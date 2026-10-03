import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
import { mergeLocks } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/lock.js';
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const O = { mutex: { leaseMs: 60, waitMs: 600, pollMs: 2 } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const LEG = { domains: ['legacy.example'], keywords: ['kw one'] };
const ops = { STATUS: () => ({ type: 'GET_STATUS' }), REPAIR: () => ({ type: 'REPAIR' }),
  SAVE_STRONG: rev => ({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...none, domains: ['legacy.example', 'more.example'], contains: ['kw one'] } }),
  SAVE_WEAK: rev => ({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...none } }),
  IMPORT: rev => ({ type: 'IMPORT_SETTINGS', baseRevision: rev, text: JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...none, domains: ['imp.example'] } }) }),
  RESET: rev => ({ type: 'RESET', baseRevision: rev }), START60: () => ({ type: 'START_SESSION', minutes: 60 }), START120: () => ({ type: 'START_SESSION', minutes: 120 }),
  ONBOARD: () => ({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false }) };
let bad = 0, total = 0;
for (const lockedMin of [90, 30]) for (const [name, mkMsg] of Object.entries(ops)) for (const mode of ['before', 'after']) for (let k = 1; k <= 12; k++) {
  const f = createFakeBrowser({ regexLimit: 5000 }); const { state } = f; const v0 = state.now + lockedMin * 60000;
  state.storage.config = { ...LEG, lockedUntil: v0 };
  let sets = 0, dead = false, died = false;
  const guard = fn => async (...a) => { if (dead) throw new Error('dead'); return fn(...a); };
  const st = { ...f.api.storage, get: guard(f.api.storage.get), getAll: guard(f.api.storage.getAll), remove: guard(f.api.storage.remove), set: async items => { if (dead) throw new Error('dead'); sets++; if (sets === k) { died = true; if (mode === 'before') { dead = true; throw new Error('dead'); } await f.api.storage.set(items); dead = true; throw new Error('dead'); } return f.api.storage.set(items); } };
  const dnr = Object.fromEntries(Object.entries(f.api.dnr).map(([n, fn]) => [n, guard(fn)]));
  const A = createController({ ...f.api, instanceId: 'A', storage: st, dnr }, O);
  const snd = (c, m) => c.handle(validateMessage(m));
  const rev = 1; let ra; try { ra = await snd(A, mkMsg(rev)); } catch (e) { ra = { ok: false, error: { code: 'threw' } }; }
  if (!died) { if (k === 1) {/* op did <1 set */} continue; }
  total++;
  await sleep(150);
  const D = createController({ ...f.api, instanceId: 'D' + k }, O);
  const s = (await snd(D, { type: 'GET_STATUS' })).status; const hasCfg = Object.keys(state.storage).some(x => x.startsWith('cfg:'));
  const keysUntil = mergeLocks(state.storage).until;
  const problems = [];
  if (s.lock.until < v0) problems.push(`session end lost/shortened status.until-v0=${s.lock.until - v0}`);
  if (hasCfg && keysUntil < v0) problems.push('cfg record exists but no lock key >= legacy end');
  const wk = await snd(D, { type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { ...none } });
  if (wk.ok && s.state !== 'not_configured') problems.push('weakening SAVE accepted during legacy session');
  const rs = await snd(D, { type: 'RESET', baseRevision: s.revision }); if (rs.ok && s.lock.active) problems.push('RESET accepted during legacy session');
  if (problems.length) { bad++; console.log('PROBLEM', lockedMin, name, mode, 'k=' + k, 'A:', ra.ok || ra.error?.code, problems.join('; ')); }
}
console.log('stop points exercised', total, 'problems', bad);
