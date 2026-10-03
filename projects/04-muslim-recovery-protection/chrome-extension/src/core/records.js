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
export const CONFIG_PREFIX = 'cfg:';
export const LEGACY_CONFIG_KEY = 'config';
export const EPOCH_PREFIX = 'ep:';
const RECORD_KEY = /^cfg:(\d{1,15}):([A-Za-z0-9_-]{1,64})$/u;
const MAX_EPOCH = 1e15;

export const configKey = (epoch, instance) => `${CONFIG_PREFIX}${epoch}:${instance}`;
export const epochKey = (epoch, instance) => `${EPOCH_PREFIX}${epoch}:${instance}`;
const EPOCH_KEY = /^ep:(\d{1,15}):([A-Za-z0-9_-]{1,64})$/u;

const higher = (a, b) => a.epoch > b.epoch || (a.epoch === b.epoch && a.id > b.id);

/** All configuration records of a storage snapshot, newest first: { key, epoch, id, value }. The legacy single `config` key counts as epoch 0. */
export function listConfigRecords(snapshot) {
    const records = []; const invalidKeys = [];
    for (const [key, value] of Object.entries(snapshot)) {
        if (!key.startsWith(CONFIG_PREFIX)) continue;
        const match = RECORD_KEY.exec(key);
        if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) >= MAX_EPOCH) { invalidKeys.push(key); continue; }
        records.push({ key, epoch: Number(match[1]), id: match[2], value });
    }
    if (LEGACY_CONFIG_KEY in snapshot) records.push({ key: LEGACY_CONFIG_KEY, epoch: 0, id: '', value: snapshot[LEGACY_CONFIG_KEY], legacy: true });
    records.sort((a, b) => (higher(a, b) ? -1 : higher(b, a) ? 1 : 0));
    return { records, invalidKeys };
}

/** The effective configuration record, or null when nothing was ever stored. */
export const newestConfig = snapshot => listConfigRecords(snapshot).records[0] ?? null;

/** Highest write epoch registered so far (epoch entries `ep:<epoch>:<instance>` and configuration records). */
export function maxEpoch(snapshot) {
    let max = 0;
    for (const key of Object.keys(snapshot)) {
        const match = EPOCH_KEY.exec(key) ?? RECORD_KEY.exec(key);
        if (match && Number(match[1]) < MAX_EPOCH) max = Math.max(max, Number(match[1]));
    }
    return max;
}

const keyOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Keys that can be removed without ever changing the effective state, because their (immutable) value is dominated for ever:
 *  - configuration records: all but the two newest;
 *  - epoch entries: all but the highest (epoch, instance);
 *  - session entries (`lock`, `lock:*`): expired ones, and any entry dominated by another with a later end time (ties: higher key name wins);
 *  - mutex entries of other instances that expired more than an hour ago (a removal at worst makes a live owner fail closed with "busy").
 * `now` is the session clock, `leaseNow` the lease clock, `selfMutexKey` the caller's own mutex entry (never listed).
 */
export function obsoleteKeys(snapshot, { now = 0, leaseNow = 0, selfMutexKey = null } = {}) {
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
    locks.forEach((entry, index) => { if (index > 0 || entry.until <= now) stale.push(entry.key); });
    for (const [key, value] of Object.entries(snapshot)) {
        if (key.startsWith('mx:') && key !== selfMutexKey && value && typeof value === 'object' && Number.isFinite(value.exp) && value.exp < leaseNow - 3_600_000) stale.push(key);
    }
    return [...new Set(stale)];
}
