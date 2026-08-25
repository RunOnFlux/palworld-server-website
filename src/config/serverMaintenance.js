/**
 * Server maintenance defaults (automatic restarts + stability env vars).
 *
 * ── Why automatic restarts ────────────────────────────────────────────────────
 * PalServer leaks memory while it runs: RAM climbs until the world starts
 * rubber-banding and the server eventually stops accepting connections while the
 * process is still alive. Every host works around it the same way — restart the
 * server on a schedule. The image already implements it (`scripts/auto_reboot.sh`,
 * driven by supercronic), so all we do is set the env vars.
 *
 * The image's "auto reboot" is really an auto-SHUTDOWN: it saves the world, calls
 * the REST API `shutdown`, and the container exits. The restart half is done by
 * FluxOS, which brings the container back on the same node (and therefore the same
 * IP and ports) — Docker's own restart policy is `no` for g: apps.
 *
 * ── Time zone ─────────────────────────────────────────────────────────────────
 * supercronic follows the container's TZ, which the image pins to UTC. The node's
 * physical location is irrelevant: without a TZ, `0 5 * * *` is 05:00 UTC for
 * everyone — 21:00 for a customer on the US west coast, i.e. peak time. So the
 * deploy form sends TZ along with the cron, defaulting to the buyer's browser zone.
 *
 * ── Why the cron expression carries a password ────────────────────────────────
 * auto_reboot.sh talks to the server's own REST API as admin:${ADMIN_PASSWORD} —
 * the ENV VAR, which is empty on every server we sell. DISABLE_GENERATE_SETTINGS=true
 * (see STANDARD_ENV) stops the container regenerating the ini from env vars, which is
 * what makes customer edits survive a reboot, but it also switches off the only thing
 * that kept env and ini in sync; the reverse direction, ini→env, does not exist in the
 * image. So the password the customer sets lands in PalWorldSettings.ini and the job
 * authenticating with the env var gets a 401: get_player_count reads 0 players, the
 * save fails, shutdown_server refuses to shut down ("Do not shutdown if not able to
 * save") and the job exits 1 seconds after it starts — silently, every night.
 *
 * start.sh builds the cron line by unquoted interpolation of a value we own:
 *   echo "$AUTO_REBOOT_CRON_EXPRESSION bash /home/steam/server/auto_reboot.sh" >> crontab
 * A crontab line is <schedule> <command>, and a command can carry its own environment
 * prefix, so the schedule hands the password in on the way past — read out of the ini,
 * at run time, inside the container. It never leaves the node and never reaches the
 * logs (supercronic logs job.command with the $(…) unexpanded).
 *
 * Do NOT put ADMIN_PASSWORD in the spec instead: these apps deploy non-enterprise, so
 * it would be plaintext on-chain, and AdminPassword is also the in-game admin credential
 * (/AdminPassword in chat) — publishing it makes every player an admin.
 *
 * Upstream fix, which makes the prefix redundant but harmless (the container prefers a
 * set ADMIN_PASSWORD, and ours holds the same value read from the same file):
 * https://github.com/thijsvanloef/palworld-server-docker/pull/931
 */

import { parseEnvArray } from '../utils/appSpecHelpers';

/**
 * ── The image ────────────────────────────────────────────────────────────────
 * Our own build of the Palworld server (github.com/RunOnFlux/palworld-server-flux):
 * upstream's image plus a health probe that restarts a server which has stopped
 * serving, and a scheduled restart that cannot silently skip. The two failures it
 * exists for both leave the container, the process and every platform health signal
 * looking fine while nobody can play, so no amount of env tuning reaches them.
 *
 * It also resolves the admin password from PalWorldSettings.ini by itself, which is
 * what makes REBOOT_ADMIN_PASSWORD below unnecessary on a server running it.
 */
export const STANDARD_IMAGE = 'runonflux/palworld-server-flux:latest';

/** Images STANDARD_IMAGE replaces, matched on the repository, ignoring the tag. */
const REPLACED_IMAGES = ['thijsvanloef/palworld-server-docker'];

const repoOf = (repotag) => String(repotag || '').split(':')[0];

/** True for a component still running an image we have moved on from. */
export function componentNeedsImageUpdate(component) {
  return REPLACED_IMAGES.includes(repoOf(component?.repotag));
}

