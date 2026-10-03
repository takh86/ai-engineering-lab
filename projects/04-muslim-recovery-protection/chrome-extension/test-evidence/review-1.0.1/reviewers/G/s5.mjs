import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
import { mergeLocks } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/lock.js';
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const O = { mutex: { leaseMs: 80, waitMs: 800, pollMs: 2 } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const f = createFakeBrowser({ regexLimit: 5000 }); const { state } = f; const snd = (c, m) => c.handle(validateMessage(m)); const mk = (id, e = {}) => createController({ ...f.api, instanceId: id, ...e }, O);
const S = mk('S'); let r = await snd(S, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false }); r = await snd(S, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['s.example'] } });
await snd(S, { type: 'START_SESSION', minutes: 60 });
let rel; const gate = new Promise(x => rel = x); let frozen = false;
const X = mk('X', { storage: { ...f.api.storage, remove: async keys => { if (!frozen && keys.some(k => k.startsWith('lock:') || k.startsWith('cfg:') || k.startsWith('ep:'))) { frozen = true; await gate; } return f.api.storage.remove(keys); } } });
// make X's compaction have something to remove: several sessions first
for (const m of [90, 90, 120]) await snd(S, { type: 'START_SESSION', minutes: m });
const px = snd(X, { type: 'REPAIR' }); for (let i = 0; i < 300 && !frozen; i++) await sleep(2);
console.log('X compaction frozen holding stale-key list:', frozen);
await sleep(200);                                     // X lease gone
const T = mk('T'); const rt = await snd(T, { type: 'START_SESSION', minutes: 120 }); console.log('T newer START ->', rt.ok || rt.error?.code);
for (let i = 0; i < 3; i++) { const u = mk('U' + i); await snd(u, { type: 'START_SESSION', minutes: 120 }); }
const before = mergeLocks(state.storage).until; rel(); await px; await sleep(100);
const after = mergeLocks(state.storage).until; const keys = Object.keys(state.storage).filter(k => k.startsWith('lock:') || k.startsWith('cfg:') || k.startsWith('ep:'));
console.log('effective end before/after late removal equal:', before === after, '| remaining keys:', keys.length, '| status', JSON.stringify((await snd(mk('V'), { type: 'GET_STATUS' })).status.lock));
