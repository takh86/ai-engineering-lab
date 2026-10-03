import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../../src/background/controller.js';
import { createFeatureController } from '../../src/background/feature-controller.js';
import { parseSchedules, weeklyIntervals, schedulesWeaken, scheduleState } from '../../src/core/schedules.js';
import { defaultConfig, settingsOf } from '../../src/core/config.js';
import { mergeLocks } from '../../src/core/lock.js';
import { validateMessage } from '../../src/background/messages.js';
import { createFakeBrowser, storedConfig } from './fake-browser.mjs';

const MIN = 60000;
const schedule = (id, days, start, end, enabled = true) => ({ id, days, start, end, enabled });
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);
const okay = reply => { assert.equal(reply.ok, true, JSON.stringify(reply)); return reply; };
const gate = () => { let open; const promise = new Promise(resolve => { open = resolve; }); return { promise, open }; };
const until = async predicate => { for (let i = 0; i < 300 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 1)); assert.ok(predicate(), 'operation reached the injected freeze'); };

async function setup({ password = false } = {}) {
    const fake = createFakeBrowser();
    const featureController = createFeatureController(fake.api, { mutex: { waitMs: 100, pollMs: 1 } });
    const options = { featureController, mutex: { waitMs: 100, pollMs: 1 } };
    const controller = createController(fake.api, options);
    const peer = createController({ ...fake.api, instanceId: 'private-peer' }, options);
    const send = message => controller.handle(validateMessage(message));
    const sendPeer = message => peer.handle(validateMessage(message));
    okay(await send({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false }));
    if (password) okay(await featureController.handle({ type: 'SET_PASSWORD', password: 'validpassword' }));
    const start = (minutes = 180, exitDelay = 60) => send({ type: 'START_SESSION', minutes, exitDelay });
    return { ...fake, controller, peer, featureController, send, sendPeer, start };
}
const save = async (t, settings) => t.send({ type: 'SAVE_SETTINGS', baseRevision: storedConfig(t.state).revision,
    settings: { ...settingsOf(defaultConfig()), starterTerms: false, ...settings } });
const matureExit = async t => { okay(await t.start()); okay(await t.send({ type: 'REQUEST_EARLY_EXIT' })); t.state.now += 61 * MIN; };

test('weekly schedules reject duplicate/malformed IDs, minute formats and exact/overnight/week-boundary overlaps', () => {
    const overnight = schedule('night', [6], '23:00', '02:00');
    assert.deepEqual(weeklyIntervals(parseSchedules([overnight])), [[0, 120], [10020, 10080]]);
    rejects(() => parseSchedules([overnight, schedule('sun', [0], '01:00', '03:00')]), 'schedule_conflict');
    rejects(() => parseSchedules([schedule('a', [1], '22:00', '03:00'), schedule('b', [2], '02:59', '05:00')]), 'schedule_conflict');
    assert.doesNotThrow(() => parseSchedules([schedule('a', [1], '22:00', '03:00'), schedule('b', [2], '03:00', '05:00')]));
    for (const item of [schedule('x', [7], '01:00', '02:00'), schedule('x', [0, 0], '01:00', '02:00'), schedule('x', [0], '1:00', '02:00'),
        schedule('x', [0], '01:00', '01:00'), { ...schedule('x', [0], '01:00', '02:00'), junk: true }]) rejects(() => parseSchedules([item]), 'schedule_invalid');
    rejects(() => parseSchedules([schedule('x', [0], '01:00', '02:00'), schedule('x', [1], '01:00', '02:00')]), 'schedule_invalid');
    assert.doesNotThrow(() => parseSchedules([overnight, schedule('disabled', [0], '01:00', '03:00', false)]));
});

test('schedule coverage detects weakening and allows extension/addition, including week-boundary intervals', () => {
    const before = [schedule('night', [6], '23:00', '02:00')];
    assert.equal(schedulesWeaken(before, [schedule('night', [6], '22:00', '03:00')]), false);
    assert.equal(schedulesWeaken(before, [schedule('night', [6], '23:00', '01:00')]), true);
    assert.equal(schedulesWeaken(before, []), false, 'removing every schedule restores continuous extras');
    const now = new Date(2026, 9, 4, 1, 30).getTime(); // Sunday local time
    assert.equal(scheduleState(before, now).active, true);
    assert.equal(scheduleState(before, now).nextChange, now + 30 * MIN);
});

