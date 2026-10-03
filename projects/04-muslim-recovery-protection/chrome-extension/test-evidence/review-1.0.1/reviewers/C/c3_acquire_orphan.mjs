// C-3: createWriteMutex.run() calls acquire() OUTSIDE its try/finally. A storage error inside acquire() (after its first set) leaves a live
// {choosing:true|ticket} entry for the lease (20 s) that blocks every other instance (busy), including the watchdog's repair.
import { createController, createFakeBrowser, noList, send, status, configured, peerOf } from './h.mjs';
const fake = createFakeBrowser(); const a = createController(fake.api); const b = peerOf(fake.api, { mutex: { waitMs: 400 } });
await configured({ a });
fake.state.fail['storage.get'] = 1;                               // the next getAll fails: this is the one right after A's first mx write
const rev = (await status({}, a)).revision;                       // GET_STATUS read-only consumes nothing from the lock; do not fail it:
fake.state.fail['storage.get'] = 0;
// make the failure hit acquire(): fail the getAll that follows A's mx 'choosing' write
const realSet = fake.api.storage.set;
fake.api.storage.set = async items => { const r = await realSet(items); if (Object.keys(items).some(k => k.startsWith('mx:')) && !fake.state.fail.done) { fake.state.fail['storage.get'] = 1; fake.state.fail.done = true; } return r; };
const ra = await send(a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'x.org'] } });
fake.api.storage.set = realSet;
console.log('A save result:', ra.ok, ra.error?.code);
console.log('orphan mx entries after A failed:', JSON.stringify(Object.entries(fake.state.storage).filter(([k]) => k.startsWith('mx:'))));
const t0 = Date.now();
const rb = await send(b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'y.org'] } });
console.log('B save while the orphan lives:', rb.ok, rb.error?.code, `after ${Date.now() - t0} ms (real waitMs is 15000, lease 20000)`);
