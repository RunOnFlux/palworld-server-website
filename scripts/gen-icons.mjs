/**
 * One-off generator for the PWA / Apple touch icons, rasterised from the game
 * logo (public/games/rust/logo.webp) onto the theme background so transparent
 * areas don't render black on iOS home screens. PNG outputs are committed, so
 * this is NOT part of the build. Run manually when the logo/palette changes:
 *
 *   node scripts/gen-icons.mjs
 */

import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '..', 'public')
const SOURCE = path.join(publicDir, 'games', 'palworld', 'logo.webp')
const BG = '#1a1a2e' // matches <meta name="theme-color">

const ICONS = [
  { size: 180, file: 'apple-touch-icon.png', inner: 0.78 },
  { size: 192, file: 'icon-192.png', inner: 0.78 },
  { size: 512, file: 'icon-512.png', inner: 0.78 },
  { size: 512, file: 'icon-maskable-512.png', inner: 0.6 },
]

for (const { size, file, inner } of ICONS) {
  const glyphSize = Math.round(size * inner)
  const glyph = await sharp(SOURCE)
    .resize(glyphSize, glyphSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: glyph, gravity: 'center' }])
    .flatten({ background: BG })
    .removeAlpha()
    .png()
    .toFile(path.join(publicDir, file))

  console.log(`✓ ${file} (${size}x${size})`)
}
