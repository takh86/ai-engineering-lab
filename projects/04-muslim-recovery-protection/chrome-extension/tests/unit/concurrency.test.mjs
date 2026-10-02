// Regression tests for the commitment-session race found by the independent review of d662632.
// Two controllers (normal + private-window worker instances) share one storage. storage.local has no
// compare-and-set, so a read-check-write sequence is NOT atomic; these tests pin the interleavings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../../src/background/controller.js';
import { validateMessage } from '../../src/background/messages.js';
import { createFakeBrowser } from './fake-browser.mjs';

const noList = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));
// A write of the configuration (append-only record `cfg:<epoch>:<instance>`; the pre-V1.2 layout used the single key `config`).
const isConfigWrite = items => Object.keys(items).some(key => key === 'config' || key.startsWith('cfg:'));
const gate = () => { let open; const promise = new Promise(resolve => { open = resolve; }); return { promise, open }; };

let peers = 0;
// A second worker instance shares storage and the browser rules but has its own identity (as in a private window).
const peerOf = api => createController({ ...api, instanceId: `peer${++peers}` });
function pair() {
    const fake = createFakeBrowser();
    const a = createController(fake.api);
    const b = peerOf(fake.api);
    const send = (controller, message) => controller.handle(validateMessage(message));
    return { ...fake, a, b, send };
}
async function configured(t, domains = ['example.com']) {
    await t.send(t.a, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    const status = (await t.send(t.a, { type: 'GET_STATUS' })).status;
    await t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList, domains } });
}
const statusOf = async (t, controller = t.a) => (await t.send(controller, { type: 'GET_STATUS' })).status;

test('REGRESSION: a paused SAVE_SETTINGS (same settings) must not erase a session started meanwhile', async () => {
    const t = pair(); await configured(t);
    const before = await statusOf(t);
    const hold = gate(); let paused = false;
    const realSet = t.api.storage.set;
    // Pause A's storage write AFTER its compare step and BEFORE the write itself (exact sequence of the review).
    t.api.storage.set = async items => {
        if (!paused && isConfigWrite(items)) { paused = true; await hold.promise; }
        return realSet(items);
    };
    const saveA = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: before.revision, settings: { ...noList, domains: ['example.com'] } });
    for (let i = 0; i < 200 && !paused; i++) await tick(1);
    assert.ok(paused, 'controller A reached its storage write');
    const startB = t.send(t.b, { type: 'START_SESSION', minutes: 60 });
    await tick(30);
    hold.open();                                             // A resumes its stale write
    const [resultA, resultB] = await Promise.all([saveA, startB]);
    t.api.storage.set = realSet;
    assert.ok(resultB.ok, `session start succeeded: ${JSON.stringify(resultB.error)}`);
    const after = await statusOf(t, t.b);
    assert.ok(after.lock.active, 'the session survives the late write');
    assert.ok(after.lock.until > t.state.now, 'the end time was not reset to 0');
    const attempt = await t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: after.revision, settings: { ...noList } });
    assert.equal(attempt.error?.code, 'locked_weakening', 'deleting a site is still refused');
    assert.deepEqual(t.state.rules[0].condition.requestDomains, ['example.com']);
    assert.ok(resultA.ok || ['stale', 'busy'].includes(resultA.error.code));
});

const lockUntil = t => Math.max(0, ...Object.entries(t.state.storage).filter(([k]) => k === 'lock' || k.startsWith('lock:')).map(([, v]) => v.until));

test('REGRESSION (variants): a paused IMPORT, or a config write that fails and rolls back, never touches the session', async () => {
    for (const mode of ['import', 'rollback']) {
        const t = pair(); await configured(t);
        const rev = (await statusOf(t)).revision;
        const hold = gate(); let paused = false; const realSet = t.api.storage.set;
        t.api.storage.set = async items => {
            if (!paused && isConfigWrite(items)) { paused = true; await hold.promise; if (mode === 'rollback') throw new Error('injected write failure'); }
            return realSet(items);
        };
        const file = JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...noList, domains: ['other.org'] } });
        const writer = t.send(t.a, mode === 'import' ? { type: 'IMPORT_SETTINGS', baseRevision: rev, text: file } : { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'x.org'] } });
        for (let i = 0; i < 200 && !paused; i++) await tick(1);
        const start = t.send(t.b, { type: 'START_SESSION', minutes: 90 });
        await tick(30); hold.open();
        const [, started] = await Promise.all([writer, start]);
        t.api.storage.set = realSet;
        assert.ok(started.ok, mode + JSON.stringify(started.error));
        const after = await statusOf(t, t.b);
        assert.ok(after.lock.active && lockUntil(t) >= t.state.now + 89 * 60000, `${mode}: session intact`);
        assert.equal(after.state, 'active', `${mode}: rules still match the stored configuration`);
    }
});

