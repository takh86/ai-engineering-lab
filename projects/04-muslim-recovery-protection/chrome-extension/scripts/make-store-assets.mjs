// Generates the store images: REAL screenshots of the released Chromium package (the extracted release ZIP, unmodified)
// and promo tiles drawn from the approved identity (redrawn mark + Cairo/Tajawal embedded from src/fonts, OFL).
//   node scripts/build.mjs && node scripts/make-store-assets.mjs        (CHROMIUM=/path/to/chrome to override the browser)
// The mark is a REDRAW of the Owner's reference image (docs/brand/ASSETS.md); replace it when the master SVG exists.
import fs from 'node:fs';
import path from 'node:path';
import { launch, openExtPage, send, root, sleep, startSite } from '../tests/e2e/lib.mjs';
import { preparePackage } from '../tests/e2e/package.mjs';

const out = path.join(root, 'store', 'images');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const pkg = preparePackage('chromium', { work: path.join(root, '.pkg-under-test', 'store-assets') });
const extensionDir = pkg.dirs.release;
const site = await startSite();
const settings = { baseList: true, starterTerms: true, domains: ['example.org', 'sample-site.test'], allow: ['fine-site.example.com'], words: ['sample phrase', 'عبارة اختبار'], contains: [] };
const shot = (page, name) => page.screenshot({ path: path.join(out, name) });
const SIZE = { width: 1280, height: 800 };

async function session(lang, scheme = 'light') {
    const b = await launch({ executablePath, extensionDir, lang });
    const options = await openExtPage(b.context, b.extensionId, 'options.html');
    await options.emulateMedia({ colorScheme: scheme });
    await send(options, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: true });
    const status = (await send(options, { type: 'GET_STATUS' })).status;
    await send(options, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings });
    await options.reload();
    return { b, options };
}
const stopPage = async (b, size = SIZE) => {
    const stop = await b.context.newPage(); await stop.setViewportSize(size);
    await stop.goto(`http://tabsira-selftest.test:${site.port}/`); await stop.waitForURL('**/blocked.html'); await sleep(350);
    return stop;
};
const frameBackground = 'linear-gradient(135deg,#0B3B8F,#1456C5)';

// ---- Arabic (default): the full tour, light ----
{
    const fresh = await launch({ executablePath, extensionDir, lang: 'ar' });
    const onboarding = await openExtPage(fresh.context, fresh.extensionId, 'onboarding.html');
    await onboarding.setViewportSize(SIZE); await sleep(350);
    await shot(onboarding, 'screenshot-ar-1-onboarding.png');
    for (let i = 0; i < 4; i++) await onboarding.click('#next');
    await sleep(350);
    await shot(onboarding, 'screenshot-ar-2-onboarding-choices.png');
    await fresh.context.close();
    const { b, options } = await session('ar');
    await options.setViewportSize(SIZE); await sleep(450);
    await shot(options, 'screenshot-ar-3-settings.png');
    const stop = await stopPage(b);
    await shot(stop, 'screenshot-ar-4-stop-page.png');
    await stop.click('a[href="help.html"]'); await stop.waitForURL('**/help.html'); await sleep(350);
    await shot(stop, 'screenshot-ar-5-help.png');
    const popup = await openExtPage(b.context, b.extensionId, 'popup.html'); await popup.setViewportSize({ width: 360, height: 420 }); await sleep(500);
    const popupPng = await popup.screenshot();
    const framed = await b.context.newPage(); await framed.setViewportSize(SIZE);
    await framed.setContent(`<body style="margin:0;background:${frameBackground};display:flex;align-items:center;justify-content:center;height:800px"><img src="data:image/png;base64,${popupPng.toString('base64')}" style="box-shadow:0 14px 44px #0006;border-radius:14px;transform:scale(1.6)"></body>`);
    await shot(framed, 'screenshot-ar-6-popup.png');
    await b.context.close();
}
// ---- Arabic, dark scheme (stop page + settings) ----
{
    const { b, options } = await session('ar', 'dark');
    await options.setViewportSize(SIZE); await sleep(450);
    await shot(options, 'screenshot-ar-7-settings-dark.png');
    const stop = await stopPage(b); await stop.emulateMedia({ colorScheme: 'dark' }); await sleep(450);
    await shot(stop, 'screenshot-ar-8-stop-page-dark.png');
    await b.context.close();
}
// ---- German and English: settings + stop page ----
for (const lang of ['de', 'en']) {
    const { b, options } = await session(lang);
    await options.setViewportSize(SIZE); await sleep(450);
    await shot(options, `screenshot-${lang}-1-settings.png`);
    const stop = await stopPage(b);
    await shot(stop, `screenshot-${lang}-2-stop-page.png`);
    await b.context.close();
}

