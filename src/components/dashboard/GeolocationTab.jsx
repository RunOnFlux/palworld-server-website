import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Save, AlertTriangle, RefreshCw, CheckCircle, Database, MapPin } from 'lucide-react';
import apiService from '../../services/apiService';
import geolocationData from '../../utils/geolocation';
import StepLocation from './deployment-steps/StepLocation';
import { fetchDecryptedEnterpriseSpec } from '../../utils/enterpriseCrypto';
import { encryptAppSpec, computeRemainingExpire } from '../../utils/appSpecHelpers';
import { capacityForGeolocation, fetchFluxNodes, OS_RESERVE, IP_HEADROOM, REGION_IP_HEADROOM } from '../../utils/nodeCapacity';

// Flux free-update rate limits — mirror of EnvironmentTab / backend checkFreeAppUpdate.
// Windows are in blocks; post-PON-fork the target block time is 30s.
const SECONDS_PER_BLOCK = 30;
const FREE_UPDATE_LIMITS = [
  { blocks: 720, max: 5 },
  { blocks: 1440, max: 8 },
  { blocks: 3600, max: 10 },
];

const formatWait = (blocks) => {
  const mins = Math.max(1, Math.ceil((blocks * SECONDS_PER_BLOCK) / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const computeFreeUpdateStatus = (messages, height) => {
  const updates = (messages || [])
    .filter((m) => (m.type === 'fluxappupdate' || m.type === 'zelappupdate') && typeof m.height === 'number')
    .map((m) => m.height)
    .sort((a, b) => b - a);
  let free = true;
  let waitBlocks = 0;
  let remaining = Infinity;
  for (const { blocks, max } of FREE_UPDATE_LIMITS) {
    const inWindow = updates.filter((h) => h > height - blocks).length;
    remaining = Math.min(remaining, max - inWindow);
    if (inWindow > max) {
      free = false;
      const governing = updates[max];
      if (typeof governing === 'number') {
        waitBlocks = Math.max(waitBlocks, (governing + blocks + 1) - height);
      }
    }
  }
  return { free, waitBlocks: Math.max(0, waitBlocks), remaining: Math.max(0, remaining === Infinity ? 0 : remaining) };
};

const CONTINENT_NAMES = {
  AF: 'Africa', AS: 'Asia', EU: 'Europe',
  NA: 'North America', OC: 'Oceania', SA: 'South America',
};
// Countries where a region can be picked. The US on purpose and only the US:
// it is where distance inside one country actually costs the player latency
// (coast to coast is ~60-80ms). Elsewhere the country is a precise enough choice.
const REGION_PICKER_COUNTRIES = new Set(['US']);
// Mirrors DeploymentDialog: the country needs several viable regions before the
// picker is worth showing (the IP headroom itself lives in nodeCapacity).
const MIN_REGIONS_TO_OFFER = 2;

const sortedKey = (arr) => [...arr].sort().join('|');

/**
 * Geolocation tab — edit the allowed deploy locations of an existing instance and
 * push them on-chain with an appupdate (decrypt → set geolocation → re-encrypt for
 * enterprise apps), reusing EnvironmentTab's free-update + propagation machinery.
 * The picker offers only locations that can host THIS app: nodes are filtered by the
 * spec's summed component hardware (after the OS reserve) and arcaneVersion (enterprise),
 * and gated on unique public IPs >= instances + IP_HEADROOM. Changes apply after a redeploy.
 */
const GeolocationTab = ({ server, onUpdate, onRedeploy, onSwitchTab }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [propagated, setPropagated] = useState(false);
  const [limitStatus, setLimitStatus] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);

  // Geo picker state
  const [nodes, setNodes] = useState([]);
  const [availableContinents, setAvailableContinents] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);
  const [availableRegions, setAvailableRegions] = useState([]);
  const [geolocationForm, setGeolocationForm] = useState({ continent: '', country: '', region: '' });
  const [allowedLocations, setAllowedLocations] = useState([]);
  const [originalGeo, setOriginalGeo] = useState(''); // sorted key of the on-chain geolocation

  // Kept for the save step.
  const specRef = useRef(null);
  const composeRef = useRef(null);
  const contactsRef = useRef([]);
  const isEnterpriseRef = useRef(false);
  const instancesRef = useRef(1);
  const hardwareRef = useRef({ cpu: 0, ramGB: 0, hddGB: 0 });
  const pollRef = useRef(null);

  const getCountryName = useCallback((code) => {
    const c = geolocationData.countries.find((x) => x.code === code);
    return c ? c.name : code;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const outer = await apiService.getAppSpecs(server.name);
      if (!outer || !outer.name) throw new Error('Could not load current server spec.');

      // Enterprise iff it carries an encrypted `enterprise` blob (v8+).
      const isEnterprise = !!outer.enterprise;
      isEnterpriseRef.current = isEnterprise;

      let compose = outer.compose;
      let contacts = outer.contacts || [];
      if (isEnterprise && (!compose || compose.length === 0)) {
        const zelidauth = await apiService.getStoredAuth();
        const fluxApiBase = sessionStorage.getItem('stickyBackendDNS') || 'https://api.runonflux.io';
        const decrypted = await fetchDecryptedEnterpriseSpec(server.name, fluxApiBase, zelidauth);
        if (!decrypted?.compose?.length) throw new Error('Could not decrypt the current spec. Try again in a moment.');
        compose = decrypted.compose;
        contacts = decrypted.contacts || contacts;
      }

      specRef.current = outer;
      composeRef.current = compose;
      contactsRef.current = contacts;
      instancesRef.current = outer.instances || 1;

      // Per-node hardware the app needs = sum of every compose component (ram MB → GB).
      let cpu = 0, ramMb = 0, hdd = 0;
      (compose || []).forEach((c) => {
        cpu += Number(c.cpu) || 0;
        ramMb += Number(c.ram) || 0;
        hdd += Number(c.hdd) || 0;
      });
      hardwareRef.current = { cpu, ramGB: ramMb / 1000, hddGB: hdd };

      const current = Array.isArray(outer.geolocation) ? outer.geolocation : [];
      setOriginalGeo(sortedKey(current));
      setAllowedLocations(current);

      // Nodes for the picker (enterprise apps need arcaneVersion → the flux projection).
      // Shared, session-cached fetch: the placement diagnosis pulls the same multi-MB list.
      setNodes(await fetchFluxNodes());

      // Free-update rate-limit status — non-fatal.
      try {
        const [msgs, h] = await Promise.all([
          apiService.getAppUpdateMessages(server.name),
          apiService.getBlockHeight(),
        ]);
        if (h) setLimitStatus(computeFreeUpdateStatus(msgs, h));
      } catch { /* non-fatal */ }
    } catch (e) {
      setError(e.message || 'Failed to load locations.');
    } finally {
      setLoading(false);
    }
  }, [server.name]);

  useEffect(() => { load(); }, [load]);

  // Build the selectable continents/countries: filter nodes by hardware + arcane, then
  // count nodes + unique IPs and gate on unique IPs >= instances + headroom (same rule as
  // the deploy dialog — a location sized exactly to the instance count has no room for a
  // node that is already full).
  useEffect(() => {
    const { cpu, ramGB, hddGB } = hardwareRef.current;
    const inst = instancesRef.current;
    const isEnt = isEnterpriseRef.current;
    const fits = (n) =>
      (n.cores - OS_RESERVE.cores) >= cpu &&
      (n.ram - OS_RESERVE.ram) >= ramGB &&
      (n.ssd - OS_RESERVE.ssd) >= hddGB &&
      (!isEnt || n.arcane);

    const contAgg = new Map();
    const ctryAgg = new Map();
    const regAgg = new Map();
    nodes.forEach((n) => {
      if (!fits(n)) return;
      if (!contAgg.has(n.cont)) contAgg.set(n.cont, { nodeCount: 0, ips: new Set() });
      const c = contAgg.get(n.cont);
      c.nodeCount++; if (n.ip) c.ips.add(n.ip);
      const key = `${n.cont}_${n.country}`;
      if (!ctryAgg.has(key)) ctryAgg.set(key, { nodeCount: 0, ips: new Set() });
      const cc = ctryAgg.get(key);
      cc.nodeCount++; if (n.ip) cc.ips.add(n.ip);
      if (!n.region) return;
      const regKey = `${key}_${n.region}`;
      if (!regAgg.has(regKey)) regAgg.set(regKey, { nodeCount: 0, ips: new Set() });
      const rr = regAgg.get(regKey);
      rr.nodeCount++; if (n.ip) rr.ips.add(n.ip);
    });

    const continents = [];
    contAgg.forEach((v, code) => {
      const ipCount = v.ips.size;
      if (ipCount >= inst + IP_HEADROOM && CONTINENT_NAMES[code]) {
        continents.push({ name: CONTINENT_NAMES[code], code, nodeCount: v.nodeCount, ipCount });
      }
    });
    continents.sort((a, b) => b.ipCount - a.ipCount);
    setAvailableContinents(continents);

    if (geolocationForm.continent) {
      const countries = [];
      ctryAgg.forEach((v, key) => {
        const [cont, code] = key.split('_');
        if (cont !== geolocationForm.continent) return;
        const ipCount = v.ips.size;
        if (ipCount >= inst + IP_HEADROOM) countries.push({ code, name: getCountryName(code), nodeCount: v.nodeCount, ipCount });
      });
      countries.sort((a, b) => b.ipCount - a.ipCount);
      setAvailableCountries(countries);
    } else {
      setAvailableCountries([]);
    }

    // Regions — same US-only rule and IP headroom as the deploy dialog.
    if (geolocationForm.continent && REGION_PICKER_COUNTRIES.has(geolocationForm.country)) {
      const prefix = `${geolocationForm.continent}_${geolocationForm.country}_`;
      const regions = [];
      regAgg.forEach((v, key) => {
        if (!key.startsWith(prefix)) return;
        const ipCount = v.ips.size;
        if (ipCount >= inst + REGION_IP_HEADROOM) {
          const name = key.slice(prefix.length);
          regions.push({ code: name, name, nodeCount: v.nodeCount, ipCount });
        }
      });
      regions.sort((a, b) => b.ipCount - a.ipCount);
      setAvailableRegions(regions.length >= MIN_REGIONS_TO_OFFER ? regions : []);
    } else {
      setAvailableRegions([]);
    }
  }, [nodes, geolocationForm.continent, geolocationForm.country, getCountryName]);

  const watchPropagation = useCallback((targetHash) => {
    if (!targetHash) return;
    clearInterval(pollRef.current);
    setPropagating(true);
    setPropagated(false);
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks += 1;
      try {
        const spec = await apiService.getAppSpecs(server.name);
        if (spec?.hash === targetHash) {
          if (specRef.current) specRef.current.hash = spec.hash;
          clearInterval(pollRef.current);
          setPropagating(false);
          setPropagated(true);
          return;
        }
      } catch { /* transient */ }
      if (ticks >= 45) {
        clearInterval(pollRef.current);
        setPropagating(false);
      }
    }, 20000);
  }, [server.name]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ── Picker handlers (mirror the deploy dialog) ──
  const formatLocationLabel = useCallback((geoCode) => {
    const code = geoCode.replace(/^ac/, '');
    const parts = code.split('_');
    if (parts.length === 1) return CONTINENT_NAMES[parts[0]] || parts[0];
    const continent = CONTINENT_NAMES[parts[0]] || parts[0];
    if (parts.length === 2) return `${getCountryName(parts[1])} (${continent})`;
    // Region names can contain "_" — rejoin everything past the country.
    return `${parts.slice(2).join('_')}, ${getCountryName(parts[1])}`;
  }, [getCountryName]);

  const getFlagIcon = useCallback((code) => `flag:${code.toLowerCase()}-4x3`, []);

  const handleAddLocation = useCallback(() => {
    if (!geolocationForm.continent) { toast.error('Please select a continent'); return; }
    let geoCode = `ac${geolocationForm.continent}`;
    if (geolocationForm.country) {
      geoCode += `_${geolocationForm.country}`;
      if (geolocationForm.region) geoCode += `_${geolocationForm.region}`;
    }
    setAllowedLocations((prev) => {
      if (prev.includes(geoCode)) return prev;
      // A broader location absorbs anything nested inside it.
      if (!geolocationForm.country || !geolocationForm.region) {
        const prefix = `${geoCode}_`;
        return [...prev.filter((code) => !code.startsWith(prefix)), geoCode];
      }
      return [...prev, geoCode];
    });
    setSavedOk(false);
    setGeolocationForm({ continent: '', country: '', region: '' });
  }, [geolocationForm]);

  const handleRemoveLocation = useCallback((geoCode) => {
    setAllowedLocations((prev) => prev.filter((code) => code !== geoCode));
    setSavedOk(false);
  }, []);

  const dirty = useMemo(() => sortedKey(allowedLocations) !== originalGeo, [allowedLocations, originalGeo]);

  /**
   * How much room the CURRENT selection leaves — recomputed as the customer edits, so
   * adding a location visibly moves the number. Compared against the instance count
   * because FluxOS places one instance per unique public IP.
   */
  const selectionCapacity = useMemo(() => {
    if (!nodes.length) return null;
    const inst = instancesRef.current;
    const { nodeCount, ipCount } = capacityForGeolocation(
      nodes, allowedLocations, hardwareRef.current, isEnterpriseRef.current,
    );
    return { nodeCount, ipCount, instances: inst, tight: ipCount < inst + IP_HEADROOM };
  }, [nodes, allowedLocations]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedOk(false);
    try {
      const outer = specRef.current;
      const compose = composeRef.current;
      if (!outer || !compose?.length) throw new Error('No current spec loaded.');

      // Recompute expire = remaining blocks so this change does NOT extend (and thus pay for)
      // the subscription — keeps an otherwise-free geolocation update free.
      const currentHeight = await apiService.getBlockHeight();
      const remainingExpire = computeRemainingExpire(outer, currentHeight);

      const plainSpec = {
        ...outer,
        expire: remainingExpire,
        compose,
        contacts: contactsRef.current,
        geolocation: allowedLocations,
        enterprise: '',
      };

      const historyMsgs = await apiService.getAppUpdateMessages(server.name);
      const status = computeFreeUpdateStatus(historyMsgs, currentHeight);
      setLimitStatus(status);
      if (!status.free) {
        throw new Error(`Update limit reached. Please wait about ${formatWait(status.waitBlocks)} before changing settings again.`);
      }

      const finalSpec = await encryptAppSpec(plainSpec, isEnterpriseRef.current);
      const newHash = await apiService.updateAppSpecification(finalSpec);

      setOriginalGeo(sortedKey(allowedLocations));
      setSavedOk(true);
      setApplyOpen(true);
      if (onUpdate) onUpdate();
      watchPropagation(newHash);
    } catch (e) {
      setError(e.message || 'Failed to update locations.');
      toast.error(e.message || 'Failed to update locations');
    } finally {
      setSaving(false);
    }
  };

  const handleRedeployClick = () => {
    if (propagating || !onRedeploy) return;
    setApplyOpen(false);
    setPropagated(false);
    setPropagating(false);
    onRedeploy();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-400">Loading locations…</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {selectionCapacity && allowedLocations.length > 0 && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          selectionCapacity.tight
            ? 'border-amber-500/30 bg-amber-500/[0.08]'
            : 'border-gray-700/50 bg-gray-800/40'
        }`}>
          <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selectionCapacity.tight ? 'text-amber-400' : 'text-gray-400'}`} />
          <div className="min-w-0 text-xs leading-relaxed">
            <p className={selectionCapacity.tight ? 'text-amber-200/90' : 'text-slate-300'}>
              These locations match <span className="font-semibold text-white">{selectionCapacity.nodeCount}</span>{' '}
              {selectionCapacity.nodeCount === 1 ? 'node' : 'nodes'} able to run your plan
              ({selectionCapacity.ipCount} unique {selectionCapacity.ipCount === 1 ? 'IP' : 'IPs'}),
              and your server needs <span className="font-semibold text-white">{selectionCapacity.instances}</span>.
            </p>
            {selectionCapacity.tight && (
              <p className="text-amber-200/70 mt-1">
                That leaves no spare capacity: when those nodes fill up with other apps, your
                server has nowhere to run. Add another country or continent below — your world
                and settings are not affected.
              </p>
            )}
          </div>
        </div>
      )}

      {limitStatus && (limitStatus.free ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span className="text-xs text-slate-300 truncate">Configuration changes available</span>
          </div>
          <span className="flex-shrink-0 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
            {limitStatus.remaining} left
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span className="text-xs text-amber-200/90 truncate">Update limit reached</span>
          </div>
          <span className="flex-shrink-0 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 whitespace-nowrap">
            wait ~{formatWait(limitStatus.waitBlocks)}
          </span>
        </div>
      ))}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!applyOpen && (propagating || propagated) && (
        <button
          type="button"
          onClick={() => setApplyOpen(true)}
          className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 border transition-colors ${
            propagated
              ? 'border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.1]'
              : 'border-blue-500/25 bg-blue-500/[0.06] hover:bg-blue-500/[0.1]'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {propagated ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            ) : (
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-400" />
              </span>
            )}
            <span className={`text-xs truncate ${propagated ? 'text-emerald-300' : 'text-blue-300'}`}>
              {propagated ? 'New spec is live — ready to redeploy' : 'Detecting new spec on the network…'}
            </span>
          </span>
          <span className={`flex-shrink-0 text-xs font-semibold rounded-full px-2.5 py-0.5 border ${
            propagated
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
              : 'text-blue-300 bg-blue-500/10 border-blue-500/30'
          }`}>
            {propagated ? 'Redeploy' : 'Open'}
          </span>
        </button>
      )}

      <StepLocation
        geolocationForm={geolocationForm}
        onGeolocationFormChange={setGeolocationForm}
        availableContinents={availableContinents}
        availableCountries={availableCountries}
        availableRegions={availableRegions}
        allowedLocations={allowedLocations}
        onAddLocation={handleAddLocation}
        onRemoveLocation={handleRemoveLocation}
        formatLocationLabel={formatLocationLabel}
        getFlagIcon={getFlagIcon}
        showNav={false}
      />

      {/* Backup reminder — always visible, right above the button that commits a relocation. */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
          <div className="text-xs leading-relaxed text-amber-200/90">
            <p className="font-semibold text-amber-300">Back up your server before changing location</p>
            <p>
              Moving to a new region redeploys your server on different Flux nodes, so any data
              that isn’t backed up may be permanently lost. Create a backup and{' '}
              <strong>download it to your device</strong> first.
            </p>
          </div>
        </div>
        {onSwitchTab && (
          <button
            type="button"
            onClick={() => onSwitchTab('backup')}
            className="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" /> Open Backup
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty || !!(limitStatus && !limitStatus.free)}
        className="btn-primary w-full inline-flex items-center justify-center gap-2"
      >
        {saving ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
        ) : savedOk ? (
          <><CheckCircle className="w-4 h-4" /> Saved — redeploy to apply</>
        ) : (
          <><Save className="w-4 h-4" /> Save Locations</>
        )}
      </button>

      {applyOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setApplyOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-gray-700/60">
            <div style={{ height: '3px', background: propagated ? 'linear-gradient(90deg,#2196F3,#1666A5)' : 'linear-gradient(90deg,#3b82f6,#2563eb)' }} />
            <div className="bg-gradient-to-b from-gray-800/95 to-gray-900/95 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={propagated
                    ? { background: 'rgba(33,150,243,0.1)', border: '1px solid rgba(33,150,243,0.25)' }
                    : { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)' }}
                >
                  {propagated
                    ? <CheckCircle className="w-5 h-5 text-primary" />
                    : <RefreshCw className={`w-5 h-5 text-blue-400 ${propagating ? 'animate-spin' : ''}`} />}
                </div>
                <div>
                  <p className="font-bold text-base text-white">Applying changes</p>
                  <p className="text-xs mt-0.5 text-gray-500">Locations saved to the app spec</p>
                </div>
              </div>

              {propagated ? (
                <div className="rounded-xl p-3.5 mb-5" style={{ background: 'rgba(33,150,243,0.07)', border: '1px solid rgba(33,150,243,0.2)' }}>
                  <p className="font-semibold text-sm mb-0.5 text-primary">New spec is live on the network</p>
                  <p className="text-gray-400 text-xs leading-relaxed">Safe to redeploy now — this keeps your world and data.</p>
                </div>
              ) : propagating ? (
                <div className="rounded-xl p-3.5 mb-5 flex items-start gap-3" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <span className="relative flex h-2.5 w-2.5 flex-shrink-0 mt-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-400" />
                  </span>
                  <div>
                    <p className="font-semibold text-sm mb-0.5 text-blue-300">Detecting the new spec on the network…</p>
                    <p className="text-gray-400 text-xs leading-relaxed">Redeploy is locked until the update goes live.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-3.5 mb-5" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="font-semibold text-sm mb-0.5 text-amber-300">Couldn’t confirm automatically</p>
                  <p className="text-gray-400 text-xs leading-relaxed">It has likely gone live. You can redeploy — if the old config persists, wait a bit and redeploy again.</p>
                </div>
              )}

              {onRedeploy && (
                <button
                  type="button"
                  onClick={handleRedeployClick}
                  disabled={propagating}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                    propagating
                      ? 'bg-gray-700/40 text-gray-500 border border-gray-600/30 cursor-not-allowed'
                      : 'text-white'
                  }`}
                  style={!propagating
                    ? { background: 'linear-gradient(90deg,#2196F3,#1B7AC7)', boxShadow: '0 4px 12px rgba(33,150,243,0.3)' }
                    : undefined}
                >
                  {propagating ? (
                    <>Redeploy locked — waiting for spec…</>
                  ) : (
                    <><RefreshCw className="w-4 h-4" /> Redeploy now — keeps data</>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setApplyOpen(false)}
                className="w-full mt-3 rounded-xl py-2.5 text-sm font-medium text-gray-300 border border-gray-700/60 bg-gray-800/40 hover:bg-gray-700/50 hover:text-white transition-colors"
              >
                {propagated ? 'Close' : 'Continue in background'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeolocationTab;
