import http from 'node:http';
import { launch, openExtPage, send, executableFor, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const dir = process.argv[2];
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/' + dir });
const page0 = await openExtPage(b.context, b.extensionId, 'options.html');
await send(page0, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: true });
const server = http.createServer((q, s) => { s.setHeader('content-type', 'text/html'); if (q.url === '/') s.end('<!doctype html><title>ENGINE HOME</title><form action="/search"><input name="q" id="q"><button id="go">Search</button></form><a id=l href="/search?q=xvideos">link</a>'); else s.end('<title>REAL-SITE</title>results'); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const P = server.address().port;
const shown = async p => (p.url().startsWith('chrome-extension://') ? 'HELP PAGE' : p.url().startsWith('chrome-error') ? 'CHROME ERROR PAGE' : 'OTHER ' + p.url().slice(0, 40));
let p = await b.context.newPage(); await p.goto(`http://www.bing.com:${P}/`); await p.fill('#q', 'xvideos'); await p.click('#go'); await sleep(1500); console.log(dir, 'form submit:', await shown(p));
p = await b.context.newPage(); await p.goto(`http://www.bing.com:${P}/`); await p.click('#l'); await sleep(1500); console.log(dir, 'link click :', await shown(p));
p = await b.context.newPage(); await p.goto(`http://www.bing.com:${P}/`); await p.evaluate(() => { location.href = '/search?q=xvideos'; }); await sleep(1500); console.log(dir, 'location=   :', await shown(p));
for (let i = 0; i < 2; i++) { p = await b.context.newPage(); await p.goto(`http://www.bing.com:${P}/search?q=xvideos`).catch(() => {}); await sleep(1500); console.log(dir, 'typed/goto  :', await shown(p)); }
await b.context.close(); server.close();
