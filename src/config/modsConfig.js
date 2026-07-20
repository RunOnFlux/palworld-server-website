/**
 * Palworld Mods configuration
 *
 * Palworld has no Steam Workshop, so mods are distributed as `.pak` files
 * (Nexus / CurseForge). Server-side pak mods load when placed in the game's
 * `Pal/Content/Paks/~mods` folder. The Mods tab installs a `.pak` by uploading
 * it via the Flux node file-manager API (the same one the Files/Config tabs use).
 *
 * ── REQUIRED marketplace mount ────────────────────────────────────────────────
 * The PalWorld marketplace app persists only `Pal/Saved`:
 *     containerData: "g:/palworld/Pal/Saved"
 * Pak mods must live in `Pal/Content/Paks/~mods`, which is OUTSIDE that volume and
 * therefore NOT reachable by the file manager. FluxOS supports multiple mounts
 * (pipe-separated) incl. a directory mount `m:<subdir>:<containerPath>`, so the
 * deploy injects a second, persisted mount that maps a `mods` subdir into the
 * game's ~mods folder:
 *
 *     containerData: "g:/palworld/Pal/Saved|m:mods:/palworld/Pal/Content/Paks/~mods"
 *
 * FluxOS then exposes that subdir to the file manager at the volume root as `mods/`
 * (the primary volume is `appdata/`, any m:<subdir> mount is a sibling — see FluxOS
 * IOUtils.getVolumeInfo / mountParser). Uploads to `mods/` land in the container's
 * ~mods folder, which Unreal loads on top of the base paks.
 */
export const MODS_VOLUME_PATH = 'mods';

/**
 * FluxOS directory mount that persists the `mods` subdir and binds it into the
 * game's `~mods` pak folder inside the container. Injected into containerData at
 * deploy time so every server built from this site supports the Mods tab without
 * requiring a marketplace app-spec change.
 * Format: m:<subdir>:<absolute container path>  (see FluxOS mountParser).
 */
export const MODS_MOUNT = 'm:mods:/palworld/Pal/Content/Paks/~mods';

/**
 * Append the mods mount to an existing containerData string (idempotent).
 * Returns the input unchanged when there is no primary volume to preserve, or
 * when the mount is already present.
 */
export function withModsMount(containerData) {
  const base = (containerData || '').trim();
  if (!base) return containerData || '';
  const parts = base.split('|').map((m) => m.trim()).filter(Boolean);
  if (parts.includes(MODS_MOUNT)) return parts.join('|');
  return [...parts, MODS_MOUNT].join('|');
}

/**
 * Mod catalog.
 *
 * Palworld has no public registry of stable, direct-download `.pak` links:
 *  - Nexus Mods (the biggest host) is login-gated, so its download URLs can't be
 *    hardcoded for one-click install.
 *  - CurseForge / GitHub release assets DO expose direct file URLs.
 *
 * Two kinds of entry:
 *  1. DIRECT entry — has `downloadUrl` (a direct .pak link) + `fileName`. Rare.
 *  2. BROWSE entry — has only `sourceUrl`. Opens the mod host so the user can grab
 *     the `.pak` and add it via "Upload from your PC".
 */
export const MOD_CATALOG = [
  // --- Real server-side gameplay pak mods (Browse → download → Upload from PC) ---
  {
    id: 'cake-fast-breed-farm',
    name: 'Cake Fast Breed Farm',
    author: 'MoxxyHaven',
    description: 'Speeds up breeding-farm egg production. Server-side gameplay pak. Browse → download the .pak → upload it below.',
    sourceUrl: 'https://www.curseforge.com/palworld/patch-pak-mods/cake-fast-breed-farm',
    downloadUrl: '',
    fileName: '',
  },

  // --- BROWSE entries: real hosts to find more mods ---
  {
    id: 'curseforge-browse',
    name: 'Browse Pak mods on CurseForge',
    author: 'CurseForge',
    description: 'Server-installable “Patch Pak” mods. Download a .pak and add it below. (Skip Lua/UE4SS mods — those need UE4SS, not a ~mods pak.)',
    sourceUrl: 'https://www.curseforge.com/palworld/patch-pak-mods',
    downloadUrl: '',
    fileName: '',
  },
  {
    id: 'nexus-browse',
    name: 'Browse mods on Nexus Mods',
    author: 'Nexus Mods',
    description: 'The largest Palworld mod host. Download a .pak and add it below (Nexus needs a login, so it can’t one-click install).',
    sourceUrl: 'https://www.nexusmods.com/games/palworld/mods',
    downloadUrl: '',
    fileName: '',
  },
];

/**
 * Accept a raw user URL and derive a safe .pak filename from it.
 */
export function fileNameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    if (last && /\.pak$/i.test(last)) return last;
  } catch { /* fall through */ }
  return '';
}