/** True when any component of this compose is on a replaced image. */
export function imageNeedsUpdate(compose) {
  return (compose || []).some(componentNeedsImageUpdate);
}

/** True once the server runs an image that authenticates itself against the ini. */
export function imageIsSelfAuthenticating(compose) {
  const first = (compose || [])[0];
  return !!first && !componentNeedsImageUpdate(first);
}

/** The compose with every replaced image swapped for the current one. */
export function standardImagePatch(compose) {
  return (compose || []).map((c) => (
    componentNeedsImageUpdate(c) ? { ...c, repotag: STANDARD_IMAGE } : c
  ));
}

export const REBOOT_ENV_KEYS = {
  enabled: 'AUTO_REBOOT_ENABLED',
  cron: 'AUTO_REBOOT_CRON_EXPRESSION',
  warnMinutes: 'AUTO_REBOOT_WARN_MINUTES',
  force: 'AUTO_REBOOT_EVEN_IF_PLAYERS_ONLINE',
  timeZone: 'TZ',
};

/** Minutes of in-game countdown before a scheduled restart. */
export const REBOOT_WARN_MINUTES = 5;

/** Hour (0-23, in the server's own time zone) used when nothing else is chosen. */
export const DEFAULT_REBOOT_HOUR = 5;

/**
 * The zone list offered in the picker. The buyer's detected zone is always added
 * on top (see timeZoneOptions), so this is only the fallback for someone who wants
 * a zone other than their own — a short, readable list beats 400+ IANA names in a
 * dropdown with no search.
 */
export const COMMON_TIME_ZONES = [
  'UTC',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Warsaw',
  'Europe/Helsinki',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/**
 * The buyer's IANA time zone as reported by the browser. Privacy-hardened browsers
 * report UTC; ancient ones report nothing — both fall back to UTC, which the
 * customer can then change by hand.
 */
export function detectTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.includes('/') ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Select options: detected zone first (if it isn't already in the common list). */
export function timeZoneOptions(selected) {
  const list = [...COMMON_TIME_ZONES];
  [selected, detectTimeZone()].forEach((tz) => {
    if (tz && !list.includes(tz)) list.unshift(tz);
  });
  return list.map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }));
}

/** "05:00" for 5 — the restart hour is always on the hour. */
export function formatHour(hour) {
  return `${String(Number(hour) || 0).padStart(2, '0')}:00`;
}

const REBOOT_SETTINGS_INI = '/palworld/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini';

/**
 * Environment prefix appended to the schedule so the reboot command runs with a working
 * password (see the header). Only the quoted form the server writes is matched; an ini
 * hand-edited to AdminPassword=hunter2 yields an empty password, i.e. today's behaviour.
 */
const REBOOT_ADMIN_PASSWORD = `ADMIN_PASSWORD=$(sed -n 's/.*AdminPassword="\\([^"]*\\)".*/\\1/p' ${REBOOT_SETTINGS_INI})`;

/**
 * The schedule to write for a server on a given image.
 *
 * `selfAuthenticating` (our image) gets a plain cron line, because the container
 * reads AdminPassword out of the ini itself. Upstream's image does not, so its
 * line still has to carry the password prefix or the job dies on a 401 seconds
 * after it starts, silently, every night. Getting this backwards on a server that
 * is still on the old image turns its nightly restart off without telling anyone,
 * so the caller has to say which image the server will be running.
 */
export function cronForHour(hour, { selfAuthenticating = false } = {}) {
  const h = Math.min(23, Math.max(0, Math.round(Number(hour) || 0)));
  return selfAuthenticating ? `0 ${h} * * *` : `0 ${h} * * * ${REBOOT_ADMIN_PASSWORD}`;
}

/**
 * Reads the hour back out of a daily cron; null when the expression isn't one.
 * Anything past the five schedule fields is the command's environment prefix, not part
 * of the schedule, so it is ignored — anchoring on $ here would make every suffixed
 * value unparseable and silently reset the customer's chosen hour to the default.
 */
