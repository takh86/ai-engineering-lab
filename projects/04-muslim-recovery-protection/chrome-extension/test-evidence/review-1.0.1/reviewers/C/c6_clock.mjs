// C-6a: a transient FORWARD clock glitch + any lock-taking operation permanently deletes the session entries (compactStorage removes `until <= now`);
//       when the clock returns, the session does not come back (a backward glitch is reversible, a forward one is not).
// C-6b: a BACKWARD wall-clock jump makes an orphaned mutex entry (worker killed while holding) look alive for the jump size => every write incl. the
//       watchdog repair is refused with `busy` until the real time catches up.
import { createController, createFakeBrowser, noList, send, status, configured, peerOf } from './h.mjs';
{
    const fake = createFakeBrowser(); const a = createController(fake.api); await configured({ a });
    await send(a, { type: 'START_SESSION', minutes: 60 });
    const t0 = fake.state.now;
    fake.state.now = t0 + 3 * 3600_000;                                   // glitch: clock 3 h ahead
    await send(a, { type: 'REPAIR' });                                    // any guarded op (also GET_STATUS repair / alarm repair) compacts
    fake.state.now = t0;                                                  // clock corrected
    const s = await a.statusNow();
    console.log('C-6a lock keys left:', Object.keys(fake.state.storage).filter(k => k.startsWith('lock:')).length, '| session active after clock restored =', s.lock.active);
}
{
    const fake = createFakeBrowser(); const a = createController(fake.api); const b = peerOf(fake.api, { mutex: { waitMs: 300 } }); await configured({ a });
    // orphan: a worker was terminated while holding the lock (entry exp = now+20s, never released)
    fake.state.storage['mx:dead'] = { choosing: false, ticket: 1, exp: Date.now() + 20000 };
    fake.state.clockSkew = -3600_000;                                     // wall clock steps back 1 h (manual change / bad RTC / VM restore)
    const s = (await send(a, { type: 'GET_STATUS' })).status;
    fake.state.rules = [];                                                // plus rules damaged: watchdog must repair
    const g = await send(b, { type: 'GET_STATUS' });
    console.log('C-6b repair under orphan after clock step-back: state =', g.status.state, g.status.reasons, '| rules restored =', fake.state.rules.length > 0);
    const r = await send(b, { type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { ...noList, domains: ['example.com', 'n.org'] } });
    console.log('C-6b SAVE:', r.ok, r.error?.code, '(no automatic recovery for ~1 h; compaction only removes orphans expired >1 h before the CURRENT clock)');
}
