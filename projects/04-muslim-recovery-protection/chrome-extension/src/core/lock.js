// Commitment session. The only state is an absolute end time; there is no timer, so a sleeping
// or restarted service worker cannot lose or extend it. Expiry only re-enables editing; it never
// removes a rule. A device-clock change moves the end: setting the clock forward ends the session
// early, setting it back lengthens it. This is a friction aid, not tamper resistance.
export const SESSION_MINUTES = Object.freeze([60, 90, 120]);

export const emptyLock = () => ({ until: 0 });

export function isLockValid(lock) {
    return !!lock && typeof lock === 'object' && Object.keys(lock).length === 1
        && Number.isSafeInteger(lock.until) && lock.until >= 0 && lock.until < 8.64e15;
}

export const isActive = (lock, now = Date.now()) => lock.until > now;

export const remainingMs = (lock, now = Date.now()) => Math.max(0, lock.until - now);

/** Starting or extending never shortens an active session. */
export function extend(lock, minutes, now = Date.now()) {
    if (!SESSION_MINUTES.includes(minutes)) return null;
    return { until: Math.max(lock.until, now + minutes * 60000) };
}

// ---- grow-only storage layout (no read-modify-write on a shared value) ----
// storage.local has no compare-and-set, so the end time is never kept in one shared value that a late or stale writer
// could overwrite, and keys are never reused: every session start/extension creates a NEW key ("lock:<epoch>-<n>:<instance>"),
// and the effective end time is the maximum over all keys. A stale write can never shorten a session, and a delayed removal
// (selected earlier) can only reach keys that were already dominated or expired - never a newer session, which lives under a new name.
export const LOCK_KEY_PREFIX = 'lock:';
export const LEGACY_LOCK_KEY = 'lock';
/** Write-once session entry: unique per lock holder and write, never rewritten (see core/records.js). */
export const lockKey = (token, instance) => `${LOCK_KEY_PREFIX}${token}:${instance}`;
export const isLockKey = key => key === LEGACY_LOCK_KEY || key.startsWith(LOCK_KEY_PREFIX);

/** Merges every lock entry of a full storage snapshot: { until, invalidKeys, keys }. */
export function mergeLocks(snapshot) {
    let until = 0; const invalidKeys = []; const keys = {};
    for (const [key, value] of Object.entries(snapshot)) {
        if (!isLockKey(key)) continue;
        if (!isLockValid(value)) { invalidKeys.push(key); continue; }
        keys[key] = value.until;
        until = Math.max(until, value.until);
    }
    return { until, invalidKeys, keys };
}
