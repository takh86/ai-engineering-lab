import { normalizeDomain } from '../core/domains.js';

export const STATUS_STATES = new Set(['active', 'partial', 'unknown', 'not_configured']);
export function honestStatus(status) {
    if (!status || !STATUS_STATES.has(status.state)) return { state: 'unknown', reasons: ['api_error'], lock: null };
    return { ...status, reasons: Array.isArray(status.reasons) ? status.reasons : [] };
}

// The full URL stays ephemeral in the click handler. Only a validated domain is sent.
export function domainFromTabUrl(raw) {
    if (typeof raw !== 'string') return null;
    try {
        const url = new URL(raw);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        return normalizeDomain(url.hostname);
    } catch { return null; }
}

export function commitmentCountdown(lock, now = Date.now(), observedDuration = 0) {
    const until = lock?.until;
    if (!lock?.active || !Number.isSafeInteger(until) || until <= 0 || until > 8640000000000000) return { active: false, expired: false, seconds: 0, fraction: 0, text: '00:00:00' };
    const remaining = Math.max(0, until - now);
    const seconds = Math.ceil(remaining / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return { active: remaining > 0, expired: remaining === 0, seconds,
        fraction: remaining === 0 ? 0 : Math.min(1, remaining / Math.max(remaining, observedDuration)),
        text: [hours, minutes, secs].map(value => String(value).padStart(2, '0')).join(':') };
}
