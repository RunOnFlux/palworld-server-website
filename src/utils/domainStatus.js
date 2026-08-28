/**
 * Is the domain actually usable by players, and if not, why not.
 *
 * The rule this file exists to enforce: **never report a routing problem from the load
 * balancer's silence alone.** FDM answers "where do players go". When it restarts it answers
 * nothing at all for up to ~25 minutes, while DNS keeps pointing at the live master and the
 * game port keeps answering — players are fine. Treating that silence as an outage put an
 * alarm in front of customers next to the Restart and Stop buttons, and the clicks that
 * followed caused the outage the banner claimed (incident 2026-08-24).
 *
 * So an alarm needs positive evidence: the domain resolved somewhere, and the game did not
 * answer there.
 */

/** The port players connect on. */
export const gamePortOf = (server) => server?.ports?.[0] || server?.compose?.[0]?.ports?.[0] || 8211;

export const domainOf = (serverOrName) => {
  const name = typeof serverOrName === 'string' ? serverOrName : serverOrName?.name;
  return `${String(name || '').toLowerCase()}.app.runonflux.io`;
};

/**
 * The domain is synced when FDM's healthy instances and the domain's A records OVERLAP.
 * Both sides are sets: FDM lists every healthy instance, and these domains hand out rotating
 * A records — 1.1.1.1 and 8.8.8.8 answer with different IPs for the same name. Comparing the
 * first of each turns a working domain into a coin flip.
 */
export const domainMatchesFdm = (fdmIps, dnsData) => {
  const dns = new Set([...(dnsData?.ips || []), dnsData?.ip].filter(Boolean));
  return (fdmIps || []).some((ip) => dns.has(ip));
};

/**
 * Why FDM could not name an instance. The three cases mean completely different things to a
 * customer, and until this existed they arrived as one indistinguishable "no FDM responded".
 *
 *   starting    — the balancer restarted and is rebuilding. Routing is untouched meanwhile.
 *   not-routed  — the balancer is up and does not have this app. A real routing problem.
 *   unreachable — no balancer answered at all. We know nothing.
 */
export const FDM_STARTING = 'starting';
export const FDM_NOT_ROUTED = 'not-routed';
export const FDM_UNREACHABLE = 'unreachable';

/**
 * Ask the domain what it resolves to.
 * @returns {Promise<{ips: string[], cname: string|null}|null>} null if the lookup failed
 */
export const resolveDomain = async (domain) => {
  try {
    const res = await fetch(`/api/dns-resolve/${domain}`);
    const body = await res.json();
    if (body.status !== 'success') return null;
    return { ips: body.data?.ips || [], cname: body.data?.cname || null };
  } catch {
    return null;
  }
};

/**
 * Ask the game itself. This is the only thing that actually proves a player can get in.
 * @returns {Promise<boolean|null>} null when the probe could not be run
 */
export const probeGamePort = async (domain, port) => {
  try {
    const res = await fetch(`/api/palworld-status/${domain}?port=${port}`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.online === true;
  } catch {
    return null;
  }
};

/**
 * Whether players can reach a server through its domain.
 *
 * A name that is still a CNAME has no address of its own — it is being stood in for while the
 * platform decides where the app lives — so it is definitively not ready, and there is no
 * point spending a probe to discover that. A name with its own address that merely disagrees
 * with FDM is a different matter: the records rotate legitimately (sampling one server every
 * 9s for three minutes gave 4 mismatches out of 20 while the domain answered fine), so a
 * mismatch is not a verdict, it is a reason to ask the game directly.
 *
 * @returns {Promise<boolean|null>} null when nothing can be concluded — the caller keeps
 *   whatever it had rather than guessing.
 */
export const checkDomainReady = async (server, gamePort) => {
  const domain = domainOf(server);
  try {
    const fdmData = await (await fetch(`/api/fdm/appips/${server.name}`)).json();
    if (fdmData.status !== 'success' || !fdmData.data?.ips?.length) return null;

    const dns = await resolveDomain(domain);
    if (!dns) return null;

    // Standing in: no address of its own yet.
    if (dns.cname) return false;

    if (domainMatchesFdm(fdmData.data.ips, dns)) return true;

    // Mismatch — only now spend a probe, and let the answer decide.
    return await probeGamePort(domain, gamePort);
  } catch {
    return null;
  }
};

/**
 * What to tell a customer when FDM could not name an instance, having checked the domain
 * rather than assuming the worst.
 *
 * @param {Object} server
 * @param {string} fdmReason one of FDM_STARTING / FDM_NOT_ROUTED / FDM_UNREACHABLE
 * @returns {Promise<'routed'|'refreshing'|'unreachable'>}
 *   routed      — the game answered on the domain; say nothing, players are fine
 *   refreshing  — the routing service is rebuilding and we have no evidence of harm
 *   unreachable — verified: the domain does not reach the game
 */
export const assessRouting = async (server, fdmReason) => {
  const domain = domainOf(server);
  const dns = await resolveDomain(domain);

  // No address of its own, or no answer at all: nothing to probe. A balancer that is merely
  // restarting is still not evidence of harm.
  if (!dns || dns.cname || dns.ips.length === 0) {
    return fdmReason === FDM_NOT_ROUTED ? 'unreachable' : 'refreshing';
  }

  const online = await probeGamePort(domain, gamePortOf(server));
  if (online === true) return 'routed';
  if (online === null) return 'refreshing'; // could not ask; do not alarm on a failed probe

  return 'unreachable';
};
