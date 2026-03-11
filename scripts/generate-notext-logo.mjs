/**
 * Creates 8logo_notext.svg - a version of the logo that crops out the "wut" text.
 * The aperture/8 symbol lives in approximately the upper 60% of the 1536x1536 viewBox.
 * We wrap the original SVG in a new SVG with a cropped viewBox using an <image> element.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

// The aperture 8 sits roughly in the top-left quadrant to center.
// We'll show only the top ~870px (out of 1536) to just clip the wut text.
// x offset 0, y offset 0, width 1536, height 870
const CROP_X = 20;
const CROP_Y = 20;
const CROP_W = 1496;
const CROP_H = 920;  // crop below the 8px mark, before the "wut" text

const src = readFileSync(resolve(publicDir, '8logo.svg'), 'utf8');

// Create a new SVG that embeds the original with a cropped viewBox via foreignObject trick
// Better: just change the viewBox of a copy of the original file
const modified = src.replace(
  /viewBox="0 0 1536 1536"/,
  `viewBox="${CROP_X} ${CROP_Y} ${CROP_W} ${CROP_H}"`
);

writeFileSync(resolve(publicDir, '8logo_notext.svg'), modified, 'utf8');
console.log(`✅ Created /public/8logo_notext.svg (viewBox ${CROP_X} ${CROP_Y} ${CROP_W} ${CROP_H})`);
