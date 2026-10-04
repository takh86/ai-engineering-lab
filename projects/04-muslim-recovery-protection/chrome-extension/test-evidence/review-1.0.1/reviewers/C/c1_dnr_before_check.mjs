// C-1: commit() writes DNR rules BEFORE any ownership check (controller.js:109 vs assertOwner :111).
// A = weakening SAVE frozen right before its DNR write; lease expires; B saves + START_SESSION; A's stale DNR write lands and A is then
// "terminated" (every later call of A hangs). Storage is safe; browser rules are not, until a watchdog/other trigger rebuilds them.
import { createController, createFakeBrowser, noList, gate, until, send, configured, status, ruleDomains } from './h.mjs';
const fake = createFakeBrowser();
const dead = { v: false }; const hang = new Promise(() => {});
const wrap = (obj, kill) => Object.fromEntries(Object.entries(obj).map(([k, f]) => [k, (...a) => (kill.v ? hang : f(...a))]));
const apiA = { ...fake.api, instanceId: 'A', storage: wrap(fake.api.storage, dead), dnr: { ...wrap(fake.api.dnr, dead) } };
const hold = gate(); let frozen = false, landed = false;
const realUpd = fake.api.dnr.updateDynamicRules;
apiA.dnr.updateDynamicRules = async o => { if (dead.v) return hang; if (!frozen) { frozen = true; await hold.promise; await realUpd(o); landed = true; dead.v = true; return; } return realUpd(o); };
const t = { a: createController(apiA), b: createController({ ...fake.api, instanceId: 'B' }) };
await configured({ a: t.b });
const rev = (await status(t, t.b)).revision;
const oldSave = send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: [] } });
await until(() => frozen, 'A at DNR write');
fake.state.clockSkew += 60_000;
console.log('B START_SESSION ok =', (await send(t.b, { type: 'START_SESSION', minutes: 60 })).ok);
hold.open(); await until(() => landed, 'landed'); await new Promise(r => setTimeout(r, 50));
const snap = await t.b.statusNow();
console.log('A terminated after stale DNR write. session active =', snap.lock.active, '| state =', snap.state, '| reasons =', snap.reasons, '| browser rules =', JSON.stringify(ruleDomains(fake.state)));
const repaired = await send(t.b, { type: 'GET_STATUS' });   // = what the watchdog alarm does
console.log('after watchdog-equivalent GET_STATUS: rules =', JSON.stringify(ruleDomains(fake.state)), 'state =', repaired.status.state);
