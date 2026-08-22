#!/usr/bin/env node
// Generate a distinct Open Graph image per indexable page.
//
// Every page shared one banner, so a link to any of them looked identical in Discord, Slack,
// X and iMessage. This composites the site's own banner with the page's headline, so a shared
// link says what it is.
//
// Run locally and commit the output: it needs fontconfig, which the Alpine build image does
// not carry, and the titles only change when someone rewrites a page.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const [root, bannerRel, outRel, siteName] = process.argv.slice(2);
const dist = join(root, 'dist');
const outDir = join(root, 'public', outRel);
await mkdir(outDir, { recursive: true });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Break a headline into at most three lines that fit the card. */
function wrap(text, perLine = 22, max = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > perLine && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (lines.length === max) break;
  }
  if (cur && lines.length < max) lines.push(cur);
  if (lines.length === max && words.join(' ').length > lines.join(' ').length) {
    lines[max - 1] = lines[max - 1].replace(/[\s,.:;-]+$/, '') + '…';
  }
  return lines;
}

const banner = await sharp(join(root, 'public', bannerRel)).resize(1200, 630, { fit: 'cover' }).toBuffer();

// Every route shell in dist, plus the homepage.
const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (e.name === 'index.html') files.push(p);
  }
}
await walk(dist);

let n = 0;
for (const f of files) {
  const html = await readFile(f, 'utf8');
  const robots = /<meta name="robots" content="([^"]*)"/i.exec(html)?.[1] || '';
  if (robots.startsWith('noindex')) continue;
  const canonical = /<link rel="canonical" href="([^"]*)"/i.exec(html)?.[1] || '';
  const slug = canonical.replace(/^https?:\/\/[^/]+\/?/, '').replace(/\/$/, '') || 'home';
  const rawTitle = (/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').trim();
  // Drop the site suffix: it goes on its own line, smaller.
  const headline = rawTitle.split('|')[0].replace(/\s+[-–—]\s+.*$/, '').trim() || siteName;

  const lines = wrap(headline);
  const startY = 330 - (lines.length - 1) * 34;
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.45"/>
      <stop offset="55%" stop-color="#000" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#v)"/>
  ${lines.map((l, i) => `<text x="80" y="${startY + i * 68}" font-family="DejaVu Sans, sans-serif" font-size="58" font-weight="bold" fill="#ffffff">${esc(l)}</text>`).join('\n  ')}
  <text x="80" y="${startY + lines.length * 68 + 24}" font-family="DejaVu Sans, sans-serif" font-size="28" fill="#cbd5e1">${esc(siteName)}</text>
</svg>`;

  const out = join(outDir, `${slug.replace(/\//g, '-') || 'home'}.webp`);
  await sharp(banner).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).webp({ quality: 82 }).toFile(out);
  n += 1;
}
console.log(`[og] ${n} imagens em public/${outRel}`);
