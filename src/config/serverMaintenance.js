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
 */

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

export function cronForHour(hour) {
  const h = Math.min(23, Math.max(0, Math.round(Number(hour) || 0)));
  return `0 ${h} * * *`;
}

/** Reads the hour back out of a daily cron; null when the expression isn't one. */
export function hourFromCron(cron) {
  const m = /^\s*0\s+(\d{1,2})\s+\*\s+\*\s+\*\s*$/.exec(String(cron || ''));
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
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

/** UI settings → env vars (as a plain object, ready to merge into a spec). */
export function buildRebootEnv(settings) {
  const s = { ...defaultRebootSettings(), ...(settings || {}) };
  return {
    [REBOOT_ENV_KEYS.enabled]: s.enabled ? 'true' : 'false',
    [REBOOT_ENV_KEYS.cron]: cronForHour(s.hour),
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
    key: REBOOT_ENV_KEYS.cron,
    value: cronForHour(DEFAULT_REBOOT_HOUR),
    enforce: false,
    label: 'Restart schedule',
    description: 'When the daily restart runs.',
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
    }
  }
  return out;
}

/**
 * The patch to apply for a one-click "update my server": only the keys reported by
 * findMissingStandardEnv, so nothing the customer configured is overwritten. TZ
 * defaults to the browser's zone rather than the spec's literal UTC — a restart at
 * "05:00 UTC" is the wrong 05:00 for most of the world.
 */
export function standardEnvPatch(envObj) {
  const patch = {};
  for (const item of findMissingStandardEnv(envObj)) {
    patch[item.key] = item.key === REBOOT_ENV_KEYS.timeZone ? detectTimeZone() : item.value;
  }
  return patch;
}
