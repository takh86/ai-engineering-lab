import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
const f = createFakeBrowser({ regexLimit: 5000 });
const until = f.state.now + 90 * 60e3;
f.state.storage.config = { domains: ['blocked.example'], keywords: [], lockedUntil: until };   // Chrome prototype (v0) shape with a running lock
const realSet = f.api.storage.set; let armed = true;
f.api.storage.set = async items => { if (armed && Object.keys(items).some(k => k.startsWith('lock:'))) { armed = false; throw new Error('worker terminated before the lock write'); } return realSet(items); };
const c = createController(f.api, { mutex: { leaseMs: 500, waitMs: 800, pollMs: 2 } });
let s = await c.reconcile(); console.log('migration run #1 (lock write fails):', s?.state, JSON.stringify(s?.lock));
s = await c.reconcile(); console.log('after restart reconcile:', s?.state, JSON.stringify(s?.lock), '(expected until', until, ')');
console.log(Object.keys(f.state.storage).filter(k=>!k.startsWith('mx:')).join(' '));
