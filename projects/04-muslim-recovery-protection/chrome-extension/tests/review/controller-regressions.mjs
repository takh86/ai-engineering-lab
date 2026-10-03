import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
const read = relative => import(pathToFileURL(resolve(dir, relative)).href);
const { createFakeBrowser } = await read('tests/unit/fake-browser.mjs');
const { createFeatureController } = process.argv[3] ? await import(pathToFileURL(resolve(process.argv[3], 'src/background/feature-controller.js')).href) : await read('src/background/feature-controller.js');
const { createController } = await read('src/background/controller.js');
const { createPrayerController } = await read('src/background/prayer-controller.js');
const { calculatePrayerTimes, prayerDate, defaultPrayer } = await read('src/core/prayer.js');
const { storedConfig } = await read('tests/unit/fake-browser.mjs');
const featureFor = api => createFeatureController(api, { mutex: { waitMs: 100, pollMs: 1 } });
const results = [];
async function scenario(name, run) {
    const start = Date.now();
    try { await run(); results.push({ name, result: 'PASS', ms: Date.now() - start }); }
    catch (error) { results.push({ name, result: 'FAIL', ms: Date.now() - start, error: error.message }); }
}
const okay = reply => { assert.equal(reply.ok, true, JSON.stringify(reply)); return reply; };
const setup = async ctrl => okay(await ctrl.handle({ type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: false }));
const start = async (ctrl, minutes = 180) => okay(await ctrl.handle({ type: 'START_SESSION', minutes, exitDelay: 60 }));

