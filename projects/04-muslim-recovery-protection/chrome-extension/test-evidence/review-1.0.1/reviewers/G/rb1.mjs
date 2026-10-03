import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const site = await startSite();
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
let r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
let rev = r.status.revision;
r = await send(page, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { baseList: false, starterTerms: false, domains: [], allow: [], words: ['tabsira word', 'سكس'], contains: ['probe-part'] } });
console.log('save', r.ok, JSON.stringify(r.error ?? {}), r.status?.state);
const u = (host, q) => `http://${host}:${site.port}/search?${q}`;
const enc = encodeURIComponent;
const cases = [
  ['CONTROL plain', 'q=tabsira+word'],
  ['double-quoted', 'q=%22tabsira+word%22'],
  ['quoted single word variant: quote before', 'q=%22tabsira+word'],
  ['trailing comma', 'q=tabsira+word%2C'],
  ['trailing period', 'q=tabsira+word.'],
  ['trailing question', 'q=tabsira+word%3F'],
  ['hyphen-joined suffix', 'q=tabsira+word-videos'],
  ['hyphen prefix', 'q=best-tabsira+word'],
  ['parens', 'q=(tabsira+word)'],
  ['NBSP between words', 'q=tabsira%C2%A0word'],
  ['ideographic space between', 'q=tabsira%E3%80%80word'],
  ['tab between words', 'q=tabsira%09word'],
  ['fullwidth latin', 'q=' + enc('ｔａｂｓｉｒａ ｗｏｒｄ')],
  ['ZWSP inside', 'q=' + enc('tabs​ira word')],
  ['soft hyphen inside', 'q=' + enc('tabs­ira word')],
  ['arabic CONTROL', 'q=' + enc('سكس')],
  ['arabic + tatweel', 'q=' + enc('سـكس')],
  ['arabic + fatha', 'q=' + enc('سَكس')],
  ['arabic quoted', 'q=%22' + enc('سكس') + '%22'],
  ['arabic comma', 'q=' + enc('سكس') + '%D8%8C'],
  ['unicode-escaped %u', 'q=%u0074absira+word'],
  ['encoded plus %2B', 'q=tabsira%2Bword'],
  ['double encoded space', 'q=tabsira%2520word'],
  ['hash-only q', 'x=1#q=tabsira+word'],
  ['semicolon-separated', 'x=1;q=tabsira+word'],
  ['as_q param (google adv)', 'as_q=tabsira+word'],
  ['q uppercase param name', 'Q=tabsira+word'],
  ['contains CONTROL', 'q=xxprobe-partyy'],
  ['contains fullwidth hyphen/underscore', 'q=xxprobe%EF%BC%8Dpartyy'],
];
for (const host of ['www.bing.com', 'www.google.com']) {
  for (const [name, q] of cases) {
    const v = await visit(b.context, u(host, q));
    console.log(`${host.padEnd(15)} ${v.blocked ? 'BLOCKED ' : 'bypass  '} ${name}`);
  }
}
await b.context.close(); await site.close();
