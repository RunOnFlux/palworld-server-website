import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package, X, Loader2, AlertTriangle, ExternalLink, RefreshCw,
  CheckCircle, Download, Upload, Wrench,
} from 'lucide-react';
import secureStorage from '../../utils/secureStorage';
import apiService from '../../services/apiService';
import { computeRemainingExpire } from '../../utils/appSpecHelpers';
import { MODS_VOLUME_PATH, MOD_CATALOG, fileNameFromUrl, withModsMount } from '../../config/modsConfig';

/**
 * Palworld Mod Manager.
 *
 * Palworld has no Steam Workshop — mods are `.pak` files installed into the server's
 * `~mods` folder via the Flux node file-manager API. Upload as many as you like, but
 * only ONE can be active at a time: the active mod is `<name>.pak`, others are kept as
 * `<name>.pak.disabled` (Unreal only loads `.pak`). Enabling one disables the rest.
 * Enable/disable is a fast rename; a restart applies it in-game.
 *
 * Props: { server, masterLocation, onMasterError }
 */
export default function ModManager({ server, masterLocation, onMasterError, onRedeploy }) {
  const [installed, setInstalled] = useState([]);          // [{ name, displayName, enabled, size }]
  const [mountMissing, setMountMissing] = useState(false); // server predates the ~mods mount
  const [enableState, setEnableState] = useState('idle');    // 'idle' | 'propagating' | 'live' | 'timeout'
  const enablePollRef = useRef(null);
  const enableOldHashRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');                    // filename currently being worked on
  const [step, setStep] = useState('');                    // 'downloading' | 'uploading' | 'removing' | 'toggling' | 'restarting' | 'enabling'
  const [needsRestart, setNeedsRestart] = useState(false); // a toggle changed — restart to apply
  const fileInputRef = useRef(null);

  const selectedComponent = server?.version >= 4 && server?.compose?.length > 0
    ? server.compose[0].name
    : 'null';

  const nodeBase = useCallback(() => {
    if (!masterLocation?.ip) return null;
    const [host, port = 16127] = masterLocation.ip.split(':');
    return `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io`;
  }, [masterLocation]);

  const auth = useCallback(async () => {
    const zelidauth = await secureStorage.getItem('zelidauth');
    if (!zelidauth) throw new Error('Not authenticated. Please re-login.');
    return JSON.stringify(zelidauth);
  }, []);

  // --- list what's already in ~mods (enabled + disabled) ---
  const loadInstalled = useCallback(async () => {
    const base = nodeBase();
    if (!base) return;
    setLoading(true);
    setError('');
    try {
      const authHeader = await auth();
      const apiUrl = `${base}/apps/getfolderinfo/${server.name}/${selectedComponent}/${encodeURIComponent(MODS_VOLUME_PATH)}`;
      const res = await fetch(apiUrl, {
        headers: { zelidauth: authHeader, 'x-apicache-bypass': true },
      });
      if (!res.ok) throw new Error('Failed to read mods folder');
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.data)) {
        setMountMissing(false);
        // A mod is enabled when its file ends in `.pak`; disabled mods are kept as
        // `<name>.pak.disabled` (Unreal only loads `.pak`, so `.disabled` is ignored).
        const paks = data.data
          .filter((f) => /\.pak(\.disabled)?$/i.test(f.name))
          .map((f) => ({
            name: f.name,                                    // actual file name on disk
            displayName: f.name.replace(/\.disabled$/i, ''), // shown to the user
            enabled: !/\.disabled$/i.test(f.name),
            size: f.size,
          }));
        setInstalled(paks);
      } else {
        // Reachable response but no folder → the `mods` mount isn't on this server.
        setMountMissing(true);
        setInstalled([]);
      }
    } catch (err) {
      if (err instanceof TypeError) onMasterError?.();
      setInstalled([]);
    } finally {
      setLoading(false);
    }
  }, [nodeBase, auth, server?.name, selectedComponent, onMasterError]);

  useEffect(() => { loadInstalled(); }, [loadInstalled]);

  // List the mod files (.pak / .pak.disabled) currently in ~mods.
  const listMods = useCallback(async (base, authHeader) => {
    const res = await fetch(`${base}/apps/getfolderinfo/${server.name}/${selectedComponent}/${encodeURIComponent(MODS_VOLUME_PATH)}`,
      { headers: { zelidauth: authHeader, 'x-apicache-bypass': true } });
    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.data)) {
      return data.data.filter((f) => /\.pak(\.disabled)?$/i.test(f.name)).map((f) => f.name);
    }
    return [];
  }, [server?.name, selectedComponent]);

  const renameObj = useCallback(async (base, authHeader, from, to) => {
    if (from === to) return;
    const oldPath = `${MODS_VOLUME_PATH}/${from}`;
    const res = await fetch(`${base}/apps/renameobject/${server.name}/${selectedComponent}/${encodeURIComponent(oldPath)}/${to}`,
      { headers: { zelidauth: authHeader } });
    if (!res.ok) throw new Error(`Rename failed (HTTP ${res.status})`);
  }, [server?.name, selectedComponent]);

  // --- add a .pak to ~mods as DISABLED, then refresh ---
  // New mods are added OFF so they don't disturb the currently-active mod (only one runs
  // at a time) and no restart is needed until the user turns one On.
  const uploadPakToMods = useCallback(async (name, blob) => {
    const base = nodeBase();
    if (!base) { setError('Server location not available yet.'); return; }
    if (!/\.pak$/i.test(name)) { setError('Please choose a .pak file.'); return; }
    if (blob.size === 0) { setError('The file is empty (0 bytes) — the download may have failed. Re-download the .pak and try again.'); return; }
    const disabledName = `${name}.disabled`;
    setBusy(name);
    try {
      const authHeader = await auth();

      // Ensure the ~mods folder exists (ignore "already exists").
      try {
        await fetch(`${base}/apps/createfolder/${server.name}/${selectedComponent}/${encodeURIComponent(MODS_VOLUME_PATH)}`,
          { headers: { zelidauth: authHeader } });
      } catch { /* ignore */ }

      // Upload the pak as `<name>.pak.disabled` — the running server is untouched.
      setStep('uploading');
      const uploadUrl = `${base}/ioutils/fileupload/volume/${server.name}/${selectedComponent}/${encodeURIComponent(MODS_VOLUME_PATH)}`;
      const formData = new FormData();
      formData.append(disabledName, blob, disabledName);
      const up = await fetch(uploadUrl, { method: 'POST', headers: { zelidauth: authHeader }, body: formData });
      if (!up.ok) {
        const text = await up.text().catch(() => '');
        throw new Error(text || `Upload failed (HTTP ${up.status})`);
      }

      setNotice(`Added "${name}" (Off). Turn it On below to use it — that swaps the active mod and needs a restart.`);
      await loadInstalled();
    } catch (err) {
      if (err instanceof TypeError) onMasterError?.();
      setError(err.message);
    } finally {
      setBusy('');
      setStep('');
    }
  }, [nodeBase, auth, server?.name, selectedComponent, onMasterError, loadInstalled]);

  // --- install a .pak from a direct URL (proxied download → shared upload) ---
  // Only used by DIRECT catalog entries (those with a downloadUrl).
  const install = useCallback(async (downloadUrl, fileName) => {
    setError('');
    setNotice('');
    if (!downloadUrl) { setError('This catalog entry has no direct link — use its “Browse” button, download the .pak, then use “Upload from PC”.'); return; }
    const name = fileName || fileNameFromUrl(downloadUrl);
    if (!name) { setError('Could not determine a .pak filename from the URL.'); return; }
    if (!nodeBase()) { setError('Server location not available yet.'); return; }

    setBusy(name);
    try {
      setStep('downloading');
      const dl = await fetch(`/api/mod-download?url=${encodeURIComponent(downloadUrl)}`);
      if (!dl.ok) {
        const j = await dl.json().catch(() => ({}));
        throw new Error(j.error || `Download failed (HTTP ${dl.status})`);
      }
      const blob = await dl.blob();
      await uploadPakToMods(name, blob);
    } catch (err) {
      if (err instanceof TypeError) onMasterError?.();
      setError(err.message);
      setBusy('');
      setStep('');
    }
  }, [nodeBase, onMasterError, uploadPakToMods]);

  // --- install a .pak the user picked from their computer ---
  // The universal path: works for ANY host, including login-gated ones (Nexus), because
  // the user's own browser did the authenticated download — we only upload the file.
  const installFromFile = useCallback(async (file) => {
    setError('');
    setNotice('');
    if (!file) return;
    if (!/\.pak$/i.test(file.name)) {
      setError('Please choose a .pak file.');
      return;
    }
    if (!nodeBase()) { setError('Server location not available yet.'); return; }
    await uploadPakToMods(file.name, file);
  }, [nodeBase, uploadPakToMods]);

  // --- enable/disable a mod (only one active at a time) ---
  // Turning one On disables any other active mod (rename to .disabled) then enables this
  // one. Turning one Off just disables it. Fast rename only — applies on the next restart.
  const setEnabled = useCallback(async (mod, enable) => {
    setError('');
    setNotice('');
    const base = nodeBase();
    if (!base) return;
    setBusy(mod.name);
    setStep('toggling');
    try {
      const authHeader = await auth();
      if (enable) {
        const files = await listMods(base, authHeader);
        for (const f of files) {
          if (!/\.disabled$/i.test(f) && f !== mod.name) {
            await renameObj(base, authHeader, f, `${f}.disabled`);
          }
        }
        if (!mod.enabled) await renameObj(base, authHeader, mod.name, mod.displayName);
      } else if (mod.enabled) {
        await renameObj(base, authHeader, mod.name, `${mod.displayName}.disabled`);
      }
      setNeedsRestart(true);
      await loadInstalled();
    } catch (err) {
      if (err instanceof TypeError) onMasterError?.();
      setError(err.message);
    } finally {
      setBusy('');
      setStep('');
    }
  }, [nodeBase, auth, listMods, renameObj, loadInstalled, onMasterError]);

  // --- restart the server to apply enable/disable changes ---
  const restartServer = useCallback(async () => {
    setError('');
    setNotice('');
    const base = nodeBase();
    if (!base) return;
    setBusy('__restart__');
    setStep('restarting');
    try {
      const authHeader = await auth();
      try {
        await fetch(`${base}/apps/appstop/${server.name}`, { headers: { zelidauth: authHeader } });
      } catch { /* may already be stopped */ }
      await new Promise((r) => setTimeout(r, 5000));
      await fetch(`${base}/apps/appstart/${server.name}`, { headers: { zelidauth: authHeader } });
      await new Promise((r) => setTimeout(r, 15000));
      setNeedsRestart(false);
      setNotice('Server restarted — mod changes applied.');
      await loadInstalled();
    } catch (err) {
      if (err instanceof TypeError) onMasterError?.();
      setError(err.message);
    } finally {
      setBusy('');
      setStep('');
    }
  }, [nodeBase, auth, server?.name, loadInstalled, onMasterError]);

  // --- remove an installed mod ---
  const remove = useCallback(async (mod) => {
    setError('');
    setNotice('');
    const base = nodeBase();
    if (!base) return;
    setBusy(mod.name);
    setStep('removing');
    try {
      const authHeader = await auth();
      const objectPath = `${MODS_VOLUME_PATH}/${mod.name}`;
      const res = await fetch(`${base}/apps/removeobject/${server.name}/${selectedComponent}/${encodeURIComponent(objectPath)}`,
        { headers: { zelidauth: authHeader } });
      if (!res.ok) throw new Error(`Failed to remove (HTTP ${res.status})`);
      if (mod.enabled) setNeedsRestart(true); // removing the active mod needs a restart
      setNotice(`Removed "${mod.displayName}".${mod.enabled ? ' Restart to apply.' : ''}`);
      await loadInstalled();
    } catch (err) {
      if (err instanceof TypeError) onMasterError?.();
      setError(err.message);
    } finally {
      setBusy('');
      setStep('');
    }
  }, [nodeBase, auth, server?.name, selectedComponent, onMasterError, loadInstalled]);

  // --- one-click fix: add the ~mods mount to the app spec, then redeploy ---
  // For servers deployed before mods support. Adds `m:mods:...` to every component's
  // containerData (idempotent), keeps the subscription window (recomputed expire), submits
  // the signed appupdate, then triggers a redeploy so the new mount takes effect. Palworld
  // apps are non-enterprise, so the spec stays plaintext.
  // Poll the on-chain spec until its hash changes (the appupdate has propagated). Only then
  // is a redeploy safe — redeploying earlier would relaunch the OLD spec (no mount).
  const watchEnablePropagation = useCallback(() => {
    if (enablePollRef.current) clearInterval(enablePollRef.current);
    let ticks = 0;
    enablePollRef.current = setInterval(async () => {
      ticks += 1;
      try {
        const spec = await apiService.getAppSpecs(server.name);
        if (spec?.hash && spec.hash !== enableOldHashRef.current) {
          clearInterval(enablePollRef.current); enablePollRef.current = null;
          setEnableState('live');
          return;
        }
      } catch { /* transient — keep polling */ }
      if (ticks >= 45) { // ~15 min at 20s
        clearInterval(enablePollRef.current); enablePollRef.current = null;
        setEnableState('timeout');
      }
    }, 20000);
  }, [server?.name]);

  const enableMods = useCallback(async () => {
    setError('');
    setNotice('');
    setBusy('__enable__');
    setStep('enabling');
    try {
      const outer = await apiService.getAppSpecs(server.name);
      if (!outer?.name) throw new Error('Could not load the current app spec.');
      enableOldHashRef.current = outer.hash || null;
      const height = await apiService.getBlockHeight();
      const newCompose = (outer.compose || []).map((c) => ({
        ...c,
        containerData: withModsMount(c.containerData),
      }));
      const spec = {
        ...outer,
        expire: computeRemainingExpire(outer, height),
        compose: newCompose,
        enterprise: '',
      };
      await apiService.updateAppSpecification(spec);
      setEnableState('propagating');
      watchEnablePropagation();
    } catch (err) {
      if (err instanceof TypeError) onMasterError?.();
      setError(err.message);
    } finally {
      setBusy('');
      setStep('');
    }
  }, [server?.name, onMasterError, watchEnablePropagation]);

  // Redeploy once the new spec is live (or the user accepts the timeout risk).
  const redeployForMods = useCallback(() => {
    if (enablePollRef.current) { clearInterval(enablePollRef.current); enablePollRef.current = null; }
    setEnableState('idle');
    if (onRedeploy) onRedeploy();
  }, [onRedeploy]);

  // Stop polling if the tab unmounts mid-watch.
  useEffect(() => () => {
    if (enablePollRef.current) clearInterval(enablePollRef.current);
  }, []);

  const stepLabel = {
    downloading: 'Downloading…', uploading: 'Uploading…', removing: 'Removing…',
    toggling: 'Updating…', restarting: 'Restarting server…', enabling: 'Enabling mods…',
  };
  const isInstalled = (name) => installed.some((m) => m.displayName.toLowerCase() === (name || '').toLowerCase());
  const anyBusy = !!busy;
  const installBlocked = anyBusy || mountMissing; // can't install until the mount exists

  return (
    <div className="space-y-5 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package size={18} className="text-primary" /> Mods
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Upload as many <code className="text-gray-300">.pak</code> mods as you like — but only <strong>one can be active at a time</strong>. Turn one On to switch, then restart.
          </p>
        </div>
        <button
          type="button"
          onClick={loadInstalled}
          disabled={loading || anyBusy}
          className="shrink-0 h-9 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
          <CheckCircle size={14} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Server predates mods support — one-click fix (spec update + redeploy) */}
      {mountMissing && !loading && (
        <div className="flex items-start gap-2.5 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-md px-3 py-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-amber-100">
              Mods aren&apos;t enabled on this server yet
            </div>
            <p className="text-xs text-amber-200/90 mt-1">
              This server has no <code>~mods</code> folder. Click <strong>Enable mods</strong> — it adds the mods mount
              to the app spec and applies it with a <strong>soft redeploy</strong>, so your <code>Pal/Saved</code> world
              data is kept. It takes a couple of minutes to propagate, then the mods folder appears here.
            </p>
            {enableState === 'idle' ? (
              <button
                type="button"
                onClick={enableMods}
                disabled={anyBusy}
                className="mt-2.5 h-9 px-3.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-100 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                {busy === '__enable__' ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />}
                Enable mods
              </button>
            ) : (
              /* Spec update submitted — detect propagation, then unlock the soft Redeploy (like Hardware) */
              <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2.5">
                {enableState === 'propagating' ? (
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    Mods added to the spec — detecting propagation across the network… (~1–2 min)
                  </div>
                ) : enableState === 'live' ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle size={14} className="shrink-0" /> New spec is live — redeploy to create the <code>~mods</code> folder (your world is kept).
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-xs text-amber-300">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    Still propagating — you can redeploy now; if it comes back without <code>~mods</code>, redeploy again.
                  </div>
                )}
                <button
                  type="button"
                  onClick={redeployForMods}
                  disabled={anyBusy || enableState === 'propagating'}
                  title={enableState === 'propagating' ? 'Available once the new spec is live' : undefined}
                  className="mt-2 h-9 px-3.5 rounded-lg bg-primary/20 border border-primary/50 text-primary-light text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-primary/30 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={15} className={enableState === 'propagating' ? 'animate-spin' : ''} />
                  {enableState === 'propagating' ? 'Waiting for spec…' : 'Redeploy now'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add a mod — upload a .pak from your PC (works for any host, incl. login-gated) */}
      <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-3">
        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 mb-2">
          <Upload size={13} /> Upload from your PC <span className="text-gray-500 font-normal">(works with any mod)</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pak"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // allow re-picking the same file
            if (f) installFromFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={installBlocked}
          className="w-full h-11 rounded-lg border-2 border-dashed border-gray-600/70 hover:border-primary/60 text-gray-200 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
        >
          <Upload size={16} /> Choose a .pak file…
        </button>
        <p className="text-[11px] text-gray-500 mt-1.5">
          Download the mod&apos;s <code>.pak</code> from Nexus/CurseForge (log in if needed) and pick it here. If it comes as a <code>.zip</code>, extract the <code>.pak</code> first. Since your browser did the download, login-gated mods work too.
        </p>
      </div>

      {/* Catalog */}
      <div>
        <h4 className="text-sm font-semibold text-gray-200 mb-2">Mod catalog</h4>
        <ul className="space-y-2">
          {MOD_CATALOG.map((mod) => {
            const done = isInstalled(mod.fileName);
            const thisBusy = busy === mod.fileName;
            return (
              <li key={mod.id} className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-md p-3">
                <Package size={20} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate flex items-center gap-1.5">
                    {mod.name}
                    {mod.sourceUrl && (
                      <a href={mod.sourceUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">{mod.description}</div>
                  {mod.author && <div className="text-[11px] text-gray-500">by {mod.author}</div>}
                </div>
                {mod.downloadUrl ? (
                  <button
                    type="button"
                    onClick={() => install(mod.downloadUrl, mod.fileName)}
                    disabled={installBlocked || done}
                    className={`shrink-0 h-9 px-3 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors
                      ${done ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    {thisBusy && step ? <Loader2 size={14} className="animate-spin" />
                      : done ? <CheckCircle size={14} /> : <Download size={14} />}
                    {done ? 'Installed' : 'Install'}
                  </button>
                ) : (
                  <a
                    href={mod.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 h-9 px-3 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors"
                  >
                    Browse <ExternalLink size={14} />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Installed */}
      <div>
        <h4 className="text-sm font-semibold text-gray-200 mb-2">
          Installed mods {installed.length > 0 && <span className="text-gray-500">({installed.length})</span>}
        </h4>

        {/* Restart needed after enabling/disabling */}
        {needsRestart && !loading && (
          <div className="flex items-center justify-between gap-3 mb-2 text-xs bg-primary/10 border border-primary/30 rounded-md px-3 py-2">
            <span className="text-primary-light">Mod change pending — restart to apply it in-game.</span>
            <button
              type="button"
              onClick={restartServer}
              disabled={anyBusy}
              className="shrink-0 h-8 px-3 rounded-md bg-primary hover:bg-primary/90 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy === '__restart__' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Restart now
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 text-sm py-6 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Reading server…
          </div>
        ) : installed.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-6 border border-dashed border-gray-700/60 rounded-md">
            <Package size={20} className="mx-auto mb-2 opacity-60" />
            No mods installed yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {installed.map((mod) => {
              const thisBusy = busy === mod.name;
              return (
                <li key={mod.name} className={`flex items-center gap-3 border rounded-md p-2.5 transition-colors ${mod.enabled ? 'bg-emerald-500/[0.07] border-emerald-600/30' : 'bg-gray-800/60 border-gray-700/50'}`}>
                  <Package size={16} className={`shrink-0 ${mod.enabled ? 'text-emerald-400' : 'text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${mod.enabled ? 'text-white' : 'text-gray-300'}`}>{mod.displayName}</div>
                    <div className="text-[11px] flex items-center gap-2">
                      {typeof mod.size === 'number' && <span className="text-gray-500">{(mod.size / (1024 * 1024)).toFixed(1)} MB</span>}
                      <span className={mod.enabled ? 'text-emerald-400 font-medium' : 'text-gray-500'}>{mod.enabled ? 'Active' : 'Off'}</span>
                    </div>
                  </div>
                  {/* On/Off — only one mod can be On at a time */}
                  <button
                    type="button"
                    onClick={() => setEnabled(mod, !mod.enabled)}
                    disabled={anyBusy}
                    title={mod.enabled ? 'Turn off' : 'Turn on (switches the active mod)'}
                    className={`shrink-0 h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-colors disabled:opacity-50 min-w-[3rem]
                      ${mod.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-gray-700/50 text-gray-300 border-gray-600/50 hover:bg-gray-600/50'}`}
                  >
                    {thisBusy && step === 'toggling' ? <Loader2 size={13} className="animate-spin" /> : (mod.enabled ? 'On' : 'Off')}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(mod)}
                    disabled={anyBusy}
                    className="shrink-0 p-1.5 text-gray-400 hover:text-red-400 disabled:opacity-40"
                    title="Remove mod"
                  >
                    {thisBusy && step === 'removing' ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Global busy indicator */}
      {anyBusy && step && (
        <div className="flex items-center gap-2 text-xs text-primary-light bg-primary/10 border border-primary/30 rounded-md px-3 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>{stepLabel[step] || 'Working…'} This can take up to a minute — don&apos;t close the panel.</span>
        </div>
      )}
    </div>
  );
}
