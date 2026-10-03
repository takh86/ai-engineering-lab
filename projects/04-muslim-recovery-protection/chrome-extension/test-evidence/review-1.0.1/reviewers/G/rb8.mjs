import http from 'node:http';
import { launch, openExtPage, send, executableFor, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page0 = await openExtPage(b.context, b.extensionId, 'options.html');
let r = await send(page0, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: true });
await send(page0, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { baseList: true, starterTerms: true, domains: ['blocked.example'], allow: [], words: [], contains: [] } });
const hits = [];
const server = http.createServer((q, s) => { hits.push(q.headers.host + q.url); s.setHeader('content-type', 'text/html'); if (q.headers.host.startsWith('origin')) s.end(`<!doctype html><title>ORIGIN</title><a id=l href="http://blocked.example:${server.address().port}/">link to blocked</a><a id=g href="http://www.google.com:${server.address().port}/search?q=xvideos">search link</a><a id=s href="http://tabsira-selftest.test:${server.address().port}/">selftest</a>`); else s.end('<title>REAL-SITE</title>real'); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const P = server.address().port;
for (const sel of ['#l', '#g', '#s']) {
  const p = await b.context.newPage(); const chain = []; p.on('framenavigated', f => { if (f === p.mainFrame()) chain.push(f.url()); });
  await p.goto(`http://origin.example:${P}/`); await p.click(sel); await sleep(1200);
  console.log('link', sel, '-> final url:', p.url().slice(0, 60), '| title:', JSON.stringify(await p.title()), '| body:', JSON.stringify((await p.evaluate(() => document.body?.innerText ?? '').catch(e => 'ERR ' + e.message.slice(0, 30))).slice(0, 60)), '| chain:', chain.map(x => x.slice(0, 40)).join(' > '));
  await p.close();
}
// location.href from script, and form-less window.open already seen
const p = await b.context.newPage(); await p.goto(`http://origin.example:${P}/`); await p.evaluate(u => { location.href = u; }, `http://blocked.example:${P}/`); await sleep(1200); console.log('location.href ->', p.url().slice(0, 60), await p.title());
// browser-initiated (typed) for contrast
const p2 = await b.context.newPage(); await p2.goto(`http://blocked.example:${P}/`).catch(e => {}); await sleep(500); console.log('typed ->', p2.url().slice(0, 60), await p2.title());
console.log('server saw requests for blocked hosts:', hits.filter(h => h.includes('blocked') || h.includes('google') || h.includes('selftest')).length);
await b.context.close(); server.close();
