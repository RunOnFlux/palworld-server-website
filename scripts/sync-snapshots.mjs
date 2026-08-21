#!/usr/bin/env node
// Refresh the build-time data snapshots that the SSR prerender renders from.
//
// Two sections of the homepage are driven by live APIs: the pricing plans
// (jetpackbridge marketplace) and the node map (stats.runonflux.io). Neither API is
// called during `renderToString` — nothing fetches on the server — so without a snapshot
// the prerendered HTML shipped a "Loading pricing plans..." spinner and dropped the
// locations section entirely. The plan names, RAM tiers, per-plan prices, the
// ItemList/Offer JSON-LD and the "N servers across M countries" line were invisible to
// every crawler that does not execute JavaScript. That is most LLM crawlers, which
// public/robots.txt explicitly invites in.
//
// The snapshots are COMMITTED, and this script is best-effort: if an API is unreachable
// or returns something implausible, the existing file is left alone and the build carries
// on with the last known-good data. They are only ever the first paint — the components
// still fetch live on mount and replace them.
//
// Run automatically as part of `npm run build`, or by hand with `npm run sync:snapshots`.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'src', 'config', 'snapshots');

const MARKETPLACE_URL = 'https://jetpackbridge.runonflux.io/api/v1/marketplace/apps';
const FLUXINFO_URL = 'https://stats.runonflux.io/fluxinfo?projection=geolocation,tier';
const APP_NAME = 'PalWorld';
const TIMEOUT_MS = 30000;

const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** Write `data` to snapshots/<name>.json, or keep the committed file if `data` is null. */
async function commit(name, data, describe) {
  const path = join(outDir, `${name}.json`);
  if (!data) {
    const kept = await readFile(path, 'utf8').then(JSON.parse).catch(() => null);
    console.warn(`[snapshots] ${name}: refresh failed, keeping committed snapshot` +
      (kept ? ` (${describe(kept)})` : ' (none on disk — SSR will fall back to the live fetch)'));
    return;
  }
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`[snapshots] ${name}: ${describe(data)}`);
}

// ---------------------------------------------------------------------------
// Pricing plans.
//
// Display fields only. `_config` / `_app` (the full compose spec the deploy dialog needs)
// are deliberately NOT snapshotted: they are large, they would be embedded in every
// prerendered page, and a stale compose is a far worse failure than a stale price.
// `snapshot: true` marks these plans so PricingPlans keeps the deploy button disabled
// until the live fetch lands.
// ---------------------------------------------------------------------------

// Palworld player tiers by RAM (MB), sized for Palworld 1.0 (max 32 players). Mirrors
// MarketplaceService.getServerPlans() — keep the two in step.
const PLAYER_TIERS = [[16000, 32], [12000, 16], [8000, 8], [5000, 4]];
const playersFor = (ramMb) => PLAYER_TIERS.find(([t]) => ramMb >= t)?.[1] ?? 4;

async function buildPlans() {
  try {
    const json = await getJson(MARKETPLACE_URL);
    const app = (json.data || [])
      .filter((a) => a.visible !== false && a.enabled !== false)
      .find((a) => a.name === APP_NAME && a.useConfig && a.configs?.length);
    if (!app) throw new Error(`app "${APP_NAME}" not in marketplace response (or has no configs)`);

    const plans = app.configs.map((config, index) => {
      const component = config.components?.[0] || {};
      const cpu = component.cpu || component.cpubasic || 0;
      const ram = component.ram || component.rambasic || 0;
      const hdd = component.hdd || component.hddbasic || 0;
      const players = playersFor(ram);

      return {
        id: config.id || `config-${index}`,
        name: config.name || `Server Plan ${index + 1}`,
        description: config.description || app.description || 'Palworld dedicated server hosting',
        popular: false,
        price: config.price ? {
          monthly: config.price * 100,
          currency: 'USD',
          displayPrice: `$${config.price.toFixed(2)}`,
        } : null,
        playerLimit: players,
        specs: {
          players: `~${players} players`,
          ram: ram ? `${parseFloat((ram / 1000).toFixed(1))} GB` : 'N/A',
          storage: hdd ? `${hdd} GB SSD/NVMe` : 'N/A',
          cpu: cpu ? `${parseFloat(cpu.toFixed(1))} ${cpu > 1 ? 'vCores' : 'vCore'}` : 'N/A',
          bandwidth: 'Unlimited',
        },
        snapshot: true,
      };
    }).sort((a, b) => (a.price?.monthly ?? Infinity) - (b.price?.monthly ?? Infinity));

    // Middle plan is the highlighted one, same rule the service applies.
    if (plans.length) plans[Math.floor(plans.length / 2)].popular = true;

    // Sanity gate: a snapshot without priced plans is worse than the committed one,
    // because it would put "N/A" into the HTML and into the Offer JSON-LD.
    if (!plans.length || plans.some((p) => !p.price || p.specs.ram === 'N/A')) {
      throw new Error(`implausible plans: ${JSON.stringify(plans.map((p) => [p.name, p.price?.displayPrice]))}`);
    }
    return plans;
  } catch (err) {
    console.warn(`[snapshots] plans: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Node locations.
//
// Country-level clusters only. cityClusters are thousands of entries that exist purely
// for the zoomed map, are worth nothing to a crawler, and would dominate the bundle — the
// live fetch fills them in. `total` and `countryCount` are the numbers in the copy.
// ---------------------------------------------------------------------------
async function buildLocations() {
  try {
    const json = await getJson(FLUXINFO_URL);
    if (json.status !== 'success' || !Array.isArray(json.data)) throw new Error('unexpected payload');

    const countries = {};
    let total = 0;
    for (const node of json.data) {
      const lat = parseFloat(node.geolocation?.lat);
      const lon = parseFloat(node.geolocation?.lon);
      if (isNaN(lat) || isNaN(lon)) continue;
      const country = node.geolocation?.country || 'Unknown';
      if (!countries[country]) countries[country] = { lat, lon, count: 0, country };
      countries[country].count++;
      total++;
    }

    const snapshot = {
      // Same >= 3 threshold processNodeData() applies, so the snapshot and the live data
      // draw the same set of markers and the map does not reshuffle on fetch.
      clusters: Object.values(countries).filter((c) => c.count >= 3),
      cityClusters: [],
      total,
      countryCount: Object.keys(countries).length,
    };

    if (snapshot.total < 100 || snapshot.countryCount < 10) {
      throw new Error(`implausible network size: ${snapshot.total} nodes / ${snapshot.countryCount} countries`);
    }
    return snapshot;
  } catch (err) {
    console.warn(`[snapshots] locations: ${err.message}`);
    return null;
  }
}

const [plans, locations] = await Promise.all([buildPlans(), buildLocations()]);

await commit('plans', plans, (d) => `${d.length} plans, ${d.map((p) => p.price?.displayPrice).join(' / ')}`);
await commit('locations', locations, (d) => `${d.total} nodes across ${d.countryCount} countries (${d.clusters.length} mapped)`);
