/**
 * Simple Express Backend for Palworld Server Status
 * Provides API endpoint to query Palworld servers via UDP ping
 */

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join, sep } from 'path';
import { readFileSync } from 'fs';
import { Resolver } from 'dns/promises';
import dgram from 'dgram';

// Force public DNS — bypasses broken system resolver
const dnsResolver = new Resolver();
dnsResolver.setServers(['1.1.1.1', '8.8.8.8']);
const dnsResolve = (domain, type) => dnsResolver.resolve(domain, type);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * UDP ping — send a packet to the game port and see whether the server answers.
 * No authentication required, works with any Palworld server.
 *
 * This is a liveness check, and only that. The round trip it measures is the one between the
 * node serving this site and the node running the game, which is not a path any player takes:
 * reported to customers as "latency" it read up to 200ms away from their real ping, which is
 * what the "latency looks high but the game feels fine" tickets were about. The number stays
 * in the log for ops, and is no longer returned. Latency shown in the dashboard is measured in
 * the customer's own browser (src/utils/clientLatency.js), and the exact in-game ping comes
 * from the game server itself via the REST API's per-player `ping`.
 */
function udpPing(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const start = Date.now();
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      try { socket.close(); } catch {}
      resolve(result);
    };

    socket.on('message', () => {
      finish({ online: true, latency: Date.now() - start });
    });

    socket.on('error', () => {
      finish({ online: false, latency: null });
    });

    socket.send(Buffer.from('ping'), 0, 4, port, host, (err) => {
      if (err) {
        finish({ online: false, latency: null });
      }
    });

    setTimeout(() => {
      finish({ online: false, latency: null });
    }, timeout);
  });
}

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend
// Compress every text response.
//
// This is the origin and it was serving everything raw: on the sibling FiveM site that was
// 727KB of HTML+JS+CSS on a first visit, about 210KB once gzipped. Whatever sits in front may
// or may not compress; the origin should not depend on it.
//
// Mounted before express.static so the route shells and the hashed assets both go through it.
// Images and fonts are already-compressed formats and are skipped by the default filter.
app.use(compression());

app.use(cors());
app.use(express.json());

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  // Canonicalise the trailing slash with a 301, so a page is reachable on exactly one URL.
  //
  // This has to sit BEFORE express.static: the prerendered shells live at
  // dist/setup-guide/index.html, and serve-static answers a request for /setup-guide/ with
  // that directory's index — 200, never reaching the catch-all below. The result was the
  // same page on both /setup-guide and /setup-guide/. <link rel="canonical"> already named
  // the slash-less form, but a canonical is a hint; a redirect is not, and it stops a
  // crawler paying for both.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const path = req.path.replace(/\/+$/, '');
    // '' means the request was for '/' (or '//'), which is already canonical.
    if (!path || path === req.path || req.path.startsWith('/api/')) return next();
    return res.redirect(301, `${path}${req.originalUrl.slice(req.path.length)}`);
  });

  // Cache headers tuned for SEO + repeat-visit performance:
  //  - /assets/* are content-hashed by Vite -> cache forever (immutable).
  //  - *.html (incl. prerendered route shells) must revalidate.
  //  - other unhashed public files get a short cache.
  app.use(
    express.static(join(__dirname, 'dist'), {
      // Don't 301-redirect /support -> /support/; the catch-all serves the shell.
      redirect: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${sep}assets${sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }),
  );
}

/**
 * GET /api/palworld-status/{:domain}
 * Query Palworld server status via UDP ping on game port
 */
app.get('/api/palworld-status/{:domain}', async (req, res) => {
  const { domain } = req.params;
  const port = parseInt(req.query.port || '8211');

  console.log(`🔍 Querying Palworld server: ${domain}:${port}`);

  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await udpPing(domain, port);

    if (result.online) {
      console.log(`✅ ${domain} - Online - probe round trip: ${result.latency}ms (ops only, not reported)`);
      return res.json({ online: true });
    }

    if (attempt < maxRetries) {
      console.log(`⚠️ ${domain} - Attempt ${attempt} failed, retrying...`);
      continue;
    }

    console.log(`❌ ${domain} - Offline or unreachable`);
    res.json({
      online: false,
      error: 'Server offline or unreachable'
    });
  }
});

/**
 * GET /api/fdm/appips/{:appName}
 * Get master IP from FDM (same method FluxOS uses)
 */
