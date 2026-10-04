import http from 'node:http';
import { launch, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const server = http.createServer((q, s) => { s.setHeader('content-type', 'text/html'); s.end('<title>H</title>'); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const p = await b.context.newPage(); await p.goto(`http://hostile.example:${server.address().port}/`);
const res = await p.evaluate(async (ID) => {
  const FAKE = 'a'.repeat(32); const samples = { real: [], fake: [], fake2: [] };
  const ids = { real: ID, fake: FAKE, fake2: 'b'.repeat(32) };
  for (let i = 0; i < 400; i++) for (const k of Object.keys(ids)) { const t = performance.now(); try { await fetch(`chrome-extension://${ids[k]}/popup.html`); } catch (e) {} samples[k].push(performance.now() - t); }
  const stat = a => { a = [...a].sort((x, y) => x - y); return { median: +a[a.length >> 1].toFixed(3), p10: +a[Math.floor(a.length * .1)].toFixed(3), p90: +a[Math.floor(a.length * .9)].toFixed(3) }; };
  return Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, stat(v)]));
}, b.extensionId);
console.log(JSON.stringify(res, null, 1));
await b.context.close(); server.close();
