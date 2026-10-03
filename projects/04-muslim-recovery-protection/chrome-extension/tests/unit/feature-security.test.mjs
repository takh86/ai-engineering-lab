import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeatureController } from '../../src/background/feature-controller.js';
import { defaultVault, SECURITY_LIMITS } from '../../src/core/security.js';

function fixture(initial = {}) {
    const store = structuredClone(initial);
    let failRead = false;
    const storage = {
        getAll: async () => { if (failRead) throw new Error('secret storage text'); return structuredClone(store); },
        set: async items => Object.assign(store, structuredClone(items)),
        remove: async keys => { for (const key of keys) delete store[key]; }
    };
    const api = id => ({ storage, instanceId: id, id: 'ext', baseUrl: 'chrome-extension://ext/', now: () => Date.now(), clock: () => Date.now(), sleep: ms => new Promise(resolve => setTimeout(resolve, ms)) });
    return { store, api, controller: createFeatureController(api('A')), failReads: value => { failRead = value; } };
}
const send = (controller, type, fields = {}, sender) => controller.handle({ type, ...fields }, sender);
const success = reply => { assert.equal(reply.ok, true, JSON.stringify(reply)); return reply; };
const error = (reply, code) => { assert.deepEqual(reply, { ok: false, error: { code, params: {} } }); };
const sender = page => ({ id: 'ext', frameId: 0, url: `chrome-extension://ext/${page}` });
const current = store => Object.entries(store).filter(([key]) => key.startsWith('feature:')).sort((a, b) => Number(b[0].split(':')[1]) - Number(a[0].split(':')[1]))[0];
const covenant = { purpose: 'My private purpose', harms: 'Personally relevant harms', values: 'Family', needs: ['stress'], plan: 'لو توترت فسوف أتنفس' };

test('public initialization sets independent faith and prayer off; partial preferences preserve siblings', async () => {
    const { controller } = fixture();
    let reply = success(await send(controller, 'GET_PUBLIC_PROFILE'));
    assert.equal(reply.profile.prayer.enabled, false);
    assert.deepEqual(reply.security, { enabled: false, locked: false, encrypted: false });
    reply = success(await send(controller, 'SAVE_PUBLIC_PROFILE', { profile: { language: 'de', religion: 'muslim' } }));
    assert.equal(reply.profile.faith, true);
    reply = success(await send(controller, 'SAVE_PUBLIC_PROFILE', { profile: { faith: false, theme: 'dark' } }));
    assert.equal(reply.profile.religion, 'muslim'); assert.equal(reply.profile.language, 'de'); assert.equal(reply.profile.faith, false);
    error(await send(controller, 'SAVE_PUBLIC_PROFILE', { profile: { religion: 'other' } }), 'bad_request');
    error(await send(controller, 'SAVE_PUBLIC_PROFILE', { profile: { prayer: { enabled: true } } }), 'bad_request');
});

test('private partial patches preserve other fields and no-password metadata honestly marks clear records', async () => {
    const { controller, store } = fixture();
    success(await send(controller, 'SAVE_PRIVATE_DATA', { data: { covenant, notes: 'a private draft' } }));
    success(await send(controller, 'SAVE_PRIVATE_DATA', { data: { favorites: ['step-1'], unsuitable: ['step-2'] } }));
    const data = success(await send(controller, 'GET_PRIVATE_DATA')).data;
    assert.deepEqual(data.covenant, covenant); assert.equal(data.notes, 'a private draft'); assert.deepEqual(data.favorites, ['step-1']);
    assert.equal(current(store)[1].vault.encrypted, false);
    assert.equal(JSON.stringify(store).includes('a private draft'), true);
});

