import { TabsiraError, toErrorPayload } from '../core/errors.js';
import { boundedJson, object, plain, fail, defaultProfile, defaultVault, parseProfile, parseVault, validatePassword, SECURITY_LIMITS } from '../core/security.js';
import { validateCredentials, validateEncrypted, credentialIdentity, checkPassword, unlockKey, createCredentials, encryptVault, decryptVault } from '../core/security-crypto.js';
import { newestConfig } from '../core/records.js';
import { createWriteMutex } from './coordination.js';

const PREFIX = 'feature:';
const RECORD = /^feature:(\d{1,15}):([A-Za-z0-9_-]{1,64})$/u;
const FEATURE_TYPES = new Set(['GET_PUBLIC_PROFILE', 'SAVE_PUBLIC_PROFILE', 'GET_PRIVATE_DATA', 'SAVE_PRIVATE_DATA', 'SET_PASSWORD', 'UNLOCK', 'LOCK_ACCESS', 'RECOVER_PASSWORD']);
const ACCESSIBLE = new Set(['GET_STATUS', 'REPAIR', 'BLOCK_CURRENT_SITE', 'START_SESSION', 'CONFIRM_EARLY_EXIT', 'GET_PUBLIC_PROFILE', 'UNLOCK', 'LOCK_ACCESS', 'RECOVER_PASSWORD']);
const FULL_PAGES = new Set(['popup.html', 'options.html', 'onboarding.html']);
const PRIVATE_FIELDS = { 'help.html': ['customSteps', 'favorites', 'unsuitable'], 'recovery.html': ['reviews'], 'covenant.html': ['covenant'] };

