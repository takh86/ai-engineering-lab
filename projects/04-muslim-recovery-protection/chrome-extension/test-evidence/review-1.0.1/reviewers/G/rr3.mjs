import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const site = await startSite(); const P = site.port; const e = encodeURIComponent;
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext2' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: true });
console.log('state', r.status.state, JSON.stringify(r.status.reasons));
const T = [['google', 'www.google.com', '/search', 'q'], ['youtube', 'www.youtube.com', '/results', 'search_query']];
const terms = [['EN xvideos', 'xvideos'], ['AR short سكس', 'سكس'], ['AR long افلام اباحية', 'افلام اباحية'], ['AR long سكس عربي', 'سكس عربي']];
for (const [en, host, path, p] of T) for (const [tn, term] of terms) for (const [vn, f] of [['plain', x => e(x)], ['quoted', x => '%22' + e(x) + '%22'], ['.com', x => e(x) + '.com']]) { const v = await visit(b.context, `http://${host}:${P}${path}?${p}=${f(term)}`); console.log(en.padEnd(8), tn.padEnd(22), vn.padEnd(7), v.blocked ? 'BLOCKED' : 'BYPASS'); }
await b.context.close(); await site.close();
