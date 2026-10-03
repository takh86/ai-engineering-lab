import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
import { mergeLocks } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/lock.js';
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const O = { mutex: { leaseMs: 500, waitMs: 3000, pollMs: 2 } };
// 1. concurrent controllers on a legacy store, mixed ops
{ let bad = 0;
  for (let t = 0; t < 30; t++) { const f = createFakeBrowser({ regexLimit: 5000 }); const v0 = f.state.now + 90 * 60000; f.state.storage.config = { domains: ['legacy.example'], keywords: ['kw one'], lockedUntil: v0 };
    const cs = ['a', 'b', 'c', 'd'].map(id => createController({ ...f.api, instanceId: id }, O)); const snd = (c, m) => c.handle(validateMessage(m));
    const msgs = [{ type: 'SAVE_SETTINGS', baseRevision: 1, settings: { ...none } }, { type: 'RESET', baseRevision: 1 }, { type: 'IMPORT_SETTINGS', baseRevision: 1, text: JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...none, domains: ['imp.example'] } }) }, { type: 'START_SESSION', minutes: 60 }, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: true }, { type: 'REPAIR' }, { type: 'GET_STATUS' }, { type: 'SAVE_SETTINGS', baseRevision: 1, settings: { ...none, domains: ['legacy.example', 'z.example'], contains: ['kw one'] } }];
    const order = msgs.map((m, i) => [m, cs[(i + t) % 4]]).sort(() => (t % 2 ? 1 : -1));
    const res = await Promise.all(order.map(([m, c]) => snd(c, m)));
    const s = (await snd(cs[0], { type: 'GET_STATUS' })).status; const reached = res.map((r, i) => r.ok ? order[i][0].type : null).filter(Boolean);
    const weak = s.settings && (!s.settings.domains.includes('legacy.example') || !s.settings.contains.includes('kw one'));
    if (s.lock.until < v0 || weak) { bad++; console.log('PROBLEM concurrent', t, s.lock.until - v0, JSON.stringify(s.settings), reached); } }
  console.log('concurrent legacy trials with problems:', bad, 'of 30'); }
// 2. corrupt legacy stores with an active legacy session
for (const [label, legacy] of [['invalid domain', { domains: ['http://bad/path'], keywords: [], lockedUntil: 'FUTURE' }], ['keywords not array ok', { domains: ['ok.example'], keywords: 'x', lockedUntil: 'FUTURE' }], ['domains with wildcard', { domains: ['*.x.example'], keywords: [], lockedUntil: 'FUTURE' }], ['keyword too short', { domains: ['ok.example'], keywords: ['a'], lockedUntil: 'FUTURE' }], ['too many domains', { domains: Array.from({ length: 1001 }, (_, i) => `d${i}.example`), keywords: [], lockedUntil: 'FUTURE' }]]) {
  const f = createFakeBrowser({ regexLimit: 5000 }); const v0 = f.state.now + 90 * 60000; f.state.storage.config = { ...legacy, lockedUntil: v0 };
  const c = createController(f.api, O); const snd = m => c.handle(validateMessage(m));
  const s = (await snd({ type: 'GET_STATUS' })).status; const r = await snd({ type: 'RESET', baseRevision: 0 });
  const s2 = (await snd({ type: 'GET_STATUS' })).status;
  console.log(label.padEnd(24), 'status', s.state, JSON.stringify(s.reasons), 'lock.active', s.lock.active, '| RESET during legacy session ->', r.ok ? 'ACCEPTED' : r.error.code, '| after:', s2.state, 'lock.active', s2.lock.active, 'keysUntil', mergeLocks(f.state.storage).until - v0);
}
