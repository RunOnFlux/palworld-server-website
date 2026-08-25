import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Save, AlertTriangle, RefreshCw, CheckCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import apiService from '../../services/apiService';
import marketplaceService from '../../services/marketplaceService';
import CustomSelect from '../common/CustomSelect';
import AutoRestartFields from './AutoRestartFields';
import { fetchDecryptedEnterpriseSpec } from '../../utils/enterpriseCrypto';
import { encryptAppSpec, mergeInlineEnv, parseEnvArray, computeRemainingExpire, fetchLatestAppSpec } from '../../utils/appSpecHelpers';
import {
  parseRebootEnv,
  buildRebootEnv,
  findPendingUpdates,
  standardUpdatePatch,
  standardImagePatch,
  imageNeedsUpdate,
  imageIsSelfAuthenticating,
} from '../../config/serverMaintenance';

// Flux free-update rate limits — mirror of backend checkFreeAppUpdate. Windows are in
// blocks; post-PON-fork the target block time is 30s.
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

// Normalize a marketplace userEnvironmentParameter into a render descriptor. The API
// (parameterConfig) is the source of truth for control type / values / default / help.
const toField = (p) => {
  const pc = p.parameterConfig || {};
  const values = p.values || pc.values || null;
  return {
    name: p.name,
    label: p.label || p.name,
    optional: p.optional ?? !p.required,
    advanced: !!p.advanced,
    values: Array.isArray(values) && values.length ? values : null,
    defaultValue: p.defaultValue ?? pc.defaultValue ?? '',
    description: p.description || pc.description || '',
  };
};

const valuesKey = (obj) => JSON.stringify(obj);

/**
 * Environment tab — edit the registration-time env vars of an existing instance and
 * push them on-chain with an appupdate, reusing the same free-update + propagation
 * machinery as the Location tab. Fields are driven directly by the marketplace app's
 * userEnvironmentParameters (no game-specific config). For enterprise apps: decrypt
 * current spec → merge edits → re-encrypt; for standard apps the compose stays plain.
 * Changes apply after a redeploy.
 */
