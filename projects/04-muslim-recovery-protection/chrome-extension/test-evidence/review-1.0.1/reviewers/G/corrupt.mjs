import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
async function fresh() { const f = createFakeBrowser({ regexLimit: 5000 }); const c = createController(f.api, { mutex: { leaseMs: 500, waitMs: 800, pollMs: 2 } }); const send = m => c.handle(validateMessage(m)); let r = await send({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false }); r = await send({ type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['blocked.example'] } }); return { ...f, c, send, rev: r.status.revision }; }
const show = (label, r) => console.log(label.padEnd(60), r.ok, r.error?.code ?? '', r.status?.state, JSON.stringify(r.status?.reasons ?? []));
{ // 1. a huge-but-valid epoch brick
  const t = await fresh(); t.state.storage['cfg:999999999999999:zz'] = JSON.parse(JSON.stringify(Object.values(t.state.storage).find(v => v && v.v === 2)));
  let r = await t.send({ type: 'GET_STATUS' }); show('1a status with cfg epoch 999999999999999 planted', r);
  r = await t.send({ type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['blocked.example', 'x.example'] } }); show('1b SAVE', r);
  r = await t.send({ type: 'GET_STATUS' }); show('1c status after', r);
  r = await t.send({ type: 'RESET', baseRevision: 0 }); show('1d RESET', r);
  r = await t.send({ type: 'GET_STATUS' }); show('1e status after reset', r);
  console.log('   keys:', Object.keys(t.state.storage).filter(k => !k.startsWith('mx:')).join(' '));
}
{ // 2. session active, then the ONLY lock key is damaged
  const t = await fresh(); let r = await t.send({ type: 'START_SESSION', minutes: 120 }); show('2a START_SESSION', r);
  r = await t.send({ type: 'SAVE_SETTINGS', baseRevision: t.rev, settings: { ...none, domains: [] } }); show('2b weaken during session', r);
  const lk = Object.keys(t.state.storage).find(k => k.startsWith('lock:')); t.state.storage[lk] = { until: 'x' };   // damaged value (bit rot / partial write / bug)
  r = await t.send({ type: 'GET_STATUS' }); show('2c status with damaged lock key', r);
  r = await t.send({ type: 'RESET', baseRevision: 0 }); show('2d RESET with damaged lock key (session had ~2h left)', r);
  r = await t.send({ type: 'GET_STATUS' }); show('2e status', r);
}
{ // 3. session active, only config record damaged -> reset refused? 
  const t = await fresh(); await t.send({ type: 'START_SESSION', minutes: 60 });
  const newest = Object.keys(t.state.storage).filter(k => k.startsWith('cfg:')).sort().pop(); t.state.storage[newest] = { garbage: true };
  let r = await t.send({ type: 'GET_STATUS' }); show('3a status w/ damaged config during session', r);
  r = await t.send({ type: 'RESET', baseRevision: 0 }); show('3b RESET during session', r);
  r = await t.send({ type: 'SAVE_SETTINGS', baseRevision: 0, settings: { ...none } }); show('3c SAVE', r);
  r = await t.send({ type: 'REPAIR' }); show('3d REPAIR (rules intact?)', r); console.log('   rules still present:', t.state.rules.length);
}
{ // 4. forward clock jump (+3h, transient) then compaction, then back
  const t = await fresh(); let r = await t.send({ type: 'START_SESSION', minutes: 120 }); const until = Object.values(t.state.storage).find(v => v && v.until)?.until;
  t.state.now += 3 * 3600e3; r = await t.send({ type: 'REPAIR' });  // any write op runs compaction
  console.log('4a lock keys after transient +3h clock error + any write op:', Object.keys(t.state.storage).filter(k => k.startsWith('lock:')).length);
  t.state.now -= 3 * 3600e3; r = await t.send({ type: 'GET_STATUS' }); show('4b clock corrected: session', r); console.log('   lock', JSON.stringify(r.status.lock));
}