export function hourFromCron(cron) {
  const m = /^\s*0\s+(\d{1,2})\s+\*\s+\*\s+\*(?:\s|$)/.exec(String(cron || ''));
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

/** True when a stored cron predates the password prefix and has to be rewritten. */
export function cronNeedsAdminPassword(cron) {
  return hourFromCron(cron) !== null && !String(cron).includes('ADMIN_PASSWORD=');
}

/**
 * True when a stored cron still carries the password prefix. On the current image
 * that prefix is dead weight: harmless, but it is the one thing that would leave a
 * long-standing customer holding a different spec from someone who buys today.
 */
export function cronCarriesAdminPassword(cron) {
  return hourFromCron(cron) !== null && String(cron).includes('ADMIN_PASSWORD=');
}

/** Settings object used by the UI. */
export function defaultRebootSettings() {
  return {
    enabled: true,
    hour: DEFAULT_REBOOT_HOUR,
    timeZone: detectTimeZone(),
    force: false,
  };
}

/**
 * UI settings → env vars (as a plain object, ready to merge into a spec).
 *
 * `selfAuthenticating` describes the image the server will be running when this
 * lands, not the one it runs now: the update that swaps the image and the one that
 * rewrites the schedule are the same spec write.
 */
export function buildRebootEnv(settings, { selfAuthenticating = false } = {}) {
  const s = { ...defaultRebootSettings(), ...(settings || {}) };
  return {
    [REBOOT_ENV_KEYS.enabled]: s.enabled ? 'true' : 'false',
    [REBOOT_ENV_KEYS.cron]: cronForHour(s.hour, { selfAuthenticating }),
    [REBOOT_ENV_KEYS.warnMinutes]: String(REBOOT_WARN_MINUTES),
    [REBOOT_ENV_KEYS.force]: s.force ? 'true' : 'false',
    [REBOOT_ENV_KEYS.timeZone]: s.timeZone || 'UTC',
  };
}

/**
 * Env vars → UI settings, for showing an EXISTING server's real configuration.
 *
 * A missing AUTO_REBOOT_ENABLED means the container is running the image default,
 * which is OFF — so that is what we report, otherwise a server bought before we
 * shipped restarts would show a lit toggle while never restarting. Hour and time
 * zone still fall back to our deploy defaults: they are only a starting point for
 * when the customer switches restarts on.
 */
export function parseRebootEnv(envObj) {
  const env = envObj || {};
  const base = defaultRebootSettings();
  const hour = hourFromCron(env[REBOOT_ENV_KEYS.cron]);
  return {
    enabled: String(env[REBOOT_ENV_KEYS.enabled] ?? 'false').toLowerCase() === 'true',
    hour: hour === null ? base.hour : hour,
    timeZone: env[REBOOT_ENV_KEYS.timeZone] || base.timeZone,
    force: String(env[REBOOT_ENV_KEYS.force] ?? 'false').toLowerCase() === 'true',
  };
}

/**
 * "Tomorrow at 05:00 (Europe/Lisbon)" — the same instant the customer's server
 * will restart, so nobody has to convert UTC in their head.
 */
export function describeNextReboot(settings) {
  const s = { ...defaultRebootSettings(), ...(settings || {}) };
  if (!s.enabled) return 'Automatic restarts are off.';
  let nowHourInZone;
  try {
    nowHourInZone = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: s.timeZone, hour: '2-digit', hour12: false,
    }).format(new Date()));
  } catch {
    nowHourInZone = null;
  }
  const when = nowHourInZone === null || nowHourInZone < s.hour ? 'today' : 'tomorrow';
  return `Next restart: ${when} at ${formatHour(s.hour)} (${s.timeZone})`;
}

/**
 * ── The game's standard env baseline ──────────────────────────────────────────
 * What every server we sell today is deployed with. A server bought before one of
 * these existed simply doesn't have the key, so the dashboard offers to add it
 * (see findMissingStandardEnv) instead of silently rewriting the customer's spec.
 *
 * `enforce: true` means the value itself matters and a different one is reported
 * as outdated. `enforce: false` means we only care that the key EXISTS — the
 * customer owns the value (their restart hour, their time zone, restarts off).
 *
 * A customer-owned value can still need a rewrite: `needsUpdate` reports one as
 * outdated and `upgrade` produces the replacement from the value already there, so
 * the customer's own choice is carried across instead of being reset to `value`.
 *
 * Note on DISABLE_GENERATE_SETTINGS for the legacy per-slot Palworld apps (the ones
 * that predate the current marketplace listing and drive SERVER_NAME/PLAYERS from
 * env): adding it stops the container rebuilding PalWorldSettings.ini from those env
 * vars on boot. Their ini already exists on the persisted volume, so the live values
 * carry over — and from then on what the customer edits in the Server Settings tab
 * survives a redeploy instead of being overwritten at every boot.
 */
