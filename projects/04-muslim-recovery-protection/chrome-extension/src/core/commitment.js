import { TabsiraError } from './errors.js';

export const COMMITMENT_LIMITS = Object.freeze({ minMinutes: 10, maxMinutes: 525600, minExitDelay: 60, maxExitDelay: 525600, maxReleases: 4096, maxLockKeyLength: 160 });
export const validMinutes = value => Number.isInteger(value) && value >= COMMITMENT_LIMITS.minMinutes && value <= COMMITMENT_LIMITS.maxMinutes;
export const validExitDelay = value => Number.isInteger(value) && value >= COMMITMENT_LIMITS.minExitDelay && value <= COMMITMENT_LIMITS.maxExitDelay;
export const defaultCommitment = () => ({ exitDelay: 60, request: null, releases: [] });
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// Never prune cancellation names merely because they disappeared from a storage snapshot.
// A frozen earlier write can reappear later. Saturation refuses another early release,
// retaining all previous cancellations; natural expiry and protection remain available.
const validLockName = key => typeof key === 'string' && key.length <= COMMITMENT_LIMITS.maxLockKeyLength
    && (key === 'lock' || /^lock:[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]{1,64})?$/u.test(key));
export function addReleases(previous, keys) {
    const releases = [...new Set([...previous, ...keys])];
    if (releases.length > COMMITMENT_LIMITS.maxReleases) throw new TabsiraError('commitment_release_limit');
    if (releases.some(key => !validLockName(key))) throw new TabsiraError('config_corrupt');
    return releases;
}

export function parseCommitment(raw) {
    if (!exact(raw, ['exitDelay', 'request', 'releases']) || !validExitDelay(raw.exitDelay) || !Array.isArray(raw.releases)
        || raw.releases.length > COMMITMENT_LIMITS.maxReleases || new Set(raw.releases).size !== raw.releases.length || raw.releases.some(key => !validLockName(key))) throw new TabsiraError('config_corrupt');
    const request = raw.request;
    if (request !== null && (!exact(request, ['readyAt', 'until', 'keys'])
        || !Number.isSafeInteger(request.readyAt) || request.readyAt < 0 || request.readyAt >= 8.64e15
        || !Number.isSafeInteger(request.until) || request.until <= 0 || request.until >= 8.64e15
        || !Array.isArray(request.keys) || !request.keys.length || request.keys.length > COMMITMENT_LIMITS.maxReleases
        || new Set(request.keys).size !== request.keys.length
        || request.keys.some(key => !validLockName(key)))) throw new TabsiraError('config_corrupt');
    return { exitDelay: raw.exitDelay, releases: [...raw.releases], request: request === null ? null : { readyAt: request.readyAt, until: request.until, keys: [...request.keys] } };
}

export function commitmentStatus(config, lock, now) {
    const active = lock.until > now;
    const request = active && config.commitment.request?.until === lock.until ? config.commitment.request : null;
    return { active, until: lock.until, exitDelay: Math.max(config.commitment.exitDelay, lock.exitDelay ?? 60),
        request: request ? { readyAt: request.readyAt, waiting: now < request.readyAt } : null, limits: COMMITMENT_LIMITS };
}
