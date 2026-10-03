import http from 'node:http';
import { launch, openExtPage, send, executableFor, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const id = b.extensionId;
const page0 = await openExtPage(b.context, id, 'options.html');
let r = await send(page0, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: true });
await send(page0, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { baseList: true, starterTerms: true, domains: ['blocked.example'], allow: [], words: [], contains: [] } });
const html = `<!doctype html><title>HOSTILE</title><body><script>
const ID = ${JSON.stringify(id)}; const FAKE = 'a'.repeat(32); const out = {};
const T = async (name, fn) => { const t0 = performance.now(); try { out[name] = { v: await fn(), ms: Math.round(performance.now() - t0) }; } catch (e) { out[name] = { err: String(e).slice(0, 80), ms: Math.round(performance.now() - t0) }; } };
const frameTest = (src) => new Promise(res => { const f = document.createElement('iframe'); let done = false; const fin = (v) => { if (!done) { done = true; let origin; try { origin = f.contentWindow.location.href } catch (e) { origin = 'cross-origin' } f.remove(); res(v + ':' + origin); }; }; f.onload = () => fin('load'); f.onerror = () => fin('error'); f.src = src; document.body.append(f); setTimeout(() => fin('timeout'), 3000); });
const tagTest = (tag, attr, src, extra = {}) => new Promise(res => { const e = document.createElement(tag); Object.assign(e, extra); e.onload = () => res('load'); e.onerror = () => res('error'); e[attr] = src; document.head.append(e); setTimeout(() => res('timeout'), 3000); });
(async () => {
  out.chromeRuntime = typeof chrome === 'undefined' ? 'no chrome' : typeof chrome.runtime + '/' + typeof (chrome.runtime && chrome.runtime.sendMessage) + '/id=' + (chrome.runtime && chrome.runtime.id);
  for (const [label, ext] of [['real', ID], ['fake', FAKE]]) {
    for (const file of ['options.html', 'blocked.html', 'manifest.json', 'core/domains.js']) {
      await T('fetch ' + label + ' ' + file, async () => (await fetch('chrome-extension://' + ext + '/' + file)).status);
      await T('xhr ' + label + ' ' + file, () => new Promise((res, rej) => { const x = new XMLHttpRequest(); x.open('GET', 'chrome-extension://' + ext + '/' + file); x.onload = () => res(x.status); x.onerror = () => rej('xhr error'); x.send(); }));
    }
    await T('iframe ' + label, () => frameTest('chrome-extension://' + ext + '/options.html'));
    await T('script ' + label, () => tagTest('script', 'src', 'chrome-extension://' + ext + '/common.js'));
    await T('img ' + label, () => tagTest('img', 'src', 'chrome-extension://' + ext + '/icons/icon-16.png'));
    await T('css ' + label, () => tagTest('link', 'href', 'chrome-extension://' + ext + '/style.css', { rel: 'stylesheet' }));
    await T('sendMessage ' + label, async () => { if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return 'API absent'; return await chrome.runtime.sendMessage(ext, { type: 'GET_STATUS' }); });
  }
  // popups
  const w1 = window.open('http://blocked.example:' + location.port + '/'); const w2 = window.open('http://notblocked.example:' + location.port + '/');
  await new Promise(r => setTimeout(r, 1500));
  const probe = w => { const o = {}; for (const k of ['closed', 'length']) { try { o[k] = w[k]; } catch (e) { o[k] = 'throws' } } try { o.href = w.location.href; } catch (e) { o.href = 'throws:' + e.name } try { o.origin = w.origin } catch (e) { o.origin = 'throws' } return o; };
  out.popupBlocked = probe(w1); out.popupOther = probe(w2);
  // can the opener navigate the extension-origin popup to a non-WAR extension page?
  try { w1.location = 'chrome-extension://' + ID + '/options.html'; } catch (e) { out.navExt = 'throws ' + e.name; }
  await new Promise(r => setTimeout(r, 1000));
  window.__out = out; document.title = 'DONE';
})();
</script>`;
const server = http.createServer((q, s) => { s.setHeader('content-type', 'text/html'); s.end(q.headers.host.startsWith('hostile') ? html : '<title>REAL-SITE</title>real'); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const hp = await b.context.newPage();
await hp.goto(`http://hostile.example:${port}/`);
await hp.waitForFunction(() => document.title === 'DONE', null, { timeout: 60000 });
const out = await hp.evaluate(() => window.__out);
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(28), JSON.stringify(v));
console.log('pages open:', b.context.pages().map(p => p.url().slice(0, 70)).join(' | '));
await b.context.close(); server.close();
