// Mutual exclusion lost by a wall-clock step back > max(2*lease,5 min): B (weaker SAVE) lands AFTER A's START_SESSION returned success.
import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const O = { mutex: { leaseMs: 20000, waitMs: 1500, pollMs: 2 } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const f = createFakeBrowser({ regexLimit: 5000 }); const { state } = f; const snd = (c, m) => c.handle(validateMessage(m));
const mk = (id, extra = {}) => createController({ ...f.api, instanceId: id, ...extra }, O);
const setup = mk('setup'); let r = await snd(setup, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
r = await snd(setup, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['strong1.example', 'strong2.example'] } }); const rev = r.status.revision;
let relA, relB; const gA = new Promise(x => relA = x), gB = new Promise(x => relB = x); let hitA = false, hitB = false;
const stA = { ...f.api.storage, set: async items => { if (!hitA && Object.keys(items).some(k => k.startsWith('cfg:'))) { hitA = true; await gA; } return f.api.storage.set(items); } };
const stB = { ...f.api.storage, set: async items => { if (!hitB && Object.keys(items).some(k => k.startsWith('cfg:'))) { hitB = true; await gB; } return f.api.storage.set(items); } };
const A = mk('A', { storage: stA }), B = mk('B', { storage: stB });
const pa = snd(A, { type: 'START_SESSION', minutes: 120 });
for (let i = 0; i < 400 && !hitA; i++) await sleep(2);
state.clockSkew = -400000;                     // wall clock steps back 6.7 min while A is alive and holds the lock
const pb = snd(B, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...none, domains: [] } });
for (let i = 0; i < 600 && !hitB; i++) await sleep(2);
console.log('A frozen at pin write:', hitA, '| B past all its checks, frozen at its config write:', hitB);
relA(); const ra = await pa; console.log('A START_SESSION ->', ra.ok ? 'OK (success reported)' : ra.error.code);
relB(); const rb = await pb; console.log('B SAVE (remove all sites) ->', rb.ok ? 'OK' : rb.error.code);
state.clockSkew = 0; const st = (await snd(mk('D'), { type: 'GET_STATUS' })).status;
console.log('FINAL: session active =', st.lock.active, '| sites protected =', st.settings.domains.length, '| state =', st.state, '| rules', state.rules.length);
