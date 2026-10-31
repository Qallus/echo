// Builds Echo's app icon and favicon from one SVG: the audio-lines mark (the
// same bars as the logo) in white on Echo's near-black.
//   npm run icons
// Writes src/app/{icon.svg,favicon.ico,apple-icon.png} (Next.js file
// conventions) and public/icons/*.png for the web app manifest.

import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#0a0a0a";
// Bars from lucide's AudioLines (24-unit grid): [x, y1, y2].
const BARS = [[2, 10, 13], [6, 6, 17], [10, 3, 21], [14, 8, 15], [18, 5, 18], [22, 10, 13]];

// size: canvas; mark: share of the canvas the bars span; radius: corner share.
function svg({ size = 512, mark = 0.62, radius = 0.22, stroke = 2.4 } = {}) {
  const scale = (size * mark) / 24;
  const offset = (size - 24 * scale) / 2;
  const lines = BARS.map(([x, y1, y2]) => {
    const p = (v) => (offset + v * scale).toFixed(2);
    return `<line x1="${p(x)}" y1="${p(y1)}" x2="${p(x)}" y2="${p(y2)}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${(size * radius).toFixed(2)}" fill="${BG}"/>` +
    `<g stroke="#fff" stroke-width="${(stroke * scale).toFixed(2)}" stroke-linecap="round">${lines}</g></svg>`;
}

const png = (markup, px) => sharp(Buffer.from(markup)).resize(px, px).png().toBuffer();

// ICO container holding PNG images (supported by every current browser).
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ px, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(px >= 256 ? 0 : px, e);
    header.writeUInt8(px >= 256 ? 0 : px, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

const rounded = svg();
// 32/48px favicons: bigger, bolder bars.
const small = svg({ mark: 0.7, stroke: 2.8 });
// 16px favicon: six bars blur together, so three pixel-aligned ones.
const tiny = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3.5" fill="${BG}"/>` +
  `<g fill="#fff"><rect x="3" y="6" width="2" height="4" rx="1"/><rect x="7" y="3" width="2" height="10" rx="1"/><rect x="11" y="5" width="2" height="6" rx="1"/></g></svg>`;
// Full-bleed square: iOS and Android apply their own corner mask.
const square = svg({ radius: 0 });
// Maskable: the mark stays inside the central safe zone.
const maskable = svg({ radius: 0, mark: 0.48 });

await mkdir("public/icons", { recursive: true });
await writeFile("src/app/icon.svg", rounded);
await writeFile("src/app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (px) => ({ px, data: await png(px === 16 ? tiny : small, px) })))));
await writeFile("src/app/apple-icon.png", await png(square, 180));
await writeFile("public/icons/icon-192.png", await png(rounded, 192));
await writeFile("public/icons/icon-512.png", await png(rounded, 512));
await writeFile("public/icons/maskable-512.png", await png(maskable, 512));
console.log("Icons written.");
