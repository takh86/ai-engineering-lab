// C-4: obsoleteKeys() accepts any lock-ish entry with a safe-integer `until` as a dominating one, but mergeLocks()/isLockValid() ignore entries with
// extra fields or until >= 8.64e15. After such an entry appears (bug / devtools / future schema), REPAIR (or a watchdog repair) runs compactStorage in a
// 'corrupt' state and deletes the VALID active session, which ends the commitment.
import { createController, createFakeBrowser, noList, send, status, configured } from './h.mjs';
const fake = createFakeBrowser(); const a = createController(fake.api);
await configured({ a });
const s0 = await send(a, { type: 'START_SESSION', minutes: 120 }); console.log('session started', s0.ok, 'active =', s0.status.lock.active);
fake.state.storage['lock:9-9:evil'] = { until: 8.7e15 };          // invalid by isLockValid (>= 8.64e15), but a "safe integer"
console.log('state now:', (await send(a, { type: 'GET_STATUS' })).status.reasons, 'lock.active =', (await a.statusNow()).lock.active);
fake.state.rules = [];                                            // make REPAIR do real work (any rules mismatch triggers it)
const r = await send(a, { type: 'REPAIR' });
console.log('after REPAIR: lock keys =', Object.keys(fake.state.storage).filter(k => k.startsWith('lock:')), '| status.lock.active =', r.status.lock.active, '| reasons', r.status.reasons);
const rs = await send(a, { type: 'RESET', baseRevision: 0 });
console.log('RESET (needs no active session) =>', rs.ok, rs.error?.code, JSON.stringify(rs.error?.params));