test('two sessions started and extended at the same time: the effective end time is the maximum and never decreases', async () => {
    const t = pair(); await configured(t);
    const seen = [];
    const record = async controller => { seen.push(lockUntil(t)); return t.send(controller, { type: 'GET_STATUS' }); };
    const results = await Promise.all([
        t.send(t.a, { type: 'START_SESSION', minutes: 60 }), t.send(t.b, { type: 'START_SESSION', minutes: 120 }),
        t.send(t.a, { type: 'START_SESSION', minutes: 90 }), t.send(t.b, { type: 'START_SESSION', minutes: 60 }), record(t.a)
    ]);
    assert.ok(results.slice(0, 4).every(r => r.ok), JSON.stringify(results.map(r => r.error)));
    assert.equal(lockUntil(t), t.state.now + 120 * 60000);
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1]);
    // a later, shorter request cannot shorten it
    await t.send(t.b, { type: 'START_SESSION', minutes: 60 });
    assert.equal(lockUntil(t), t.state.now + 120 * 60000);
});

test('storage layout: a stale or rule-breaking writer cannot shorten the session (grow-only entries)', async () => {
    const t = pair(); await configured(t);
    await t.send(t.a, { type: 'START_SESSION', minutes: 120 });
    const target = lockUntil(t);
    t.state.storage['lock:late-stale-writer'] = { until: 1 };      // an old, smaller value arriving late
    t.state.storage.lock = { until: 0 };                            // legacy single key reset to 0
    assert.equal((await statusOf(t, t.b)).lock.until, target);
    const weak = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: (await statusOf(t)).revision, settings: { ...noList } });
    assert.equal(weak.error.code, 'locked_weakening');
});

test('configuration writes never write any lock key', async () => {
    const t = pair(); await configured(t);
    await t.send(t.a, { type: 'START_SESSION', minutes: 60 });
    const written = [];
    const realSet = t.api.storage.set;
    t.api.storage.set = async items => { written.push(...Object.keys(items)); return realSet(items); };
    const rev = (await statusOf(t)).revision;
    await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'more.org'] } });
    t.api.storage.set = realSet;
    assert.ok(written.some(key => key.startsWith('cfg:')), 'configuration is written as an append-only record');
    assert.ok(!written.some(key => key === 'lock' || key.startsWith('lock:')));
});

test('mutual exclusion: five instances saving from one base revision - exactly one wins, critical sections never overlap', async () => {
    const t = pair(); await configured(t);
    const controllers = [t.a, t.b, peerOf(t.api), peerOf(t.api), peerOf(t.api)];
    const rev = (await statusOf(t)).revision;
    let inside = 0, maxInside = 0;
    const realUpdate = t.api.dnr.updateDynamicRules;
    t.api.dnr.updateDynamicRules = async options => { inside += 1; maxInside = Math.max(maxInside, inside); await tick(3); try { return await realUpdate(options); } finally { inside -= 1; } };
    const results = await Promise.all(controllers.map((controller, i) => t.send(controller, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', `site${i}.org`] } })));
    t.api.dnr.updateDynamicRules = realUpdate;
    assert.equal(results.filter(r => r.ok).length, 1, JSON.stringify(results.map(r => r.ok || r.error.code)));
    assert.ok(results.filter(r => !r.ok).every(r => r.error.code === 'stale'));
    assert.equal(maxInside, 1, 'rule installation of two instances never overlapped');
    const status = await statusOf(t);
    assert.equal(status.state, 'active');
    assert.equal(status.settings.domains.length, 2);
});

test('lease lost (worker paused beyond its lease): its late write is refused, the other instance state stands, rules follow storage', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    const hold = gate(); let paused = false; const realUpdate = t.api.dnr.updateDynamicRules;
    t.api.dnr.updateDynamicRules = async options => { await realUpdate(options); if (!paused) { paused = true; await hold.promise; } };
    const slow = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'slow.org'] } });
    for (let i = 0; i < 200 && !paused; i++) await tick(1);
    t.state.clockSkew += 60_000;                               // A's lease (20 s) has expired while it was paused
    t.api.dnr.updateDynamicRules = realUpdate;
    const fast = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'fast.org'] } });
    assert.ok(fast.ok, JSON.stringify(fast.error));
    hold.open();
    const late = await slow;
    assert.equal(late.ok, false); assert.equal(late.error.code, 'busy');
    const status = await statusOf(t, t.b);
    assert.deepEqual([...status.settings.domains].sort(), ['example.com', 'fast.org']);
    assert.equal(status.state, 'active');
    assert.deepEqual([...t.state.rules[0].condition.requestDomains].sort(), ['example.com', 'fast.org']);
});

