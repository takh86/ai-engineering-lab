import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const site = await startSite(); const P = site.port;
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext3' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: true });
console.log('state', r.status.state, 'notes', JSON.stringify(r.status.notes));
const cases = [['plain', 'xvideos'], ['quoted', '%22xvideos%22'], ['.com', 'xvideos.com'], ['hyphen', 'hentai-manga'], ['parens', '(hentai)'], ['site: operator', 'site%3Axvideos.com'], ['site: raw colon', 'site:xvideos.com'], ['inurl:', 'inurl%3Axvideos'], ['intitle:', 'intitle%3Ahentai'], ['trailing !', 'xvideos%21'], ['trailing ?', 'xvideos%3F'], ['is xvideos safe?', 'is+xvideos+safe%3F'], ['slash', 'xvideos%2Fvideo'], ['semicolon', 'xvideos%3B'], ['brackets', '%5Bxvideos%5D'], ['xvideos| pipe', 'xvideos%7C'], ['comma', 'xvideos%2C'], ['AR quoted', '%22' + encodeURIComponent('سكس') + '%22'], ['AR ؟', encodeURIComponent('سكس') + '%D8%9F'], ['AR ،', encodeURIComponent('سكس') + '%D8%8C'], ['letter after (must allow)', 'xvideosx'], ['digit after (must allow)', 'xvideos2']];
for (const [n, q] of cases) { const v = await visit(b.context, `http://www.google.com:${P}/search?q=${q}`); console.log(v.blocked ? 'BLOCKED' : 'allowed', n); }
const ui = await openExtPage(b.context, b.extensionId, 'popup.html'); await new Promise(r => setTimeout(r, 800)); console.log('popup reasons/notes DOM:', JSON.stringify(await ui.evaluate(() => [...document.querySelectorAll('#reasons li')].map(l => l.className + ':' + l.textContent))));
await b.context.close(); await site.close();
