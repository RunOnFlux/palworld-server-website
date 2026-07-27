/**
 * Safe power operations (stop / start / restart) for a Flux app on its master node.
 *
 * Every flow in the dashboard that stops a container to write a file used to be shaped
 * `stop → work → start`, with the start reachable only on the happy path. Any throw in
 * between (network blip, Cloudflare 5xx on the upload, the panel unmounting and
 * short-circuiting the async function) left the container stopped — FluxOS only brings it
 * back on its next compliance sweep, tens of minutes later, and the app sits `exited`.
 *
 * `withAppStopped` makes the restart unconditional: it lives in a `finally`, it retries,
 * and it is also armed on `pagehide` so a page unload during the stopped window still
 * fires a start. Callers must never issue a bare `appstop` outside this helper.
 *
 * A module-level lock (survives React unmounts, unlike a ref) serialises power operations
 * per app, so a background reconcile and a user-triggered save can't stop/start each other.
 */

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Apps with a power operation in flight — module scope so it outlives component remounts. */
const powerLocks = new Set();

/** Thrown by withAppStopped when another power operation holds the lock for this app. */
export class AppBusyError extends Error {
  constructor(appName) {
    super(`A power operation is already running for ${appName}`);
    this.name = 'AppBusyError';
  }
}

export const isAppPowerBusy = (appName) => powerLocks.has(appName);

/** `1.2.3.4:16127` → `https://1-2-3-4-16127.node.api.runonflux.io` */
export function nodeApiBase(ip) {
  if (!ip) return null;
  const [host, port = 16127] = String(ip).split(':');
  return `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io`;
}

/**
 * Container liveness on the master node.
 * @returns {Promise<'running'|'stopped'|'unknown'>} `unknown` when the node can't be read —
 *          callers must treat it as "assume running", never as "safe to leave stopped".
 */
export async function getAppRunState(base, appName) {
  try {
    // Bypass FluxOS's 15s apicache — a stale hit right after a start reads as stopped.
    const res = await fetch(`${base}/apps/listrunningapps`, {
      headers: { 'x-apicache-bypass': true },
    });
    if (!res.ok) return 'unknown';
    const data = await res.json();
    if (data.status !== 'success' || !Array.isArray(data.data)) return 'unknown';
    // Paused counts as running: the container exists and must not be "rescued" by a start.
    return data.data.some((c) => c.Names?.[0]?.includes(appName)) ? 'running' : 'stopped';
  } catch {
    return 'unknown';
  }
}

/**
 * Pending restores: apps this browser stopped and has not yet seen come back.
 *
 * FluxOS records a stop as a durable operator lock ("operatorStopped wins over all"), so
 * its reconciler will NOT resurrect a container that was stopped through the API — only a
 * start clears the lock. If the node dies or restarts inside our stopped window, the start
 * has nowhere to land and the app stays `exited` indefinitely. The record survives page
 * reloads so the next dashboard visit finishes the job.
 */
const PENDING_STORE = 'flux:pendingRestore';
const PENDING_MAX_AGE_MS = 6 * 60 * 60 * 1000; // beyond this, assume the state is stale

const readPending = () => {
  try { return JSON.parse(localStorage.getItem(PENDING_STORE) || '{}'); } catch { return {}; }
};
const writePending = (store) => {
  try { localStorage.setItem(PENDING_STORE, JSON.stringify(store)); } catch { /* storage disabled */ }
};

/** Record that this browser is about to stop `appName` on `base` and owes it a start. */
export function markPendingRestore(base, appName) {
  const store = readPending();
  store[appName] = { base, ts: Date.now() };
  writePending(store);
}

/** Drop the debt — the app is back up, or the user has deliberately stopped it since. */
export function clearPendingRestore(appName) {
  const store = readPending();
  if (!(appName in store)) return;
  delete store[appName];
  writePending(store);
}

/**
 * Finish any restart this browser still owes: for every app stopped by a flow that never
 * confirmed it back up, check the node and start it if it is still down. Safe to call on
 * every dashboard/panel open — a running app just clears its record.
 *
 * @returns {Promise<string[]>} apps that were still down and have been started
 */
export async function recoverPendingRestores(authHeader, { appName = null } = {}) {
  const store = readPending();
  const recovered = [];

  for (const [name, entry] of Object.entries(store)) {
    if (appName && name !== appName) continue;
    if (!entry?.base || Date.now() - (entry.ts || 0) > PENDING_MAX_AGE_MS) { clearPendingRestore(name); continue; }
    if (powerLocks.has(name)) continue; // an operation is handling it right now

    // Sequential on purpose: these are recovery starts, not a race to fan out.
    const state = await getAppRunState(entry.base, name);
    if (state === 'running') { clearPendingRestore(name); continue; }
    if (state === 'unknown') continue; // node unreachable — try again next time

    const after = await startApp(entry.base, name, authHeader);
    if (after === 'running') { clearPendingRestore(name); recovered.push(name); }
  }
  return recovered;
}

/**
 * Start an app, retrying until the node confirms it is up.
 *
 * FluxOS answers `appstart` synchronously, so `status: 'success'` is proof enough. Anything
 * else (error body, unparseable response, network throw) is re-checked against
 * listrunningapps — `appstart` on an already-running container reports an error, and a
 * transient failure is worth retrying rather than leaving the server down.
 *
 * @param {{schedule?: number[]}} opts backoff before each attempt, in ms. The long default
 *        used by withAppStopped spans a FluxOS restart: the node process can die on the
 *        stop itself, and a start fired 3s later lands on nothing.
 * @returns {Promise<'running'|'stopped'|'unknown'>} final observed state. Never throws.
 */
