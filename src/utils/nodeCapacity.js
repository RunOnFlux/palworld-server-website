import { nodeApiBase } from './appPower';

/**
 * Why an app can end up running nowhere.
 *
 * A Flux app is only placed on nodes that (a) match its geolocation, (b) are big
 * enough for its hardware, and (c) still have that hardware FREE. A customer who
 * picks a narrow location — one country, or worse one US region — can end up with a
 * handful of candidate nodes, and once those fill up with other people's apps the
 * app has nowhere to go: `/apps/location/<name>` returns an empty list and the
 * server never comes up, with nothing in the dashboard explaining why.
 *
 * This module answers that question with numbers: how many nodes the customer's
 * locations actually match, and how many of them have room right now. The fix it
 * points at is always the same one — widen the locations.
 */

/** Resources reserved for the node OS/FluxOS — an app can only use what is left. */
export const OS_RESERVE = { cores: 1, ram: 2, ssd: 80 };

/**
 * Spare unique IPs a location must have BEYOND the instance count before we let a
 * customer deploy into it.
 *
 * Matching the instance count exactly is not enough, and we have the receipts: a server
 * sold into Brazil (2 unique IPs, 2 instances) never got placed, because the nodes behind
 * those IPs were already full of other people's apps. `nodeFitsApp` only knows a node is
 * BIG enough, never whether it is FREE — the headroom is what covers that blind spot,
 * plus the ordinary churn of nodes going offline.
 *
 * One spare IP is the deliberate setting: it keeps small markets (3 IPs for a 2-instance
 * app, e.g. Singapore) selectable, at the cost of not covering the case where every spare
 * node is also full. The placement diagnosis in this module is what catches that after
 * the fact, and it tells the customer to widen.
 *
 * A region is the narrowest thing a customer can pick, so it needs more slack than a
 * country: fewer nodes, and a single operator's rack can be most of them.
 */
export const IP_HEADROOM = 1;
export const REGION_IP_HEADROOM = 2;

const STATS_URL = 'https://stats.runonflux.io/fluxinfo';
const NODE_CACHE_KEY = 'fluxNodeCapacityCache';
const NODE_CACHE_TTL_MS = 10 * 60 * 1000;
// A sanity floor: the network is thousands of nodes, so a short answer means the
// stats endpoint is degraded and counting it would produce a false alarm.
const MIN_PLAUSIBLE_NODES = 5000;
// Probing free capacity means one request per candidate NODE (not per unique IP — several
// nodes can share an IP, and each has its own free capacity). Worth it for the tight
// selections this diagnosis is about; pointless (and rude) for a whole continent. The
// requests all go out in parallel and cap at PROBE_TIMEOUT_MS, so the ceiling costs
// latency only in the pathological case where every node is unreachable.
const MAX_NODES_TO_PROBE = 32;
const PROBE_TIMEOUT_MS = 6000;

/**
 * Normalized node list from the Flux stats API, cached per tab for 10 minutes: the
 * payload is megabytes and both the location picker and the placement diagnosis want it.
 *
 * The `flux` projection is always requested, even for non-enterprise apps. It is the
 * only place the node's API PORT appears (`geolocation.ip` is the bare address), and one
 * public IP routinely hosts several nodes on different ports — asking the wrong one for
 * its free capacity is how a busy node gets reported as free. It also carries
 * arcaneVersion, which enterprise apps are filtered on.
 */
export async function fetchFluxNodes() {
  const cacheKey = NODE_CACHE_KEY;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (cached && Date.now() - cached.at < NODE_CACHE_TTL_MS && Array.isArray(cached.nodes)) {
      return cached.nodes;
    }
  } catch { /* unreadable cache — refetch */ }

  const resp = await fetch(`${STATS_URL}?projection=geolocation,benchmark,flux`);
  const result = await resp.json();
  if (result.status !== 'success' || !Array.isArray(result.data) || result.data.length < MIN_PLAUSIBLE_NODES) {
    return [];
  }

  const nodes = [];
  result.data.forEach((n) => {
    const g = n.geolocation;
    if (!g?.continentCode || !g?.countryCode) return;
    const b = n.benchmark?.bench || {};
    if (!b.cores) return;
    const rawIp = n.flux?.ip || g.ip || '';
    nodes.push({
      cont: g.continentCode,
      country: g.countryCode,
      // Matched verbatim by FluxOS as the third geolocation level.
      region: g.regionName || '',
      ip: rawIp.split(':')[0],
      // Kept with its port: the node API is addressed as <ip>-<port>.node.api.runonflux.io,
      // and several nodes can share one IP behind different ports.
      apiIp: rawIp,
      cores: b.cores,
      ram: b.ram || 0,
      ssd: b.ssd || 0,
      arcane: !!n.flux?.arcaneVersion,
    });
  });

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), nodes }));
  } catch { /* quota — fine, we just refetch next time */ }
  return nodes;
}

