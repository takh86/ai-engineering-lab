import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser, storedConfig } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
import { mergeLocks } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/lock.js';
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const O = { mutex: { leaseMs: 80, waitMs: 800, pollMs: 2 } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(label, { freeze, thirdStart = null, bSave = 'weaker', sameEnd = false }) {
  const f = createFakeBrowser({ regexLimit: 5000 }); const { state } = f;
  const mk = (id, extra = {}) => createController({ ...f.api, instanceId: id, ...extra }, O); const snd = (c, m) => c.handle(validateMessage(m));
  const setup = mk('setup'); let r = await snd(setup, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
  r = await snd(setup, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['strong1.example', 'strong2.example'] } }); const rev = r.status.revision;
  let release; const gate = new Promise(x => { release = x; }); let hit = false; let lockWritten = false;
  const st = { ...f.api.storage };
  st.set = async items => { const keys = Object.keys(items); const isPin = keys.some(k => k.startsWith('cfg:')), isLock = keys.some(k => k.startsWith('lock:'));
    if (freeze === 'pin' && isPin && !hit) { hit = true; await gate; } if (freeze === 'lock' && isLock && !hit) { hit = true; await gate; } const out = await f.api.storage.set(items); if (isLock) lockWritten = true; return out; };
  st.getAll = async () => { if (freeze === 'afterlock' && lockWritten && !hit) { hit = true; await gate; } return f.api.storage.getAll(); };
  const A = mk('A', { storage: st }); const B = mk('B'); const C = mk('C');
  const pa = snd(A, { type: 'START_SESSION', minutes: 60 });
  for (let i = 0; i < 400 && !hit; i++) await sleep(2);
  await sleep(250);      // A's lease (80 ms) expires
  const out = {};
  if (thirdStart) { const rc = await snd(C, { type: 'START_SESSION', minutes: thirdStart }); out.C = rc.ok || rc.error?.code; }
  if (bSave) { const weaker = bSave === 'weaker' ? { ...none, domains: [] } : { ...none, domains: ['strong1.example', 'strong2.example', 'extra.example'] }; const sb = await snd(B, { type: 'SAVE_SETTINGS', baseRevision: (await snd(B, { type: 'GET_STATUS' })).status.revision, settings: weaker }); out.B = sb.ok || sb.error?.code; }
  const untilBefore = mergeLocks(state.storage).until;
  release(); const ra = await pa; out.A = ra.ok ? 'OK' : ra.error?.code;
  await sleep(150);
  const locks = Object.entries(state.storage).filter(([k]) => k.startsWith('lock:')).map(([k, v]) => v.until - state.now);
  const stF = (await snd(mk('D'), { type: 'GET_STATUS' })).status;
  const flag = (out.A === 'OK' && (stF.settings.domains.length < 2)) ? '  <== A SUCCESS ON WEAKER' : (out.A !== 'OK' && stF.lock.active ? '  <== failed start but session ACTIVE' : '');
  console.log(label.padEnd(36), JSON.stringify(out), 'lockUntil-now(min):', JSON.stringify(locks.map(x => Math.round(x / 60000))), 'untilBeforeResume>=after?', mergeLocks(state.storage).until >= untilBefore, '| final domains', stF.settings.domains.length, 'lockActive', stF.lock.active, 'state', stF.state, flag);
}
await run('F-pin, B weaker', { freeze: 'pin' });
await run('F-lock, B weaker', { freeze: 'lock' });
await run('F-afterlock, B weaker', { freeze: 'afterlock' });
await run('F-lock, B stronger', { freeze: 'lock', bSave: 'stronger' });
await run('F-lock, B weaker, C start 120', { freeze: 'lock', thirdStart: 120 });
await run('F-lock(60), C start 60 (equal-ish)', { freeze: 'lock', thirdStart: 60, bSave: null });
await run('F-afterlock, C start 120, B weaker(refused?)', { freeze: 'afterlock', thirdStart: 120 });
await run('F-pin, C start 120, B none', { freeze: 'pin', thirdStart: 120, bSave: null });
