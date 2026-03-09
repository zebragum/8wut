import fs from 'fs';

const PATH = 'C:/Z/8wut/public/8logo.svg';

let svgContent = fs.readFileSync(PATH, 'utf-8');

// 1. Swap blue tones to a gradient of lavender tones
svgContent = svgContent.replace(/#6CBDE8/g, '#ce93d8'); // Lavender
svgContent = svgContent.replace(/#6DBEE8/g, '#d8a1e0'); // Slightly lighter lavender
svgContent = svgContent.replace(/#6EBFE9/g, '#ba68c8'); // Darker lavender stroke 
svgContent = svgContent.replace(/#74BDE1/g, '#ab47bc'); // Darkest lavender detail

// 2. Inject a white circle behind everything to fill the center loops of the 8 transparently.
// Based on the 2986x1408 viewBox and the main 8 paths happening centrally,
// we'll inject a white circle `cx="1560" cy="740" r="400"` to cover the back.
const circleInject = `<circle cx="1560" cy="740" r="450" fill="white" />\n<path fill="#FEFEFE"`;
svgContent = svgContent.replace(/<path fill="#FEFEFE"/, circleInject);

// 3. To make the bottom loop "aperture-like" without completely reconstructing the massive path arrays, 
// we will draw 6 sharp, overlapping grey/white polygon "blades" directly inside the coordinate space of 
// the bottom circle of the '8' figure, layered on top of the white circle but behind the lavender paths.
// Let's create an aperture group. We will guesstimate the center of the bottom loop around (1560, 950) 
// using relative polygon blades built mathematically around that point.
const cx = 1560;
const cy = 950;
const r = 200; // Inner radius for the aperture ring 

const apertureGroup = `
  <g fill="none" stroke="#ba68c8" stroke-width="8" opacity="0.8">
    <!-- Camera aperture blades centered on bottom loop of 8 -->
    <path d="M ${cx-r+40} ${cy-r+40} L ${cx+r-100} ${cy-r+40} L ${cx+r} ${cy+r-100} Z" fill="#E1BEE7"/>
    <path d="M ${cx+r-100} ${cy-r+40} L ${cx+r-40} ${cy+r-40} L ${cx-r+100} ${cy+r-40} Z" fill="#CE93D8"/>
    <path d="M ${cx+r-40} ${cy+r-40} L ${cx-r+40} ${cy+r-100} L ${cx-r+40} ${cy-r+40} Z" fill="#BA68C8"/>
    <!-- Center shutter hole -->
    <polygon points="${cx},${cy-60} ${cx+50},${cy+30} ${cx-50},${cy+30}" fill="#4a148c" />
  </g>
`;

svgContent = svgContent.replace(/<path fill="#ce93d8"/, apertureGroup + '\n<path fill="#ce93d8"');

fs.writeFileSync(PATH, svgContent, 'utf-8');
console.log('SVG patched with padding, lavender, white circle, and aperture blades.');
