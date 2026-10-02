// Generates store screenshots (real extension UI, real Chromium) and promo images from HTML templates.
//   CHROMIUM=/path/to/chrome node scripts/make-store-assets.mjs   (needs: node scripts/build.mjs --test)
// Design is TEMPORARY (no approved Tabsira identity assets exist in the repository).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openExtPage, send, root, sleep, startSite } from '../tests/e2e/lib.mjs';

const out = path.join(root, 'store', 'images');
fs.mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const extensionDir = path.join(root, 'dist-test', 'chromium');
const site = await startSite();
const settings = { baseList: true, starterTerms: true, domains: ['example.org', 'sample-site.test'], allow: ['fine-site.example.com'], words: ['sample phrase', 'عبارة اختبار'], contains: [] };
const shot = (page, name) => page.screenshot({ path: path.join(out, name) });

async function session(lang) {
    const b = await launch({ executablePath, extensionDir, lang });
    const options = await openExtPage(b.context, b.extensionId, 'options.html');
    await send(options, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: true });
    const status = (await send(options, { type: 'GET_STATUS' })).status;
    await send(options, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings });
    await options.reload();
    return { b, options };
}

// ---- Arabic (default) ----
{
    const { b, options } = await session('ar');
    const size = { width: 1280, height: 800 };
    const onboarding = await openExtPage(b.context, b.extensionId, 'onboarding.html');
    await onboarding.setViewportSize(size);
    await shot(onboarding, 'screenshot-ar-1-onboarding.png');
    for (let i = 0; i < 4; i++) await onboarding.click('#next');
    await onboarding.setViewportSize(size); await sleep(300);
    await shot(onboarding, 'screenshot-ar-2-onboarding-choices.png');
    await options.setViewportSize(size); await sleep(400);
    await shot(options, 'screenshot-ar-3-settings.png');
    const stop = await b.context.newPage(); await stop.setViewportSize(size);
    await stop.goto(`http://tabsira-selftest.test:${site.port}/`); await stop.waitForURL('**/blocked.html'); await sleep(300);
    await shot(stop, 'screenshot-ar-4-stop-page.png');
    await stop.click('a[href="help.html"]'); await stop.waitForURL('**/help.html'); await sleep(300);
    await shot(stop, 'screenshot-ar-5-help.png');
    const popup = await openExtPage(b.context, b.extensionId, 'popup.html'); await popup.setViewportSize({ width: 360, height: 420 }); await sleep(500);
    const popupPng = await popup.screenshot();
    const framed = await b.context.newPage(); await framed.setViewportSize(size);
    await framed.setContent(`<body style="margin:0;background:#e3ece5;display:flex;align-items:center;justify-content:center;height:800px"><img src="data:image/png;base64,${popupPng.toString('base64')}" style="box-shadow:0 12px 40px #0004;border-radius:12px;transform:scale(1.6)"></body>`);
    await shot(framed, 'screenshot-ar-6-popup.png');
    await b.context.close();
}
// ---- German and English settings pages ----
for (const lang of ['de', 'en']) {
    const { b, options } = await session(lang);
    await options.setViewportSize({ width: 1280, height: 800 }); await sleep(400);
    await shot(options, `screenshot-${lang}-1-settings.png`);
    const stop = await b.context.newPage(); await stop.setViewportSize({ width: 1280, height: 800 });
    await stop.goto(`http://tabsira-selftest.test:${site.port}/`); await stop.waitForURL('**/blocked.html'); await sleep(300);
    await shot(stop, `screenshot-${lang}-2-stop-page.png`);
    await b.context.close();
}
// ---- promo images (HTML templates rendered by Chromium) ----
const icon = fs.readFileSync(path.join(root, 'src', 'icons', 'icon-128.png')).toString('base64');
const promo = (width, height, big) => `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;width:${width}px;height:${height}px;background:linear-gradient(135deg,#1f4a3a,#2b6650);color:#f6f5ee;font-family:system-ui,'Noto Sans Arabic',sans-serif;display:flex;align-items:center;justify-content:center;gap:${big ? 48 : 24}px">
<img src="data:image/png;base64,${icon}" style="width:${big ? 220 : 120}px;height:${big ? 220 : 120}px">
<div><div style="font-size:${big ? 92 : 52}px;font-weight:700;line-height:1.2">تبصرة</div><div style="font-size:${big ? 36 : 20}px;opacity:.92;margin-top:8px">مساحة تختار فيها</div><div style="font-size:${big ? 24 : 15}px;opacity:.75;margin-top:6px">Tabsira · local · no accounts · no tracking</div></div></body></html>`;
const browser = await launch({ executablePath, extensionDir, lang: 'ar' });
for (const [name, w, h, big] of [['promo-small-440x280.png', 440, 280, false], ['promo-marquee-1400x560.png', 1400, 560, true]]) {
    const page = await browser.context.newPage(); await page.setViewportSize({ width: w, height: h });
    await page.setContent(promo(w, h, big)); await sleep(200); await shot(page, name); await page.close();
}
await browser.context.close();
fs.copyFileSync(path.join(root, 'src', 'icons', 'icon-128.png'), path.join(out, 'icon-128.png'));
fs.copyFileSync(path.join(root, 'src', 'icons', 'icon-300.png'), path.join(out, 'edge-logo-300x300.png'));
await site.close();
process.stdout.write(`${fs.readdirSync(out).join('\n')}\n`);