app.get('/api/fdm/appips/{:appName}', async (req, res) => {
  const { appName } = req.params;

  const firstLetter = appName.substring(0, 1).toLowerCase();
  let fdmIndex = 1;
  if (/[h-n]/.test(firstLetter)) fdmIndex = 2;
  else if (/[o-u]/.test(firstLetter)) fdmIndex = 3;
  else if (/[v-z]/.test(firstLetter)) fdmIndex = 4;

  const fdmRegions = [
    `http://fdm-fn-1-${fdmIndex}.runonflux.io:16130`,
    `http://fdm-usa-1-${fdmIndex}.runonflux.io:16130`,
    `http://fdm-sg-1-${fdmIndex}.runonflux.io:16130`,
  ];

  // Why a balancer could not answer matters as much as that it could not. A restarting
  // balancer serves 503 while it rebuilds — for the o-u subset every `palworld*` app lives in,
  // that is up to ~25 minutes — and throughout it DNS still points at the live master and the
  // game port still answers. Collapsing that into the same "no FDM responded" as a genuine 404
  // is what let the dashboard tell customers players could not get in while they happily
  // could, next to the Restart and Stop buttons (incident 2026-08-24).
  let reason = 'unreachable';

  // Keep the most informative answer any region gave. A 404 from a balancer that is up
  // outranks silence from one that is not; a 503 says the fleet is mid-restart and outranks
  // both, because a balancer that is rebuilding explains every other region's silence.
  const classify = (current, status, body) => {
    if (current === 'starting') return current;
    if (status === 503 || /starting up/i.test(body?.data?.message || '')) return 'starting';
    if (status === 404 || body?.data?.code === 404) return 'not-routed';
    return current;
  };

  for (const baseUrl of fdmRegions) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${baseUrl}/appips/${appName}`, { signal: controller.signal });
      clearTimeout(timeout);
      // Status first, body second, and never let the body cost us the status: a balancer that
      // is restarting can be answered for by whatever sits in front of it, whose 503 is a page,
      // not JSON. Parsing before looking threw that away and downgraded the one case this
      // endpoint exists to name back to an indistinguishable silence.
      const data = await response.json().catch(() => null);
      if (data?.status === 'success' && data.data?.ips?.length > 0) {
        return res.json(data);
      }
      reason = classify(reason, response.status, data);
    } catch {
      // Try next region
    }
  }

  res.json({
    status: 'error',
    data: {
      reason,
      message: reason === 'starting'
        ? 'Routing service is restarting'
        : reason === 'not-routed'
          ? 'App is not in the load balancer configuration'
          : 'No FDM responded',
    },
  });
});

/**
 * GET /api/dns-resolve/{:domain}
 */
app.get('/api/dns-resolve/{:domain}', async (req, res) => {
  try {
    const addresses = await dnsResolve(req.params.domain, 'A');

    // Whether the name has an ADDRESS OF ITS OWN, which an A lookup alone cannot tell you: a
    // resolver follows a CNAME silently and hands back the target's address, so a name still
    // being stood in for looks like an ordinary answer that happens to disagree with FDM.
    // Asking directly turns that into a fact.
    //
    // Asked on every lookup, including the two pollers that ignore the answer. Making it
    // opt-in would save a second cached query and hand every caller that forgot the flag a
    // `cname` of `undefined`, which reads as "has its own address" — the exact wrong answer,
    // silently, in the code that decides whether to alarm a customer.
    let cname = null;
    try {
      const targets = await dnsResolve(req.params.domain, 'CNAME');
      cname = targets?.[0] || null;
    } catch {
      // ENODATA is the normal, healthy case: the name has its own A record.
    }

    // ALL A records, not just the first: an app with several healthy instances gets several
    // records, and resolvers rotate their order between queries. Comparing one arbitrary
    // record against one arbitrary FDM IP turns "is the domain synced" into a coin flip.
    // `ip` stays for callers that only need one.
    res.json({ status: 'success', data: { ip: addresses[0], ips: addresses, cname } });
  } catch (e) {
    res.json({ status: 'error', data: { message: e.message } });
  }
});

/**
 * Palworld REST API proxy
 * Proxies requests to the Palworld server's REST API (port 8212)
 * Avoids CORS issues and keeps admin password on backend side
 */

// GET endpoints: info, players, settings, metrics
app.get('/api/palworld-rest/:host/:endpoint', async (req, res) => {
  const { host, endpoint } = req.params;
  const port = req.query.port || '8212';
  const password = req.query.password || '';

  const allowed = ['info', 'players', 'settings', 'metrics'];
  if (!allowed.includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`http://${host}:${port}/v1/api/${endpoint}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text || response.statusText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.log(`❌ REST API ${endpoint} failed for ${host}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoints: kick, ban, unban, save, shutdown, stop, announce
app.post('/api/palworld-rest/:host/:endpoint', async (req, res) => {
  const { host, endpoint } = req.params;
  const port = req.query.port || '8212';
  const password = req.query.password || '';

  const allowed = ['kick', 'ban', 'unban', 'save', 'shutdown', 'stop', 'announce'];
  if (!allowed.includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`http://${host}:${port}/v1/api/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text || response.statusText });
    }

    // Some endpoints return empty body
    const text = await response.text();
    try {
      res.json(JSON.parse(text));
    } catch {
      res.json({ success: true });
    }
  } catch (error) {
    console.log(`❌ REST API ${endpoint} failed for ${host}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mod-download?url=<direct .pak URL>
 * Same-origin proxy so the browser can fetch a mod file and re-upload it to the
 * Flux node's file manager. Fetching mod hosts directly from the browser is blocked
 * by CORS, so the Mods tab routes downloads through here.
 * Only http(s) URLs, 300 MB cap.
 */
const MOD_MAX_BYTES = 300 * 1024 * 1024;
app.get('/api/mod-download', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http(s) URLs are allowed' });
  }

  try {
    const upstream = await fetch(target.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'palworld-server-website/mod-download' },
    });
    if (!upstream.ok || !upstream.body) {
      return res.status(502).json({ error: `Upstream returned HTTP ${upstream.status}` });
    }

    const len = Number(upstream.headers.get('content-length') || 0);
    if (len && len > MOD_MAX_BYTES) {
      return res.status(413).json({ error: 'File exceeds 300 MB limit' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    if (len) res.setHeader('Content-Length', String(len));

    let received = 0;
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MOD_MAX_BYTES) {
        try { await reader.cancel(); } catch {}
        res.destroy();
        return;
      }
      if (!res.write(Buffer.from(value))) {
        await new Promise((r) => res.once('drain', r));
      }
    }
    res.end();
  } catch (error) {
    console.log(`❌ mod-download failed for ${target.href}: ${error.message}`);
    if (!res.headersSent) res.status(500).json({ error: error.message });
    else res.destroy();
  }
});

/**
 * POST /api/appexec/{host}
 * Runs a command inside the app's container via FluxOS `appexec` (docker exec).
 *
 * ⚠️ DO NOT send `Content-Type: application/json` upstream. FluxOS reads this
 * request body by hand (`req.on('data')` / `req.on('end')` in appInspector.appExec).
 * When the header says JSON, its own body parser consumes the stream first, the
 * manual reader never fires, and the request hangs until it times out — no status,
 * no bytes, no error. Verified against a live node: with the JSON header the call
 * sat for 90s and returned nothing; with a plain body it answered in 0.5s.
 * `fetch` with a string body defaults to text/plain, which is exactly what we want,
 * so this deliberately sets NO content type.
 *
 * The command runs as root inside the container.
 */
app.post('/api/appexec/{:host}', async (req, res) => {
  const { host } = req.params;
  const { port = 16127, appname, cmd, zelidauth } = req.body;

  if (!appname || !cmd || !zelidauth) {
    return res.status(400).json({ error: 'appname, cmd and zelidauth are required' });
  }
  if (!Array.isArray(cmd) || cmd.length === 0) {
    return res.status(400).json({ error: 'cmd must be a non-empty array' });
  }

  try {
    const nodeUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/appexec`;
    const upstream = await fetch(nodeUrl, {
      method: 'POST',
      headers: {
        zelidauth: typeof zelidauth === 'string' ? zelidauth : JSON.stringify(zelidauth),
      },
      body: JSON.stringify({ appname, cmd }),
      signal: AbortSignal.timeout(60000),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: text || `HTTP ${upstream.status}` });
    }
    // Exec streams raw stdout/stderr; strip the NUL bytes Docker's multiplexed
    // stream leaves behind so the caller gets plain text.
    res.json({ status: 'success', data: text.replace(/\0/g, '').trim() });
  } catch (error) {
    console.log(`❌ appexec failed for ${host}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'palworld-status-api' });
});

// In production, serve index.html for all non-API routes (SPA fallback)
if (process.env.NODE_ENV === 'production') {
  const distRoot = join(__dirname, 'dist');
  // Route shells generated by scripts/prerender.mjs, which also writes the map. It used
  // to be hand-maintained here and drifted twice: a page could be prerendered into dist
  // and listed in the sitemap, yet still 404 in production because its line was never
  // added. Read the generated manifest instead, so the two can no longer disagree.
  let prerendered = {};
  try {
    prerendered = JSON.parse(readFileSync(join(distRoot, '.prerendered-routes.json'), 'utf8'));
    console.log(`\u2713 ${Object.keys(prerendered).length} prerendered routes loaded`);
  } catch (err) {
    // Every content URL would 404. Louder than a silent empty object.
    console.error(`\u26a0 could not read dist/.prerendered-routes.json - content routes will 404: ${err.message}`);
  }

  app.get('*path', (req, res) => {
    // Already canonicalised by the redirect middleware above; the strip is belt-and-braces.
    const path = req.path.replace(/\/+$/, '') || '/';
    if (prerendered[path]) {
      return res.sendFile(join(distRoot, prerendered[path]));
    }
    if (path === '/' || path === '/dashboard') {
      return res.sendFile(join(distRoot, 'index.html'));
    }
    return res.status(404).sendFile(join(distRoot, '404.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log('🚀 Palworld Status API Server');
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🎮 Endpoints:`);
  console.log(`   GET /api/palworld-status/{:domain}`);
  console.log('');
});

server.keepAliveTimeout = 65000;
