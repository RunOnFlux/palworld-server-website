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
// nothing in React emits those. Article is the exception — it is stamped here per
// content route, because its dateModified is the build timestamp and React cannot
// know that without producing a value that differs between server and browser.
//
// server.js maps the routes to these files, and it is the only thing that does. The
// netlify.toml / vercel.json that used to sit alongside it were deleted: both rewrote
// /* to /index.html, which would have served the homepage shell — wrong <title>, wrong
// canonical, wrong schema — for every content URL, and turned every 404 into a soft 200.
// Production is the Docker image that runs server.js.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pagesContent, buildFaqSchema, buildArticleSchema } from '../src/config/pagesContent.js';
import plansSnapshot from '../src/config/snapshots/plans.json' with { type: 'json' };
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

/**
 * Search-engine ownership verification, stamped into every shell.
 *
 * Left out of index.html because the tokens are per-property, not per-repo: set
 * GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION at build time (Dockerfile build-args)
 * and the tags appear. Unset, nothing is emitted — which is correct if the property is
 * already verified by DNS TXT record. The tokens are public strings, not secrets.
 */
const verificationTags = [
  ['google-site-verification', process.env.GOOGLE_SITE_VERIFICATION],
  ['msvalidate.01', process.env.BING_SITE_VERIFICATION],
]
  .filter(([, value]) => value)
  .map(([name, value]) => `<meta name="${name}" content="${value.replace(/"/g, '&quot;')}" />`);

const rawIndexHtml = await readFile(indexPath, 'utf8');
const withVerification = verificationTags.length
  ? rawIndexHtml.replace(/<\/head>/i, `    ${verificationTags.join('\n    ')}\n  </head>`)
  : rawIndexHtml;

// Used as `dateModified` on the content pages. A release rebuilds every shell from the
// current source, so "modified when this bundle was cut" is the honest claim.
const BUILD_DATE = new Date().toISOString();

/**
 * Keep the AggregateOffer in index.html honest.
 *
 * lowPrice / highPrice / offerCount were hand-written, so they were a set of prices with no
 * link to the marketplace they claim to describe — correct on the day they were typed and
 * silently wrong after any repricing. They are now derived from the same build-time
 * snapshot the pricing section renders from (scripts/sync-snapshots.mjs), so the schema and
 * the cards can no longer disagree.
 */
function syncAggregateOffer(html) {
  const prices = plansSnapshot.map((p) => p.price?.monthly).filter((m) => typeof m === 'number');
  if (!prices.length) {
    console.warn('[prerender] AggregateOffer: no priced plans in the snapshot, leaving index.html as authored');
    return html;
  }
  const low = (Math.min(...prices) / 100).toFixed(2);
  const high = (Math.max(...prices) / 100).toFixed(2);
  console.log(`[prerender] AggregateOffer: ${prices.length} offers, $${low} - $${high}`);
  return html
    .replace(/("lowPrice":\s*)"[^"]*"/, `$1"${low}"`)
    .replace(/("highPrice":\s*)"[^"]*"/, `$1"${high}"`)
    .replace(/("offerCount":\s*)"[^"]*"/, `$1"${prices.length}"`);
}

const baseHtml = syncAggregateOffer(withVerification);

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

function injectJsonLd(html, schemas) {
  const blocks = (schemas || []).filter(Boolean);
  if (!blocks.length) return html;
  return html.replace(
    /<\/head>/i,
    `    ${blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join('\n    ')}\n  </head>`,
  );
}

/**
 * Drop the commercial JSON-LD from a shell that should not carry it.
 *
 * index.html holds Service + AggregateOffer, Organization and WebSite, and every shell here
 * is built from index.html — so /support, /success, /cancel and the 404 page were each
 * repeating a priced service entity on a noindex page. The homepage and the content pages
 * keep it.
 */
const stripServiceSchema = (html) =>
  html.replace(
    /\s*<!-- Static JSON-LD so non-JS crawlers[\s\S]*?<\/script>(?=\s*<!-- FAQPage schema)/i,
    '',
  );

function buildHtml({
  path, ssrPath, title, description, canonical, robots, rootBody,
  ogType = 'website', jsonLd, service = true,
}) {
  let html = baseHtml;
  if (!service) html = stripServiceSchema(html);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta name="title"[^>]*>/i, `<meta name="title" content="${esc(title)}" />`);
  html = html.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${esc(description)}" />`);
  html = html.replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(title)}" />`);
  html = html.replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${esc(description)}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${esc(canonical)}" />`);
  // Content pages are articles. Without this every shell inherited the homepage's
  // og:type="website".
  html = html.replace(/<meta property="og:type"[^>]*>/i, `<meta property="og:type" content="${esc(ogType)}" />`);
  html = html.replace(/<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${esc(title)}" />`);
  html = html.replace(/<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${esc(description)}" />`);
  html = html.replace(/<meta name="twitter:url"[^>]*>/i, `<meta name="twitter:url" content="${esc(canonical)}" />`);
  html = html.replace(/<meta name="robots"[^>]*>/i, `<meta name="robots" content="${esc(robots)}" />`);
  html = html.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${esc(canonical)}" />`);
  html = injectJsonLd(html, jsonLd);
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
    service: false,
  },
  {
    slug: 'support/index.html',
    path: '/support',
    title: 'Support & Contact - Palworld on Flux',
    description: 'Get help with your Palworld server on Flux. Submit a support ticket for billing, deployment, or server issues and our team will respond by email.',
    canonical: `${SITE_URL}/support`,
    robots: 'noindex, follow',
    service: false,
  },
  {
    slug: 'success/index.html',
    path: '/success',
    title: 'Deployment Successful - Palworld on Flux',
    description: 'Your Palworld server is being deployed on the Flux decentralized cloud.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex, nofollow',
    service: false,
  },
  {
    slug: 'cancel/index.html',
    path: '/cancel',
    title: 'Checkout Cancelled - Palworld on Flux',
    description: 'Your checkout was cancelled.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex, nofollow',
    service: false,
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
  published: page.published,
  robots: INDEXABLE_ROBOTS,
  ogType: 'article',
  // The only schema React does not emit for these pages. See buildArticleSchema().
  jsonLd: [buildArticleSchema(page, BUILD_DATE)],
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

// ---------------------------------------------------------------------------
// Sitemap.
//
// Written here rather than by a Vite plugin, because the route table above is already the
// single source of truth for which URLs exist and when each one last changed. The plugin
// needed a second, hand-maintained copy of the route list, and could only stamp one build-time
// lastmod across every entry: a claim that every page changed on every release, which is the
// kind of lastmod Google learns to ignore.
//
// No <changefreq> or <priority>: Google has said for years that it ignores both.
// ---------------------------------------------------------------------------
// Last time the homepage's own content changed. Stated, not derived from the build.
const HOME_MODIFIED = '2026-08-22';
const sitemapEntries = [
  { loc: `${SITE_URL}/`, lastmod: HOME_MODIFIED },
  ...(contentRoutes)
    .map((r) => ({ loc: r.canonical, lastmod: r.modified || r.published || HOME_MODIFIED }))
    .filter((e) => e.loc),
];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((e) => `  <url>\n    <loc>${esc(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
await writeFile(join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
console.log(`[prerender] wrote sitemap.xml (${sitemapEntries.length} URLs)`);