test('password encrypts the complete vault, restart locks, wrong password is safe, and verifier does not unlock', async () => {
    const { controller, store, api } = fixture({ 'lock:99:A': { until: 888888 }, 'cfg:99:A': { revision: 1, onboarded: false } });
    const protectionBefore = structuredClone({ lock: store['lock:99:A'], config: store['cfg:99:A'] });
    success(await send(controller, 'SAVE_PRIVATE_DATA', { data: { covenant, notes: 'SECRET-NOTE' } }));
    const setup = success(await send(controller, 'SET_PASSWORD', { password: 'correct-password' }));
    assert.match(setup.recoveryCode, /^[A-Za-z0-9_-]{43}$/u);
    assert.equal(JSON.stringify(store).includes('SECRET-NOTE'), false);
    assert.equal(JSON.stringify(store).includes('My private purpose'), false);
    assert.equal(JSON.stringify(store).includes('correct-password'), false);
    assert.equal(JSON.stringify(store).includes(setup.recoveryCode), false);
    assert.deepEqual({ lock: store['lock:99:A'], config: store['cfg:99:A'] }, protectionBefore);
    const restarted = createFeatureController(api('B'));
    assert.equal(success(await send(restarted, 'GET_PUBLIC_PROFILE')).security.locked, true);
    error(await send(restarted, 'GET_PRIVATE_DATA'), 'access_locked');
    error(await send(restarted, 'UNLOCK', { password: 'wrong-password' }), 'invalid_password');
    assert.equal(await restarted.verifyPassword('correct-password'), true);
    error(await send(restarted, 'GET_PRIVATE_DATA'), 'access_locked');
    success(await send(restarted, 'UNLOCK', { password: 'correct-password' }));
    assert.equal(success(await send(restarted, 'GET_PRIVATE_DATA')).data.notes, 'SECRET-NOTE');
    success(await send(restarted, 'LOCK_ACCESS'));
    await assert.rejects(restarted.authorize({ type: 'GET_EXPORT' }), err => err.code === 'access_locked');
    for (const type of ['BLOCK_CURRENT_SITE', 'START_SESSION', 'GET_STATUS', 'REPAIR', 'CONFIRM_EARLY_EXIT']) assert.equal(await restarted.authorize({ type }), true);
});

test('prior recovery code rotates once, preserves private and protection records, and invalidates other worker sessions', async () => {
    const { controller, store, api } = fixture({ 'lock:8:A': { until: 12345 }, 'cfg:8:A': { revision: 2, onboarded: true, baseList: true } });
    success(await send(controller, 'SAVE_PRIVATE_DATA', { data: { covenant, notes: 'retained', reviews: [{ stageNeeds: ['fatigue'], task: '', care: '', trigger: '', ifText: '', thenText: '', createdAt: 42 }] } }));
    const initial = success(await send(controller, 'SET_PASSWORD', { password: 'old-password' }));
    const other = createFeatureController(api('B'));
    success(await send(other, 'UNLOCK', { password: 'old-password' }));
    const generation = await other.getPasswordGeneration();
    success(await send(controller, 'LOCK_ACCESS'));
    error(await send(controller, 'RECOVER_PASSWORD', { recoveryCode: 'Z'.repeat(43), password: 'new-password' }), 'invalid_recovery');
    const recovered = success(await send(controller, 'RECOVER_PASSWORD', { recoveryCode: initial.recoveryCode, password: 'new-password' }));
    assert.notEqual(recovered.recoveryCode, initial.recoveryCode);
    assert.notEqual(await controller.getPasswordGeneration(), generation);
    error(await send(controller, 'RECOVER_PASSWORD', { recoveryCode: initial.recoveryCode, password: 'third-password' }), 'invalid_recovery');
    assert.equal(await controller.verifyPassword('old-password'), false);
    assert.equal(await controller.verifyPassword('new-password'), true);
    error(await send(other, 'GET_PRIVATE_DATA'), 'access_locked');
    assert.equal(success(await send(controller, 'GET_PRIVATE_DATA')).data.notes, 'retained');
    assert.deepEqual(store['lock:8:A'], { until: 12345 }); assert.equal(store['cfg:8:A'].baseList, true);
});

test('large valid encrypted records survive persistence, locking and worker restart (base64 expansion regression)', async () => {
    const { controller, api } = fixture();
    success(await send(controller, 'SET_PASSWORD', { password: 'large-password' }));
    const customSteps = Array.from({ length: 60 }, (_, index) => ({ id: `custom-${index}`, text: 'x'.repeat(3500), needs: [] }));
    success(await send(controller, 'SAVE_PRIVATE_DATA', { data: { customSteps } }));
    const restarted = createFeatureController(api('B'));
    success(await send(restarted, 'UNLOCK', { password: 'large-password' }));
    assert.deepEqual(success(await send(restarted, 'GET_PRIVATE_DATA')).data.customSteps, customSteps);
    error(await send(restarted, 'SAVE_PRIVATE_DATA', { data: { customSteps: Array.from({ length: 100 }, (_, index) => ({ id: `oversize-${index}`, text: 'x'.repeat(4000), needs: [] })) } }), 'bad_request');
    assert.deepEqual(success(await send(restarted, 'GET_PRIVATE_DATA')).data.customSteps, customSteps);
});

