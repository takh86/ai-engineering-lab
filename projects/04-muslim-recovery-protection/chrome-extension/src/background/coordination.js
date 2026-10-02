import { TabsiraError } from '../core/errors.js';
import { epochKey, maxEpoch } from '../core/records.js';

const PREFIX = 'mx:';

/**
 * Cross-instance write mutex built on storage.local (Lamport's bakery algorithm over atomic single-key reads/writes).
 *
 * Why: the normal and the private-window worker instances share storage but not memory, and storage.local offers no
 * atomic compare-and-set; "read, check, write" from two instances can interleave and a stale write can overwrite a newer
 * one. Every state-changing operation therefore runs inside this mutex. Entries carry a lease so a crashed worker cannot
 * block the others for long. `assertOwner()` is called before each storage write and fails closed (`busy`) if the lease
 * was lost, so a worker that was paused past its lease cannot write over a newer state.
 *
 * It is cooperative (every instance of THIS extension follows it) — not protection against a hostile writer. The session
 * end time is additionally stored grow-only (see core/lock.js), so even a rule-breaking writer cannot shorten it.
 */
export function createWriteMutex(api, { leaseMs = 20000, waitMs = 15000, pollMs = 4 } = {}) {
    const me = api.instanceId;
    const key = `${PREFIX}${me}`;
    let held = false;
    let epoch = 0;
    let sequence = 0;

    const entriesOf = (all, now) => Object.entries(all)
        .filter(([name, value]) => name.startsWith(PREFIX) && name !== key && value && typeof value === 'object' && Number.isFinite(value.exp) && value.exp > now)
        .map(([name, value]) => ({ id: name.slice(PREFIX.length), ticket: Number(value.ticket) || 0, choosing: !!value.choosing }));
    const before = (a, b) => a.ticket < b.ticket || (a.ticket === b.ticket && a.id < b.id);

    async function acquire() {
        const deadline = api.clock() + waitMs;
        await api.storage.set({ [key]: { choosing: true, ticket: 0, exp: api.clock() + leaseMs } });
        const others = entriesOf(await api.storage.getAll(), api.clock());
        const ticket = 1 + Math.max(0, ...others.map(entry => entry.ticket));
        await api.storage.set({ [key]: { choosing: false, ticket, exp: api.clock() + leaseMs } });
        const mine = { id: me, ticket };
        for (;;) {
            const rivals = entriesOf(await api.storage.getAll(), api.clock());
            const blocked = rivals.some(entry => entry.choosing || (entry.ticket > 0 && before(entry, mine)));
            if (!blocked) { held = true; return; }
            if (api.clock() > deadline) {
                await api.storage.remove([key]).catch(() => {});
                throw new TabsiraError('busy');
            }
            await api.sleep(pollMs);
        }
    }

    async function release() {
        held = false;
        try { await api.storage.remove([key]); } catch { /* the lease expires by itself */ }
    }

    /** Fails closed unless this instance still holds the lease and nobody ahead of it exists. Renews the lease. */
    async function assertOwner() {
        if (!held) throw new TabsiraError('busy');
        const all = await api.storage.getAll();
        const mine = all[key];
        const now = api.clock();
        if (!mine || mine.choosing || !(mine.exp > now)) { held = false; throw new TabsiraError('busy'); }
        const rivals = entriesOf(all, now);
        if (rivals.some(entry => entry.choosing || (entry.ticket > 0 && before(entry, { id: me, ticket: mine.ticket })))) { held = false; throw new TabsiraError('busy'); }
        await api.storage.set({ [key]: { ...mine, exp: now + leaseMs } });
    }

    // Fencing token: every holder registers an epoch greater than all epochs registered before it. A frozen holder keeps its old
    // epoch, so anything it writes late is ranked below what later holders wrote (see core/records.js). If the lease was lost while
    // the epoch was being registered, assertOwner() fails closed before anything else is written.
    async function beginEpoch() {
        epoch = 1 + maxEpoch(await api.storage.getAll());
        sequence = 0;
        await api.storage.set({ [epochKey(epoch, me)]: { n: epoch } });   // write-once, unique name: never rewritten, only removed when dominated
        await assertOwner();
    }

    async function run(task) {
        await acquire();
        try { await beginEpoch(); return await task(); } finally { epoch = 0; await release(); }
    }

    return { run, assertOwner, isHeld: () => held, epoch: () => epoch, ownKey: key,
        /** A name that is unique to this lock holder and this write inside it (`<epoch>-<n>`): used for write-once keys. */
        token: () => `${epoch}-${++sequence}` };
}
