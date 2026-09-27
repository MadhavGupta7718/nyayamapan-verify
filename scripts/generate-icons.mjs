#!/usr/bin/env node
// Renders the PWA / Android app icons from public/icon.svg: node scripts/generate-icons.mjs
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile("public/icon.svg", "utf8");

// Maskable icons are cropped to a circle or squircle by the launcher, so only the scales mark is used,
// shrunk into the central safe zone on a full-bleed background.
const mark = svg.match(/<g id="mark"[\s\S]*?<\/g>/)?.[0];
if (!mark) throw new Error('public/icon.svg needs a <g id="mark"> element');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a69b1"/><stop offset="1" stop-color="#243563"/></linearGradient></defs>
  <rect width="64" height="64" fill="url(#bg)"/>
  <g transform="translate(12 13.5) scale(0.625)">${mark}</g>
</svg>`;

const out = [
  ["public/icon-192.png", svg, 192],
  ["public/icon-512.png", svg, 512],
  ["public/icon-maskable-512.png", maskable, 512],
  ["public/apple-touch-icon.png", maskable, 180],
];
for (const [file, source, size] of out) {
  await sharp(Buffer.from(source), { density: 72 * (size / 64) }).resize(size, size).png().toFile(file);
  console.log(`${file} (${size}x${size})`);
}
