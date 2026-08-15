/**
 * PalWorldSettings.ini reconcile — the three fields a server we sell needs and the game's
 * own default file does not provide.
 *
 * The ini a server boots with is the GAME's DefaultPalWorldSettings.ini (start.sh copies it
 * verbatim, because DISABLE_GENERATE_SETTINGS=true stops compile-settings.sh running), so
 * every server we sell starts life with:
 *
 *  - PublicPort=8211. Deploys randomize the external game port, and this value is the
 *    address the server hands to the in-game community browser. Until it matches, the
 *    server is listed at an address nobody can reach. Direct connect is unaffected.
 *  - RESTAPIEnabled=False and a blank AdminPassword. The Remote Control tab needs both,
 *    and so does the scheduled restart (it authenticates against the server's own API).
 *
 * ONLY these three are touched. RCONPort / RESTAPIPort in the ini are the container's
 * INTERNAL bind ports — Flux maps the external ports onto them (e.g. 59025→8212), so the
 * server must keep listening on the defaults; changing them would break the REST proxy.
 * Same reason PORT/QUERY_PORT are never set. ServerPassword is never touched either:
 * writing one would lock existing players out.
 *
 * Two callers, one implementation:
 *  - the dashboard, as the last step of a deploy — before the server is announced as
 *    ready, while there is provably nobody playing on it;
 *  - the manage panel, as the fallback for everything else (a server bought before this
 *    existed, a browser that was closed during the deploy, a redeploy on a new port).
 *
 * Both go through reconcilePalworldIni, which owns the container stop, so the two can
 * never both be stopping the same server.
 */

import { nodeApiBase, withAppStopped, recoverPendingRestores } from './appPower';
import secureStorage from './secureStorage';

export const CONFIG_PATH = 'appdata/Config/LinuxServer/PalWorldSettings.ini';

// The reconcile stops the container, so it must not be able to run on every visit forever.
// A server that keeps rewriting its ini gets at most this many restarts, then we give up.
export const PORT_RECONCILE_MAX_ATTEMPTS = 3;
const PORT_RECONCILE_STORE = 'palworld:publicPortReconcile';

// Apps whose reconcile is running right now. Module scope, not a ref: the dashboard keys
// the manage panel on the server name, so closing it unmounts that component and would
// wipe a ref-based guard while the container is still stopped. Shared by both callers,
// which is what stops the dashboard's deploy pass and a panel open colliding.
const reconcileInFlight = new Set();

export const readPublicPort = (ini) => /PublicPort=(\d+)/.exec(ini)?.[1];

// Surgical patch — replace only the PublicPort value; the rest of the user-owned ini is
// one big OptionSettings=(...) line and must survive untouched.
export const patchPublicPort = (ini, port) => (
  /PublicPort=\d+/.test(ini)
    ? ini.replace(/PublicPort=\d+/, `PublicPort=${port}`)
    : ini.replace(/OptionSettings=\(/, `OptionSettings=(PublicPort=${port},`)
);

// Booleans are written `True`/`False` to match what the Config tab's toggles write and what
// the game's own default file uses. Values are matched as "anything up to the next , or )"
// rather than \w+ / a quoted string, so a key that is present but malformed
// (`RESTAPIEnabled=`, an unquoted password) is still recognised as PRESENT and gets replaced
// in place. Matching narrowly would fall through to the insert branch and leave the same key
// in the line twice.
const REST_ENABLED_RE = /RESTAPIEnabled=[^,)]*/;
const ADMIN_PASSWORD_RE = /AdminPassword=(?:"([^"]*)"|([^,)]*))/;

