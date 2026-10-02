// Chrome Web Store screenshots: five 1280x800 PNG files (24-bit, no alpha), Arabic, built from REAL captures of the released
// Chromium package (the extracted tabsira-chromium ZIP, unmodified) and composed with a short title on the approved identity.
//   node scripts/build.mjs && node scripts/make-chrome-store-screenshots.mjs        (CHROMIUM=/path/to/chrome to override)
// Only features that exist in this version are shown. Texts inside the screenshots are the extension's own UI texts; captions make
// no privacy or therapeutic claim beyond what the UI itself says.
import fs from 'node:fs';
import path from 'node:path';
import { launch, openExtPage, send, root, sleep, startSite } from '../tests/e2e/lib.mjs';
import { preparePackage } from '../tests/e2e/package.mjs';

const out = path.join(root, 'store', 'chrome-web-store');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const raw = path.join(root, '.pkg-under-test', 'store-cws-raw'); fs.rmSync(raw, { recursive: true, force: true }); fs.mkdirSync(raw, { recursive: true });
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const pkg = preparePackage('chromium', { work: path.join(root, '.pkg-under-test', 'store-cws') });
const site = await startSite();
const settings = { baseList: true, starterTerms: false, domains: ['example.org', 'sample-site.test', 'news.example.net'], allow: ['fine-site.example.com'], words: ['عبارة اختبار', 'مثال بحث'], contains: ['sample-part'] };

// ---------- 1. real captures (2x pixel density through CSS zoom, so the text is crisp) ----------
const b = await launch({ executablePath, extensionDir: pkg.dirs.release, lang: 'ar' });
const options = await openExtPage(b.context, b.extensionId, 'options.html');
await send(options, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: false });
const status = (await send(options, { type: 'GET_STATUS' })).status;
const saved = await send(options, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings });
if (!saved.ok) throw new Error(`could not save the demo settings: ${JSON.stringify(saved.error)}`);
const zoomed = async (page, width = 1280) => { await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => document.documentElement.style.setProperty('zoom', '2')); await sleep(500); };
const shots = {};
await options.reload(); await zoomed(options);
await options.evaluate(() => document.fonts.ready);
const section = id => options.locator(`section[aria-labelledby="${id}"]`);
shots.sites = await section('h-sites').screenshot();
shots.allow = await section('h-allow').screenshot();
// Presentation crop of the REAL section: the long technical hint under the fields (browser limits, engine list) is not shown in this image.
await options.evaluate(() => { document.querySelector('#phrases-hint').style.display = 'none'; });
shots.phrases = await section('h-phrases').screenshot();
const popup = await openExtPage(b.context, b.extensionId, 'popup.html'); await zoomed(popup);
shots.popup = await popup.locator('main.popup').screenshot();
const stop = await b.context.newPage();
await stop.goto(`http://tabsira-selftest.test:${site.port}/`); await stop.waitForURL('**/blocked.html'); await zoomed(stop);
shots.blocked = await stop.locator('main').screenshot();
await stop.goto(`chrome-extension://${b.extensionId}/help.html`); await zoomed(stop);
// Presentation crop of the REAL help page: header and the one-minute timer card; the next-step card and the back link are hidden.
await stop.evaluate(() => { document.querySelectorAll('main > section:nth-of-type(2), main > a.button').forEach(el => { el.style.display = 'none'; }); });
shots.help = await stop.locator('main').screenshot();
for (const [name, buffer] of Object.entries(shots)) fs.writeFileSync(path.join(raw, `${name}.png`), buffer);
await b.context.close(); await site.close();

// ---------- 2. composition ----------
const font = (file, family, weight, range) => `@font-face{font-family:${family};font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(root, 'src', 'fonts', file)).toString('base64')}) format('woff2');unicode-range:${range}}`;
const ARABIC = 'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC,U+200C-200E,U+0660-0669'; const LATIN = 'U+0000-00FF,U+2000-206F,U+2122';
const fontCss = [font('cairo-arabic-700-normal.woff2', 'Cairo', 700, ARABIC), font('cairo-latin-700-normal.woff2', 'Cairo', 700, LATIN), font('tajawal-arabic-400-normal.woff2', 'Tajawal', 400, ARABIC), font('tajawal-latin-400-normal.woff2', 'Tajawal', 400, LATIN)].join('');
const svgUri = file => `data:image/svg+xml;base64,${fs.readFileSync(path.join(root, 'docs', 'brand', 'vector', file)).toString('base64')}`;
const png = name => `data:image/png;base64,${fs.readFileSync(path.join(raw, `${name}.png`)).toString('base64')}`;

