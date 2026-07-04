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
import { pagesContent, renderPageBodyHtml, buildPageSchemas, buildFaqSchema } from '../src/config/pagesContent.js';
import { gameConfig } from '../src/config/gameConfig.js';

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

function buildHtml({ title, description, canonical, robots, noscriptBody, mainBody, schemas }) {
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
  // Replace the #root static fallback with page-specific content so non-JS
  // crawlers see this route's real content (React still hydrates over it).
  if (mainBody) {
    html = html.replace(
      /<div id="root">[\s\S]*?<\/div>\s*<noscript>/i,
      `<div id="root">${mainBody}</div>\n    <noscript>`
    );
  }
  // Inject per-page JSON-LD (BreadcrumbList, HowTo, FAQPage, Product) so
  // structured data is present without JS.
  if (schemas && schemas.length) {
    const scripts = schemas
      .map((s) => `<script type="application/ld+json">\n    ${JSON.stringify(s)}\n    </script>`)
      .join('\n    ');
    html = html.replace(/<\/head>/i, `    ${scripts}\n  </head>`);
  }
  return html;
}

// Cross-links to sibling Flux hosting products (the footer "Explore other Flux
// hosting" block) rendered as static HTML so non-JS crawlers see the same
// followed, keyword-anchor links the React Footer renders. Single source of
// truth is gameConfig.ecosystemLinks.
function ecosystemFooterHtml() {
  const items = gameConfig.ecosystemLinks
    .map(
      (l) =>
        `<li><a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`,
    )
    .join('');
  return `<footer class="seo-fallback" aria-label="Explore other Flux hosting"><h2>Explore other Flux hosting</h2><ul>${items}</ul></footer>`;
}

// Wrap page HTML in the shared fallback styling so the static content is legible.
function fallbackMain(bodyHtml) {
  return `<style>${fallbackStyle}</style><main class="seo-fallback">${bodyHtml}</main>${ecosystemFooterHtml()}`;
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
    noscriptBody: `<style>${fallbackStyle}</style><div class="seo-fallback"><h1>Palworld on Flux - Support</h1><p>Need help with your Palworld server? Open a ticket at the <a href="https://support.runonflux.com" target="_blank" rel="noopener noreferrer">Flux support center</a> and our team will respond by email. For community help, join the <a href="https://discord.com/invite/runonflux">Flux Discord</a>.</p></div>`,
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

// Content/guide pages — real long-form content sourced from pagesContent.js so
// the static HTML and the React render never drift apart. These are indexable.
const contentRoutes = Object.entries(pagesContent).map(([key, page]) => ({
  slug: `${key}/index.html`,
  title: page.metaTitle || page.title,
  description: page.description,
  canonical: `${SITE_URL}${page.slug}`,
  robots: INDEXABLE_ROBOTS,
  mainBody: fallbackMain(renderPageBodyHtml(page)),
  schemas: buildPageSchemas(page),
}));

const allRoutes = [...routes, ...contentRoutes];

for (const route of allRoutes) {
  const outPath = join(distDir, route.slug);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buildHtml(route), 'utf8');
  console.log(`[prerender] wrote ${route.slug}`);
}

// =====================================================================
// Homepage: inject a STATIC FAQPage JSON-LD from gameConfig.faq so it is
// present for non-JS crawlers and appears exactly once. FAQ.jsx no longer
// emits this schema. Built from baseHtml so the utility/noindex shells above
// (which were also built from baseHtml) never receive the homepage FAQPage.
// =====================================================================
{
  const homeFaqSchema = buildFaqSchema({ faq: gameConfig.faq });
  let homeHtml = baseHtml.replace(
    /<\/head>/i,
    `    <script type="application/ld+json">${JSON.stringify(homeFaqSchema)}</script>\n  </head>`,
  );
  // Inject the "Explore other Flux hosting" cross-links into the homepage's
  // static #root fallback so the followed sibling/cloud links ship for non-JS
  // crawlers too (React hydrates over #root for JS clients).
  homeHtml = homeHtml.replace(
    /<\/main>\s*<\/div>\s*<noscript>/i,
    `</main>${ecosystemFooterHtml()}\n    </div>\n    <noscript>`,
  );
  await writeFile(indexPath, homeHtml, 'utf8');
  console.log(`[prerender] injected static FAQPage (${gameConfig.faq.length} questions) + ecosystem footer into index.html`);
}

console.log(`[prerender] done - ${allRoutes.length} route shells generated`);
