import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const site = await startSite();
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
let r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: true });
console.log('onboard', r.ok, r.status?.state, JSON.stringify(r.status?.reasons));
const u = (q) => `http://www.google.com:${site.port}/search?${q}`;
const cases = [['xvideos'],['xvideos.com'],['xvideos+.com'],['%22xvideos%22'],['xvideos%2C'],['www.xvideos.com'],['%22free+porn%22'],['free+porn%21'],['hentai-manga'],['xnxx.com'],['pornhub.com'],['(hentai)'],
 ['%22'+encodeURIComponent('سكس')+'%22'],[encodeURIComponent('سكس')+'.com'],[encodeURIComponent('سكس')+'%D8%9F'],[encodeURIComponent('سكس')+'%D8%8C+x'],[encodeURIComponent('سـكس')],[encodeURIComponent('سَكْس')]];
for (const [q] of cases) { const v = await visit(b.context, u('q=' + q)); console.log(v.blocked ? 'BLOCKED' : v.real ? 'LOADED(bypass)' : 'ERR '+v.error, decodeURIComponent(q)); }
await b.context.close(); await site.close();
