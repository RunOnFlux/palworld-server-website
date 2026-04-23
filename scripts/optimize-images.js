import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/**
 * Image Optimization Script
 * Converts PNG/JPG images to WebP format with optimal quality settings
 *
 * Usage: node scripts/optimize-images.js
 */

const optimizations = [
  {
    name: 'Logo',
    input: 'public/games/palworld/logo.png',
    output: 'public/games/palworld/logo.webp',
    width: 512,
    height: 512,
    quality: 90,
    fit: 'contain'
  },
  {
    name: 'Banner',
    input: 'public/games/palworld/banner.png',
    output: 'public/games/palworld/banner.webp',
    width: 1200,
    height: 630,
    quality: 85,
    fit: 'cover'
  },
  {
    name: 'Timer',
    input: 'public/games/palworld/timer.png',
    output: 'public/games/palworld/timer.webp',
    width: 512,
    height: 512,
    quality: 95,
    fit: 'contain'
  },
  {
    name: 'No-servers',
    input: 'public/games/palworld/no-servers.png',
    output: 'public/games/palworld/no-servers.webp',
    width: 512,
    height: 512,
    quality: 90,
    fit: 'contain'
  },
  {
    name: 'Plan Loader',
    input: 'public/games/palworld/planLoader.png',
    output: 'public/games/palworld/planLoader.webp',
    width: 384,
    height: 384,
    quality: 85,
    fit: 'contain'
  },
  {
    name: 'Support Hero',
    input: 'public/games/palworld/support.png',
    output: 'public/games/palworld/support.webp',
    width: 800,
    height: 533,
    quality: 90,
    fit: 'contain'
  },
  {
    name: 'Support Left Character',
    input: 'public/games/palworld/support-left.png',
    output: 'public/games/palworld/support-left.webp',
    width: 512,
    height: 512,
    quality: 90,
    fit: 'contain'
  },
  {
    name: 'Support Right Character',
    input: 'public/games/palworld/support-right.png',
    output: 'public/games/palworld/support-right.webp',
    width: 512,
    height: 512,
    quality: 90,
    fit: 'contain'
  },
  {
    name: 'FAQ Character Left',
    input: 'public/games/palworld/faq-character-left.png',
    output: 'public/games/palworld/faq-character-left.webp',
    width: 512,
    height: 1024,
    quality: 90,
    fit: 'contain'
  },
  {
    name: 'FAQ Character Right',
    input: 'public/games/palworld/faq-character-right.png',
    output: 'public/games/palworld/faq-character-right.webp',
    width: 512,
    height: 1024,
    quality: 90,
    fit: 'contain'
  },
  {
    name: '404 Page',
    input: 'public/games/palworld/404.png',
    output: 'public/games/palworld/404.webp',
    width: 800,
    height: 800,
    quality: 90,
    fit: 'contain'
  }
];

// Feature icons optimization
const featureIcons = [
  'deployment-icon',
  'ddos-shield',
  'decentralized-nodes',
  'global-network',
  'monitoring-chart',
  'payment-icon',
  'uptime-clock',
  'cost-savings'
];

async function optimizeImage(config) {
  const inputPath = path.join(projectRoot, config.input);
  const outputPath = path.join(projectRoot, config.output);

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.log(`⚠️  ${config.name}: Input file not found, skipping...`);
    return;
  }

  try {
    const inputStats = fs.statSync(inputPath);
    const inputSize = (inputStats.size / 1024 / 1024).toFixed(2);

    await sharp(inputPath)
      .resize(config.width, config.height, {
        fit: config.fit,
        position: config.fit === 'cover' ? 'center' : undefined,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: config.quality })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);
    const outputSize = (outputStats.size / 1024).toFixed(2);
    const reduction = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);

    console.log(`✓ ${config.name}: ${inputSize} MB → ${outputSize} KB (${reduction}% reduction)`);
  } catch (error) {
    console.error(`❌ ${config.name}: Optimization failed - ${error.message}`);
  }
}

async function optimizeFeatureIcons() {
  console.log('\n📦 Optimizing feature icons...');

  let totalInput = 0;
  let totalOutput = 0;
  let processed = 0;

  for (const icon of featureIcons) {
    const inputPath = path.join(projectRoot, `public/games/palworld/features/${icon}.png`);
    const outputPath = path.join(projectRoot, `public/games/palworld/features/${icon}.webp`);

    if (!fs.existsSync(inputPath)) {
      continue;
    }

    try {
      const inputStats = fs.statSync(inputPath);
      totalInput += inputStats.size;

      await sharp(inputPath)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 75 })
        .toFile(outputPath);

      const outputStats = fs.statSync(outputPath);
      totalOutput += outputStats.size;
      processed++;
    } catch (error) {
      console.error(`❌ ${icon}: Failed - ${error.message}`);
    }
  }

  if (processed > 0) {
    const inputMB = (totalInput / 1024 / 1024).toFixed(2);
    const outputKB = (totalOutput / 1024).toFixed(2);
    const reduction = ((1 - totalOutput / totalInput) * 100).toFixed(1);
    console.log(`✓ ${processed} icons: ${inputMB} MB → ${outputKB} KB (${reduction}% reduction)`);
  } else {
    console.log('⚠️  No feature icons found, skipping...');
  }
}

async function main() {
  console.log('🖼️  Starting image optimization...\n');

  // Optimize individual images
  for (const config of optimizations) {
    await optimizeImage(config);
  }

  // Optimize feature icons
  await optimizeFeatureIcons();

  console.log('\n✨ Image optimization complete!');
  console.log('\n💡 Tips:');
  console.log('   - Update gameConfig.js to use .webp paths');
  console.log('   - Run "npm run build" to see final bundle size');
  console.log('   - WebP provides ~90-95% size reduction vs PNG');
}

main().catch(console.error);