export const STANDARD_ENV = [
  {
    key: 'DISABLE_GENERATE_SETTINGS',
    value: 'true',
    enforce: true,
    label: 'Keep your server settings',
    description: 'Stops the container rebuilding PalWorldSettings.ini on every boot, so the values you change in the Server Settings tab survive restarts and redeploys.',
  },
  {
    key: 'BACKUP_ENABLED',
    value: 'false',
    enforce: true,
    label: 'Backup handling',
    description: 'Turns off the container\'s own backup job — backups are taken from the dashboard instead, so the server disk is not filled with a second, duplicate copy of your world.',
  },
  {
    key: 'PALWORLD_ALLOW_NEGATIVE_DELTA_TIME',
    value: 'true',
    enforce: true,
    label: 'Crash protection',
    description: 'Enables the game\'s own recovery for the negative delta-time bug that terminates 1.0 servers when the host clock jumps.',
  },
  {
    // The container ships a player-tracking loop that polls its own REST API every
    // PLAYER_LOGGING_POLL_PERIOD (5s) to announce joins and leaves. It authenticates with
    // admin:${ADMIN_PASSWORD} — the ENV VAR, which we never set — while the password the
    // customer types in the Server Settings tab lands in PalWorldSettings.ini. The image has
    // no ini→env path (upstream issue #886), so the loop can never authenticate and every
    // poll writes two lines into the console. We don't use join/leave announcements, so the
    // loop is switched off rather than fed a password: putting ADMIN_PASSWORD in the spec
    // would publish it on-chain, and these apps deploy non-enterprise (unencrypted compose).
    key: 'ENABLE_PLAYER_LOGGING',
    value: 'false',
    enforce: true,
    label: 'Quieter server logs',
    description: 'Stops the container\'s player-tracking loop, which polls the admin API every 5 seconds and fills the console with "Unauthorized" errors. Join and leave announcements are turned off; nothing else changes.',
  },
  {
    key: REBOOT_ENV_KEYS.enabled,
    value: 'true',
    enforce: false,
    label: 'Automatic restarts',
    description: 'Restarts the server on a schedule, which is what clears the memory leak that makes a running server stop accepting players.',
  },
  {
    // The value written here is always the plain line, because this patch is only
    // ever applied together with the image update below, and on that image the
    // container resolves the password itself. A server that has the old prefix is
    // reported as needing an update purely so that nobody is left holding a spec
    // that differs from what a customer buying today receives.
    key: REBOOT_ENV_KEYS.cron,
    value: cronForHour(DEFAULT_REBOOT_HOUR, { selfAuthenticating: true }),
    enforce: false,
    needsUpdate: cronCarriesAdminPassword,
    upgrade: (current) => cronForHour(hourFromCron(current) ?? DEFAULT_REBOOT_HOUR, { selfAuthenticating: true }),
    label: 'Restart schedule',
    description: 'When the daily restart runs.',
    updateDescription: 'Simplifies the schedule your server was given as a workaround for an old bug. The new server image no longer needs it, and your chosen time is kept.',
  },
  {
    key: REBOOT_ENV_KEYS.warnMinutes,
    value: String(REBOOT_WARN_MINUTES),
    enforce: false,
    label: 'In-game warning',
    description: 'Minutes of countdown broadcast to players before a restart.',
  },
  {
    key: REBOOT_ENV_KEYS.force,
    value: 'false',
    enforce: false,
    label: 'Restart with players online',
    description: 'Whether the scheduled restart still runs when someone is playing.',
  },
  {
    key: REBOOT_ENV_KEYS.timeZone,
    value: 'UTC',
    enforce: false,
    label: 'Time zone',
    description: 'The zone the restart schedule is expressed in.',
  },
];

