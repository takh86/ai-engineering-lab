import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const site = await startSite(); const P = site.port;
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext2' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
let r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
const save = async (o) => { const st = (await send(page, { type: 'GET_STATUS' })).status; return send(page, { type: 'SAVE_SETTINGS', baseRevision: st.revision, settings: { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [], ...o } }); };
r = await save({ words: ['tabsira word', 'xx'], contains: ['probe-part'] }); console.log('save', r.ok, r.status?.state, JSON.stringify(r.error ?? {}));
const cases = [
 ['CONTROL', 'q=tabsira+word', true], ['quoted', 'q=%22tabsira+word%22', true], ['.com', 'q=tabsira+word.com', true], ['hyphen', 'q=free-tabsira+word', true],
 ['letter before', 'q=xtabsira+word', false], ['letter after', 'q=tabsira+words', false], ['digit before', 'q=1tabsira+word', false], ['digit after', 'q=tabsira+word2', false],
 ['encoded letter after (%41)', 'q=tabsira+word%41', false], ['non-ascii letter after é', 'q=tabsira+word%C3%A9', false], ['non-ascii letter before é', 'q=%C3%A9tabsira+word', false],
 ['%2& crossing param boundary (phrase only in OTHER param name)', 'q=zz%2&tabsira+word=1', false], ['%2# fragment', 'q=zz%2#tabsira+word', false], ['phrase in other param value after crafted %2&', 'q=ok%2&note=tabsira+word', false],
 ['truncated %2 then word', 'q=zz%2tabsira+word', null], ['%25 then word (literal percent)', 'q=zz%25tabsira+word', true], ['%2E', 'q=tabsira+word%2E', true], ['%3A', 'q=site%3Atabsira+word', true], ['%3B (;) not edge', 'q=tabsira+word%3B', null], ['%5F underscore encoded', 'q=tabsira+word%5F', null], ['xx word inside e.g. "xxx"', 'q=xxx', false], ['xx with dot', 'q=xx.com', true], ['text "a.xx"', 'q=a.xx', true],
];
for (const [n, q, expect] of cases) { const v = await visit(b.context, `http://www.bing.com:${P}/search?${q}`); const got = v.blocked; console.log((expect === null ? 'info    ' : got === expect ? 'ok      ' : 'UNEXPECTED ') + (got ? 'BLOCKED ' : 'allowed ') + n + '  ' + q); }
await b.context.close(); await site.close();