test('a crashed holder cannot block forever (lease expiry), a live one makes others fail with "busy"', async () => {
    const fake = createFakeBrowser();
    const quick = createController(fake.api, { mutex: { leaseMs: 20000, waitMs: 60, pollMs: 2 } });
    const send = message => quick.handle(validateMessage(message));
    fake.state.storage['mx:ghost'] = { choosing: false, ticket: 1, exp: Date.now() + 20000 };
    const blocked = await send({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    assert.equal(blocked.error.code, 'busy');
    fake.state.clockSkew += 60000;                              // the ghost's lease is now expired
    const freed = await send({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    assert.ok(freed.ok, JSON.stringify(freed.error));
    assert.ok(!Object.keys(fake.state.storage).some(key => key === `mx:${quick.instanceId}`), 'released its own entry');
});

test('reconciliation of a damaged browser state while another instance saves is serialized by the same mutex', async () => {
    const t = pair(); await configured(t);
    t.state.rules = [];                                         // rules wiped behind our back
    const rev = (await statusOf(t)).revision;
    const [repair, save] = await Promise.all([t.send(t.a, { type: 'REPAIR' }), t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'new.org'] } })]);
    assert.ok(repair.ok && save.ok);
    const status = await statusOf(t);
    assert.equal(status.state, 'active');
    assert.deepEqual([...t.state.rules[0].condition.requestDomains].sort(), ['example.com', 'new.org']);
});

test('a repair paused BEFORE its rule write, past its lease, cannot leave stale rules behind a newer save (state follows storage)', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    t.state.rules = [];                                         // rules wiped (after the status call, which would auto-repair): A will repair from the stored configuration
    const hold = gate(); let paused = false; const realGet = t.api.dnr.getEnabledRulesets;
    t.api.dnr.getEnabledRulesets = async () => { const value = await realGet(); if (!paused) { paused = true; await hold.promise; } return value; };
    const repair = t.send(t.a, { type: 'REPAIR' });
    for (let i = 0; i < 200 && !paused; i++) await tick(1);
    assert.ok(paused, 'A is paused before it wrote any rule');
    t.state.clockSkew += 60_000;                                // its lease expires while it is paused
    t.api.dnr.getEnabledRulesets = realGet;
    const save = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'newer.org'] } });
    assert.ok(save.ok, JSON.stringify(save.error));
    hold.open();                                                // A resumes with a plan built from the OLD configuration
    await repair;
    // Checked BEFORE any status call (a status call would auto-repair): the late worker itself must have left the rules consistent.
    assert.deepEqual([...t.state.rules[0].condition.requestDomains].sort(), ['example.com', 'newer.org'], 'rules follow storage immediately');
    const status = await statusOf(t, t.b);
    assert.deepEqual([...status.settings.domains].sort(), ['example.com', 'newer.org']);
    assert.equal(status.state, 'active', JSON.stringify(status.reasons));
    assert.deepEqual([...t.state.rules[0].condition.requestDomains].sort(), ['example.com', 'newer.org']);
});
