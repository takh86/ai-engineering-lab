// Renders src/icons/icon.svg to PNG sizes with a real Chromium (no image library needed).
//   CHROMIUM=/path/to/chrome node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'src', 'icons', 'icon.svg'), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const size of [16, 32, 48, 96, 128, 300]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">${svg.replace('width="128" height="128"', `width="${size}" height="${size}"`)}</body>`);
    await page.screenshot({ path: path.join(root, 'src', 'icons', `icon-${size}.png`), omitBackground: true });
}
await browser.close();
