import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage, isTrustedSender } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
import { parseStored } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/config.js';
import { newestConfig } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/records.js';
let s = 12345; const R = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; const pick = a => a[Math.floor(R() * a.length)];
const f = createFakeBrowser({ regexLimit: 400 }); const c = createController(f.api, { mutex: { leaseMs: 500, waitMs: 800, pollMs: 2 } });
const nasty = ['', ' ', 'a', 'example.com', 'EXAMPLE.COM.', 'http://example.com', 'ｅxample.com', 'a'.repeat(300), 'ab'.repeat(40), '\u0000', '\ud800', 'x‮y.example', '*.example.com', 'xn--', '٣٣.example', '%41.example', '__proto__', 'constructor', 'سكس', 'سـكس', '日本語.example', 'a b', 'ab\n', '😀😀', 'co.uk', 'google.com', 'search.yahoo.com', 'x'.repeat(5000)];
const rv = () => pick([0, 1, 2, -1, 1.5, NaN, Infinity, '1', null, undefined, 2 ** 53, Number.MAX_SAFE_INTEGER]);
const list = () => Array.from({ length: Math.floor(R() * 5) }, () => pick(nasty));
const settings = () => ({ baseList: R() < .5, starterTerms: R() < .5, domains: list(), allow: R() < .8 ? [] : list(), words: list(), contains: list(), ...(R() < .1 ? { extra: 1 } : {}) });
const types = ['GET_STATUS', 'REPAIR', 'GET_EXPORT', 'SAVE_SETTINGS', 'IMPORT_SETTINGS', 'RESET', 'COMPLETE_ONBOARDING', 'START_SESSION', 'BOGUS', undefined, 5, '__proto__'];
const mk = () => { const t = pick(types); const m = { type: t }; if (R() < .9) { if (t === 'SAVE_SETTINGS') { m.baseRevision = R() < .7 ? 0 : rv(); m.settings = R() < .9 ? settings() : pick([null, [], 'x', 5]); }
  if (t === 'IMPORT_SETTINGS') { m.baseRevision = R() < .7 ? 0 : rv(); const body = { format: 'tabsira-settings', version: R() < .9 ? 2 : 3, settings: settings() }; m.text = R() < .85 ? JSON.stringify(body) : pick(['', '{', '[]', 'null', '{"__proto__":{}}', '[' .repeat(100000), 'x'.repeat(300000)]); }
  if (t === 'RESET') m.baseRevision = rv(); if (t === 'COMPLETE_ONBOARDING') { m.baseList = R() < .9 ? R() < .5 : 'yes'; m.starterTerms = R() < .5; } if (t === 'START_SESSION') m.minutes = pick([60, 90, 120, 30, '60', 0, null, 1e9]); } return m; };
let counts = {}, escaped = 0, badState = 0, rev = 0;
for (let i = 0; i < 2500; i++) {
  const m = mk(); let clean; try { clean = validateMessage(m); } catch (e) { counts[e.code] = (counts[e.code] || 0) + 1; continue; }
  if (clean.baseRevision !== undefined) clean.baseRevision = R() < .8 ? rev : clean.baseRevision;
  try { const r = await c.handle(clean); counts[r.ok ? 'ok:' + clean.type : (r.error.code)] = (counts[r.ok ? 'ok:' + clean.type : r.error.code] || 0) + 1; if (r.status?.revision != null) rev = r.status.revision; if (r.error?.code === 'unexpected') console.log('UNEXPECTED for', clean.type, JSON.stringify(m).slice(0, 160)); } catch (e) { escaped++; console.log('ESCAPED', e); }
  if (i % 50 === 0) f.state.now += 61 * 60e3 * (R() < .3 ? 1 : 0);
  const rec = newestConfig(f.state.storage); if (rec) { try { parseStored(rec.value); } catch { badState++; console.log('INVALID STORED CONFIG after', JSON.stringify(clean).slice(0, 100)); break; } }
}
console.log(JSON.stringify(counts)); console.log('escaped', escaped, 'badState', badState);
// sender trust
const ctx = { id: 'X', baseUrl: 'chrome-extension://X/' };
for (const [u, id, fr] of [['chrome-extension://X/options.html', 'X', 0], ['chrome-extension://X/options.html?a=1', 'X', 0], ['chrome-extension://X/options.html#h', 'X', 0], ['chrome-extension://X/options.html.evil', 'X', 0], ['chrome-extension://X/options.htmlx', 'X', 0], ['chrome-extension://X/blocked.html', 'X', 0], ['chrome-extension://X/options.html', 'Y', 0], ['chrome-extension://X/options.html', 'X', 1], ['chrome-extension://X/options.html/../help.html', 'X', 0], ['https://evil.example/', 'X', 0], ['chrome-extension://X/popup.html?x=chrome-extension://X/options.html', 'X', 0], ['chrome-extension://XY/options.html', 'X', 0], ['chrome-extension://x/options.html', 'X', 0]]) console.log(JSON.stringify([u, id, fr]), isTrustedSender({ id, url: u, frameId: fr }, ctx));