/** Per-node hardware an app needs = the sum of every compose component (ram MB → GB). */
export function appHardware(compose) {
  let cpu = 0, ramMb = 0, hdd = 0;
  (compose || []).forEach((c) => {
    cpu += Number(c.cpu) || 0;
    ramMb += Number(c.ram) || 0;
    hdd += Number(c.hdd) || 0;
  });
  return { cpu, ramGB: ramMb / 1000, hddGB: hdd };
}

/** Whether a node is big enough to host the app at all (ignores what is already on it). */
export function nodeFitsApp(node, hw, isEnterprise = false) {
  return (node.cores - OS_RESERVE.cores) >= hw.cpu
    && (node.ram - OS_RESERVE.ram) >= hw.ramGB
    && (node.ssd - OS_RESERVE.ssd) >= hw.hddGB
    && (!isEnterprise || node.arcane);
}

/**
 * Does a node satisfy one geolocation entry?
 *
 * FluxOS encodes allowed locations as `ac<CONT>[_<COUNTRY>[_<REGION>]]` and forbidden
 * ones as `a!c<CONT>[_...]`. The site only ever writes allowed entries, but a spec
 * edited elsewhere can carry both, so we honour the negative form too.
 */
function matchesGeoEntry(node, entry) {
  const negative = entry.startsWith('a!c');
  const code = entry.replace(/^a!?c/, '');
  const [cont, country, ...regionParts] = code.split('_');
  // Region names legitimately contain underscores, so rejoin everything past the country.
  const region = regionParts.join('_');
  let hit = node.cont === cont;
  if (hit && country) hit = node.country === country;
  if (hit && region) hit = node.region === region;
  return { hit, negative };
}

/** Nodes allowed by a spec's whole `geolocation` array (empty array = anywhere). */
export function nodesInGeolocation(nodes, geolocation) {
  const entries = (geolocation || []).filter((e) => typeof e === 'string' && e);
  if (!entries.length) return nodes;
  const allow = entries.filter((e) => !e.startsWith('a!c'));
  return nodes.filter((n) => {
    for (const entry of entries) {
      const { hit, negative } = matchesGeoEntry(n, entry);
      if (hit && negative) return false;
    }
    if (!allow.length) return true; // only exclusions were set
    return allow.some((entry) => matchesGeoEntry(n, entry).hit);
  });
}

/**
 * How much room the customer's locations leave for THIS app.
 * `ipCount` is what matters for placement: FluxOS spreads instances across unique
 * public IPs, so two nodes behind one IP can only ever host one instance.
 */
export function capacityForGeolocation(nodes, geolocation, hw, isEnterprise = false) {
  const candidates = nodesInGeolocation(nodes, geolocation).filter((n) => nodeFitsApp(n, hw, isEnterprise));
  const ips = new Set(candidates.filter((n) => n.ip).map((n) => n.ip));
  return { candidates, nodeCount: candidates.length, ipCount: ips.size };
}

/**
 * Per-node readings of committed resources, cached in-tab for 2 minutes.
 *
 * Two callers probe now — the deploy wizard and the dashboard diagnosis — and a customer
 * editing their location list re-probes the same nodes on every change. We cache what the
 * node REPORTED rather than a yes/no verdict, so one reading answers for any plan size.
 * A Map rather than sessionStorage: probes run concurrently, and a read-modify-write
 * against shared storage would drop entries.
 */
const usedCache = new Map();
const PROBE_CACHE_TTL_MS = 2 * 60 * 1000;

/**
 * Ask a node how much of its hardware is already committed to apps.
 * `/apps/appsresources` is public and cached node-side for 30s. Anything that fails
 * counts as "unknown", never as "free" — a wrong "there is room" reading would send
 * the customer chasing the wrong problem.
 */
