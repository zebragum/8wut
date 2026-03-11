/**
 * Generates PWA icons (192x192 and 512x512 PNG) from the 8logo.svg.
 * The logo is centered with ~15% padding on a solid dark background (#0a0a1a).
 * Requires: sharp  (npm install sharp --save-dev in the root)
 */
import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const publicDir = resolve(rootDir, 'public');
const svgPath = resolve(publicDir, '8logo.svg');

if (!existsSync(svgPath)) {
  console.error('ERROR: public/8logo.svg not found');
  process.exit(1);
}

const svgBuffer = readFileSync(svgPath);

const BG_COLOR = { r: 10, g: 10, b: 26, alpha: 1 }; // #0a0a1a – the app's dark background

async function generateIcon(size) {
  const padding = Math.round(size * 0.12); // 12% padding all around
  const logoSize = size - padding * 2;

  // Rasterize SVG to the logo size
  const logoBuffer = await sharp(svgBuffer)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Composite on a solid background
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG_COLOR
    }
  })
    .composite([{ input: logoBuffer, gravity: 'centre' }])
    .png()
    .toFile(resolve(publicDir, `icon-${size}.png`));

  console.log(`✅  Generated /public/icon-${size}.png  (${size}×${size})`);
}

await generateIcon(192);
await generateIcon(512);

// Also generate apple-touch-icon.png at 180x180 (iOS standard)
const applePadding = Math.round(180 * 0.12);
const appleLogoSize = 180 - applePadding * 2;
const appleLogoBuffer = await sharp(svgBuffer)
  .resize(appleLogoSize, appleLogoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

await sharp({
  create: { width: 180, height: 180, channels: 4, background: BG_COLOR }
})
  .composite([{ input: appleLogoBuffer, gravity: 'centre' }])
  .png()
  .toFile(resolve(publicDir, 'apple-touch-icon.png'));

console.log('✅  Generated /public/apple-touch-icon.png  (180×180)');
console.log('\nAll icons generated successfully!');
