// G-3 repro: clock moves forward, a worker is terminated while holding the write lock, clock returns -> all writes AND the watchdog repair are locked out.
import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
const fake = createFakeBrowser({ regexLimit: 5000 }); const { state } = fake;
const mk = (id, extra = {}) => createController({ ...fake.api, instanceId: id, ...extra }, { mutex: { leaseMs: 20000, waitMs: 300, pollMs: 4 } }); // default 20 s lease, short wait only to keep the test fast
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const A = mk('A'); const send = (c, m) => c.handle(validateMessage(m));
let r = await send(A, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
r = await send(A, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['blocked.example'] } });
console.log('1 baseline save ok =', r.ok, 'state', r.status.state);
// 2. clock jumps forward 1 h (NTP step / user / VM resume); worker B starts a save and is terminated right after taking the lock.
state.clockSkew = 3600e3;
let calls = 0; const dying = { ...fake.api.storage, set: async items => { const out = await fake.api.storage.set(items); if (Object.keys(items).some(k => k.startsWith('ep:'))) throw new Error('worker terminated'); return out; } };
const B = createController({ ...fake.api, instanceId: 'B', storage: { ...fake.api.storage, set: dying.set, remove: async () => { throw new Error('terminated, cannot release'); } } }, { mutex: { leaseMs: 20000, waitMs: 300, pollMs: 4 } });
const rb = await send(B, { type: 'SAVE_SETTINGS', baseRevision: 1, settings: { ...none, domains: [] } });
console.log('2 B (terminated while holding lock) ->', rb.ok, rb.error?.code, '| leftover mx entries:', Object.entries(state.storage).filter(([k]) => k.startsWith('mx:')).map(([k, v]) => `${k} exp-now=${Math.round((v.exp - Date.now()) / 1000)}s`).join(', '));
// 3. clock returns to normal
state.clockSkew = 0;
const C = mk('C');
// stale rules (e.g. a late rule write) that only a repair can fix:
state.rules = []; 
const rc = await send(C, { type: 'SAVE_SETTINGS', baseRevision: 2, settings: { ...none, domains: ['blocked.example', 'other.example'] } });
console.log('3 C save after clock returned ->', rc.ok, rc.error?.code);
const rr = await send(C, { type: 'REPAIR' });
console.log('3 C REPAIR (what the watchdog does) ->', rr.ok, rr.error?.code, '| rules present:', state.rules.length, '(config says 1 blocked domain)');
const rs = await send(C, { type: 'GET_STATUS' });
console.log('3 status', rs.status.state, JSON.stringify(rs.status.reasons));
