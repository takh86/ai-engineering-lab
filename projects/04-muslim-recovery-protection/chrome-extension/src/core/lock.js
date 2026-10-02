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