test('hostile schema, accessors, cycles, inherited types and unbounded data are refused without evaluating getters', async () => {
    const { controller, store } = fixture();
    let getterRan = false;
    const getter = { type: 'SAVE_PRIVATE_DATA', get data() { getterRan = true; return {}; } };
    error(await controller.handle(getter), 'bad_request'); assert.equal(getterRan, false);
    const typeGetter = { get type() { getterRan = true; return 'GET_PRIVATE_DATA'; } };
    error(await controller.handle(typeGetter), 'bad_request'); assert.equal(getterRan, false);
    for (const data of [JSON.parse('{"__proto__":{}}'), { notes: 'x'.repeat(SECURITY_LIMITS.notes + 1) }, { extra: 'secret' }, { favorites: ['a', 'a'] }, { customSteps: [{ id: 'bad id', text: '', needs: [] }] }]) error(await send(controller, 'SAVE_PRIVATE_DATA', { data }), 'bad_request');
    const cycle = { notes: '' }; cycle.notes = cycle;
    error(await send(controller, 'SAVE_PRIVATE_DATA', { data: cycle }), 'bad_request');
    error(await send(controller, 'SET_PASSWORD', { password: 'short' }), 'password_invalid');
    assert.equal(Object.keys(store).filter(key => key.startsWith('feature:')).length, 0);
    assert.equal({}.polluted, undefined);
});

test('corrupt stored state and unreadable storage fail closed without preventing strengthening', async () => {
    const { controller, store, failReads } = fixture();
    success(await send(controller, 'SET_PASSWORD', { password: 'test-password' }));
    current(store)[1].security.password.verifier = 'invalid';
    error(await send(controller, 'GET_PUBLIC_PROFILE'), 'security_corrupt');
    error(await send(controller, 'UNLOCK', { password: 'test-password' }), 'security_corrupt');
    await assert.rejects(controller.authorize({ type: 'RESET' }), err => err.code === 'security_corrupt');
    assert.equal(await controller.authorize({ type: 'BLOCK_CURRENT_SITE' }), true);
    const filtered = await controller.filterStatus({ ok: true, status: { state: 'active', settings: { secret: true } } });
    assert.equal(filtered.security.locked, true); assert.equal(filtered.status.settings, undefined);
    failReads(true);
    error(await send(controller, 'GET_PRIVATE_DATA'), 'storage_error');
    assert.equal(await controller.verifyPassword('test-password'), false);
});

test('ciphertext modification does not open the private session', async () => {
    const { controller, store, api } = fixture();
    success(await send(controller, 'SET_PASSWORD', { password: 'test-password' }));
    const vault = current(store)[1].vault;
    vault.ciphertext = `${vault.ciphertext[0] === 'A' ? 'B' : 'A'}${vault.ciphertext.slice(1)}`;
    const restarted = createFeatureController(api('B'));
    error(await send(restarted, 'UNLOCK', { password: 'test-password' }), 'security_corrupt');
    error(await send(restarted, 'GET_PRIVATE_DATA'), 'access_locked');
});

test('locked status strips private fields and schedule rows but retains actual deadline and honest core status', async () => {
    const { controller } = fixture();
    success(await send(controller, 'SET_PASSWORD', { password: 'test-password' })); await send(controller, 'LOCK_ACCESS');
    const filtered = await controller.filterStatus({ ok: true, text: 'SECRET EXPORT', status: {
        state: 'active', settings: { domains: ['secret.example'] }, config: { secret: true }, unknownPrivate: 'SECRET', counts: { words: 1 },
        schedules: { items: [{ name: 'private' }], active: true, configured: true, nextChange: 900 },
        commitment: { active: true, until: 1000, exitDelay: 60, request: { readyAt: 800, waiting: true }, storageKeys: ['secret'] },
        lock: { active: true, until: 1000 }, base: { enabled: true }
    } });
    assert.equal(JSON.stringify(filtered).includes('SECRET'), false); assert.equal(JSON.stringify(filtered).includes('secret'), false);
    assert.deepEqual(filtered.status.schedules, { active: true, configured: true, nextChange: 900 });
    assert.equal(filtered.status.lock.until, 1000); assert.equal(filtered.status.base.enabled, true);
    assert.deepEqual(filtered.status.commitment.request, { readyAt: 800, waiting: true });
});

