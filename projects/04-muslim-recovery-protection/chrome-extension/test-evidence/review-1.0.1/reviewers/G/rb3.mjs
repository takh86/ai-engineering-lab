import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
import { phraseFragment, buildPhraseRegex } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/phrases.js';
const site = await startSite();
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
let r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
const supports = async (mode, param, phrase) => page.evaluate(regex => chrome.declarativeNetRequest.isRegexSupported({ regex, isCaseSensitive: false }).then(x => x.isSupported), buildPhraseRegex(mode, param, [phraseFragment(phrase)]));
const params = ['q','p','text','search_query'];
for (const mode of ['word','contains']) for (const [name, ch] of [['arabic','ع'],['latin','a']]) {
  const row = {};
  for (const param of params) { let max = 0; for (let L = 2; L <= 60; L++) { if (await supports(mode, param, ch.repeat(L))) max = L; else break; } row[param] = max; }
  console.log(mode, name, JSON.stringify(row));
}
// find a length supported for q but not search_query
for (const mode of ['word','contains']) {
  const ok = [];
  for (let L = 2; L <= 60; L++) { const [a,b2] = [await supports(mode,'q','ع'.repeat(L)), await supports(mode,'search_query','ع'.repeat(L))]; if (a && !b2) ok.push(L); }
  console.log('q-ok-but-search_query-not lengths', mode, ok);
  if (ok.length) {
    const L = ok[0]; const phrase = 'ع'.repeat(L);
    let rev = (await send(page, { type: 'GET_STATUS' })).status.revision;
    const settings = { baseList:false, starterTerms:false, domains:[], allow:[], words: mode==='word'?[phrase]:[], contains: mode==='contains'?[phrase]:[] };
    const s = await send(page, { type: 'SAVE_SETTINGS', baseRevision: rev, settings });
    console.log('SAVE', mode, L, s.ok, JSON.stringify(s.error??{}), s.status?.state, JSON.stringify(s.status?.reasons));
    const q = await visit(b.context, `http://www.youtube.com:${site.port}/results?search_query=${encodeURIComponent(phrase)}`);
    const g = await visit(b.context, `http://www.google.com:${site.port}/search?q=${encodeURIComponent(phrase)}`);
    console.log('youtube blocked?', q.blocked, 'google blocked?', g.blocked);
    const ss = await send(page, { type: 'START_SESSION', minutes: 60 });
    console.log('START_SESSION', ss.ok, JSON.stringify(ss.error??{}));
    rev = s.status.revision;
    await send(page, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { baseList:false, starterTerms:false, domains:[], allow:[], words:[], contains:[] } });
  }
}
await b.context.close(); await site.close();