const SLIDES = [
    { file: '01-main-interface.png', title: 'تحجب ما تختاره أنت', sub: 'مواقع وعبارات بحث تحددها بنفسك، وصفحة هادئة عند الحجب.', chips: ['حجب المواقع', 'عبارات البحث', 'دقيقة مساعدة', 'جلسة التزام'], images: ['popup'], scale: 1 },
    { file: '02-block-sites.png', title: 'أضف المواقع التي تريد حجبها', sub: 'يشمل الحجب النطاقات الفرعية، ويمكنك إضافة استثناءات متى احتجت.', images: ['sites', 'allow'], scale: 1 },
    { file: '03-block-search-phrases.png', title: 'احجب عبارات البحث التي تحددها', sub: 'بالعربية والإنجليزية، ككلمات كاملة أو بمطابقة جزئية.', images: ['phrases'], scale: 1 },
    { file: '04-block-page.png', title: 'صفحة هادئة عند الحجب', sub: 'بدل رسالة خطأ، تظهر لك صفحة توقف تقترح عليك دقيقة مساعدة.', images: ['blocked'], scale: 1 },
    { file: '05-short-help.png', title: 'دقيقة توقف قبل القرار', sub: 'زر «ساعدني الآن» يبدأ مؤقتًا لدقيقة، ولا يفتح أي موقع ولا يوقف الحجب.', images: ['help'], scale: 1 }
];
const html = slide => `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>${fontCss}
*{box-sizing:border-box}
body{margin:0;width:1280px;height:800px;overflow:hidden;position:relative;font-family:Tajawal,sans-serif;color:#fff;background:linear-gradient(135deg,#082C6C 0%,#0B3B8F 55%,#1456C5 100%)}
.text{position:absolute;inset-block:0;right:64px;width:440px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.logo{width:230px;height:auto;margin-bottom:10px}
h1{font:700 62px/1.3 Cairo,Tajawal,sans-serif;margin:0;color:#fff;text-wrap:balance}
.bar{width:84px;height:9px;border-radius:5px;background:#B7E445}
p{font:400 30px/1.65 Tajawal,sans-serif;margin:0;color:#E3ECFB;text-wrap:balance}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.chip{font:700 21px/1 Cairo,Tajawal,sans-serif;color:#0B3B8F;background:#B7E445;border-radius:999px;padding:11px 18px}
.stage{position:absolute;left:56px;top:48px;width:660px;height:704px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
.frame{background:#F3F6FB;border-radius:22px;padding:14px;box-shadow:0 22px 56px rgba(2,12,40,.45),0 0 0 1px rgba(255,255,255,.18);display:flex;max-width:100%;min-height:0}
.frame img{display:block;max-width:100%;border-radius:12px}
.lime{position:absolute;left:0;bottom:0;width:100%;height:12px;background:#B7E445}
</style><body>
<div class="text"><img class="logo" src="${svgUri('tabsira-logo-dark.svg')}" alt=""><h1>${slide.title}</h1><div class="bar"></div><p>${slide.sub}</p>${slide.chips ? `<div class="chips">${slide.chips.map(c => `<span class="chip">${c}</span>`).join('')}</div>` : ''}</div>
<div class="stage">${slide.images.map(name => `<div class="frame"><img id="img-${name}" src="${png(name)}" alt=""></div>`).join('')}</div>
<div class="lime"></div></body></html>`;

const composer = await (await import('playwright-core')).chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await composer.newPage({ viewport: { width: 1280, height: 800 } });
for (const slide of SLIDES) {
    await page.setContent(html(slide), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // fit each captured image into the stage: width <= 632 px, and together they must fit the height
    await page.evaluate(count => {
        const imgs = [...document.querySelectorAll('.frame img')];
        const stage = document.querySelector('.stage'); const maxH = stage.clientHeight - (count - 1) * 18 - count * 28;
        const budget = maxH / count;
        for (const img of imgs) {
            const w = img.naturalWidth / 2; const h = img.naturalHeight / 2;           // captures are 2x
            const scale = Math.min(1.7, 632 / w, budget / h);
            img.style.width = `${Math.round(w * scale)}px`;
        }
    }, slide.images.length);
    await sleep(150);
    fs.writeFileSync(path.join(out, slide.file), await page.screenshot({ type: 'png', omitBackground: false }));
}
await composer.close();
process.stdout.write(`${fs.readdirSync(out).join('\n')}\n`);
