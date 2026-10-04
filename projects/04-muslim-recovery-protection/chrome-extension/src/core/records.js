import { mergeLocks } from './lock.js';
// Append-only, fenced storage layout for the configuration (and the write epoch).
//
// storage.local has no atomic compare-and-set, and a worker can be frozen at ANY point between its last ownership check and
// the storage call (review of 7294cd6). Checking ownership "once more" before a non-atomic write therefore cannot prove anything.
// Instead a late write is made harmless by construction:
//   * the configuration is never overwritten in place. Every write creates its own record  `cfg:<epoch>:<instance>`;
//   * the epoch is taken when the write lock is entered (coordination.js): each holder gets an epoch strictly greater than every
//     epoch an earlier holder has registered. A worker that is frozen and resumes later still carries its OLD epoch;
//   * the effective configuration is the record with the highest (epoch, instance). A late record is therefore dominated by
//     every record written after its holder entered the lock - it can be stored, but never becomes the configuration;
//   * START_SESSION also writes a record (a copy of the effective configuration) so that every write that started before the
//     session is dominated by it: a delayed "delete my sites" cannot land inside a running session;
//   * compaction keeps the two newest records, so a late rollback can never leave none.
//
// Storage rule for EVERY key (review of 0b46c1d: a delete that was selected earlier can run arbitrarily late):
//   a key is either WRITE-ONCE under a unique name (cfg:<epoch>:<instance>, ep:<epoch>:<instance>, lock:<token>:<instance>) or it is
//   not used for state. A key is only ever removed when its (immutable) value is dominated for ever by another key - so a late removal
//   can only remove what was already irrelevant when it was chosen, and can never reach a newer value, because newer values live under
//   different names. (The only in-place rewrite is a writer replacing its OWN record by the previous configuration when it rolls back;
//   that writer is the only one that can touch that name.)
import { listConfigRecords, newestConfig } from './config-records.js';
export { MAX_EPOCH, CONFIG_PREFIX, LEGACY_CONFIG_KEY, EPOCH_PREFIX, configKey, epochKey, listConfigRecords, newestConfig, maxEpoch } from './config-records.js';

const EPOCH_KEY = /^ep:(\d{1,15}):([A-Za-z0-9_-]{1,64})$/u;
const keyOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Keys that can be removed without ever changing the effective state, because their (immutable) value is dominated for ever:
 *  - configuration records: all but the two newest;
 *  - epoch entries: all but the highest (epoch, instance);
 *  - session entries (`lock`, `lock:*`): any VALID entry dominated by another with a later end time (ties: higher key name wins). The newest
 *    entry is kept even when it has expired: a clock that jumped forward must never delete a session for good, and one small key costs nothing.
 *    An entry that fails the lock validator is never touched here (only RESET clears it), so one damaged entry cannot delete a valid session;
 *  - mutex entries of other instances that expired more than an hour ago (a removal at worst makes a live owner fail closed with "busy").
 * `leaseNow` is the lease clock, `selfMutexKey` the caller's own mutex entry (never listed).
 */
export function obsoleteKeys(snapshot, { leaseNow = 0, selfMutexKey = null } = {}) {
    const stale = listConfigRecords(snapshot).records.slice(2).map(record => record.key);
    const epochs = Object.keys(snapshot).map(key => ({ key, match: EPOCH_KEY.exec(key) })).filter(entry => entry.match)
        .map(entry => ({ key: entry.key, n: Number(entry.match[1]), id: entry.match[2] }))
        .sort((a, b) => b.n - a.n || keyOrder(b.id, a.id));
    for (const entry of epochs.slice(1)) stale.push(entry.key);
    // Released lock names are immutable cancellation targets. They cannot dominate a new,
    // shorter commitment, and removing them can never reach a future unique lock name.
    const merged = mergeLocks(snapshot);
    for (const [key, value] of Object.entries(snapshot)) {
        if ((key === 'lock' || key.startsWith('lock:')) && value && Number.isSafeInteger(value.until)
            && !merged.invalidKeys.includes(key) && !Object.hasOwn(merged.keys, key)) stale.push(key);
    }
    const locks = Object.entries(merged.keys).map(([key, until]) => ({ key, until }))
        .sort((a, b) => b.until - a.until || keyOrder(b.key, a.key));
    locks.forEach((entry, index) => { if (index > 0) stale.push(entry.key); });
    for (const [key, value] of Object.entries(snapshot)) {
        if (key.startsWith('mx:') && key !== selfMutexKey && value && typeof value === 'object' && Number.isFinite(value.exp) && value.exp < leaseNow - 3_600_000) stale.push(key);
    }
    return [...new Set(stale)];
}