test('mandatory core survives false onboarding, save/import/reset, exceptions, schedules and missing starter phrases', async () => {
    const t = await setup();
    assert.equal(t.state.baseEnabled, true);
    okay(await save(t, { baseList: false, domains: ['example.com'], allow: ['ok.example.com'] }));
    assert.equal(t.state.rules.some(rule => rule.action.type === 'allow'), false);
    assert.deepEqual(t.state.rules[0].condition.excludedRequestDomains, ['ok.example.com']);
    assert.equal(storedConfig(t.state).baseList, true);
    const text = JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...settingsOf(defaultConfig()), baseList: false, starterTerms: false } });
    okay(await t.send({ type: 'IMPORT_SETTINGS', baseRevision: storedConfig(t.state).revision, text }));
    t.state.now = new Date(2026, 9, 5, 12).getTime();
    okay(await t.send({ type: 'SAVE_SCHEDULES', schedules: [schedule('overnight', [1], '22:00', '03:00')] }));
    assert.equal(t.state.rules.length, 0, 'extras rest outside scheduled time');
    assert.equal(t.state.baseEnabled, true);
    okay(await t.start());
    assert.equal(t.state.rules.length, 1, 'manual commitment protects extras outside scheduled time');
    assert.equal((await t.send({ type: 'RESET', baseRevision: storedConfig(t.state).revision })).error.code, 'locked_weakening');
    t.state.now += 181 * MIN;
    okay(await t.send({ type: 'RESET', baseRevision: storedConfig(t.state).revision }));
    assert.equal(t.state.baseEnabled, true);
});

test('schedules CRUD is fenced with revision checks and refusal of weaker coverage during commitment', async () => {
    const t = await setup();
    const original = [schedule('a', [1], '22:00', '02:00')];
    okay(await t.send({ type: 'SAVE_SCHEDULES', schedules: original }));
    const read = okay(await t.send({ type: 'GET_SCHEDULES' }));
    assert.deepEqual(read.schedules, original);
    okay(await t.start());
    const weaker = await t.send({ type: 'SAVE_SCHEDULES', schedules: [schedule('a', [1], '23:00', '01:00')] });
    assert.equal(weaker.error.code, 'locked_weakening');
    okay(await t.send({ type: 'SAVE_SCHEDULES', baseRevision: read.revision, schedules: [schedule('a', [1], '21:00', '03:00'), schedule('b', [3], '12:00', '13:00')] }));
    assert.equal((await t.send({ type: 'SAVE_SCHEDULES', baseRevision: read.revision, schedules: [] })).error.code, 'stale');
    okay(await t.send({ type: 'SAVE_SCHEDULES', schedules: [] }));
});

test('current-site block is normalized strengthening even during commitment and removes covering exceptions', async () => {
    const t = await setup();
    okay(await save(t, { allow: ['example.com'] }));
    okay(await t.start());
    okay(await t.send({ type: 'BLOCK_CURRENT_SITE', domain: 'HTTPS://Www.Example.COM/' }));
    assert.deepEqual(storedConfig(t.state).domains, ['example.com']);
    assert.deepEqual(storedConfig(t.state).allow, []);
    assert.equal((await t.send({ type: 'BLOCK_CURRENT_SITE', domain: 'https://private.example/path' })).ok, false);
});