// ---- promo tiles (HTML rendered by Chromium; fonts and mark embedded, no network) ----
const font = (file, family, weight, range) => `@font-face{font-family:${family};font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(root, 'src', 'fonts', file)).toString('base64')}) format('woff2');unicode-range:${range}}`;
const ARABIC = 'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC,U+200C-200E';
const LATIN = 'U+0000-00FF,U+2000-206F,U+2122';
const fontCss = [font('cairo-arabic-700-normal.woff2', 'Cairo', 700, ARABIC), font('cairo-latin-700-normal.woff2', 'Cairo', 700, LATIN),
    font('tajawal-arabic-400-normal.woff2', 'Tajawal', 400, ARABIC), font('tajawal-latin-400-normal.woff2', 'Tajawal', 400, LATIN)].join('');
const mark = fs.readFileSync(path.join(root, 'src', 'brand', 'mark.svg'), 'utf8').replace(/<\?xml[^>]*>/u, '').replace('<svg ', '<svg width="100%" height="100%" ');
const promo = (width, height, big) => `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>${fontCss}
body{margin:0;width:${width}px;height:${height}px;background:#F3F6FB;color:#0B3B8F;display:flex;align-items:center;justify-content:center;gap:${big ? 64 : 28}px;font-family:Tajawal,sans-serif;position:relative;overflow:hidden}
.bar{position:absolute;inset-inline:0;bottom:0;height:${big ? 18 : 10}px;background:#B7E445}
.mark{width:${big ? 300 : 130}px;height:${big ? 270 : 118}px}
.name{font:700 ${big ? 120 : 56}px/1.15 Cairo,sans-serif;color:#0B3B8F}
.line{font-size:${big ? 40 : 19}px;color:#1F3050;margin-top:${big ? 12 : 6}px}
.en{font-size:${big ? 28 : 13}px;color:#44546F;margin-top:${big ? 10 : 5}px;direction:ltr;text-align:right}
</style><body><div class="mark">${mark}</div><div><div class="name">تبصرة</div><div class="line">تحجب ما تختاره أنت، وتمنحك لحظة مساعدة</div><div class="en">Tabsira · block what you choose · local · no accounts</div></div><div class="bar"></div></body></html>`;
const browser = await launch({ executablePath, extensionDir, lang: 'ar' });
for (const [name, w, h, big] of [['promo-small-440x280.png', 440, 280, false], ['promo-marquee-1400x560.png', 1400, 560, true]]) {
    const page = await browser.context.newPage(); await page.setViewportSize({ width: w, height: h });
    await page.setContent(promo(w, h, big)); await page.evaluate(() => document.fonts.ready); await sleep(200); await shot(page, name); await page.close();
}
await browser.context.close();
fs.copyFileSync(path.join(root, 'src', 'icons', 'icon-128.png'), path.join(out, 'icon-128.png'));
fs.copyFileSync(path.join(root, 'src', 'icons', 'icon-300.png'), path.join(out, 'edge-logo-300x300.png'));
await site.close();
process.stdout.write(`${fs.readdirSync(out).join('\n')}\n`);
