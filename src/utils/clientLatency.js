/**
 * Latency measured from the customer's own browser.
 *
 * Why this exists: `/api/palworld-status` (see server.js) is a UDP probe sent by OUR backend,
 * so it times the path between whatever node is serving this site and the node running the
 * game. Customers read that number as their in-game ping — it is not, and it can be 100-200ms
 * off in either direction. That mismatch is what support tickets about "high latency but the
 * game feels fine" are actually reporting. The UDP probe is still the right liveness check,
 * so it stays; it just no longer reports a latency.
 *
 * How this measures a round trip when a browser cannot send UDP or open a raw socket: fetch an
 * `https://` URL on the node's plain-HTTP FluxOS API port. The TCP handshake completes (1 RTT),
 * the browser sends a TLS ClientHello, the HTTP server answers with something that is not TLS,
 * and the request fails (1 more RTT). Time-to-failure is therefore ~2x the round trip, so we
 * halve it. Measured against a live node: 227/228/229ms to failure against a 110ms real TCP
 * connect time — the estimate lands within a few ms, and repeats are stable to ~2ms.
 *
 * This is a calibrated estimate, not a stopwatch on the handshake: browsers do not expose
 * connect timing for failed cross-origin requests (PerformanceResourceTiming zeroes those
 * fields without Timing-Allow-Origin). It is also TCP rather than the game's UDP, and it does
 * not include the server's own frame time, so a player's in-game ping usually reads slightly
 * higher. What it does capture — and the backend probe never could — is the customer's actual
 * network path: their ISP, their Wi-Fi, their distance to the node.
 *
 * For the real in-game figure when someone is playing, use the per-player `ping` field from the
 * Palworld REST API (`/v1/api/players`), which the game server measures itself.
 */

import { useState, useEffect, useRef } from 'react';
import { parseAddress } from '../services/apiService';

const DEFAULT_TIMEOUT = 4000;
const DEFAULT_SAMPLES = 3;

/** FluxOS API port when a location carries no explicit one. */
export const DEFAULT_NODE_API_PORT = 16127;

/**
 * One probe. Resolves to the estimated one-way-and-back time in ms, or null if the node never
 * answered (which reads as unreachable, not as "slow").
 */
async function probeOnce(host, port, timeout) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  const started = performance.now();
  try {
    // The rejection is the expected outcome — TLS against a plain HTTP port. `no-cors` keeps
    // the browser from also complaining about CORS, and the cache-buster keeps any layer in
    // between from answering a second probe from memory.
    await fetch(`https://${host}:${port}/?_probe=${started}`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    // expected
  } finally {
    clearTimeout(timer);
  }

  if (timedOut) return null;
  return (performance.now() - started) / 2;
}

// One measurement per node, shared between whoever asks at the same time. The dashboard keeps
// both the mobile card list and the desktop table mounted — one of them is merely CSS-hidden —
// and the management panel can be open on top of those, so the same node would otherwise be
// probed three times over. The window is shorter than the poll interval, so each poll still
// takes a fresh reading; it only collapses the near-simultaneous ones.
const SHARE_WINDOW_MS = 20000;
const inFlight = new Map();
const recent = new Map();

async function runProbes(host, port, samples, timeout) {
  const results = [];
  for (let i = 0; i < samples; i += 1) {
    const sample = await probeOnce(host, port, timeout);
    if (sample !== null) results.push(sample);
  }
  return results.length > 0 ? Math.round(Math.min(...results)) : null;
}

/**
 * Probe a node a few times and keep the best sample. Sequential on purpose: parallel probes
 * would queue behind each other in the browser's connection pool and time their own waiting.
 * The minimum is the least contaminated sample — a slow one means a retransmit or a busy tab,
 * never a genuinely faster network.
 */
export async function measureClientLatency(host, port = DEFAULT_NODE_API_PORT, options = {}) {
  const { samples = DEFAULT_SAMPLES, timeout = DEFAULT_TIMEOUT } = options;
  if (!host) return null;

  const key = `${host}:${port}`;
  const cached = recent.get(key);
  if (cached && performance.now() - cached.at < SHARE_WINDOW_MS) return cached.value;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const run = runProbes(host, port, samples, timeout)
    .then((value) => {
      recent.set(key, { value, at: performance.now() });
      return value;
    })
    .finally(() => { inFlight.delete(key); });

  inFlight.set(key, run);
  return run;
}

/**
 * The FluxOS API endpoint of the instance players are actually on — FDM's master, the one the
 * domain routes to. A multi-instance app keeps the others on standby, usually with the
 * container stopped, so probing them measures the path to a machine nobody is playing on.
 *
 * No master, no target: the caller renders a dash. That is deliberately not a fallback to
 * `locations[0]` — the on-chain order says nothing about which instance is live, so the
 * fallback was as likely to time a standby node as the real one, and it spent a failed
 * request per sample doing it.
 */
export function nodeTargetFor(server) {
  const locations = Array.isArray(server?.locations) ? server.locations : [];
  if (!server?.fdmMasterIp) return { host: null, port: DEFAULT_NODE_API_PORT };

  const master = locations.find((loc) => parseAddress(loc.ip).host === server.fdmMasterIp);
  // The API port belongs to the node, not to the network — 16127 is only the most common one,
  // and plenty of nodes sit on 16137-16197. Guessing it for a master that is missing from the
  // locations list would probe a closed port and burn three timeouts on it.
  if (!master) return { host: null, port: DEFAULT_NODE_API_PORT };

  const { port } = parseAddress(master.ip);
  return { host: server.fdmMasterIp, port: port || DEFAULT_NODE_API_PORT };
}

/**
 * Poll the node from this browser. Latency stays null while the first probe is still running
 * and whenever the node stops answering — callers render a dash for both, since neither is a
 * latency reading.
 */
export function useClientLatency(host, port, options = {}) {
  const { enabled = true, intervalMs = 60000 } = options;
  const [latency, setLatency] = useState(null);
  const [measuring, setMeasuring] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !host) {
      setLatency(null);
      return undefined;
    }

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      setMeasuring(true);
      const result = await measureClientLatency(host, port);
      if (cancelled || !mountedRef.current) return;
      setLatency(result);
      setMeasuring(false);
    };

    run();
    const id = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [host, port, enabled, intervalMs]);

  return { latency, measuring };
}

/** Shared colouring so the cards, the table and the management panel never disagree. */
export function latencyClass(ms) {
  if (!ms) return 'text-gray-600';
  if (ms < 200) return 'text-emerald-400';
  if (ms < 500) return 'text-orange-400';
  return 'text-red-400';
}

export const LATENCY_TOOLTIP =
  'Measured from your browser to the node hosting your server, so it reflects your own '
  + 'connection. It is an estimate over TCP — your in-game ping usually reads slightly higher. '
  + 'For the exact in-game ping of connected players, open Remote Control.';
