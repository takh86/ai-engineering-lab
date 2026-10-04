// Randomised adversarial interleaving of SAVE/IMPORT/START_SESSION/REPAIR/RESET/GET_STATUS across 3-4 worker instances with
// freezes past the lease, worker death right after a write, and session/lease clock jumps. Real src/, fake browser (NOT DNR evidence).
import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser, storedConfig } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
import { mergeLocks } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/lock.js';
import { weakeningReasons, parseStored } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/config.js';
import { planRules, rulesMatch } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/rules.js';

const SEED0 = Number(process.argv[2] ?? 1), TRIALS = Number(process.argv[3] ?? 100), CLOCK = process.argv.includes('--clock'), VERBOSE = process.argv.includes('-v');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rng = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const LEASE = 60, FREEZE = 140;
const POOL = ['d0.example', 'd1.example', 'd2.example', 'd3.example', 'd4.example', 'd5.example'];
const WORDS = ['alpha word', 'beta word', 'gamma word'];

async function trial(seed) {
  const R = rng(seed); const pick = a => a[Math.floor(R() * a.length)]; const subset = (a, p) => a.filter(() => R() < p);
  const fake = createFakeBrowser({ regexLimit: 5000 }); const { state } = fake;
  const violations = []; let baseline = null; let maxSeen = 0; const log = [];
  const monitor = (why) => {
    const until = mergeLocks(state.storage).until; const active = until > state.now;
    if (until < maxSeen && maxSeen > state.now) violations.push(`session shortened ${maxSeen}->${until} after ${why}`);
    maxSeen = Math.max(maxSeen, until);
    let eff; try { eff = parseStored(storedConfig(state)); } catch { eff = null; }
    if (active) { if (!baseline) baseline = eff; else if (eff && baseline) { const r = weakeningReasons(baseline, eff); if (r.length) violations.push(`weakened during session (${r}) after ${why}`); } if (!eff) violations.push('effective config unreadable during session after ' + why); }
    else baseline = null;
  };
  const rawSet = fake.api.storage.set, rawRemove = fake.api.storage.remove;
  fake.api.storage.set = async items => { await rawSet(items); monitor('set ' + Object.keys(items).join(',').slice(0, 40)); };
  fake.api.storage.remove = async keys => { await rawRemove(keys); monitor('remove ' + keys.length); };
  let n = 0;
  const mkWorker = (opts = {}) => {
    const id = `w${seed}_${++n}`; const w = { id, calls: 0, dead: false, freezeAt: opts.freezeAt ?? -1, dieAt: opts.dieAt ?? -1, freezeMs: opts.freezeMs ?? FREEZE, frozenOn: null };
    const hook = async name => {
      if (w.dead) throw new Error('worker terminated');
      const c = ++w.calls;
      if (c === w.freezeAt) { w.frozenOn = name; await sleep(w.freezeMs); if (w.dead) throw new Error('worker terminated'); }
    };
    const after = async name => { if (w.calls === w.dieAt) { w.dead = true; log.push(`${id} died after ${name}`); } };
    const wrap = (obj, prefix) => Object.fromEntries(Object.entries(obj).map(([k, f]) => [k, async (...a) => { await hook(prefix + k); const r = await f(...a); await after(prefix + k); return r; }]));
    const api = { ...fake.api, instanceId: id, storage: wrap(fake.api.storage, 'storage.'), dnr: wrap(fake.api.dnr, 'dnr.') };
    w.ctl = createController(api, { mutex: { leaseMs: LEASE, waitMs: 500, pollMs: 2 } });
    w.send = m => w.ctl.handle(validateMessage(m));
    return w;
  };
  // healthy setup
  const setup = mkWorker();
  const ob = await setup.send({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
  let rev = ob.status.revision;
  await setup.send({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: { baseList: false, starterTerms: false, domains: ['d0.example', 'd1.example'], allow: [], words: ['alpha word'], contains: [] } });
  const nW = 3 + Math.floor(R() * 2);
  const workers = Array.from({ length: nW }, () => mkWorker({ freezeAt: R() < 0.7 ? 1 + Math.floor(R() * 45) : -1, freezeMs: FREEZE * (0.5 + R() * 2), dieAt: R() < 0.35 ? 1 + Math.floor(R() * 60) : -1 }));
  const settingsOf = (cfg) => ({ baseList: R() < 0.2 ? !cfg.baseList : cfg.baseList, starterTerms: false, domains: subset(POOL, 0.4), allow: R() < 0.1 ? ['allowed.example'] : [], words: subset(WORDS, 0.5), contains: [] });
  const opsDone = [];
  const runWorker = async w => {
    const count = 1 + Math.floor(R() * 3);
    for (let i = 0; i < count && !w.dead; i++) {
      await sleep(Math.floor(R() * 30));
      const kind = pick(['SAVE', 'SAVE', 'IMPORT', 'START', 'REPAIR', 'RESET', 'STATUS']);
      try {
        const st = await w.send({ type: 'GET_STATUS' }); const cfg = st.status?.settings; const baseRevision = st.status?.revision ?? 0;
        if (!cfg) { opsDone.push(`${w.id} nostatus`); continue; }
        let m;
        if (kind === 'SAVE') m = { type: 'SAVE_SETTINGS', baseRevision, settings: settingsOf(cfg) };
        else if (kind === 'IMPORT') m = { type: 'IMPORT_SETTINGS', baseRevision, text: JSON.stringify({ format: 'tabsira-settings', version: 2, settings: settingsOf(cfg) }) };
        else if (kind === 'START') m = { type: 'START_SESSION', minutes: pick([60, 90, 120]) };
        else if (kind === 'REPAIR') m = { type: 'REPAIR' };
        else if (kind === 'RESET') m = { type: 'RESET', baseRevision };
        else m = { type: 'GET_STATUS' };
        const r = await w.send(m);
        opsDone.push(`${w.id} ${kind} ${r.ok ? 'ok' : r.error?.code}`);
      } catch (e) { opsDone.push(`${w.id} ${kind} threw ${e.message}`); }
      if (CLOCK && R() < 0.3) { const jump = pick([-3600e3, 3600e3, 30 * 60e3, -90 * 60e3]); state.now += jump; log.push(`session clock ${jump}`); monitor('clock'); }
      if (CLOCK && R() < 0.15) { const j = pick([-60e3, 25e3, 5e3]); state.clockSkew += j; log.push(`lease clock ${j}`); }
    }
  };
  await Promise.all(workers.map(runWorker));
  await sleep(FREEZE * 3 + 50);       // let every frozen worker resume and finish its late writes
  monitor('quiesce');
  // watchdog / fresh worker: reconcile under lock
  state.clockSkew = 0;
  const wd = mkWorker();
  await sleep(LEASE + 20);
  const status = (await wd.send({ type: 'GET_STATUS' })).status;
  const st2 = (await wd.ctl.reconcile());
  const rs = await wd.ctl.readState();
  const eff = rs.kind === 'ok' || rs.kind === 'fresh' ? rs.config : null;
  if (!eff) violations.push('final state kind ' + rs.kind);
  else {
    const plan = await planRules({ ...eff, ...(eff.onboarded ? {} : { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] }) }, wd.ctl.supports);
    if (!rulesMatch(state.rules, plan.rules) || state.baseEnabled !== plan.baseListEnabled) violations.push(`final rules != plan(effective config) (state=${st2?.state}; reasons=${st2?.reasons})`);
  }
  monitor('final');
  if (violations.length && VERBOSE) console.log(seed, violations, log.join('|'), opsDone.join(' | '));
  return { seed, violations, log, opsDone };
}
let bad = 0; const t0 = Date.now(); const agg = {};
for (let i = 0; i < TRIALS; i++) {
  const res = await trial(SEED0 + i);
  for (const o of res.opsDone) { const k = o.split(' ').slice(1).join(' '); agg[k] = (agg[k]||0)+1; } agg.died=(agg.died||0)+res.log.filter(x=>x.includes('died')).length;
  if (res.violations.length) { bad++; console.log('VIOLATION seed', res.seed, JSON.stringify(res.violations), '\n  ', res.log.join(' | '), '\n  ', res.opsDone.join(' | ')); }
  if (Date.now() - t0 > 240000) { console.log('time cap at trial', i); break; }
}
console.log(JSON.stringify(agg));
console.log(`done seeds ${SEED0}..+${TRIALS} violations=${bad} in ${Date.now() - t0}ms clock=${CLOCK}`);