export async function startApp(base, appName, authHeader, { schedule = [0, 3000, 6000] } = {}) {
  let observed = 'unknown';
  for (let i = 0; i < schedule.length; i += 1) {
    if (schedule[i] > 0) await delay(schedule[i]);
    try {
      const res = await fetch(`${base}/apps/appstart/${appName}`, {
        method: 'GET',
        headers: { zelidauth: authHeader },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === 'success') return 'running';
    } catch { /* network — fall through to verification */ }

    await delay(2000);
    observed = await getAppRunState(base, appName);
    if (observed === 'running') return 'running';
  }
  return observed;
}

/**
 * Stop an app as part of a flow that will start it again. Resolves even on failure — the
 * caller's `finally` still has to run. The pending-restore record is written BEFORE the
 * request, because a node that dies handling the stop still has the durable operator lock
 * (FluxOS writes it first, deliberately) and will never bring the app back on its own.
 */
export async function stopApp(base, appName, authHeader) {
  markPendingRestore(base, appName);
  try {
    await fetch(`${base}/apps/appstop/${appName}`, {
      method: 'GET',
      headers: { zelidauth: authHeader },
    });
  } catch { /* may already be stopped, or the node blipped — verified by the caller */ }
}

/**
 * Restart an app, guaranteeing it does not stay down.
 *
 * `apprestart` is atomic (docker restart) so it has no stopped window, but it can still
 * fail with the container down; that falls back to `startApp`.
 *
 * @returns {Promise<'running'|'stopped'|'unknown'>} Never throws.
 */
export async function restartApp(base, appName, authHeader) {
  let ok = false;
  try {
    const res = await fetch(`${base}/apps/apprestart/${appName}`, {
      method: 'GET',
      headers: { zelidauth: authHeader },
    });
    const data = await res.json().catch(() => null);
    ok = res.ok && data?.status === 'success';
  } catch { /* verified below */ }

  if (ok) return 'running';

  await delay(2000);
  const state = await getAppRunState(base, appName);
  if (state === 'running') return 'running';
  return startApp(base, appName, authHeader);
}

/**
 * Fire a start on page unload. `keepalive` lets the request outlive the document, which
 * `sendBeacon` can't do here (it cannot carry the zelidauth header).
 */
function armUnloadRescue(base, appName, authHeader) {
  if (typeof window === 'undefined') return () => {};
  const rescue = () => {
    try {
      fetch(`${base}/apps/appstart/${appName}`, {
        method: 'GET',
        headers: { zelidauth: authHeader },
        keepalive: true,
      }).catch(() => {});
    } catch { /* best effort */ }
  };
  window.addEventListener('pagehide', rescue);
  return () => window.removeEventListener('pagehide', rescue);
}

/**
 * Run `fn` with the container stopped, then always bring it back.
 *
 * Contract:
 *  - If the app is already stopped, `fn` runs and the app is LEFT stopped — a deliberate
 *    stop by the user is never undone as a side effect of writing a config file.
 *  - Otherwise: stop → settle → `fn` → start, with the start in a `finally` plus retries
 *    and an unload rescue. `fn` throwing propagates to the caller, but only after the
 *    restart has been attempted.
 *  - Concurrent calls for the same app throw {@link AppBusyError} without touching it.
 *
 * @param {(ctx: {wasRunning: boolean}) => Promise<any>} fn work to do while stopped
 * @param {{settleMs?: number, onPhase?: (p: 'stopping'|'working'|'starting') => void}} opts
 * @returns {Promise<{result: any, wasRunning: boolean, startState: 'running'|'stopped'|'unknown'}>}
 */
export async function withAppStopped(base, appName, authHeader, fn, opts = {}) {
  const { settleMs = 5000, onPhase } = opts;
  if (powerLocks.has(appName)) throw new AppBusyError(appName);
  powerLocks.add(appName);

  let disarm = () => {};
  try {
    // 'unknown' is treated as running: restarting a container that was already down is
    // harmless, leaving a running one down is not.
    const wasRunning = (await getAppRunState(base, appName)) !== 'stopped';

    if (!wasRunning) {
      onPhase?.('working');
      return { result: await fn({ wasRunning }), wasRunning, startState: 'stopped' };
    }

    disarm = armUnloadRescue(base, appName, authHeader);
    onPhase?.('stopping');
    await stopApp(base, appName, authHeader);
    await delay(settleMs);
    // Writing is only safe once the game is actually down — it rewrites its own config on
    // shutdown, so a stop that didn't take means the file we write gets clobbered. One
    // retry; if it still won't stop we continue anyway rather than abandon the caller's work.
    if ((await getAppRunState(base, appName)) === 'running') {
      await stopApp(base, appName, authHeader);
      await delay(settleMs);
    }

    // `result` / `startState` are assigned across the try+finally so the restart is
    // reflected in the return value — a `return` inside the try would snapshot them first.
    // The throw is deferred rather than rethrown from a catch, so `startState` is known
    // (the finally has run) and can be attached to the error the caller receives.
    let result;
    let startState;
    let failure;
    let failed = false;
    try {
      onPhase?.('working');
      result = await fn({ wasRunning });
    } catch (err) {
      failed = true;
      failure = err;
    } finally {
      onPhase?.('starting');
      // Long schedule: FluxOS can be restarting (it may even have died on the stop), and a
      // start fired 3s later lands on a dead port. ~2 minutes of attempts, then the
      // pending-restore record carries the debt to the next dashboard visit.
      startState = await startApp(base, appName, authHeader, { schedule: [0, 5000, 15000, 30000, 60000] });
      if (startState === 'running') clearPendingRestore(appName);
      disarm();
      disarm = () => {};
    }
    if (failed) {
      if (failure && typeof failure === 'object') failure.startState = startState;
      throw failure;
    }
    return { result, wasRunning, startState };
  } finally {
    disarm();
    powerLocks.delete(appName);
  }
}
