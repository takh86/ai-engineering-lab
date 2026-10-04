import { newestConfig } from './config-records.js';
import { parseStored } from './config.js';
import { validMinutes, validExitDelay } from './commitment.js';
// Commitment deadlines are absolute, so worker sleep/restart cannot lose a session.
// An explicit mature request plus a current verified password may publish a fenced cancellation
// for exact existing lock names. Expiry re-enables editing; core protection remains active. A device-clock change moves the end: setting the clock forward ends the session
// early, setting it back lengthens it. This is a friction aid, not tamper resistance.
export const SESSION_MINUTES = Object.freeze([60, 90, 120]);

export const emptyLock = () => ({ until: 0 });

export function isLockValid(lock) {
    return !!lock && typeof lock === 'object' && (Object.keys(lock).length === 1 || (Object.keys(lock).length === 2 && validExitDelay(lock.exitDelay)))
        && Number.isSafeInteger(lock.until) && lock.until >= 0 && lock.until < 8.64e15;
}

export const isActive = (lock, now = Date.now()) => lock.until > now;

export const remainingMs = (lock, now = Date.now()) => Math.max(0, lock.until - now);

/** Starting or extending never shortens an active session. */
export function extend(lock, minutes, now = Date.now()) {
    if (!validMinutes(minutes)) return null;
    return { until: Math.max(lock.until, now + minutes * 60000) };
}

// ---- grow-only storage layout (no read-modify-write on a shared value) ----
// storage.local has no compare-and-set, so the end time is never kept in one shared value that a late or stale writer
// could overwrite, and keys are never reused: every session start/extension creates a NEW key ("lock:<epoch>-<n>:<instance>"),
// and the effective end time is the maximum over unreleased keys. A stale write can never shorten a session, and a delayed removal
// (selected earlier) can only reach keys that were already dominated or expired - never a newer session, which lives under a new name.
export const LOCK_KEY_PREFIX = 'lock:';
export const LEGACY_LOCK_KEY = 'lock';
/** Write-once session entry: unique per lock holder and write, never rewritten (see core/records.js). */
export const lockKey = (token, instance) => `${LOCK_KEY_PREFIX}${token}:${instance}`;
export const isLockKey = key => key === LEGACY_LOCK_KEY || key.startsWith(LOCK_KEY_PREFIX);

/** Merges every lock entry of a full storage snapshot: { until, exitDelay, invalidKeys, keys }. */
export function mergeLocks(snapshot) {
    let until = 0; let exitDelay = 60; const released = new Set(); const invalidKeys = []; const keys = {};
    // Cancellation is fenced by the effective append-only configuration record. Only exact
    // observed immutable lock names are released; a future extension uses a new name.
    try { parseStored(newestConfig(snapshot)?.value).commitment.releases.forEach(key => released.add(key)); }
    catch { /* unreadable cancellation state never weakens a commitment */ }
    for (const [key, value] of Object.entries(snapshot)) {
        if (!isLockKey(key)) continue;
        if (!isLockValid(value)) { invalidKeys.push(key); continue; }
        if (released.has(key)) continue;
        keys[key] = value.until;
        exitDelay = Math.max(exitDelay, value.exitDelay ?? 60);
        until = Math.max(until, value.until);
    }
    return { until, exitDelay, invalidKeys, keys };
}
