// Dependency-free selection and fencing for immutable configuration records.
export const CONFIG_PREFIX = 'cfg:';
export const LEGACY_CONFIG_KEY = 'config';
export const EPOCH_PREFIX = 'ep:';
const RECORD_KEY = /^cfg:(\d{1,15}):([A-Za-z0-9_-]{1,64})$/u;
export const MAX_EPOCH = 5e11; // Reject planted huge epochs before record ranking or mutex allocation.

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

