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
//   * compaction keeps the two newest records, so a late rollback (which removes only its own record) can never leave none.
export const CONFIG_PREFIX = 'cfg:';
export const LEGACY_CONFIG_KEY = 'config';
export const EPOCH_PREFIX = 'ep:';
const RECORD_KEY = /^cfg:(\d{1,15}):([A-Za-z0-9_-]{1,64})$/u;
const MAX_EPOCH = 1e15;

export const configKey = (epoch, instance) => `${CONFIG_PREFIX}${epoch}:${instance}`;
export const epochKey = instance => `${EPOCH_PREFIX}${instance}`;

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

/** Highest write epoch registered so far (epoch entries and configuration records). */
export function maxEpoch(snapshot) {
    let max = 0;
    for (const [key, value] of Object.entries(snapshot)) {
        if (key.startsWith(EPOCH_PREFIX) && value && typeof value === 'object' && Number.isSafeInteger(value.n) && value.n > 0 && value.n < MAX_EPOCH) max = Math.max(max, value.n);
        else { const match = RECORD_KEY.exec(key); if (match && Number(match[1]) < MAX_EPOCH) max = Math.max(max, Number(match[1])); }
    }
    return max;
}

/** Keys that can be removed without ever changing the effective state: all but the two newest records, and all but the highest epoch entry. */
export function obsoleteKeys(snapshot) {
    const { records } = listConfigRecords(snapshot);
    const stale = records.slice(2).map(record => record.key);
    const epochs = Object.entries(snapshot).filter(([key, value]) => key.startsWith(EPOCH_PREFIX) && value && Number.isSafeInteger(value.n));
    const top = epochs.reduce((best, entry) => (!best || entry[1].n > best[1].n || (entry[1].n === best[1].n && entry[0] > best[0]) ? entry : best), null);
    for (const [key] of epochs) if (key !== top[0]) stale.push(key);
    return stale;
}