/** Local preferences and private records. No network, protection writes, storage.clear(), or persisted unlock state. */
export function createFeatureController(api, { mutex: mutexOptions } = {}) {
    // Separate mutex identity: the protection controller uses api.instanceId too, with an independent queue.
    const writer = { ...api, instanceId: `${api.instanceId}_feature` };
    const mutex = createWriteMutex(writer, mutexOptions);
    let queue = Promise.resolve();
    let session = null;
    const serialize = task => {
        const run = queue.then(task, task);
        queue = run.then(() => {}, () => {});
        return run;
    };
    const fresh = () => ({ version: 1, initialized: false, profile: defaultProfile(), security: null, vault: { encrypted: false, data: defaultVault() } });
    function validateState(value) {
        boundedJson(value, SECURITY_LIMITS.bytes * 2);
        object(value, ['version', 'initialized', 'profile', 'security', 'vault'], ['version', 'initialized', 'profile', 'security', 'vault']);
        if (value.version !== 1 || typeof value.initialized !== 'boolean') fail();
        object(value.profile, Object.keys(defaultProfile()), Object.keys(defaultProfile()));
        object(value.profile.prayer, Object.keys(defaultProfile().prayer), Object.keys(defaultProfile().prayer));
        const profile = parseProfile(value.profile);
        if (value.security === null) {
            object(value.vault, ['encrypted', 'data'], ['encrypted', 'data']);
            if (value.vault.encrypted !== false) fail();
            object(value.vault.data, Object.keys(defaultVault()), Object.keys(defaultVault()));
            return { ...value, profile, vault: { encrypted: false, data: parseVault(value.vault.data) } };
        }
        validateCredentials(value.security);
        object(value.vault, ['encrypted', 'iv', 'ciphertext'], ['encrypted', 'iv', 'ciphertext']);
        if (value.vault.encrypted !== true) fail();
        validateEncrypted({ iv: value.vault.iv, ciphertext: value.vault.ciphertext });
        return { ...value, profile };
    }
    async function read(compact = true) {
        let all;
        try { all = await api.storage.getAll(); } catch { session = null; fail('storage_error'); }
        const records = [];
        for (const [key, value] of Object.entries(all)) {
            if (!key.startsWith(PREFIX)) continue;
            const match = RECORD.exec(key);
            if (!match || Number(match[1]) >= 1e15) { session = null; fail('security_corrupt'); }
            records.push({ key, epoch: Number(match[1]), id: match[2], value });
        }
        records.sort((a, b) => b.epoch - a.epoch || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
        let state;
        try { state = records.length ? validateState(records[0].value) : fresh(); }
        catch { session = null; fail('security_corrupt'); }
        if (session && credentialIdentity(state.security) !== session.identity) session = null;
        // A suspended writer may leave a dominated record later. Reconcile it on reads too; old immutable names never win.
        if (compact && records.length > 1) await api.storage.remove(records.slice(1).map(record => record.key));
        return { state, records, all };
    }
    const metadata = state => ({ enabled: state.security !== null, locked: state.security !== null && !session, encrypted: state.vault.encrypted });
    const requireAccess = state => { if (state.security && !session) fail('access_locked'); };
    async function privateData(state) {
        requireAccess(state);
        if (!state.security) return parseVault(state.vault.data);
        try { return parseVault(await decryptVault(session.key, state.vault)); }
        catch { session = null; fail('security_corrupt'); }
    }
    async function write(state) {
        // Generated ciphertext expands cleartext; refuse an invalid envelope before replacing any good state.
        validateState(state);
        await mutex.assertOwner();
        const key = `${PREFIX}${mutex.epoch()}:${writer.instanceId}`;
        await api.storage.set({ [key]: state });
        await mutex.assertOwner();
        const current = await read();
        if (current.records[0]?.key !== key) fail('busy');
        // All older names are immutable and permanently dominated. Delayed deletion cannot delete a later state.
        const stale = current.records.slice(1).map(record => record.key);
        if (stale.length) await api.storage.remove(stale);
        return current.state;
    }
    function capability(message, sender) {
        if (!sender) return; // Internal callers and unit doubles; the worker validates real senders before dispatch.
        let page;
        try {
            const url = new URL(sender.url);
            if (sender.id !== api.id || (sender.frameId !== undefined && sender.frameId !== 0) || !sender.url.startsWith(api.baseUrl)) fail();
            page = url.pathname.slice(1);
        } catch { fail('bad_request'); }
        if (FULL_PAGES.has(page)) return;
        if (message.type === 'GET_PUBLIC_PROFILE' && ['blocked.html', ...Object.keys(PRIVATE_FIELDS)].includes(page)) return;
        const fields = PRIVATE_FIELDS[page];
        if (!fields) fail('bad_request');
        if (message.type === 'GET_PRIVATE_DATA') return;
        if (message.type === 'SAVE_PRIVATE_DATA') {
            object(message.data, fields);
            return;
        }
        fail('bad_request');
    }
    function validateMessage(message) {
        boundedJson(message);
        object(message, ['type', 'profile', 'data', 'password', 'recoveryCode'], ['type']);
        const schemas = {
            GET_PUBLIC_PROFILE: ['type'], SAVE_PUBLIC_PROFILE: ['type', 'profile'], GET_PRIVATE_DATA: ['type'], SAVE_PRIVATE_DATA: ['type', 'data'],
            SET_PASSWORD: ['type', 'password'], UNLOCK: ['type', 'password'], LOCK_ACCESS: ['type'], RECOVER_PASSWORD: ['type', 'recoveryCode', 'password']
        };
        const keys = schemas[message.type];
        if (!keys) fail();
        object(message, keys, keys);
        if (message.type === 'SAVE_PUBLIC_PROFILE') { object(message.profile, Object.keys(defaultProfile())); if (!Object.keys(message.profile).length) fail(); }
        if (message.type === 'SAVE_PRIVATE_DATA') { object(message.data, Object.keys(defaultVault())); if (!Object.keys(message.data).length) fail(); }
        if (['UNLOCK', 'SET_PASSWORD', 'RECOVER_PASSWORD'].includes(message.type)) validatePassword(message.password);
    }
    async function process(message, sender) {
        validateMessage(message);
        capability(message, sender);
        if (message.type === 'LOCK_ACCESS') { session = null; return { ok: true }; }
        const execute = async () => {
            const { state, all } = await read();
            switch (message.type) {
                case 'GET_PUBLIC_PROFILE': return { ok: true, profile: state.profile, security: metadata(state) };
                case 'GET_PRIVATE_DATA': {
                    let data = await privateData(state);
                    if (sender) {
                        const fields = PRIVATE_FIELDS[new URL(sender.url).pathname.slice(1)];
                        if (fields) data = Object.fromEntries(fields.map(key => [key, data[key]]));
                    }
                    return { ok: true, data };
                }
                case 'SAVE_PUBLIC_PROFILE': {
                    const profilePatch = message.profile;
                    const first = !state.initialized && !newestConfig(all)?.value?.onboarded && Object.hasOwn(profilePatch, 'language')
                        && ['muslim', 'non-muslim'].includes(profilePatch.religion);
                    if (!first) requireAccess(state);
                    // First setup can never activate prayer notifications or mutate private data while locked.
                    if (first && state.security && !session && profilePatch.prayer?.enabled) fail('access_locked');
                    const patch = first && !Object.hasOwn(profilePatch, 'faith') ? { ...profilePatch, faith: profilePatch.religion === 'muslim' } : profilePatch;
                    const profile = parseProfile(patch, state.profile);
                    const next = await write({ ...state, initialized: state.initialized || first, profile });
                    return { ok: true, profile: next.profile, security: metadata(next) };
                }
                case 'SAVE_PRIVATE_DATA': {
                    const data = parseVault({ ...await privateData(state), ...message.data });
                    const vault = state.security ? { encrypted: true, ...await encryptVault(session.key, data) } : { encrypted: false, data };
                    await write({ ...state, vault });
                    return { ok: true, security: metadata(state) };
                }
                case 'UNLOCK': {
                    if (!state.security) return { ok: true, security: metadata(state) };
                    const candidate = await unlockKey(state.security, message.password);
                    // Authenticate both ciphertext and its schema before opening a session.
                    try { parseVault(await decryptVault(candidate.key, state.vault)); } catch { fail('security_corrupt'); }
                    session = { ...candidate, identity: credentialIdentity(state.security) };
                    return { ok: true, security: metadata(state) };
                }
                case 'SET_PASSWORD': case 'RECOVER_PASSWORD': {
                    let bytes;
                    let data;
                    if (message.type === 'RECOVER_PASSWORD') {
                        if (!state.security) fail('recovery_unavailable');
                        const candidate = await unlockKey(state.security, message.recoveryCode, true);
                        bytes = candidate.bytes;
                        try { data = parseVault(await decryptVault(candidate.key, state.vault)); } catch { fail('security_corrupt'); }
                    } else {
                        data = await privateData(state);
                        bytes = session?.bytes;
                    }
                    const credentials = await createCredentials(message.password, bytes);
                    const next = { ...state, security: credentials.security, vault: { encrypted: true, ...await encryptVault(credentials.key, data) } };
                    await write(next);
                    session = { key: credentials.key, bytes: credentials.bytes, identity: credentialIdentity(credentials.security) };
                    return { ok: true, recoveryCode: credentials.recoveryCode, security: metadata(next) };
                }
                default: fail();
            }
        };
        // Reads and unlocks also hold the cross-worker lock so password changes cannot race an unlock.
        return mutex.run(async () => {
            const result = await execute();
            // Bound fencing metadata even when a worker is only reading public/help preferences.
            const all = await api.storage.getAll();
            const epochs = Object.keys(all).filter(key => /^ep:\d{1,15}:[A-Za-z0-9_-]{1,64}$/u.test(key))
                .sort((a, b) => Number(b.split(':')[1]) - Number(a.split(':')[1]) || (a < b ? 1 : -1));
            if (epochs.length > 1) await api.storage.remove(epochs.slice(1));
            return result;
        });
    }
    async function handle(message, sender) {
        if (!plain(message)) return undefined;
        const type = Object.getOwnPropertyDescriptor(message, 'type');
        if (type && !('value' in type)) return { ok: false, error: { code: 'bad_request', params: {} } };
        if (typeof type?.value !== 'string' || !FEATURE_TYPES.has(type.value)) return undefined;
        return serialize(async () => {
            try { return await process(message, sender); }
            catch (error) { return { ok: false, error: toErrorPayload(error instanceof TabsiraError ? error : new TabsiraError('storage_error')) }; }
        });
    }
    async function authorize(message, sender) {
        capability(message, sender);
        if (ACCESSIBLE.has(message?.type)) return true;
        const { state } = await read();
        requireAccess(state);
        return true;
    }
    async function filterStatus(reply) {
        let security;
        try { security = metadata((await read()).state); }
        catch { security = { enabled: true, locked: true, encrypted: false, unavailable: true }; }
        const filtered = { ...reply, security };
        if (security.locked) {
            const redact = status => {
                if (!status || typeof status !== 'object') return status;
                // Allowlisted public protection status. Future private fields are hidden by default.
                const allowed = ['ok', 'error', 'state', 'reasons', 'reason', 'revision', 'protection', 'coverage', 'session', 'lock', 'commitment', 'schedules', 'lockedUntil', 'sessionUntil', 'until', 'countdown', 'onboarded', 'permissions', 'incognitoAllowed', 'base', 'sessionMinutes', 'limits', 'scheduled', 'security'];
                const result = Object.fromEntries(Object.entries(status).filter(([key]) => allowed.includes(key)));
                for (const key of ['protection', 'session', 'lock', 'commitment', 'schedules', 'scheduled']) {
                    if (result[key] && typeof result[key] === 'object') {
                        const publicKeys = ['state', 'active', 'until', 'deadline', 'remaining', 'remainingMs', 'remainingMinutes', 'exitDelay', 'configured', 'nextChange', 'enabled', 'coreEnabled', 'baseListEnabled', 'honest', 'locked', 'kind'];
                        result[key] = Object.fromEntries(Object.entries(result[key]).filter(([name]) => publicKeys.includes(name)));
                    }
                }
                if (status.commitment?.request) result.commitment.request = { readyAt: status.commitment.request.readyAt, waiting: status.commitment.request.waiting };
                return { ...result, security };
            };
            if (Object.hasOwn(filtered, 'status')) return { ok: filtered.ok, ...(filtered.error ? { error: filtered.error } : {}), status: redact(filtered.status), security };
            return redact(filtered);
        }
        if (filtered.status && typeof filtered.status === 'object') filtered.status = { ...filtered.status, security };
        return filtered;
    }
    async function verifyPassword(password) {
        return serialize(async () => {
            try {
                return await mutex.run(async () => {
                    const { state } = await read();
                    return !!state.security && await checkPassword(state.security, password);
                });
            } catch { return false; }
        });
    }
    async function setPrayerEnabled(enabled) {
        if (enabled !== false) fail('bad_request');
        return serialize(() => mutex.run(async () => {
            const { state } = await read();
            if (state.profile.prayer.enabled) await write({ ...state, profile: parseProfile({ prayer: { enabled: false } }, state.profile) });
            return { ok: true };
        }));
    }
    // Internal snapshots only: called under other controllers' shared write lock; never exposed as messages.
    const getPasswordGeneration = async () => credentialIdentity((await read(false)).state.security) || null;
    const readPublicProfileSnapshot = async () => structuredClone((await read(false)).state.profile);
    return { handle, authorize, filterStatus, verifyPassword, getPasswordGeneration, readPublicProfileSnapshot, setPrayerEnabled };
}