await scenario('RT1 valid password confirms mature explicit early exit (actual feature controller)', async () => {
    const { api, state } = createFakeBrowser(); const feature = featureFor(api); const ctrl = createController(api, { featureController: feature });
    okay(await feature.handle({ type: 'SET_PASSWORD', password: 'validpassword' }));
    await setup(ctrl); await start(ctrl); okay(await ctrl.handle({ type: 'REQUEST_EARLY_EXIT' })); state.now += 61 * 60000;
    const reply = okay(await ctrl.handle({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' })); assert.equal(reply.status.lock.active, false);
});

await scenario('RT2 released older long lock cannot delete shorter new commitment (verifier stub isolates protection)', async () => {
    const { api, state } = createFakeBrowser(); const ctrl = createController(api, { featureController: { verifyPassword: async () => true, getPasswordGeneration: async () => 'stub-credential-generation' } });
    await setup(ctrl); await start(ctrl); okay(await ctrl.handle({ type: 'REQUEST_EARLY_EXIT' })); state.now += 61 * 60000;
    okay(await ctrl.handle({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' })); await start(ctrl, 60);
    const reply = okay(await ctrl.handle({ type: 'GET_STATUS' })); assert.equal(reply.status.lock.active, true); assert.equal(reply.status.lock.until, state.now + 60 * 60000);
});

await scenario('RT3 eligible opted-in prayer alarm delivers notification (actual feature controller)', async () => {
    const { api, state } = createFakeBrowser(); let notices = 0;
    api.alarms = { getAll: async () => [], clear: async () => true, create: async () => {} }; api.notifications = { create: async () => { notices++; } };
    const feature = featureFor(api); const p = { ...defaultPrayer(), enabled: true, latitude: 30, longitude: 31, timeZone: 'UTC', prayers: ['dhuhr'] };
    okay(await feature.handle({ type: 'SAVE_PUBLIC_PROFILE', profile: { religion: 'muslim', faith: true, prayer: p } })); const prayer = createPrayerController(api, feature);
    const date = prayerDate(state.now, p.timeZone), when = calculatePrayerTimes(date, p).times.dhuhr; state.now = when;
    await prayer.onAlarm({ name: `tabsira-prayer:${date}:dhuhr:${when}` }); assert.equal(notices, 1);
});

await scenario('RT4 valid large private records remain readable after encrypted save/restart/recovery', async () => {
    const { api } = createFakeBrowser(); let feature = featureFor(api);
    const recoveryCode = okay(await feature.handle({ type: 'SET_PASSWORD', password: 'validpassword' })).recoveryCode;
    const data = { customSteps: Array.from({ length: 60 }, (_, i) => ({ id: `idea_${i}`, text: 'x'.repeat(3500), needs: [] })) };
    okay(await feature.handle({ type: 'SAVE_PRIVATE_DATA', data }));
    feature = featureFor({ ...api, instanceId: 'restart' }); okay(await feature.handle({ type: 'UNLOCK', password: 'validpassword' }));
    assert.deepEqual(okay(await feature.handle({ type: 'GET_PRIVATE_DATA' })).data.customSteps, data.customSteps);
    okay(await feature.handle({ type: 'LOCK_ACCESS' })); okay(await feature.handle({ type: 'RECOVER_PASSWORD', recoveryCode, password: 'newpassword' }));
    assert.deepEqual(okay(await feature.handle({ type: 'GET_PRIVATE_DATA' })).data.customSteps, data.customSteps);
});

await scenario('RT5 locked gates/private status redaction/page capabilities/recovery preserve commitment', async () => {
    const { api, state } = createFakeBrowser(); const feature = featureFor(api); const ctrl = createController(api, { featureController: feature });
    await setup(ctrl); await start(ctrl);
    okay(await feature.handle({ type: 'SAVE_PRIVATE_DATA', data: { notes: 'PRIVATE_CANARY', favorites: ['help_01'], reviews: [] } }));
    const recoveryCode = okay(await feature.handle({ type: 'SET_PASSWORD', password: 'validpassword' })).recoveryCode;
    okay(await feature.handle({ type: 'LOCK_ACCESS' }));
    for (const type of ['GET_PRIVATE_DATA', 'SAVE_PRIVATE_DATA', 'SET_PASSWORD']) {
        const message = type === 'GET_PRIVATE_DATA' ? { type } : type === 'SAVE_PRIVATE_DATA' ? { type, data: { notes: 'overwritten' } } : { type, password: 'newpassword' };
        assert.equal((await feature.handle(message)).error.code, 'access_locked');
    }
    for (const type of ['GET_EXPORT', 'GET_SCHEDULES', 'RESET', 'SAVE_SETTINGS', 'IMPORT_SETTINGS', 'REQUEST_EARLY_EXIT']) await assert.rejects(feature.authorize({ type }), error => error.code === 'access_locked');
    const filtered = await feature.filterStatus(await ctrl.handle({ type: 'GET_STATUS' })); assert.equal(filtered.status.settings, undefined); assert.equal(filtered.status.schedules.items, undefined);
    const sender = page => ({ id: api.id, url: `${api.baseUrl}${page}`, frameId: 0 });
    for (const page of ['blocked.html', 'help.html', 'recovery.html', 'covenant.html']) {
        okay(await feature.handle({ type: 'GET_PUBLIC_PROFILE' }, sender(page)));
        assert.equal((await feature.handle({ type: 'UNLOCK', password: 'validpassword' }, sender(page))).ok, false);
    }
    okay(await feature.handle({ type: 'UNLOCK', password: 'validpassword' }));
    assert.deepEqual(Object.keys(okay(await feature.handle({ type: 'GET_PRIVATE_DATA' }, sender('help.html'))).data).sort(), ['customSteps', 'favorites', 'unsuitable']);
    assert.equal((await feature.handle({ type: 'SAVE_PRIVATE_DATA', data: { notes: 'injected' } }, sender('help.html'))).ok, false);
    const protectionBefore = structuredClone(Object.fromEntries(Object.entries(state.storage).filter(([key]) => key.startsWith('cfg:') || key.startsWith('lock'))));
    okay(await feature.handle({ type: 'RECOVER_PASSWORD', recoveryCode, password: 'newpassword' }));
    assert.deepEqual(Object.fromEntries(Object.entries(state.storage).filter(([key]) => key.startsWith('cfg:') || key.startsWith('lock'))), protectionBefore);
    assert.equal(okay(await feature.handle({ type: 'GET_PRIVATE_DATA' })).data.notes, 'PRIVATE_CANARY');
    assert.equal(storedConfig(state).baseList, true);
});

for (const change of ['cancel', 'new-session', 'rotate-password', 'natural-expiry']) await scenario(`RT6 frozen valid confirmation rejects ${change}`, async () => {
    const { api, state } = createFakeBrowser(); const feature = featureFor(api);
    okay(await feature.handle({ type: 'SET_PASSWORD', password: 'validpassword' }));
    let resume, entered; const frozen = new Promise(resolve => { entered = resolve; }); const gate = new Promise(resolve => { resume = resolve; });
    const verifier = { ...feature, verifyPassword: async password => { const valid = await feature.verifyPassword(password); entered(); await gate; return valid; } };
    const ctrl = createController(api, { featureController: verifier }); const second = createController({ ...api, instanceId: 'second-protection' }, { featureController: feature });
    await setup(ctrl); await start(ctrl); okay(await ctrl.handle({ type: 'REQUEST_EARLY_EXIT' })); state.now += 61 * 60000;
    const confirming = ctrl.handle({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' }); await frozen;
    if (change === 'cancel') okay(await second.handle({ type: 'CANCEL_EARLY_EXIT' }));
    if (change === 'new-session') await start(second, 240);
    if (change === 'rotate-password') okay(await feature.handle({ type: 'SET_PASSWORD', password: 'newpassword' }));
    if (change === 'natural-expiry') state.now += 180 * 60000;
    resume(); const reply = await confirming; assert.equal(reply.ok, false); assert.equal(reply.error.code, change === 'rotate-password' ? 'password_invalid' : change === 'natural-expiry' ? 'session_expired' : 'exit_not_requested');
    assert.equal((await ctrl.handle({ type: 'GET_STATUS' })).status.lock.active, change !== 'natural-expiry');
});

await scenario('RT7 ciphertext corruption fails closed without weakening protection or revealing private text', async () => {
    const { api, state } = createFakeBrowser(); const feature = featureFor(api); const ctrl = createController(api, { featureController: feature });
    await setup(ctrl); await start(ctrl);
    okay(await feature.handle({ type: 'SAVE_PRIVATE_DATA', data: { notes: 'PRIVATE_CANARY' } }));
    const recoveryCode = okay(await feature.handle({ type: 'SET_PASSWORD', password: 'validpassword' })).recoveryCode;
    const record = Object.entries(state.storage).filter(([key]) => key.startsWith('feature:')).sort((a, b) => Number(b[0].split(':')[1]) - Number(a[0].split(':')[1]))[0][1];
    const { encode, decode } = await read('src/core/security-crypto.js'); const bytes = decode(record.vault.ciphertext); bytes[0] ^= 1; record.vault.ciphertext = encode(bytes);
    const protection = structuredClone(Object.fromEntries(Object.entries(state.storage).filter(([key]) => key.startsWith('cfg:') || key.startsWith('lock'))));
    for (const message of [{ type: 'GET_PRIVATE_DATA' }, { type: 'UNLOCK', password: 'validpassword' }, { type: 'RECOVER_PASSWORD', recoveryCode, password: 'newpassword' }]) {
        const reply = await feature.handle(message); assert.equal(reply.ok, false); assert.equal(reply.error.code, 'security_corrupt'); assert.equal(JSON.stringify(reply).includes('PRIVATE_CANARY'), false);
    }
    assert.equal(okay(await feature.handle({ type: 'GET_PUBLIC_PROFILE' })).security.locked, true);
    await assert.rejects(feature.authorize({ type: 'RESET' }), error => error.code === 'access_locked');
    assert.deepEqual(Object.fromEntries(Object.entries(state.storage).filter(([key]) => key.startsWith('cfg:') || key.startsWith('lock'))), protection);
    assert.equal((await ctrl.handle({ type: 'GET_STATUS' })).status.lock.active, true);
});

console.log(JSON.stringify({ repo: dir, coverage: 'Node real controllers with fake browser APIs, no browser/DNR claim', results }, null, 2));
if (results.some(result => result.result === 'FAIL')) process.exitCode = 1;

if (results.some(item => item.result !== 'PASS')) process.exitCode = 1;
