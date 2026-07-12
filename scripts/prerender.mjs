#!/usr/bin/env node
// Post-build SSR prerender (no headless browser required).
//
// For every route, renders the REAL React tree to HTML (src/entry-server.jsx) and
// writes it into <div id="root">. The client then HYDRATES that markup rather than
// calling createRoot(), which used to wipe the DOM and re-render — the visible
// "page loads, then reloads" flash.
//
// Two things follow from rendering the actual components:
//   - non-JS crawlers (most LLM bots) see exactly what a user sees; the body can no
//     longer drift away from the app, as it did when it was hand-written from
//     pagesContent.js by renderPageBodyHtml().
//   - the markup the browser hydrates is byte-identical to what React would render.
//
// The <head> is still stamped here, per route:
//   - <title>, <meta description>, canonical, robots, OG/Twitter tags
//   - the homepage-only FAQPage (built from gameConfig.faq)
//
// Page-specific JSON-LD (HowTo, FAQPage, BreadcrumbList, Product) is NOT stamped
// here any more: the React components emit it themselves via <SEO>, and it now
// survives into the SSR body. Injecting it here too would duplicate every entity.
// The Service + AggregateOffer / Organization / WebSite schemas stay in index.html:
// nothing in React emits those.
//
// server.js maps the routes to these files.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pagesContent, buildFaqSchema } from '../src/config/pagesContent.js';
import { gameConfig } from '../src/config/gameConfig.js';
// The SSR bundle, built by `vite build --ssr src/entry-server.jsx`. Rendering the
// real React components means the crawler-visible HTML and the app can no longer
// drift apart, and the client can hydrate it instead of wiping it.
import { render } from '../.ssr/entry-server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const indexPath = join(distDir, 'index.html');
const SITE_URL = 'https://palworld.runonflux.com';
const INDEXABLE_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

if (!existsSync(indexPath)) {
  console.error('[prerender] dist/index.html not found - did `vite build` run?');
  process.exit(1);
}

const baseHtml = await readFile(indexPath, 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Remove <title>/<meta>/<link> from the server-rendered body.
 *
 * React 19 treats those three as "hoistable": on the client it lifts them out of
 * the component tree and into <head> by itself (which is how <SEO> works at all,
 * now that react-helmet-async is a thin shim over React 19's metadata support).
 * renderToString has no document to hoist into, so it emits them inline instead —
 * leaving a <link rel="canonical"> in the <body>, where Google ignores it, and
 * duplicating what buildHtml() already stamps into <head>.
 *
 * Stripping them is also what keeps hydration clean: the client never puts these
 * nodes in the container either, so removing them makes the server markup match
 * the client's first render. JSON-LD <script> tags are NOT hoistable — React
 * renders them in place on both sides — so they are deliberately left alone.
 */
const stripHoistables = (html) =>
  html
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*\/?>/gi, '')
    .replace(/<link\b[^>]*\/?>/gi, '');

/**
 * Swap the (empty) #root of a shell for this route's server-rendered markup.
 *
 * `data-ssr-path` records which route the markup belongs to. server.js serves
 * dist/index.html for /dashboard as well as /, so #root can hold a page the
 * browser is not on — main.jsx compares this attribute with location.pathname and
 * only hydrates when they agree (otherwise React would hit a hydration mismatch,
 * throw away the markup, and re-render anyway).
 */
const withRoot = (html, path, rootBody) =>
  html.replace(
    /<div id="root"[^>]*>[\s\S]*?<\/div>/i,
    () => `<div id="root" data-ssr-path="${esc(path)}">${rootBody}</div>`,
  );

function buildHtml({ path, ssrPath, title, description, canonical, robots, rootBody }) {
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
  return rootBody ? withRoot(html, ssrPath || path, rootBody) : html;
}

// ---------------------------------------------------------------------------
// Utility / low-content shells (noindex)
// ---------------------------------------------------------------------------
// '404.html' deliberately renders an unmatched path so the router falls through
// to the NotFound route. It is served for *any* unknown URL and the NotFound page
// looks the same on all of them, hence the '*' ssr-path: always safe to hydrate.
const utilityRoutes = [
  {
    slug: '404.html',
    path: '/__not-found__',
    ssrPath: '*',
    title: 'Page Not Found - Palworld on Flux',
    description: 'The page you are looking for does not exist. Return to Palworld on Flux to deploy a dedicated Palworld server on the Flux decentralized cloud.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex, follow',
  },
  {
    slug: 'support/index.html',
    path: '/support',
    title: 'Support & Contact - Palworld on Flux',
    description: 'Get help with your Palworld server on Flux. Submit a support ticket for billing, deployment, or server issues and our team will respond by email.',
    canonical: `${SITE_URL}/support`,
    robots: 'noindex, follow',
  },
  {
    slug: 'success/index.html',
    path: '/success',
    title: 'Deployment Successful - Palworld on Flux',
    description: 'Your Palworld server is being deployed on the Flux decentralized cloud.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex, nofollow',
  },
  {
    slug: 'cancel/index.html',
    path: '/cancel',
    title: 'Checkout Cancelled - Palworld on Flux',
    description: 'Your checkout was cancelled.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex, nofollow',
  },
];

// ---------------------------------------------------------------------------
// Content / guide pages (indexable). Metadata comes from pagesContent.js; the
// body is the server-rendered ArticlePage for that same page key.
// ---------------------------------------------------------------------------
const contentRoutes = Object.entries(pagesContent).map(([key, page]) => ({
  slug: `${key}/index.html`,
  path: page.slug,
  title: page.metaTitle || page.title,
  description: page.description,
  canonical: `${SITE_URL}${page.slug}`,
  robots: INDEXABLE_ROBOTS,
}));

const allRoutes = [...utilityRoutes, ...contentRoutes];

for (const route of allRoutes) {
  const { html } = await render(route.path);
  const outPath = join(distDir, route.slug);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buildHtml({ ...route, rootBody: stripHoistables(html) }), 'utf8');
  console.log(`[prerender] wrote ${route.slug}`);
}

// ---------------------------------------------------------------------------
// Homepage. Its <head> is left exactly as authored in index.html — only #root
// changes — plus the FAQPage built from gameConfig.faq (FAQ.jsx does not emit
// that schema). The shells above were all built from baseHtml, so the homepage
// FAQPage never leaks onto /support, /404 or the guide pages.
// ---------------------------------------------------------------------------
{
  const { html } = await render('/');
  const homeFaqSchema = buildFaqSchema({ faq: gameConfig.faq });
  let homeHtml = baseHtml.replace(
    /<\/head>/i,
    `    <script type="application/ld+json">${JSON.stringify(homeFaqSchema)}</script>\n  </head>`,
  );
  homeHtml = withRoot(homeHtml, '/', stripHoistables(html));
  await writeFile(indexPath, homeHtml, 'utf8');
  console.log(`[prerender] wrote index.html (homepage, SSR body + FAQPage with ${gameConfig.faq.length} questions)`);
}

console.log(`[prerender] done - ${allRoutes.length + 1} routes server-rendered`);