async function nodeUsedResources(node) {
  const key = node.apiIp || node.ip;
  const hit = usedCache.get(key);
  if (hit && Date.now() - hit.at < PROBE_CACHE_TTL_MS) return hit.used;

  const base = nodeApiBase(key);
  if (!base) return { known: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  let used = { known: false };
  try {
    const res = await fetch(`${base}/apps/appsresources`, { signal: controller.signal });
    const body = await res.json();
    const d = body?.data;
    if (body?.status === 'success' && d) {
      used = {
        known: true,
        cpu: Number(d.appsCpusLocked) || 0,
        ramGB: (Number(d.appsRamLocked) || 0) / 1000, // node reports MB
        hddGB: Number(d.appsHddLocked) || 0,
      };
    }
  } catch { /* unreachable or malformed — stays unknown */ } finally {
    clearTimeout(timer);
  }
  // Failures are cached too: a node that just timed out is not worth re-asking on the
  // customer's next click, and two minutes is short enough to recover.
  usedCache.set(key, { at: Date.now(), used });
  return used;
}

/** Whether a node still has room for the app on top of what it already runs. */
function nodeHasRoom(node, used, hw) {
  return (node.cores - OS_RESERVE.cores - used.cpu) >= hw.cpu
    && (node.ram - OS_RESERVE.ram - used.ramGB) >= hw.ramGB
    && (node.ssd - OS_RESERVE.ssd - used.hddGB) >= hw.hddGB;
}

/**
 * How many of the candidate nodes' unique public IPs can actually take the app right now.
 *
 * @returns {Promise<number|null>} null when we cannot tell — too many candidates to probe
 *          politely, or every probe failed. Never substitute a guess: both callers turn
 *          this into something the customer acts on, and a made-up number is worse than
 *          saying nothing.
 */
export async function probeFreeIpCount(candidates, hw) {
  if (!candidates?.length || candidates.length > MAX_NODES_TO_PROBE) return null;
  const results = await Promise.all(
    candidates.map(async (n) => ({ node: n, used: await nodeUsedResources(n) })),
  );
  if (!results.some((r) => r.used.known)) return null;
  const freeIps = new Set(
    results
      .filter((r) => r.node.ip && r.used.known && nodeHasRoom(r.node, r.used, hw))
      .map((r) => r.node.ip),
  );
  return freeIps.size;
}

/**
 * Diagnose why an app has fewer running instances than it should, in terms of the
 * one thing the customer can act on: their chosen locations.
 *
 * @returns {Promise<null|{severity,title,message,nodeCount,ipCount,freeIpCount,probed,instances,running,worldwide}>}
 *          null when the locations are not the problem (or we cannot tell).
 */
export async function diagnosePlacement({ geolocation, compose, instances = 1, isEnterprise = false, running = 0 }) {
  if (running >= instances) return null;

  const hw = appHardware(compose);
  if (!hw.cpu && !hw.ramGB) return null; // no spec to reason about

  const nodes = await fetchFluxNodes();
  if (!nodes.length) return null; // stats unavailable — say nothing rather than guess

  const worldwide = !(geolocation || []).length;
  const { candidates, nodeCount, ipCount } = capacityForGeolocation(nodes, geolocation, hw, isEnterprise);

  // Not enough distinct IPs to ever satisfy the instance count: a hard configuration
  // problem that no amount of waiting fixes.
  if (ipCount < instances) {
    return {
      severity: 'blocked',
      title: worldwide
        ? 'No node can host this server right now'
        : 'Your locations are too narrow for this plan',
      message: worldwide
        ? `Only ${ipCount} node${ipCount === 1 ? '' : 's'} on the network currently fit this plan's hardware, and it needs ${instances}.`
        : `The locations you picked match ${nodeCount} node${nodeCount === 1 ? '' : 's'} (${ipCount} unique IP${ipCount === 1 ? '' : 's'}) able to run this plan, but your server needs ${instances}. Add another location so it has somewhere to go.`,
      nodeCount, ipCount, freeIpCount: null, probed: false, instances, running, worldwide,
    };
  }

  // Enough nodes exist on paper — the usual cause is that they are all already full.
  // Only worth probing for a small candidate set (which is exactly the case at risk).
  const freeIpCount = await probeFreeIpCount(candidates, hw);
  const probed = freeIpCount !== null;

  if (probed && freeIpCount < instances) {
    return {
      severity: 'full',
      title: 'The nodes in your locations are full',
      message: `Your locations match ${nodeCount} node${nodeCount === 1 ? '' : 's'} (${ipCount} unique IP${ipCount === 1 ? '' : 's'}), but ${freeIpCount === 0 ? 'none of them has' : `only ${freeIpCount} has`} room for this plan right now — your server needs ${instances}. Adding another location gives it more nodes to choose from.`,
      nodeCount, ipCount, freeIpCount, probed, instances, running, worldwide,
    };
  }

  // Room exists: the app is probably still being placed. Only say something once the
  // customer is clearly stuck (nothing running at all), and say it softly.
  if (running === 0) {
    return {
      severity: 'waiting',
      title: 'Your server has not been placed yet',
      message: `${ipCount} node${ipCount === 1 ? '' : 's'} in your locations can host this plan, so it should come up shortly. If it stays like this, adding another location usually gets it placed faster.`,
      nodeCount, ipCount, freeIpCount, probed, instances, running, worldwide,
    };
  }

  return null;
}
