#!/usr/bin/env node
// Lightweight post-build prerender (no headless browser required).
// Takes dist/index.html and emits route-specific HTML shells with per-route
// <title>, <meta description>, <link rel="canonical">, robots directives and
// <noscript> fallback content. Each shell still boots the same SPA bundle, so
// behaviour for JS-enabled clients is unchanged. For crawlers that do not
// execute JS (Bing, most LLM bots) each route now has real, keyword-relevant
// HTML instead of a blank shell. server.js maps the routes to these files.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const indexPath = join(distDir, 'index.html');
const SITE_URL = 'https://palworld.runonflux.com';

if (!existsSync(indexPath)) {
  console.error('[prerender] dist/index.html not found - did `vite build` run?');
  process.exit(1);
}

const baseHtml = await readFile(indexPath, 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildHtml({ title, description, canonical, robots, noscriptBody }) {
  let html = baseHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta name="title"[^>]*>/i, `<meta name="title" content="${esc(title)}" />`);
  html = html.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${esc(description)}" />`);
  html = html.replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(title)}" />`);
  html = html.replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${esc(description)}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${esc(canonical)}" />`);
  html = html.replace(/<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${esc(title)}" />`);
  html = html.replace(/<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${esc(description)}" />`);
  html = html.replace(/<meta name="twitter:url"[^>]*>/i, `<meta name="twitter:url" content="${esc(canonical)}" />`);
  html = html.replace(/<meta name="robots"[^>]*>/i, `<meta name="robots" content="${esc(robots)}" />`);
  html = html.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${esc(canonical)}" />`);
  if (noscriptBody) {
    html = html.replace(/<noscript>[\s\S]*?<\/noscript>/i, `<noscript>${noscriptBody}</noscript>`);
  }
  return html;
}

const fallbackStyle = `
  .seo-fallback { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #e6e6e6; background: #0f0f1a; line-height: 1.6; }
  .seo-fallback h1 { font-size: 2rem; margin: 0 0 0.75rem; color: #3aa0d6; }
  .seo-fallback h2 { font-size: 1.25rem; margin: 1.5rem 0 0.5rem; color: #3aa0d6; }
  .seo-fallback a { color: #3aa0d6; }
  .seo-fallback ul { padding-left: 1.25rem; }
`;

const routes = [
  {
    slug: '404.html',
    title: 'Page Not Found - Palworld on Flux',
    description: 'The page you are looking for does not exist. Return to Palworld on Flux to deploy a dedicated Palworld server on the Flux decentralized cloud.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex, follow',
    noscriptBody: `<style>${fallbackStyle}</style><div class="seo-fallback"><h1>Page not found</h1><p>The page you are looking for does not exist. <a href="${SITE_URL}/">Go back to Palworld on Flux</a> to deploy a Palworld dedicated server.</p></div>`,
  },
  {
    slug: 'support/index.html',
    title: 'Support & Contact - Palworld on Flux',
    description: 'Get help with your Palworld server on Flux. Submit a support ticket for billing, deployment, or server issues and our team will respond by email.',
    canonical: `${SITE_URL}/support`,
    robots: 'noindex, follow',
    noscriptBody: `<style>${fallbackStyle}</style><div class="seo-fallback"><h1>Palworld on Flux - Support</h1><p>Need help with your Palworld server? Submit a ticket via the support form (requires JavaScript). For community help, join the <a href="https://discord.com/invite/runonflux">Flux Discord</a>.</p></div>`,
  },
  {
    slug: 'success/index.html',
    title: 'Deployment Successful - Palworld on Flux',
    description: 'Your Palworld server is being deployed on the Flux decentralized cloud.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex, nofollow',
    noscriptBody: `<style>${fallbackStyle}</style><div class="seo-fallback"><h1>Deployment in progress</h1><p>Your Palworld server is being deployed. Check the dashboard for live status.</p></div>`,
  },
  {
    slug: 'cancel/index.html',
    title: 'Checkout Cancelled - Palworld on Flux',
    description: 'Your checkout was cancelled.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex, nofollow',
    noscriptBody: `<style>${fallbackStyle}</style><div class="seo-fallback"><h1>Checkout cancelled</h1><p>No charges were made. <a href="${SITE_URL}/">Return to the pricing page</a> to pick a plan.</p></div>`,
  },
];

for (const route of routes) {
  const outPath = join(distDir, route.slug);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buildHtml(route), 'utf8');
  console.log(`[prerender] wrote ${route.slug}`);
}

console.log(`[prerender] done - ${routes.length} route shells generated`);