export const readRestApiEnabled = (ini) => /RESTAPIEnabled=([^,)]*)/.exec(ini)?.[1];
const patchRestApiEnabled = (ini) => (
  REST_ENABLED_RE.test(ini)
    ? ini.replace(REST_ENABLED_RE, 'RESTAPIEnabled=True')
    : ini.replace(/OptionSettings=\(/, 'OptionSettings=(RESTAPIEnabled=True,')
);

// Unquoted values count too: a hand-edited `AdminPassword=hunter2` is a real password, and
// reading it as absent would overwrite it — the one thing this must never do.
export const readAdminPassword = (ini) => {
  const m = ADMIN_PASSWORD_RE.exec(ini);
  return m ? (m[1] !== undefined ? m[1] : m[2]) : undefined;
};
// Present AND non-blank. `AdminPassword=""` is the game's default and counts as absent.
export const hasAdminPassword = (ini) => !!readAdminPassword(ini)?.trim();
// Only ever fills a BLANK password. A customer who set their own keeps it — this must not
// be able to lock someone out of their own admin API, or invalidate a password they wrote
// down. Written quoted, like every string in the ini.
const patchAdminPassword = (ini, password) => (
  ADMIN_PASSWORD_RE.test(ini)
    ? ini.replace(ADMIN_PASSWORD_RE, `AdminPassword="${password}"`)
    : ini.replace(/OptionSettings=\(/, `OptionSettings=(AdminPassword="${password}",`)
);

// 24 chars of crypto-random base58-ish alphabet (no look-alikes). The customer never has to
// type it — the Remote Control tab reads it straight out of the ini — but it is visible and
// editable in Server Settings, so it stays readable.
export const generateAdminPassword = () => {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
};

// The external game port Flux registered for this app (index 0 of the game component).
// PublicPort in the ini MUST equal this: it is the address the server hands out to the
// in-game community browser, and the node only forwards this port to the container's 8211.
export const externalGamePort = (server) => server?.ports?.[0] || server?.compose?.[0]?.ports?.[0];

// Everything the reconcile owns, in one predicate and one patch so they can never drift:
// the write is verified by re-running the predicate, not by re-checking a subset.
export const iniNeedsReconcile = (ini, expectedPort) => (
  readPublicPort(ini) !== expectedPort
  || String(readRestApiEnabled(ini)).toLowerCase() !== 'true'
  || !hasAdminPassword(ini)
);

// `password` is generated once per reconcile run, not per call: this runs twice (before the
// stop, then again on the copy re-read while stopped) and both must agree on the value.
export const reconcileIni = (ini, expectedPort, password) => {
  let out = ini;
  if (readPublicPort(out) !== expectedPort) out = patchPublicPort(out, expectedPort);
  if (String(readRestApiEnabled(out)).toLowerCase() !== 'true') out = patchRestApiEnabled(out);
  if (!hasAdminPassword(out)) out = patchAdminPassword(out, password);
  return out;
};

// Read the live PalWorldSettings.ini off a node. Cache-bypassed on purpose — the node API
// caches downloads, and acting on a stale copy is exactly how one writer silently reverts
// another. Returns null (never throws) when the file is missing or not yet generated.
export const fetchIniText = async (nodeBase, appName, component, authHeader) => {
  try {
    const url = `${nodeBase}/apps/downloadfile/${appName}/${component}/${encodeURIComponent(CONFIG_PATH)}`;
    const res = await fetch(url, { headers: { zelidauth: authHeader, 'x-apicache-bypass': true } });
    if (!res.ok) return null;
    const text = await res.text();
    return text && text.includes('OptionSettings=') ? text : null;
  } catch { return null; }
};

// Persisted so the marker survives page reloads and panel remounts — an in-memory guard
// reset on every close, which is how one server could be restarted repeatedly across a
// session. Keyed by port so a redeploy (new random port) re-runs.
export const readPortReconcileMark = (appName, port) => {
  try {
    const entry = JSON.parse(localStorage.getItem(PORT_RECONCILE_STORE) || '{}')[appName];
    if (entry?.port === port) return { done: !!entry.done, attempts: entry.attempts || 0 };
  } catch { /* unreadable/disabled storage — behave as a fresh server */ }
  return { done: false, attempts: 0 };
};

export const writePortReconcileMark = (appName, port, patch) => {
  try {
    const store = JSON.parse(localStorage.getItem(PORT_RECONCILE_STORE) || '{}');
    store[appName] = { ...readPortReconcileMark(appName, port), ...patch, port };
    localStorage.setItem(PORT_RECONCILE_STORE, JSON.stringify(store));
  } catch { /* storage full or disabled — the attempt cap degrades, nothing breaks */ }
};

/** The component holding the game data — v4+ apps name it, v3 apps use the literal 'null'. */
const gameComponent = (server) => (
  server?.version >= 4 && server?.compose?.length > 0 ? server.compose[0].name : 'null'
);

/**
 * Bring one server's ini in line with its deploy.
 *
 * Reads are cheap and always happen; the WRITE stops the container, so it is attempt-capped
 * via a persisted marker. A server that keeps rewriting its ini gets a bounded number of
 * restarts instead of one per visit. Reads are never gated: the comparison must happen every
 * time, or a port that drifts after a successful fix goes unnoticed forever.
 *
 * @param {object} server        dashboard/panel server object (needs name, ports, compose)
 * @param {string} masterIp      the app's MASTER node ip:port — Syncthing replicates the
 *                               write from there to the other instances; writing to a slave
 *                               would be reverted
 * @param {object} [opts]
 * @param {(phase: string, ctx: object) => void} [opts.onPhase] 'patching' once a write is
 *        known to be needed (fires before the container is stopped), then withAppStopped's
 *        own phases ('stopping', …)
 * @param {number} [opts.iniReadAttempts] how many times to look for the file. A container on
 *        its first boot has not written it yet, so a deploy waits longer than a panel open.
 * @returns {Promise<{status:'not-needed'|'unavailable'|'capped'|'busy'|'done'|'failed'|'exhausted',
 *                    changes:string[], startState?:string}>}
 */
export async function reconcilePalworldIni(server, masterIp, { onPhase, iniReadAttempts = 4 } = {}) {
  const appName = server?.name;
  const expected = String(externalGamePort(server) || '');
  // A queued deploy has no on-chain spec yet, so its port is genuinely unknown. NOT skipped
  // when the port is 8211 — an app deployed before port randomization is served on 8211 and
  // its ini still has to say 8211, which is exactly the case a "nothing to fix" shortcut
  // here once missed.
  if (!appName || !masterIp || !expected) return { status: 'unavailable', changes: [] };
  if (reconcileInFlight.has(appName)) return { status: 'busy', changes: [] };

  const mark = readPortReconcileMark(appName, expected);
  if (mark.attempts >= PORT_RECONCILE_MAX_ATTEMPTS) return { status: 'exhausted', changes: [] };

  reconcileInFlight.add(appName);
  try {
    const zelidauth = await secureStorage.getItem('zelidauth');
    if (!zelidauth) return { status: 'unavailable', changes: [] };
    const authHeader = JSON.stringify(zelidauth);
    const nodeBase = nodeApiBase(masterIp);

    // Settle any restart still owed to THIS server before deciding anything: a server left
    // stopped by an earlier write must come back up, not be treated as an intentional stop
    // by the write-while-stopped path below.
    await recoverPendingRestores(authHeader, { appName });

    const component = gameComponent(server);
    const readIni = () => fetchIniText(nodeBase, appName, component, authHeader);

    // The file does not exist until the container's first boot generates it, so a deploy
    // polls for it rather than giving up.
    let ini = null;
    for (let attempt = 0; attempt < iniReadAttempts && !ini; attempt += 1) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 5000));
      ini = await readIni();
    }
    // Nothing has been touched yet, so bailing out here is free — retry on the next pass.
    if (!ini) return { status: 'unavailable', changes: [] };

    // Generated once and reused below, so the value written while stopped is the same one
    // this comparison was made against.
    const password = generateAdminPassword();
    if (!iniNeedsReconcile(ini, expected) || reconcileIni(ini, expected, password) === ini) {
      writePortReconcileMark(appName, expected, { done: true });
      return { status: 'not-needed', changes: [] };
    }

    // What is about to change, for whatever the caller shows. Read off the pre-stop copy:
    // the write uses the copy re-read while stopped, but for telling the customer why their
    // server is restarting this is the honest answer.
    const changes = [
      readPublicPort(ini) !== expected && 'public port',
      String(readRestApiEnabled(ini)).toLowerCase() !== 'true' && 'admin API',
      !hasAdminPassword(ini) && 'admin password',
    ].filter(Boolean);

    onPhase?.('patching', { changes });

    // Write while stopped so the running game cannot clobber the file. withAppStopped owns
    // bringing the container back (finally + retries + unload rescue), so an unmount, a
    // failed upload or a network blip can never strand the app `exited`. A server the user
    // has stopped is written to and left stopped.
    let persisted = false;
    let startState;
    try {
      ({ startState } = await withAppStopped(nodeBase, appName, authHeader, async ({ wasRunning }) => {
        // Count the attempt only once the container has actually been touched.
        if (wasRunning) writePortReconcileMark(appName, expected, { attempts: mark.attempts + 1 });

        // Re-read while stopped: Palworld flushes its own settings on shutdown, so patching
        // the copy read before the stop would revert whatever it just wrote.
        const fresh = (await readIni()) || ini;
        if (!iniNeedsReconcile(fresh, expected)) { persisted = true; return; }

        const uploadUrl = `${nodeBase}/ioutils/fileupload/volume/${appName}/${component}/${encodeURIComponent('appdata/Config/LinuxServer')}`;
        const fd = new FormData();
        fd.append('PalWorldSettings.ini', new Blob([reconcileIni(fresh, expected, password)], { type: 'text/plain' }));
        const up = await fetch(uploadUrl, { method: 'POST', headers: { zelidauth: authHeader }, body: fd });
        if (!up.ok) throw new Error(`Upload failed: HTTP ${up.status}`);

        // Confirm the write landed before marking this server done (anti-loop).
        const verify = await readIni();
        persisted = verify ? !iniNeedsReconcile(verify, expected) : false;
      }, { onPhase: (phase) => onPhase?.(phase, { changes }) }));
    } catch (err) {
      // AppBusyError: a save/restart is already running — leave it alone, retry next pass.
      if (err?.name === 'AppBusyError') return { status: 'busy', changes };
      startState = err?.startState;
      persisted = false;
    }

    if (persisted) {
      writePortReconcileMark(appName, expected, { done: true });
      return { status: 'done', changes, startState };
    }
    return {
      status: readPortReconcileMark(appName, expected).attempts >= PORT_RECONCILE_MAX_ATTEMPTS
        ? 'exhausted'
        : 'failed',
      changes,
      startState,
    };
  } finally {
    reconcileInFlight.delete(appName);
  }
}
