import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Save, AlertTriangle, RefreshCw, CheckCircle, Database, MapPin } from 'lucide-react';
import apiService from '../../services/apiService';
import geolocationData from '../../utils/geolocation';
import StepLocation from './deployment-steps/StepLocation';
import { fetchDecryptedEnterpriseSpec } from '../../utils/enterpriseCrypto';
import { encryptAppSpec, computeRemainingExpire, fetchLatestAppSpec } from '../../utils/appSpecHelpers';
import { capacityForGeolocation, confirmFreeIpCount, fetchFluxNodes, nodeFitsApp, nodeHasRoom, occupiedIps, IP_HEADROOM, LIVE_CHECK_MARGIN } from '../../utils/nodeCapacity';

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
 * with the whole selection judged against the instance count. Changes apply after a redeploy.
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
  // The IPs the server is running on right now. Not part of the capacity judgement (that
  // stays on the whole selection, because a redeploy can move every copy), only of the
  // sentence that reconciles this screen's count with the "N other host servers" the
  // placement warning quotes: without it the customer sees two different numbers for the
  // same locations and neither explains the other.
  const [placedIps, setPlacedIps] = useState(() => new Set());

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

      // Where it actually runs — advisory, so a failed lookup just means the line is
      // not shown rather than the tab failing to load.
      try {
        setPlacedIps(occupiedIps(await apiService.getAppLocations(server.name)));
      } catch { /* non-fatal */ }

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
  // count nodes + unique IPs. No per-location gate, same reasoning as the deploy dialog:
  // FluxOS places into the pool of allowed locations, so a location's own IP count says
  // nothing on its own. The judgement is on the selection as a whole, below.
  useEffect(() => {
    const hw = hardwareRef.current;
    const isEnt = isEnterpriseRef.current;
    // Same definition of "fits" as the deploy dialog and as FluxOS itself.
    const fits = (n) => nodeFitsApp(n, hw, isEnt);

    // Mirrors the deploy dialog: each option carries how many of its unique IPs have room
    // right now, and that is the number shown beside it. A full location keeps its place in
    // the list rather than vanishing, because fullness passes and being too small does not.
    const blank = () => ({ nodeCount: 0, ips: new Set(), freeIps: new Set() });
    const add = (agg, key, n, hasRoom) => {
      if (!agg.has(key)) agg.set(key, blank());
      const a = agg.get(key);
      a.nodeCount++;
      if (!n.ip) return;
      a.ips.add(n.ip);
      if (hasRoom) a.freeIps.add(n.ip);
    };
    const byFree = (a, b) => b.freeIpCount - a.freeIpCount || b.ipCount - a.ipCount;

    const contAgg = new Map();
    const ctryAgg = new Map();
    const regAgg = new Map();
    nodes.forEach((n) => {
      if (!fits(n)) return;
      const hasRoom = nodeHasRoom(n, hw, isEnt);
      add(contAgg, n.cont, n, hasRoom);
      const key = `${n.cont}_${n.country}`;
      add(ctryAgg, key, n, hasRoom);
      if (!n.region) return;
      add(regAgg, `${key}_${n.region}`, n, hasRoom);
    });

    const continents = [];
    contAgg.forEach((v, code) => {
      if (CONTINENT_NAMES[code]) {
        continents.push({ name: CONTINENT_NAMES[code], code, nodeCount: v.nodeCount, ipCount: v.ips.size, freeIpCount: v.freeIps.size });
      }
    });
    continents.sort(byFree);
    setAvailableContinents(continents);

    if (geolocationForm.continent) {
      const countries = [];
      ctryAgg.forEach((v, key) => {
        const [cont, code] = key.split('_');
        if (cont !== geolocationForm.continent) return;
        countries.push({ code, name: getCountryName(code), nodeCount: v.nodeCount, ipCount: v.ips.size, freeIpCount: v.freeIps.size });
      });
      countries.sort(byFree);
      setAvailableCountries(countries);
    } else {
      setAvailableCountries([]);
    }

    // Regions — same US-only rule as the deploy dialog.
    if (geolocationForm.continent && REGION_PICKER_COUNTRIES.has(geolocationForm.country)) {
      const prefix = `${geolocationForm.continent}_${geolocationForm.country}_`;
      const regions = [];
      regAgg.forEach((v, key) => {
        if (!key.startsWith(prefix)) return;
        const name = key.slice(prefix.length);
        regions.push({ code: name, name, nodeCount: v.nodeCount, ipCount: v.ips.size, freeIpCount: v.freeIps.size });
      });
      regions.sort(byFree);
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
   *
   * Computed in an effect rather than a memo, like the picker options above: the plan's
   * hardware and instance count live in refs that the spec load fills in, and a ref read
   * during render is both a rules-of-React violation and a stale-value trap — the memo
   * would not recompute when the spec finally arrives.
   */
  const [selectionCapacity, setSelectionCapacity] = useState(null);
  /**
   * A count taken from the host servers themselves, for the selection named in `key`.
   * The cached one behind it can be half an hour old, which is invisible while browsing and
   * expensive at the moment of saving, so `requestSave` refreshes it and leaves the answer
   * here for the panel to show.
   */
  const [liveFree, setLiveFree] = useState(null);
  const selectionKey = useMemo(() => sortedKey(allowedLocations), [allowedLocations]);
  useEffect(() => {
    if (!nodes.length) { setSelectionCapacity(null); return; }
    const inst = instancesRef.current;
    const { candidates, nodeCount, ipCount, freeIpCount: cachedFree } = capacityForGeolocation(
      nodes, allowedLocations, hardwareRef.current, isEnterpriseRef.current,
    );
    const live = liveFree && liveFree.key === selectionKey ? liveFree.freeIpCount : null;
    const freeIpCount = live === null ? cachedFree : live;
    // Second pass, same arithmetic with the running IPs held out: how many of the host
    // servers counted above are already spent on this server. Deliberately NOT fed back
    // into the numbers above, which judge the whole selection.
    const { takenIpCount } = placedIps.size
      ? capacityForGeolocation(nodes, allowedLocations, hardwareRef.current, isEnterpriseRef.current, placedIps)
      : { takenIpCount: 0 };
    setSelectionCapacity({
      candidates, nodeCount, ipCount, freeIpCount, takenIpCount, instances: inst,
      live: live !== null,
      // Three distinct facts: cannot fit at all, fits but every node is occupied, or
      // fits with nothing to spare. The first is permanent, the other two are about now.
      short: ipCount < inst,
      full: ipCount >= inst && freeIpCount < inst,
      tight: freeIpCount < inst + IP_HEADROOM,
    });
  }, [nodes, allowedLocations, placedIps, liveFree, selectionKey]);

  /**
   * Saving a selection too small for the instance count takes a RUNNING server apart, so
   * this screen gets the same confirmation the deploy wizard puts on Continue: 'short' when
   * the selection can never hold the copies, 'full' when its host servers are occupied.
   *
   * 'full' used to be left out here, on the grounds that it passes on its own as nodes free
   * up. That reasoning holds for a server sitting happily on its nodes; it does not hold for
   * the customer on this tab, who is almost always here because the server did NOT place and
   * is being told to add locations. Saving a selection with nowhere to go leaves them exactly
   * where they started, so it is worth one question.
   */
  const [saveConfirm, setSaveConfirm] = useState(null);
  const [verifyingCapacity, setVerifyingCapacity] = useState(false);

  const handleSave = async () => {
    setSaveConfirm(null);
    setSaving(true);
    setError(null);
    setSavedOk(false);
    try {
      // Re-read the spec now: an appupdate rewrites the whole thing, so the copy loaded
      // when this tab mounted would put its own (possibly pre-renewal) expiry back on
      // chain. Also refuses outright while an update is still confirming.
      const { outer, compose, contacts, isEnterprise } = await fetchLatestAppSpec(server.name);
      if (!compose?.length) throw new Error('No current spec loaded.');
      specRef.current = outer;
      composeRef.current = compose;
      contactsRef.current = contacts;
      isEnterpriseRef.current = isEnterprise;
      instancesRef.current = outer.instances || 1;

      // Recompute expire = remaining blocks so this change does NOT extend (and thus pay for)
      // the subscription — keeps an otherwise-free geolocation update free.
      const currentHeight = await apiService.getBlockHeight();
      const remainingExpire = computeRemainingExpire(outer, currentHeight);

      const plainSpec = {
        ...outer,
        expire: remainingExpire,
        compose,
        contacts,
        geolocation: allowedLocations,
        enterprise: '',
      };

      const historyMsgs = await apiService.getAppUpdateMessages(server.name);
      const status = computeFreeUpdateStatus(historyMsgs, currentHeight);
      setLimitStatus(status);
      if (!status.free) {
        throw new Error(`Update limit reached. Please wait about ${formatWait(status.waitBlocks)} before changing settings again.`);
      }

      const finalSpec = await encryptAppSpec(plainSpec, isEnterprise);
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


  /**
   * Same check the deploy wizard runs on Continue, for the same reason: the counts on this
   * panel come from an aggregate that can be half an hour behind, and a customer who is here
   * to rescue a server that never placed must not save a selection that was full before they
   * opened the tab. Only when the answer could change — a selection with room to spare is not
   * worth the wait, and 'short' is arithmetic no live reading can move.
   */
  const requestSave = async () => {
    const cap = selectionCapacity;
    if (!cap || allowedLocations.length === 0) { handleSave(); return; }
    if (cap.short) { setSaveConfirm('short'); return; }

    if (cap.full || cap.freeIpCount - cap.instances <= LIVE_CHECK_MARGIN) {
      setVerifyingCapacity(true);
      const live = await confirmFreeIpCount(
        cap.candidates, hardwareRef.current, isEnterpriseRef.current, cap.instances,
      );
      setVerifyingCapacity(false);
      if (live) {
        // A run that stopped early stopped because it had confirmed enough; only a complete
        // sweep is an exact count, and only an exact count belongs on the panel.
        if (live.complete) setLiveFree({ key: selectionKey, freeIpCount: live.freeIpCount });
        if (live.freeIpCount < cap.instances) { setSaveConfirm('full'); return; }
        handleSave();
        return;
      }
      // Could not tell: the cached verdict stands rather than a guess being made from it.
    }
    if (cap.full) { setSaveConfirm('full'); return; }
    handleSave();
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
              These locations cover <span className="font-semibold text-white">{selectionCapacity.ipCount}</span>{' '}
              host {selectionCapacity.ipCount === 1 ? 'server' : 'servers'} able to run your plan, and your
              server runs on <span className="font-semibold text-white">{selectionCapacity.instances}</span> copies.
              Flux places each copy on a separate IP address, so host servers sharing one count once here.
            </p>
            {/* Reconciles this count with the placement warning, which only ever talks about
                the host servers still available to the copies that are missing. */}
            {selectionCapacity.takenIpCount > 0 && (
              <p className={`mt-1 ${selectionCapacity.tight ? 'text-amber-200/70' : 'text-slate-400'}`}>
                {selectionCapacity.takenIpCount === 1
                  ? '1 of them already runs a copy of your server'
                  : `${selectionCapacity.takenIpCount} of them already run copies of your server`}
                {selectionCapacity.instances > selectionCapacity.takenIpCount
                  ? `, so the ${selectionCapacity.instances - selectionCapacity.takenIpCount} still missing ${
                    selectionCapacity.instances - selectionCapacity.takenIpCount === 1
                      ? `needs one of the other ${selectionCapacity.ipCount - selectionCapacity.takenIpCount}`
                      : `need the other ${selectionCapacity.ipCount - selectionCapacity.takenIpCount}`}.`
                  : '.'}
              </p>
            )}
            {selectionCapacity.short ? (
              <p className="text-amber-200/70 mt-1">
                That is not enough to run every copy: {selectionCapacity.instances - selectionCapacity.ipCount}{' '}
                {selectionCapacity.instances - selectionCapacity.ipCount === 1 ? 'copy has' : 'copies have'} nowhere
                to go. Add another country or continent below, and your world and settings are not affected.
              </p>
            ) : selectionCapacity.full ? (
              <p className="text-amber-200/70 mt-1">
                {selectionCapacity.freeIpCount === 0
                  ? 'None of them has room for your plan right now: they are all already running other apps.'
                  : `Only ${selectionCapacity.freeIpCount} of them has room for your plan right now, so ${selectionCapacity.instances - selectionCapacity.freeIpCount} ${selectionCapacity.instances - selectionCapacity.freeIpCount === 1 ? 'copy has' : 'copies have'} nowhere to go.`}{' '}
                Add another country or continent below, and your world and settings are not affected.
              </p>
            ) : selectionCapacity.tight ? (
              <p className="text-amber-200/70 mt-1">
                {selectionCapacity.freeIpCount} of them {selectionCapacity.freeIpCount === 1 ? 'has' : 'have'} room right
                now, which leaves no spare: when one fills up with another app, a copy of your server
                has nowhere to run. Add another country or continent below, and your world and settings
                are not affected.
              </p>
            ) : null}
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
              {propagated ? 'New spec is live, ready to redeploy' : 'Detecting new spec on the network…'}
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
        onClick={requestSave}
        disabled={saving || verifyingCapacity || !dirty || !!(limitStatus && !limitStatus.free)}
        className="btn-primary w-full inline-flex items-center justify-center gap-2"
      >
        {verifyingCapacity ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Checking availability…</>
        ) : saving ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
        ) : savedOk ? (
          <><CheckCircle className="w-4 h-4" /> Saved, redeploy to apply</>
        ) : (
          <><Save className="w-4 h-4" /> Save Locations</>
        )}
      </button>

      {saveConfirm && selectionCapacity && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSaveConfirm(null)} />
          <div className="relative bg-gray-800 rounded-xl p-6 max-w-md w-full border border-amber-500/40 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-7 h-7 text-amber-400 flex-shrink-0" />
              <div className="min-w-0">
                {saveConfirm === 'short' ? (
                  <>
                    <h4 className="text-lg font-semibold text-amber-300 mb-2">
                      These locations cannot fit your server
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      They cover {selectionCapacity.ipCount} host {selectionCapacity.ipCount === 1 ? 'server' : 'servers'} able
                      to run your plan, and your server runs on {selectionCapacity.instances} copies. Saving this and
                      redeploying leaves {selectionCapacity.instances - selectionCapacity.ipCount}{' '}
                      {selectionCapacity.instances - selectionCapacity.ipCount === 1 ? 'copy' : 'copies'} with nowhere
                      to go, and that does not resolve itself with time.
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="text-lg font-semibold text-amber-300 mb-2">
                      The host servers in these locations are full right now
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {selectionCapacity.freeIpCount === 0
                        ? `None of the ${selectionCapacity.ipCount} host servers these locations cover has room for your plan at the moment.`
                        : `Only ${selectionCapacity.freeIpCount} of the ${selectionCapacity.ipCount} host servers these locations cover has room for your plan, and your server runs on ${selectionCapacity.instances} copies.`}{' '}
                      Saving this leaves your server waiting until one frees up.
                    </p>
                    {selectionCapacity.live && (
                      <p className="text-xs text-gray-500 mt-2">
                        We asked those host servers directly just now, so this is more current
                        than the counts above.
                      </p>
                    )}
                  </>
                )}
                <p className="text-sm text-gray-400 mt-3">
                  Adding another location gives it somewhere to go.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-sm text-gray-300 hover:bg-gray-700/60 transition-colors"
              >
                Save anyway
              </button>
              <button
                type="button"
                onClick={() => setSaveConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-sm font-semibold text-gray-900 hover:bg-amber-400 transition-colors"
              >
                Add another location
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-gray-400 text-xs leading-relaxed">Safe to redeploy now, and it keeps your world and data.</p>
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
                  <p className="text-gray-400 text-xs leading-relaxed">It has likely gone live. You can redeploy now; if the old config persists, wait a moment and redeploy again.</p>
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
                    <>Redeploy locked, waiting for spec…</>
                  ) : (
                    <><RefreshCw className="w-4 h-4" /> Redeploy now, keeps data</>
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
