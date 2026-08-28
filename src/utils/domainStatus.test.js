/**
 * The verdict this file guards is the one a customer reads next to the Restart and Stop
 * buttons, and getting it wrong on 2026-08-24 turned a routing refresh into a real outage.
 * Every case below is one the fleet actually produced.
 *
 * Run with `npm test` (node:test, no runner to install).
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  assessRouting,
  checkDomainReady,
  domainMatchesFdm,
  domainOf,
  gamePortOf,
  FDM_STARTING,
  FDM_NOT_ROUTED,
  FDM_UNREACHABLE,
} from './domainStatus.js';

const realFetch = globalThis.fetch;

// Routes by the shape of the URL, so a test says only what it cares about. `calls` records
// every path, which is how "did we spend a probe" becomes an assertion rather than a hope.
const calls = [];
const stubFetch = ({ fdm, dns, probe }) => {
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const reply = (body, ok = true) => ({ ok, json: async () => body });
    if (String(url).includes('/api/fdm/')) return reply(fdm);
    if (String(url).includes('/api/dns-resolve/')) return reply(dns);
    if (String(url).includes('/api/palworld-status/')) {
      if (probe === 'unreachable') return reply({}, false);
      return reply({ online: probe === true });
    }
    throw new Error(`unstubbed ${url}`);
  };
};

const probed = () => calls.some((u) => u.includes('/api/palworld-status/'));

beforeEach(() => { calls.length = 0; });
afterEach(() => { globalThis.fetch = realFetch; });

const SERVER = { name: 'Explorer', ports: [41234] };
const ok = (data) => ({ status: 'success', data });

describe('domainMatchesFdm', () => {
  test('overlap, not first-against-first: these domains rotate their A records', () => {
    // The bug this replaced: comparing ips[0] to ip reported a healthy domain as broken
    // roughly a fifth of the time.
    assert.equal(domainMatchesFdm(['1.1.1.1', '2.2.2.2'], { ips: ['2.2.2.2', '3.3.3.3'] }), true);
  });

  test('a legacy caller that only carries one record still counts', () => {
    assert.equal(domainMatchesFdm(['9.9.9.9'], { ip: '9.9.9.9' }), true);
  });

  test('genuinely disjoint sets do not match', () => {
    assert.equal(domainMatchesFdm(['1.1.1.1'], { ips: ['8.8.8.8'] }), false);
  });

  test('nothing on either side is not a match', () => {
    assert.equal(domainMatchesFdm(undefined, undefined), false);
    assert.equal(domainMatchesFdm([], { ips: [] }), false);
  });
});

describe('domainOf / gamePortOf', () => {
  test('takes a server or a bare name, and lowercases either', () => {
    assert.equal(domainOf(SERVER), 'explorer.app.runonflux.io');
    assert.equal(domainOf('Explorer'), 'explorer.app.runonflux.io');
  });

  test('randomized deploys expose a high port; legacy servers fall back to 8211', () => {
    assert.equal(gamePortOf(SERVER), 41234);
    assert.equal(gamePortOf({ compose: [{ ports: [55555] }] }), 55555);
    assert.equal(gamePortOf({}), 8211);
  });
});

describe('assessRouting', () => {
  test('the game answering outranks anything FDM says, including not-routed', async () => {
    stubFetch({ dns: ok({ ips: ['1.1.1.1'], cname: null }), probe: true });
    assert.equal(await assessRouting(SERVER, FDM_NOT_ROUTED), 'routed');
  });

  test('a restarting balancer alone is never an alarm', async () => {
    // The incident in one line: FDM went quiet, DNS kept pointing at the live master, and the
    // game kept answering. The old code showed "Players can't reach this server" anyway.
    stubFetch({ dns: ok({ ips: ['1.1.1.1'], cname: null }), probe: true });
    assert.equal(await assessRouting(SERVER, FDM_STARTING), 'routed');
  });

  test('resolved but silent on the game port is the one verified alarm', async () => {
    stubFetch({ dns: ok({ ips: ['1.1.1.1'], cname: null }), probe: false });
    assert.equal(await assessRouting(SERVER, FDM_UNREACHABLE), 'unreachable');
  });

  test('a probe that could not be run does not alarm', async () => {
    stubFetch({ dns: ok({ ips: ['1.1.1.1'], cname: null }), probe: 'unreachable' });
    assert.equal(await assessRouting(SERVER, FDM_UNREACHABLE), 'refreshing');
  });

  test('still standing in, and the balancer says it has no such app: alarm', async () => {
    stubFetch({ dns: ok({ ips: ['1.1.1.1'], cname: 'fdm-lb-1-1.runonflux.io' }) });
    assert.equal(await assessRouting(SERVER, FDM_NOT_ROUTED), 'unreachable');
    assert.equal(probed(), false, 'a name with no address of its own is not worth a probe');
  });

  test('still standing in while the balancer restarts: no verdict, no alarm', async () => {
    stubFetch({ dns: ok({ ips: ['1.1.1.1'], cname: 'fdm-lb-1-1.runonflux.io' }) });
    assert.equal(await assessRouting(SERVER, FDM_STARTING), 'refreshing');
  });

  test('no balancer answered and DNS gave nothing: we know nothing, so say nothing', async () => {
    stubFetch({ dns: { status: 'error', data: { message: 'ENOTFOUND' } } });
    assert.equal(await assessRouting(SERVER, FDM_UNREACHABLE), 'refreshing');
  });

  test('an empty answer is treated like no answer, not like a match', async () => {
    stubFetch({ dns: ok({ ips: [], cname: null }) });
    assert.equal(await assessRouting(SERVER, FDM_NOT_ROUTED), 'unreachable');
  });
});

describe('checkDomainReady', () => {
  test('FDM with nothing to say concludes nothing — the caller keeps what it had', async () => {
    stubFetch({ fdm: { status: 'error', data: { reason: FDM_STARTING } } });
    assert.equal(await checkDomainReady(SERVER, 41234), null);
  });

  test('records overlap: ready, and no probe spent', async () => {
    stubFetch({ fdm: ok({ ips: ['1.1.1.1'] }), dns: ok({ ips: ['1.1.1.1'], cname: null }) });
    assert.equal(await checkDomainReady(SERVER, 41234), true);
    assert.equal(probed(), false);
  });

  test('a mismatch is a reason to ask the game, not a verdict', async () => {
    stubFetch({ fdm: ok({ ips: ['1.1.1.1'] }), dns: ok({ ips: ['2.2.2.2'], cname: null }), probe: true });
    assert.equal(await checkDomainReady(SERVER, 41234), true);
    assert.equal(probed(), true);
  });

  test('mismatch and the game does not answer either: not ready', async () => {
    stubFetch({ fdm: ok({ ips: ['1.1.1.1'] }), dns: ok({ ips: ['2.2.2.2'], cname: null }), probe: false });
    assert.equal(await checkDomainReady(SERVER, 41234), false);
  });

  test('a name still being stood in for is not ready, whatever FDM lists', async () => {
    stubFetch({ fdm: ok({ ips: ['1.1.1.1'] }), dns: ok({ ips: ['1.1.1.1'], cname: 'fdm-lb-1-1.runonflux.io' }) });
    assert.equal(await checkDomainReady(SERVER, 41234), false);
  });
});