/**
 * Which standard settings this server is missing (or has at an outdated value).
 * Returns [] for a server that is fully up to date.
 *
 * @param {object} envObj current env as { KEY: value } (see parseEnvArray)
 * @returns {Array<{key,label,description,value,reason}>}
 */
export function findMissingStandardEnv(envObj) {
  const env = envObj || {};
  const out = [];
  for (const item of STANDARD_ENV) {
    const current = env[item.key];
    if (current === undefined || current === '') {
      out.push({ ...item, reason: 'missing' });
    } else if (item.enforce && String(current).toLowerCase() !== String(item.value).toLowerCase()) {
      out.push({ ...item, reason: 'outdated' });
    } else if (item.needsUpdate && item.needsUpdate(current)) {
      out.push({ ...item, reason: 'outdated' });
    }
  }
  return out;
}

/**
 * The patch to apply for a one-click "update my server": only the keys reported by
 * findMissingStandardEnv, so nothing the customer configured is overwritten. TZ
 * defaults to the browser's zone rather than the spec's literal UTC — a restart at
 * "05:00 UTC" is the wrong 05:00 for most of the world. An entry with `upgrade`
 * rewrites the value the server already has, keeping the customer's choice inside it.
 */
export function standardEnvPatch(envObj) {
  const env = envObj || {};
  const patch = {};
  for (const item of findMissingStandardEnv(env)) {
    const current = env[item.key];
    if (item.upgrade && current !== undefined && current !== '') {
      patch[item.key] = item.upgrade(current);
    } else if (item.key === REBOOT_ENV_KEYS.timeZone) {
      patch[item.key] = detectTimeZone();
    } else {
      patch[item.key] = item.value;
    }
  }
  return patch;
}

/**
 * How many standard settings a server in the dashboard list is missing.
 *
 * Reads the env off the spec the list already holds, so a badge on every row costs no
 * extra request. Answers 0 — rather than "everything is missing" — for the cases where
 * the env is not visible or not settled yet: an enterprise spec ships an empty compose
 * until it is decrypted, and a server that is still installing (or on its way out) has
 * nothing to apply an update to.
 *
 * @param {object} server a dashboard server (see transformFluxAppToServer)
 */
export function pendingStandardUpdates(server) {
  if (!server || server.enterprise) return 0;
  if (server.status && server.status !== 'running') return 0;
  const env = server.compose?.[0]?.environmentParameters;
  if (!Array.isArray(env)) return 0;
  return findPendingUpdates(server.compose).length;
}

/**
 * ── Everything an existing server is behind on ───────────────────────────────
 * The env baseline above plus the image, in one list, because they are applied in
 * one spec write and the customer should read them as one thing: "make my server
 * the server someone buying today would get".
 *
 * The ordering matters for how it reads: the image is the reason the rest is safe,
 * so it goes first.
 */
export function findPendingUpdates(compose) {
  const env = parseEnvArray(compose?.[0]?.environmentParameters);
  const items = findMissingStandardEnv(env);
  if (imageNeedsUpdate(compose)) {
    items.unshift({
      key: '__image__',
      kind: 'image',
      reason: 'outdated',
      label: 'Server software',
      description: 'Moves your server onto our own build, which watches for the two ways a Palworld server can go on running while nobody can play, warns anyone still connected, and restarts it by itself. Your world, your settings and your server address are untouched.',
      updateDescription: 'Moves your server onto our own build, which watches for the two ways a Palworld server can go on running while nobody can play, warns anyone still connected, and restarts it by itself. Your world, your settings and your server address are untouched.',
    });
  }
  return items;
}

/**
 * The single patch behind the "Update my server" button: the env keys that are
 * missing or stale, and the compose with the image swapped. Both or neither — the
 * plain cron line the env patch writes only works on the new image, so they must
 * reach the chain in the same update.
 *
 * `compose` is null when the image is already current, so the caller can leave the
 * existing compose alone.
 */
export function standardUpdatePatch(compose) {
  const env = parseEnvArray(compose?.[0]?.environmentParameters);
  return {
    env: standardEnvPatch(env),
    compose: imageNeedsUpdate(compose) ? standardImagePatch(compose) : null,
  };
}
