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
 *
 * Both sides are sets, and the comparison is written for the case where they have more than
 * one member each. Measured on this fleet on 2026-08-28, that case does not currently arise
 * here: 30 sampled `palworld*` apps each had exactly one FDM instance and one A record, and
 * 60 lookups across three of them (alternating 1.1.1.1 and 8.8.8.8, over 20s each) returned
 * one stable address, equal to FDM's, with zero mismatches. So on today's servers this is
 * arithmetically the same as comparing one against one, and it is NOT what stops a healthy
 * domain being reported as broken — the game-port probe is. It is kept because it is the
 * correct comparison the day an app is elected on more than one instance, and it costs
 * nothing. Do not cite it as the fix for a mismatch you have measured; find that cause.
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
 * @param {string} domain
 * @param {AbortSignal} [signal] abandons the lookup when the caller stops caring
 * @returns {Promise<{ips: string[], cname: string|null}|null>} null if the lookup failed
 */
export const resolveDomain = async (domain, signal) => {
  try {
    const res = await fetch(`/api/dns-resolve/${domain}`, { signal });
    const body = await res.json();
    if (body.status !== 'success') return null;
    return { ips: body.data?.ips || [], cname: body.data?.cname || null };
  } catch {
    return null;
  }
};

/**
 * Ask the game itself. This is the only thing that actually proves a player can get in.
 *
 * The slowest thing in this file by a wide margin: a domain that does not answer costs the
 * server two 5s UDP timeouts, which is why callers hand it a signal and why nothing renders
 * behind it.
 *
 * @param {string} domain
 * @param {number} port
 * @param {AbortSignal} [signal]
 * @returns {Promise<boolean|null>} null when the probe could not be run
 */
export const probeGamePort = async (domain, port, signal) => {
  try {
    const res = await fetch(`/api/palworld-status/${domain}?port=${port}`, { signal });
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
 * A CNAME means the name has no address of its own, and what that implies depends entirely on
 * how many instances FDM elected — which this function, unlike assessRouting, always knows,
 * because it is only reached when FDM listed some:
 *
 *   one instance    — the domain should be holding that instance's address. A CNAME says the
 *                     platform is still standing the name in, so it is not ready, and a probe
 *                     would only spend two 5s timeouts confirming it.
 *   more than one   — a CNAME to the balancer is the NORMAL, healthy shape. `explorer` has 25
 *                     healthy FDM instances and resolves through `fdm-lb-1-1.runonflux.io` to
 *                     an address that appears in no FDM list at all (measured 2026-08-28).
 *                     Reading that as "not ready" would condemn a working app forever, so it
 *                     falls through and the game gets the last word.
 *
 * A mismatch between FDM and an address of its own is never a verdict either way: it is a
 * reason to ask the game directly, which is the only thing that proves a player can get in.
 *
 * @returns {Promise<boolean|null>} null when nothing can be concluded — the caller keeps
 *   whatever it had rather than guessing.
 */
export const checkDomainReady = async (server, gamePort, signal) => {
  const domain = domainOf(server);
  try {
    const fdmData = await (await fetch(`/api/fdm/appips/${server.name}`, { signal })).json();
    if (fdmData.status !== 'success' || !fdmData.data?.ips?.length) return null;

    const dns = await resolveDomain(domain, signal);
    if (!dns) return null;

    // Standing in: one elected instance, and the domain is not holding its address yet.
    if (dns.cname && fdmData.data.ips.length === 1) return false;

    if (domainMatchesFdm(fdmData.data.ips, dns)) return true;

    // Mismatch — only now spend a probe, and let the answer decide.
    return await probeGamePort(domain, gamePort, signal);
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
 * @param {AbortSignal} [signal] the panel that asked has closed; an aborted lookup reads as
 *   "could not tell", which is already the calm answer
 * @returns {Promise<'routed'|'refreshing'|'unreachable'>}
 *   routed      — the game answered on the domain; say nothing, players are fine
 *   refreshing  — the routing service is rebuilding and we have no evidence of harm
 *   unreachable — verified: the domain does not reach the game
 */
export const assessRouting = async (server, fdmReason, signal) => {
  const domain = domainOf(server);
  const dns = await resolveDomain(domain, signal);

  // Nothing resolved at all: there is no address to ask, so there is nothing to verify and
  // nothing to claim. Only a balancer that is up and says it has never heard of this app is
  // worth an alarm on its own.
  if (!dns || dns.ips.length === 0) {
    return fdmReason === FDM_NOT_ROUTED ? 'unreachable' : 'refreshing';
  }

  // A CNAME is deliberately NOT short-circuited here, unlike in checkDomainReady: this path
  // runs precisely when FDM named nothing, so there is no instance count to read it against,
  // and on a multi-instance app the CNAME is the healthy shape. This is the loud path. It can
  // afford the probe, and it is the one place that must not guess.
  const online = await probeGamePort(domain, gamePortOf(server), signal);
  if (online === true) return 'routed';
  if (online === null) return 'refreshing'; // could not ask; do not alarm on a failed probe

  // The game did not answer. That is evidence about the player's path only if our own way out
  // is intact — and when not one of three balancers in three regions answered, the likeliest
  // thing that broke is this server's egress, not the customer's server. The probe leaves
  // here from the same machine, so it would fail for the same reason. Alarming on that would
  // be this whole incident again in a new place: reporting what WE cannot reach as what a
  // PLAYER cannot reach.
  if (fdmReason === FDM_UNREACHABLE) return 'refreshing';

  return 'unreachable';
};
