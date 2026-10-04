import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
for (const planted of []) {
  const f = createFakeBrowser({ regexLimit: 5000 }); const c = createController(f.api, { mutex: { leaseMs: 500, waitMs: 800, pollMs: 2 } }); const send = m => c.handle(validateMessage(m));
  let r = await send({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false }); r = await send({ type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['b.example'] } });
  f.state.storage[planted] = planted.startsWith('ep') ? { n: 1 } : { ...Object.values(f.state.storage).find(v => v && v.v === 2) };
  const o = []; r = await send({ type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['b.example', 'c.example'] } }); o.push('SAVE ' + (r.ok || r.error.code));
  r = await send({ type: 'GET_STATUS' }); o.push('status ' + r.status.state + ' ' + r.status.reasons); r = await send({ type: 'RESET', baseRevision: 0 }); o.push('RESET ' + (r.ok || r.error.code)); r = await send({ type: 'GET_STATUS' }); o.push('after ' + r.status.state + ' ' + r.status.reasons);
  console.log(planted.padEnd(24), o.join(' | '));
}
// lease: legit slow op with backward clock step
{
  const f = createFakeBrowser({ regexLimit: 5000 }); const O = { mutex: { leaseMs: 20000, waitMs: 400, pollMs: 4 } };
  const B = createController({ ...f.api, instanceId: 'B' }, O); const sb = m => B.handle(validateMessage(m));
  let r = await sb({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false }); const rev = r.status.revision;
  let release; const gate = new Promise(r => { release = r; }); const realSet = f.api.storage.set; let froze = false;
  const A = createController({ ...f.api, instanceId: 'A', storage: { ...f.api.storage, set: async items => { if (!froze && Object.keys(items).some(k => k.startsWith('cfg:'))) { froze = true; await gate; } return realSet(items); } } }, O);
  const pa = A.handle(validateMessage({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...none, domains: ['a.example'] } }));
  await new Promise(r => setTimeout(r, 80)); console.log('A holds lock, frozen before its cfg write:', froze);
  f.state.clockSkew = -25000;
  const rb2 = await sb({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...none, domains: ['b.example'] } });
  console.log('B while A still holds the lock (wall clock stepped back 25 s):', rb2.ok || rb2.error?.code);
  f.state.clockSkew = 0; release(); const ra = await pa; console.log('A resumes ->', ra.ok || ra.error?.code);
  const st = (await sb({ type: 'GET_STATUS' })).status; console.log('final', st.state, JSON.stringify(st.settings?.domains), st.reasons, 'rules', JSON.stringify(f.state.rules.map(x => x.condition.requestDomains)));
}