test('actual combined controllers confirm only explicit mature request plus current password; delay is never shortened', async () => {
    const t = await setup({ password: true });
    okay(await t.start(240, 90));
    okay(await t.start(10, 60));
    assert.equal((await t.send({ type: 'GET_STATUS' })).status.commitment.exitDelay, 90);
    assert.equal((await t.send({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' })).error.code, 'exit_not_requested');
    const request = okay(await t.send({ type: 'REQUEST_EARLY_EXIT' })).status.commitment.request;
    assert.equal(request.readyAt, t.state.now + 90 * MIN);
    assert.equal((await t.send({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' })).error.code, 'exit_waiting');
    t.state.now += 91 * MIN;
    assert.equal((await t.send({ type: 'GET_STATUS' })).status.lock.active, true, 'waiting never automatically ends a session');
    assert.equal((await t.send({ type: 'CONFIRM_EARLY_EXIT', password: 'incorrectpassword' })).error.code, 'password_invalid');
    const result = okay(await t.send({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' }));
    assert.equal(result.status.lock.active, false);
    assert.equal(t.state.baseEnabled, true);
    okay(await t.start(60));
    assert.equal((await t.send({ type: 'GET_STATUS' })).status.lock.until, t.state.now + 60 * MIN, 'released longer lock cannot compact the new shorter commitment');
    assert.equal(mergeLocks(t.state.storage).until, t.state.now + 60 * MIN);
});

test('early confirmation without configured password fails closed, and natural expiry wins while verifier is waiting', async () => {
    const disabled = await setup(); await matureExit(disabled);
    assert.equal((await disabled.send({ type: 'CONFIRM_EARLY_EXIT', password: '' })).error.code, 'password_invalid');
    const t = await setup({ password: true }); await matureExit(t);
    const hold = gate(), original = t.featureController.verifyPassword; let checked = false;
    t.featureController.verifyPassword = async password => { const valid = await original(password); checked = true; await hold.promise; return valid; };
    const confirming = t.send({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' });
    await until(() => checked);
    t.state.now = mergeLocks(t.state.storage).until;
    hold.open();
    assert.equal((await confirming).error.code, 'session_expired');
    assert.deepEqual(storedConfig(t.state).commitment.releases, []);
});

for (const race of ['cancel', 'extend', 'password']) test(`actual verifier proof cannot confirm after another instance changes ${race} state`, async () => {
    const t = await setup({ password: true }); await matureExit(t);
    const hold = gate(), original = t.featureController.verifyPassword; let checked = false;
    t.featureController.verifyPassword = async password => { const valid = await original(password); checked = true; await hold.promise; return valid; };
    const confirming = t.send({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' });
    await until(() => checked);
    if (race === 'cancel') okay(await t.sendPeer({ type: 'CANCEL_EARLY_EXIT' }));
    if (race === 'extend') okay(await t.sendPeer({ type: 'START_SESSION', minutes: 240, exitDelay: 60 }));
    if (race === 'password') okay(await t.featureController.handle({ type: 'SET_PASSWORD', password: 'replacementpassword' }));
    hold.open();
    const result = await confirming;
    assert.equal(result.ok, false);
    assert.equal(result.error.code, race === 'password' ? 'password_invalid' : 'exit_not_requested');
    assert.equal(mergeLocks(t.state.storage).until > t.state.now, true);
    assert.deepEqual(storedConfig(t.state).commitment.releases, []);
});

test('frozen late confirmation record cannot override a cancellation or a new private-window extension', async () => {
    const t = await setup({ password: true }); await matureExit(t);
    const hold = gate(), set = t.api.storage.set; let frozen = false;
    t.api.storage.set = async items => {
        if (!frozen && Object.values(items).some(value => value?.commitment?.releases?.length)) { frozen = true; await hold.promise; }
        return set(items);
    };
    const confirming = t.send({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' });
    await until(() => frozen);
    t.state.clockSkew += 60000;
    okay(await t.sendPeer({ type: 'CANCEL_EARLY_EXIT' }));
    okay(await t.sendPeer({ type: 'START_SESSION', minutes: 240, exitDelay: 120 }));
    hold.open();
    assert.equal((await confirming).ok, false);
    assert.deepEqual(storedConfig(t.state).commitment.releases, []);
    assert.equal((await t.sendPeer({ type: 'GET_STATUS' })).status.lock.until, t.state.now + 240 * MIN);
});

test('frozen cleanup of a released lock cannot delete a newer shorter commitment', async () => {
    const t = await setup({ password: true }); await matureExit(t);
    const oldNames = Object.keys(mergeLocks(t.state.storage).keys);
    const hold = gate(), remove = t.api.storage.remove; let frozen = false;
    t.api.storage.remove = async keys => {
        if (!frozen && keys.some(key => oldNames.includes(key))) { frozen = true; await hold.promise; }
        return remove(keys);
    };
    const confirming = t.send({ type: 'CONFIRM_EARLY_EXIT', password: 'validpassword' });
    await until(() => frozen);
    t.state.clockSkew += 60000;
    okay(await t.sendPeer({ type: 'START_SESSION', minutes: 60, exitDelay: 60 }));
    hold.open(); okay(await confirming);
    assert.equal((await t.sendPeer({ type: 'GET_STATUS' })).status.lock.until, t.state.now + 60 * MIN);
    assert.equal(mergeLocks(t.state.storage).until, t.state.now + 60 * MIN);
});

test('new message schemas reject extra fields, invalid bounds, passwords and oversized schedule requests', () => {
    for (const input of [{ type: 'START_SESSION', minutes: 9, exitDelay: 60 }, { type: 'START_SESSION', minutes: 525601, exitDelay: 60 },
        { type: 'START_SESSION', minutes: 180, exitDelay: 59 }, { type: 'CONFIRM_EARLY_EXIT', password: 'x', force: true },
        { type: 'SAVE_SCHEDULES', schedules: [], baseRevision: -1 }, { type: 'BLOCK_CURRENT_SITE', domain: 'x'.repeat(2049) }]) rejects(() => validateMessage(input), 'bad_request');
    assert.equal(validateMessage({ type: 'START_SESSION', minutes: 525600, exitDelay: 525600 }).minutes, 525600);
});

test('a schedule reduction frozen at config write cannot land inside a newer private-window commitment', async () => {
    const t = await setup();
    const original = [schedule('a', [1], '20:00', '03:00')];
    okay(await t.send({ type: 'SAVE_SCHEDULES', schedules: original }));
    const hold = gate(), set = t.api.storage.set; let frozen = false;
    t.api.storage.set = async items => {
        if (!frozen && Object.values(items).some(value => value?.schedules?.[0]?.start === '23:00')) { frozen = true; await hold.promise; }
        return set(items);
    };
    const saving = t.send({ type: 'SAVE_SCHEDULES', schedules: [schedule('a', [1], '23:00', '01:00')] });
    await until(() => frozen);
    t.state.clockSkew += 60000;
    okay(await t.sendPeer({ type: 'START_SESSION', minutes: 180, exitDelay: 60 }));
    hold.open();
    assert.equal((await saving).ok, false);
    assert.deepEqual(storedConfig(t.state).schedules, original);
    assert.equal((await t.sendPeer({ type: 'GET_STATUS' })).status.lock.active, true);
});