const EnvironmentTab = ({ server, onUpdate, onRedeploy, onStandardEnvChange }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [propagated, setPropagated] = useState(false);
  const [limitStatus, setLimitStatus] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [originalValues, setOriginalValues] = useState('');

  // Scheduled restarts (env vars read by the container's cron) and the list of
  // standard settings this server was deployed before we started shipping.
  const [rebootSettings, setRebootSettings] = useState(null);
  const [originalReboot, setOriginalReboot] = useState('');
  const [missingStandard, setMissingStandard] = useState([]);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  // Held in a ref so a parent that re-creates the callback each render can't
  // retrigger load() (which would refetch the spec in a loop).
  const standardEnvCbRef = useRef(onStandardEnvChange);
  useEffect(() => { standardEnvCbRef.current = onStandardEnvChange; }, [onStandardEnvChange]);

  const specRef = useRef(null);
  const composeRef = useRef(null);
  const contactsRef = useRef([]);
  const isEnterpriseRef = useRef(false);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Field definitions from the marketplace app (same source as the deploy form).
      let userParams = [];
      try {
        const plans = await marketplaceService.getServerPlans();
        userParams = plans?.[0]?._app?.compose?.[0]?.userEnvironmentParameters || [];
      } catch { /* fall back to whatever the current env exposes */ }

      // 2. Current spec (outer) + decrypt compose if enterprise.
      const outer = await apiService.getAppSpecs(server.name);
      if (!outer || !outer.name) throw new Error('Could not load current server spec.');

      const isEnterprise = !!outer.enterprise;
      isEnterpriseRef.current = isEnterprise;

      let compose = outer.compose;
      let contacts = outer.contacts || [];
      if (isEnterprise && (!compose || compose.length === 0)) {
        const zelidauth = await apiService.getStoredAuth();
        const fluxApiBase = sessionStorage.getItem('stickyBackendDNS') || 'https://api.runonflux.io';
        const decrypted = await fetchDecryptedEnterpriseSpec(server.name, fluxApiBase, zelidauth);
        if (!decrypted?.compose?.length) throw new Error('Could not decrypt the current environment. Try again in a moment.');
        compose = decrypted.compose;
        contacts = decrypted.contacts || contacts;
      }

      specRef.current = outer;
      composeRef.current = compose;
      contactsRef.current = contacts;

      const currentEnv = parseEnvArray(compose?.[0]?.environmentParameters);

      const builtFields = (userParams || []).filter((p) => p && p.name).map(toField);
      const initial = {};
      for (const f of builtFields) {
        initial[f.name] = currentEnv[f.name] ?? f.defaultValue ?? '';
      }
      setFields(builtFields);
      setValues(initial);
      setOriginalValues(valuesKey(initial));

      const reboot = parseRebootEnv(currentEnv);
      setRebootSettings(reboot);
      setOriginalReboot(valuesKey(reboot));

      const missing = findPendingUpdates(compose);
      setMissingStandard(missing);
      standardEnvCbRef.current?.(missing.length);

      // Free-update rate-limit status — non-fatal.
      try {
        const [msgs, h] = await Promise.all([
          apiService.getAppUpdateMessages(server.name),
          apiService.getBlockHeight(),
        ]);
        if (h) setLimitStatus(computeFreeUpdateStatus(msgs, h));
      } catch { /* non-fatal */ }
    } catch (e) {
      setError(e.message || 'Failed to load environment.');
    } finally {
      setLoading(false);
    }
  }, [server.name]);

  useEffect(() => { load(); }, [load]);

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

  const onChange = (name, value) => {
    setSavedOk(false);
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const onRebootChange = (next) => {
    setSavedOk(false);
    setRebootSettings(next);
  };

  const rebootDirty = useMemo(
    () => !!rebootSettings && valuesKey(rebootSettings) !== originalReboot,
    [rebootSettings, originalReboot],
  );
  const dirty = useMemo(
    () => valuesKey(values) !== originalValues || rebootDirty,
    [values, originalValues, rebootDirty],
  );

  /**
   * Push the env to the chain. `extraEnv` carries the standard-settings patch when the
   * customer accepts the update banner. The restart vars are only written when they were
   * actually touched (or patched), so saving an unrelated field never quietly adds
   * settings to a server the customer never configured.
   */
  const handleSave = async (extraEnv = null, { imageUpdate = false } = {}) => {
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

      // The image and the env travel together: the plain cron line the standard patch
      // writes only authenticates on the new image, so a spec write that moved one
      // without the other would turn a customer's nightly restart off silently.
      const wantsImage = imageUpdate && imageNeedsUpdate(compose);
      const targetCompose = wantsImage ? standardImagePatch(compose) : compose;

      // Merge edits over the existing env (preserves fixed params like PORT/SERVERNAME).
      const currentEnvArray = compose[0].environmentParameters || [];
      // Restart edits come last: if the customer tweaked the schedule and then accepted
      // the update banner in the same visit, their hour must win over the patch default.
      // The schedule is written for the image the server will be running once this
      // lands, not the one it is running now.
      const edits = {
        ...values,
        ...(extraEnv || {}),
        ...(rebootDirty && rebootSettings
          ? buildRebootEnv(rebootSettings, { selfAuthenticating: imageIsSelfAuthenticating(targetCompose) })
          : {}),
      };
      const mergedEnv = mergeInlineEnv(currentEnvArray, edits);
      const newCompose = targetCompose.map((c, i) => (i === 0 ? { ...c, environmentParameters: mergedEnv } : c));

      // Recompute expire = remaining blocks so this change doesn't extend (and thus charge for)
      // the subscription — keeps an otherwise-free env update free.
      const currentHeight = await apiService.getBlockHeight();
      const remainingExpire = computeRemainingExpire(outer, currentHeight);

      const plainSpec = {
        ...outer,
        expire: remainingExpire,
        compose: newCompose,
        contacts,
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

      // The saved spec is the new baseline: a second save must merge on top of what we
      // just wrote, and the "update available" banner must reflect it without a reload.
      composeRef.current = newCompose;
      const savedEnv = parseEnvArray(mergedEnv);
      const stillMissing = findPendingUpdates(newCompose);
      setMissingStandard(stillMissing);
      standardEnvCbRef.current?.(stillMissing.length);
      const savedReboot = parseRebootEnv(savedEnv);
      setRebootSettings(savedReboot);
      setOriginalReboot(valuesKey(savedReboot));

      setOriginalValues(valuesKey(values));
      setSavedOk(true);
      setApplyOpen(true);
      if (onUpdate) onUpdate();
      watchPropagation(newHash);
    } catch (e) {
      setError(e.message || 'Failed to update environment.');
      toast.error(e.message || 'Failed to update environment');
    } finally {
      setSaving(false);
    }
  };

  /**
   * One-click "bring this server up to date": the image, plus only the standard
   * settings this server is missing or has at a stale value. Everything else is left
   * alone, and both halves go on chain in the same update.
   */
  const handleApplyUpdate = async () => {
    const patch = standardUpdatePatch(composeRef.current);
    if (!Object.keys(patch.env).length && !patch.compose) return;
    setApplyingUpdate(true);
    try {
      await handleSave(patch.env, { imageUpdate: !!patch.compose });
    } finally {
      setApplyingUpdate(false);
    }
  };

  const handleRedeployClick = () => {
    if (propagating || !onRedeploy) return;
    setApplyOpen(false);
    setPropagated(false);
    setPropagating(false);
    onRedeploy();
  };

  const regular = fields.filter((f) => !f.advanced);
  const advanced = fields.filter((f) => f.advanced);

  const renderField = (f) => (
    <div key={f.name} className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-xl p-4">
      <label htmlFor={f.name} className="block text-sm font-semibold text-white mb-2">
        {f.label}
        {f.optional && <span className="ml-2 text-xs text-gray-500 font-normal">(Optional)</span>}
      </label>
      {f.values ? (
        <CustomSelect
          id={f.name}
          value={values[f.name] || ''}
          onChange={(e) => onChange(f.name, e.target.value)}
          options={f.values.map((v) => ({ value: v, label: v }))}
          placeholder={f.defaultValue ? `Default (${f.defaultValue})` : `Select ${f.label}`}
          className="w-full"
        />
      ) : (
        <input
          id={f.name}
          type="text"
          value={values[f.name] || ''}
          onChange={(e) => onChange(f.name, e.target.value)}
          placeholder={f.defaultValue ? String(f.defaultValue) : ''}
          className="input w-full"
        />
      )}
      {f.description && (
        <p className="text-xs text-gray-400 mt-2 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{f.description}</span>
        </p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-400">Loading environment…</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
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

      {missingStandard.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.07] p-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-500/10 border border-blue-500/25 rounded-lg p-2 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-200">Server update available</p>
              <p className="text-xs text-gray-400 mt-1">
                Your server predates {missingStandard.length}{' '}
                {missingStandard.length === 1 ? 'improvement' : 'improvements'} we now ship with every
                Palworld server. Applying {missingStandard.length === 1 ? 'it' : 'them'} leaves it exactly
                as a server bought today, and changes nothing about your world, your settings or your
                server address.
              </p>
              <ul className="mt-3 space-y-1.5">
                {missingStandard.map((item) => (
                  <li key={item.key} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="text-blue-400 mt-[3px]">•</span>
                    <span>
                      <span className="font-semibold text-white">{item.label}</span>
                      {item.reason === 'outdated' && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-300">needs update</span>
                      )}
                      <span className="block text-gray-400">
                        {item.reason === 'outdated' && item.updateDescription
                          ? item.updateDescription
                          : item.description}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleApplyUpdate}
                disabled={saving || applyingUpdate || !!(limitStatus && !limitStatus.free)}
                className="btn-primary mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
              >
                {applyingUpdate ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Updating…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Update my server</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {rebootSettings && (
        <AutoRestartFields settings={rebootSettings} onChange={onRebootChange} />
      )}

      <div className="space-y-3">
        {regular.map(renderField)}
      </div>

      {advanced.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between rounded-xl border border-gray-700/50 bg-gray-800/40 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800/70 transition-colors"
          >
            <span>Advanced options ({advanced.length})</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAdvanced && advanced.map(renderField)}
        </div>
      )}

      {fields.length === 0 && !rebootSettings && (
        <p className="text-sm text-slate-400 text-center py-6">This server has no user-configurable environment variables.</p>
      )}

      {(fields.length > 0 || rebootSettings) && (
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving || !dirty || !!(limitStatus && !limitStatus.free)}
          className="btn-primary w-full inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
          ) : savedOk ? (
            <><CheckCircle className="w-4 h-4" /> Saved — redeploy to apply</>
          ) : (
            <><Save className="w-4 h-4" /> Save Environment</>
          )}
        </button>
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
                  <p className="text-xs mt-0.5 text-gray-500">Environment saved to the app spec</p>
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

export default EnvironmentTab;
