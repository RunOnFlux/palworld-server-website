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
 *
 * WHERE THE NUMBERS COME FROM
 *
 * One request to the Flux stats aggregate carries, for every node on the network,
 * both its specs and what its apps have already reserved:
 *
 *   apps.fluxusage.nodeSpecs  -> { cpuCores, ram (MB), ssdStorage (GB) }
 *   apps.resources            -> { appsCpusLocked, appsRamLocked, appsHddLocked }
 *
 * `apps.resources` is the same payload a node serves from its own
 * `/apps/appsresources`, and `nodeSpecs` is exactly what FluxOS measures on itself
 * (os.cpus().length, os.totalmem(), the benchmark's ssd) rather than an approximation
 * from the benchmark block. So the whole network's free capacity is one cached call,
 * and the arithmetic below can mirror FluxOS's own admission check line for line.
 *
 * This replaced a scheme that probed candidate nodes directly for their
 * `/apps/appsresources`. That could only afford to probe a bounded number of nodes,
 * which left every selection above the cap unmeasured — twenty of the fifty-six
 * countries with capacity, including the US and France. The aggregate has no such
 * cliff and is smaller than the node-list request it folds into.
 *
 * It is refreshed several times a day rather than live, so a node that filled up in
 * the last few minutes can still read as free. That is an acceptable trade for an
 * advisory number: being slightly behind is not the failure mode that hurt customers.
 */

/**
 * Resources reserved for the node OS/FluxOS — an app can only use what is left.
 * Mirrors `config.lockedSystemResources` in FluxOS: cpu 10 (tenths of a core),
 * ram 2000 MB, hdd 60 plus extrahdd 20.
 */
export const OS_RESERVE = { cores: 1, ram: 2, ssd: 80 };

/**
 * FluxOS only ever offers 95% of a node's disk to apps before subtracting the
 * reserve (`totalSpaceOnNode * 0.95 - hdd - extrahdd` in checkAppHWRequirements).
 * Leaving it out made us count roughly 11 GB per 220 GB node that FluxOS would
 * never hand out.
 */
const DISK_USABLE_FACTOR = 0.95;

/**
 * Spare unique IPs a location should have BEYOND the instance count before a
 * selection is comfortable.
 *
 * Matching the instance count exactly is not enough, and we have the receipts: a server
 * sold into Brazil (2 unique IPs, 2 instances) never got placed, because the nodes behind
 * those IPs were already full of other people's apps. One spare IP is the deliberate
 * setting: it keeps small markets selectable while flagging the ones with no slack.
 */
export const IP_HEADROOM = 1;

const STATS_URL = 'https://stats.runonflux.io/fluxinfo';
// Nested projections keep this to a fraction of the whole-document payload while
// carrying more than the old specs-only request did.
const STATS_PROJECTION = [
  'flux.ip',
  'flux.arcaneVersion',
  'geolocation.continentCode',
  'geolocation.countryCode',
  'geolocation.regionName',
  'apps.resources',
  'apps.fluxusage.nodeSpecs',
].join(',');
// Bumped with the payload shape: a tab holding a cache written by the previous build
// would return nodes with no `used` reading, and every capacity call would throw on it.
const NODE_CACHE_KEY = 'fluxNodeCapacityCache.v2';
const NODE_CACHE_TTL_MS = 10 * 60 * 1000;
// A sanity floor: the network is thousands of nodes, so a short answer means the
// stats endpoint is degraded and counting it would produce a false alarm.
const MIN_PLAUSIBLE_NODES = 5000;

/**
 * Normalized node list from the Flux stats API, cached per tab for 10 minutes: the
 * payload is megabytes and both the location picker and the placement diagnosis want it.
 *
 * `flux.ip` is kept whole as `apiIp` as well as split: it is the only place the node's
 * API PORT appears (`geolocation.ip` is the bare address), and one public IP routinely
 * hosts several nodes on different ports. `arcaneVersion` is what enterprise apps are
 * filtered on.
 *
 * A node missing either its specs or its resource reading is dropped rather than
 * guessed at: counting it would overstate capacity, which is the direction that costs
 * customers a server that never places.
 */
export async function fetchFluxNodes() {
  const cacheKey = NODE_CACHE_KEY;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (cached && Date.now() - cached.at < NODE_CACHE_TTL_MS && Array.isArray(cached.nodes)) {
      return cached.nodes;
    }
  } catch { /* unreadable cache — refetch */ }

  let result;
  try {
    const resp = await fetch(`${STATS_URL}?projection=${STATS_PROJECTION}`);
    result = await resp.json();
  } catch {
    return [];
  }
  if (result?.status !== 'success' || !Array.isArray(result.data) || result.data.length < MIN_PLAUSIBLE_NODES) {
    return [];
  }

  const nodes = [];
  result.data.forEach((n) => {
    const g = n?.geolocation;
    if (!g?.continentCode || !g?.countryCode) return;
    const apps = n?.apps;
    const specs = apps?.fluxusage?.nodeSpecs;
    const used = apps?.resources;
    if (!specs?.cpuCores || !used || typeof used.appsCpusLocked !== 'number') return;
    const rawIp = n?.flux?.ip || '';
    nodes.push({
      cont: g.continentCode,
      country: g.countryCode,
      // Matched verbatim by FluxOS as the third geolocation level.
      region: g.regionName || '',
      ip: rawIp.split(':')[0],
      // Kept with its port: several nodes can share one IP behind different ports.
      apiIp: rawIp,
      cores: specs.cpuCores,
      // nodeSpecs.ram is MB, and app specs are MB too. Divide by 1000 (not 1024) so
      // this stays in the same units the compose values are expressed in.
      ram: specs.ram / 1000,
      ssd: specs.ssdStorage || 0,
      arcane: !!n?.flux?.arcaneVersion,
      // What apps on this node have already reserved, in the same units as above.
      used: {
        cpu: used.appsCpusLocked || 0,
        ramGB: (used.appsRamLocked || 0) / 1000,
        hddGB: used.appsHddLocked || 0,
      },
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

/**
 * What a node can offer apps in total, before anything is placed on it.
 * The three lines are FluxOS's `checkAppHWRequirements` with the comparison removed.
 */
function totalForApps(node) {
  return {
    cpu: node.cores - OS_RESERVE.cores,
    ramGB: node.ram - OS_RESERVE.ram,
    hddGB: node.ssd * DISK_USABLE_FACTOR - OS_RESERVE.ssd,
  };
}

/** Whether a node is big enough to host the app at all (ignores what is already on it). */
export function nodeFitsApp(node, hw, isEnterprise = false) {
  if (isEnterprise && !node.arcane) return false;
  const total = totalForApps(node);
  return total.cpu >= hw.cpu && total.ramGB >= hw.ramGB && total.hddGB >= hw.hddGB;
}

/**
 * Whether a node still has room for the app on top of what it already runs.
 *
 * Only CPU, RAM and disk. FluxOS additionally reserves CPU burst headroom for
 * enterprise apps, which is deliberately not modelled here: this number is advisory,
 * and the three resources below are the ones customers can reason about.
 */
export function nodeHasRoom(node, hw, isEnterprise = false) {
  if (isEnterprise && !node.arcane) return false;
  const used = node.used;
  // No reading means no opinion, and "no opinion" must never read as "free": every
  // caller turns this into something a customer acts on.
  if (!used) return false;
  const total = totalForApps(node);
  return (total.cpu - used.cpu) >= hw.cpu
    && (total.ramGB - used.ramGB) >= hw.ramGB
    && (total.hddGB - used.hddGB) >= hw.hddGB;
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
 *
 * `ipCount` is what matters for placement: FluxOS spreads instances across unique
 * public IPs, so two nodes behind one IP can only ever host one instance. `freeIpCount`
 * is the subset of those IPs with a node that can take the app right now.
 *
 * Both are plain arithmetic over the already-fetched list, so this is synchronous and
 * costs nothing to recompute on every keystroke of a location picker.
 */
export function capacityForGeolocation(nodes, geolocation, hw, isEnterprise = false) {
  const inGeo = nodesInGeolocation(nodes, geolocation);
  const candidates = inGeo.filter((n) => nodeFitsApp(n, hw, isEnterprise));
  const ips = new Set();
  const freeIps = new Set();
  candidates.forEach((n) => {
    if (!n.ip) return;
    ips.add(n.ip);
    if (nodeHasRoom(n, hw, isEnterprise)) freeIps.add(n.ip);
  });
  return {
    candidates,
    nodeCount: candidates.length,
    ipCount: ips.size,
    freeIpCount: freeIps.size,
  };
}

/**
 * Diagnose why an app has fewer running instances than it should, in terms of the
 * one thing the customer can act on: their chosen locations.
 *
 * @returns {Promise<null|{severity,title,message,nodeCount,ipCount,freeIpCount,instances,running,worldwide}>}
 *          null when the locations are not the problem (or we cannot tell).
 */
export async function diagnosePlacement({ geolocation, compose, instances = 1, isEnterprise = false, running = 0 }) {
  if (running >= instances) return null;

  const hw = appHardware(compose);
  if (!hw.cpu && !hw.ramGB) return null; // no spec to reason about

  const nodes = await fetchFluxNodes();
  if (!nodes.length) return null; // stats unavailable — say nothing rather than guess

  const worldwide = !(geolocation || []).length;
  const { nodeCount, ipCount, freeIpCount } = capacityForGeolocation(nodes, geolocation, hw, isEnterprise);

  // Not enough distinct IPs to ever satisfy the instance count: a hard configuration
  // problem that no amount of waiting fixes.
  if (ipCount < instances) {
    return {
      severity: 'blocked',
      title: worldwide
        ? 'No host server can take this plan right now'
        : 'Your locations are too narrow for this plan',
      message: worldwide
        ? `Only ${ipCount} host server${ipCount === 1 ? '' : 's'} on the network currently fit this plan's hardware, and your server runs on ${instances} copies.`
        : `The locations you picked cover ${ipCount} host server${ipCount === 1 ? '' : 's'} able to run this plan, but your server runs on ${instances} copies. Add another location so every copy has somewhere to go.`,
      nodeCount, ipCount, freeIpCount, instances, running, worldwide,
    };
  }

  // Enough nodes exist on paper — the usual cause is that they are all already full.
  if (freeIpCount < instances) {
    return {
      severity: 'full',
      title: 'The host servers in your locations are full',
      message: `Your locations cover ${ipCount} host server${ipCount === 1 ? '' : 's'}, but ${freeIpCount === 0 ? 'none of them has' : `only ${freeIpCount} has`} room for this plan right now, and your server runs on ${instances} copies. Adding another location gives it more to choose from.`,
      nodeCount, ipCount, freeIpCount, instances, running, worldwide,
    };
  }

  // Room exists: the app is probably still being placed. Only say something once the
  // customer is clearly stuck (nothing running at all), and say it softly.
  if (running === 0) {
    return {
      severity: 'waiting',
      title: 'Your server has not been placed yet',
      message: `${freeIpCount} host server${freeIpCount === 1 ? '' : 's'} in your locations ${freeIpCount === 1 ? 'has' : 'have'} room for this plan, so it should come up shortly. If it stays like this, adding another location usually gets it placed faster.`,
      nodeCount, ipCount, freeIpCount, instances, running, worldwide,
    };
  }

  return null;
}
