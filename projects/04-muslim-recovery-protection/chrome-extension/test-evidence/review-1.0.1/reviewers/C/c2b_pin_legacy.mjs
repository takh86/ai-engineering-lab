// C-2b (probe): START_SESSION on an UNMIGRATED v0 store whose browser rules already match: pinConfig copies state.raw.config (the v0 object) under a cfg: key.
import { createController, createFakeBrowser, send } from './h.mjs';
import { planRules } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/rules.js';
const fake = createFakeBrowser(); const c = createController(fake.api);
fake.state.storage.config = { domains: ['example.com'], keywords: ['abc'], lockedUntil: 0 };
const plan = await planRules({ baseList: false, starterTerms: false, domains: ['example.com'], allow: [], words: [], contains: ['abc'] }, async () => true);
fake.state.rules = plan.rules;
const r = await send(c, { type: 'START_SESSION', minutes: 60 });
console.log('START_SESSION ok =', r.ok, r.error?.code, r.status?.state);
console.log(JSON.stringify(Object.fromEntries(Object.entries(fake.state.storage).filter(([k]) => k.startsWith('cfg:') || k === 'config'))));
const g = await send(c, { type: 'GET_STATUS' }); console.log('status', g.status.state, g.status.lock.active, 'revision', g.status.revision);
