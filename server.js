/**
 * Simple Express Backend for Palworld Server Status
 * Provides API endpoint to query Palworld servers via UDP ping
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join, sep } from 'path';
import { Resolver } from 'dns/promises';
import dgram from 'dgram';

// Force public DNS — bypasses broken system resolver
const dnsResolver = new Resolver();
dnsResolver.setServers(['1.1.1.1', '8.8.8.8']);
const dnsResolve = (domain, type) => dnsResolver.resolve(domain, type);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * UDP ping — send a packet to the game port and measure response time
 * No authentication required, works with any Palworld server
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
app.use(cors());
app.use(express.json());

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
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
      const response = {
        online: true,
        latency: result.latency,
      };

      console.log(`✅ ${domain} - Online - latency: ${result.latency}ms`);
      return res.json(response);
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

  for (const baseUrl of fdmRegions) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${baseUrl}/appips/${appName}`, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await response.json();
      if (data.status === 'success' && data.data?.ips?.length > 0) {
        return res.json(data);
      }
    } catch {
      // Try next region
    }
  }

  res.json({ status: 'error', data: { message: 'No FDM responded' } });
});

/**
 * GET /api/dns-resolve/{:domain}
 */
app.get('/api/dns-resolve/{:domain}', async (req, res) => {
  try {
    const addresses = await dnsResolve(req.params.domain, 'A');
    res.json({ status: 'success', data: { ip: addresses[0] } });
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
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'palworld-status-api' });
});

// In production, serve index.html for all non-API routes (SPA fallback)
if (process.env.NODE_ENV === 'production') {
  const distRoot = join(__dirname, 'dist');
  // Route shells generated by scripts/prerender.mjs.
  const prerendered = {
    '/support': 'support/index.html',
    '/success': 'success/index.html',
    '/cancel': 'cancel/index.html',
    '/setup-guide': 'setup-guide/index.html',
    '/server-requirements': 'server-requirements/index.html',
    '/pricing': 'pricing/index.html',
    '/guides/join-server': 'guides/join-server/index.html',
    '/guides/server-settings': 'guides/server-settings/index.html',
    '/decentralized-palworld-hosting': 'decentralized-palworld-hosting/index.html',
    '/nitrado-alternative': 'nitrado-alternative/index.html',
    '/gportal-alternative': 'gportal-alternative/index.html',
  };

  app.get('*path', (req, res) => {
    const path = req.path.replace(/\/$/, '') || '/';
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