test('one-time onboarding bypass cannot be replayed after configured setup', async () => {
    const { controller } = fixture();
    success(await send(controller, 'SET_PASSWORD', { password: 'test-password' })); await send(controller, 'LOCK_ACCESS');
    success(await send(controller, 'SAVE_PUBLIC_PROFILE', { profile: { language: 'en', religion: 'non-muslim' } }));
    error(await send(controller, 'SAVE_PUBLIC_PROFILE', { profile: { language: 'ar', religion: 'muslim' } }), 'access_locked');
    error(await send(controller, 'SET_PASSWORD', { password: 'replace-password' }), 'access_locked');
});

test('page capabilities permit only explicit bounded help/recovery/covenant records and public blocked profile', async () => {
    const { controller } = fixture();
    success(await send(controller, 'SAVE_PRIVATE_DATA', { data: { notes: 'private notes', covenant } }));
    success(await send(controller, 'GET_PUBLIC_PROFILE', {}, sender('blocked.html')));
    error(await send(controller, 'GET_PRIVATE_DATA', {}, sender('blocked.html')), 'bad_request');
    const help = success(await send(controller, 'GET_PRIVATE_DATA', {}, sender('help.html'))).data;
    assert.deepEqual(Object.keys(help).sort(), ['customSteps', 'favorites', 'unsuitable']);
    error(await send(controller, 'SAVE_PRIVATE_DATA', { data: { notes: 'no' } }, sender('help.html')), 'bad_request');
    success(await send(controller, 'SAVE_PRIVATE_DATA', { data: { favorites: ['step-1'] } }, sender('help.html')));
    error(await send(controller, 'SET_PASSWORD', { password: 'test-password' }, sender('covenant.html')), 'bad_request');
    await assert.rejects(controller.authorize({ type: 'START_SESSION' }, sender('recovery.html')), err => err.code === 'bad_request');
    error(await send(controller, 'GET_PUBLIC_PROFILE', {}, { ...sender('options.html'), id: 'other' }), 'bad_request');
});

test('concurrent public and private patches from two workers preserve unrelated edits; storage remains bounded', async () => {
    const { controller, api, store } = fixture();
    const other = createFeatureController(api('B'));
    const replies = await Promise.all([
        send(controller, 'SAVE_PUBLIC_PROFILE', { profile: { theme: 'dark' } }),
        send(other, 'SAVE_PUBLIC_PROFILE', { profile: { language: 'en' } }),
        send(controller, 'SAVE_PRIVATE_DATA', { data: { notes: 'retained' } }),
        send(other, 'SAVE_PRIVATE_DATA', { data: { favorites: ['step-1'] } })
    ]);
    replies.forEach(success);
    const profile = success(await send(controller, 'GET_PUBLIC_PROFILE')).profile;
    assert.equal(profile.theme, 'dark'); assert.equal(profile.language, 'en');
    const data = success(await send(other, 'GET_PRIVATE_DATA')).data;
    assert.equal(data.notes, 'retained'); assert.deepEqual(data.favorites, ['step-1']);
    for (let i = 0; i < 10; i++) success(await send(controller, 'GET_PUBLIC_PROFILE'));
    assert.equal(Object.keys(store).filter(key => key.startsWith('feature:')).length, 1);
    assert.equal(Object.keys(store).filter(key => key.startsWith('ep:')).length, 1);
});

test('permission-loss setter only disables prayer and lock-free profile snapshots cannot mutate stored data', async () => {
    const { controller } = fixture();
    success(await send(controller, 'SAVE_PUBLIC_PROFILE', { profile: { prayer: { enabled: true, latitude: 30, longitude: 31, city: 'Cairo', timeZone: 'Africa/Cairo' } } }));
    success(await send(controller, 'SET_PASSWORD', { password: 'test-password' })); await send(controller, 'LOCK_ACCESS');
    const snapshot = await controller.readPublicProfileSnapshot(); snapshot.language = 'de'; snapshot.prayer.enabled = false;
    assert.equal((await controller.readPublicProfileSnapshot()).prayer.enabled, true);
    await assert.rejects(controller.setPrayerEnabled(true), err => err.code === 'bad_request');
    success(await controller.setPrayerEnabled(false));
    assert.equal((await controller.readPublicProfileSnapshot()).prayer.enabled, false);
    assert.equal((await controller.readPublicProfileSnapshot()).language, 'ar');
    assert.deepEqual(success(await send(controller, 'GET_PUBLIC_PROFILE')).security, { enabled: true, locked: true, encrypted: true });
});
