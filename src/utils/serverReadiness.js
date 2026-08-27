/**
 * Is this server ready for players, and if not, what is it doing?
 *
 * The dashboard used to have no honest answer to that. `server.status` is set to
 * `'running'` the moment the app is registered on the Flux chain, the green banner
 * follows DNS, and neither notices that a freshly rebuilt container spends about
 * nine minutes pulling 5.15 GB through SteamCMD before it opens the game port.
 * Only `Pal/Saved` is a persistent volume, by design, so every container rebuild
 * pays that cost — and a customer watching "Running" the whole time reasonably
 * concludes the panel is lying to them.
 *
 * Two signals, in order of authority:
 *
 * 1. **Docker health**, from the `Status` string `listrunningapps` already returns.
 *    Our image declares a HEALTHCHECK that runs `flux-guard.sh --check` inside the
 *    container, so Docker appends `(healthy)`, `(health: starting)` or
 *    `(unhealthy)` and FluxOS passes it straight through. This is computed from
 *    inside the container and does not depend on the browser reaching the game
 *    port, which is why it beats the UDP probe.
 *
 * 2. **The boot phase**, from a single line our entrypoint writes on every
 *    transition: `[flux] phase=installing|starting|loading`. Health can only say
 *    "not ready yet"; this says which kind. Deliberately our own line and not
 *    upstream's `****Starting Installation****` — those belong to
 *    thijsvanloef/palworld-server-docker and are free to change on any release.
 *
 * The download percentage is the one thing read from upstream's output, and it is
 * treated as decoration: if that format changes we lose the number and keep the
 * phase.
 */

/** Ports of the readiness model, in the order a boot walks through them. */
export const READINESS = {
  UNKNOWN: 'unknown',
  STOPPED: 'stopped',
  INSTALLING: 'installing',
  STARTING: 'starting',
  LOADING: 'loading',
  RECOVERING: 'recovering',
  READY: 'ready',
};

/** True for every state in which a player cannot join yet. */
export const isPreparing = (state) =>
  state === READINESS.INSTALLING ||
  state === READINESS.STARTING ||
  state === READINESS.LOADING;

/**
 * Docker's health verdict out of the `Status` string.
 *
 * `"Up 21 hours (healthy)"` → `'healthy'`
 * `"Up 18 seconds (health: starting)"` → `'starting'`
 * `"Up 4 minutes"` → `null` (an image with no HEALTHCHECK — an older build, or a
 * server deployed before this shipped; callers must fall back, not assume down)
 */
export function parseHealth(status) {
  if (!status) return null;
  if (status.includes('(healthy)')) return 'healthy';
  if (status.includes('(unhealthy)')) return 'unhealthy';
  if (status.includes('(health: starting)')) return 'starting';
  return null;
}

/**
 * The last boot phase our entrypoint announced, plus the SteamCMD percentage if
 * one is still in the window.
 *
 * `applogpolling` returns the tail of the log, so both are best-effort by nature:
 * a server that booted an hour ago has scrolled its phase lines away and shows
 * nothing here. That is fine — health already covers a server that is up, and
 * this is only consulted while health says it is not.
 *
 * @param {string[]} lines raw log lines, oldest first
 * @returns {{ phase: string|null, percent: number|null }}
 */
export function parseBootPhase(lines) {
  let phase = null;
  let percent = null;

  for (const raw of lines || []) {
    const line = typeof raw === 'string' ? raw : (raw?.message || raw?.log || '');

    // Ours. One per transition, and the last one wins.
    const m = line.match(/\[flux\] phase=(installing|starting|loading)\b/);
    if (m) {
      phase = m[1];
      percent = null; // a new phase invalidates the old phase's progress
      continue;
    }

    // The guard says this exactly once per generation, and it means players can
    // join. Health will agree within a minute; this just gets there first.
    if (line.includes('[flux] server healthy for the first time this boot')) {
      phase = 'ready';
      percent = null;
      continue;
    }

    // Upstream's. Decoration only — see the header.
    const p = line.match(/\(0x61\)\s+downloading,\s+progress:\s+([\d.]+)/);
    if (p) {
      const v = Number.parseFloat(p[1]);
      if (Number.isFinite(v)) percent = Math.max(0, Math.min(100, v));
    }
  }

  return { phase, percent };
}

/** What a customer should read, per state. Kept here so the two panels agree. */
export function readinessLabel(state, percent) {
  switch (state) {
    case READINESS.INSTALLING:
      return percent === null || percent === undefined
        ? 'Installing game files'
        : `Installing game files — ${Math.round(percent)}%`;
    case READINESS.STARTING:
      return 'Starting server';
    case READINESS.LOADING:
      return 'Loading world';
    case READINESS.RECOVERING:
      return 'Recovering';
    case READINESS.STOPPED:
      return 'Stopped';
    case READINESS.READY:
      return 'Online';
    default:
      return null;
  }
}

