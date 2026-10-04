// C-2: v0 prototype migration persists the NEW config record first (commit) and writes the migrated session end (lockedUntil) AFTER.
// If anything stops in between (worker terminated, storage error), the legacy `config` key is no longer the newest record, so migrate() never runs
// again and the v0 session end is gone for good.
import { createController, createFakeBrowser, noList, send, status } from './h.mjs';
const fake = createFakeBrowser(); const c = createController(fake.api);
const endsAt = fake.state.now + 90 * 60000; fake.state.clockSkew = 0;
fake.state.storage.config = { domains: ['example.com'], keywords: ['abc'], lockedUntil: Date.now() + 90 * 60000 };
const real = fake.api.storage.set;
let fail = true;
fake.api.storage.set = async items => { if (fail && Object.keys(items).some(k => k.startsWith('lock:'))) throw new Error('worker stopped / storage error'); return real(items); };
// pre-state: session visible through migration
fake.state.now = Date.now();
console.log('before: lock.active =', (await c.statusNow()).lock.active);
const r = await send(c, { type: 'REPAIR' });
console.log('REPAIR (writeLock fails after commit): ok =', r.ok, r.error?.code);
fail = false;
const s = await c.statusNow();
console.log('after: keys =', Object.keys(fake.state.storage).filter(k => !k.startsWith('mx:')), '| lock.active =', s.lock.active, 'until =', s.lock.until);
const save = await send(c, { type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { ...noList, domains: [] } });
console.log('weakening save (delete all sites) accepted =', save.ok, save.error?.code ?? '');