/** One line of reassurance under the label, where there is room for it. */
export function readinessDetail(state) {
  switch (state) {
    case READINESS.INSTALLING:
      return 'Your world is safe. Only the game files are being downloaded, which takes a few minutes after a rebuild.';
    case READINESS.STARTING:
      return 'The game files are in place and the server is launching.';
    case READINESS.LOADING:
      return 'The server is reading your world into memory. Almost there.';
    case READINESS.RECOVERING:
      return 'The server stopped responding and is being restarted automatically.';
    default:
      return null;
  }
}

/**
 * Fold the container's Docker health and its boot phase into one state.
 *
 * @param {object}  args
 * @param {string=} args.containerStatus Docker `Status` from listrunningapps
 * @param {string=} args.containerState  Docker `State` from listrunningapps
 * @param {boolean} args.containerFound  false when the container is not on the node
 * @param {string=} args.phase           from parseBootPhase
 * @param {number=} args.percent         from parseBootPhase
 * @param {boolean=} args.udpOnline      the UDP probe, used only as a fallback
 */
export function deriveReadiness({
  containerStatus,
  containerState,
  containerFound = true,
  phase = null,
  percent = null,
  udpOnline = undefined,
} = {}) {
  if (!containerFound) return { state: READINESS.STOPPED, percent: null };
  if (containerState && containerState !== 'running') {
    return { state: READINESS.STOPPED, percent: null };
  }

  const health = parseHealth(containerStatus);

  if (health === 'healthy') return { state: READINESS.READY, percent: null };
  if (health === 'unhealthy') return { state: READINESS.RECOVERING, percent: null };

  if (health === 'starting') {
    // Health knows it is not ready; the phase line says which kind of not-ready.
    // Without one — the tail scrolled, or the log call was refused — `starting` is
    // the honest middle: something is coming up, we cannot say what.
    if (phase === 'ready') return { state: READINESS.READY, percent: null };
    if (phase === 'installing') return { state: READINESS.INSTALLING, percent };
    if (phase === 'loading') return { state: READINESS.LOADING, percent: null };
    return { state: READINESS.STARTING, percent: null };
  }

  // No HEALTHCHECK in this image. Older servers still run those, so fall back to
  // what the dashboard has always used rather than claiming anything new.
  if (udpOnline === true) return { state: READINESS.READY, percent: null };
  if (udpOnline === false) return { state: READINESS.RECOVERING, percent: null };
  return { state: READINESS.UNKNOWN, percent: null };
}

/**
 * Read both signals off the node. The log call is only made when health says the
 * server is not ready — a healthy server costs exactly one request.
 *
 * @returns {Promise<{state: string, percent: number|null, label: string|null, detail: string|null}>}
 */
export async function fetchReadiness({ base, appName, containerName, zelidauth, udpOnline, signal }) {
  if (!base || !appName) {
    return { state: READINESS.UNKNOWN, percent: null, label: null, detail: null };
  }

  let containerFound = false;
  let containerStatus;
  let containerState;

  try {
    // Bypass FluxOS's 15s apicache: during a boot, fifteen seconds is a whole phase.
    const res = await fetch(`${base}/apps/listrunningapps`, {
      headers: { 'x-apicache-bypass': true },
      signal,
    });
    const data = await res.json();
    if (data?.status === 'success' && Array.isArray(data.data)) {
      const container = data.data.find((c) => (c.Names || []).some((n) => String(n).includes(appName)));
      if (container) {
        containerFound = true;
        containerStatus = container.Status;
        containerState = container.State;
      }
    } else {
      // Could not read the node at all. Never report "stopped" from ignorance.
      return { state: READINESS.UNKNOWN, percent: null, label: null, detail: null };
    }
  } catch {
    return { state: READINESS.UNKNOWN, percent: null, label: null, detail: null };
  }

  let phase = null;
  let percent = null;
  const health = parseHealth(containerStatus);

  if (containerFound && health === 'starting' && zelidauth && containerName) {
    try {
      const res = await fetch(`${base}/apps/applogpolling/${containerName}/200`, {
        headers: { zelidauth: JSON.stringify(zelidauth) },
        signal,
      });
      const data = await res.json();
      if (data?.status === 'success' && Array.isArray(data.logs)) {
        ({ phase, percent } = parseBootPhase(data.logs));
      }
    } catch {
      // Leave phase null: deriveReadiness falls back to the generic "Starting".
    }
  }

  const { state, percent: pct } = deriveReadiness({
    containerStatus,
    containerState,
    containerFound,
    phase,
    percent,
    udpOnline,
  });

  return { state, percent: pct, label: readinessLabel(state, pct), detail: readinessDetail(state) };
}
