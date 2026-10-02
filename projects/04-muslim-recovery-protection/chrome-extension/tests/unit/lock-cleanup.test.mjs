// Regression tests for LATE DELETES (independent review of 0b46c1d, "review-lock-cleanup"): a worker frozen at storage.remove after it
// selected stale keys must not be able to wipe a NEWER session that re-used the same storage key. The reviewer's own test file was not
// in the repository; these tests reproduce the sequence from the written description and run unchanged against the old layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../../src/background/controller.js';
import { validateMessage } from '../../src/background/messages.js';
import { createFakeBrowser } from './fake-browser.mjs';

const noList = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const MIN = 60_000;
const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));
const gate = () => { let open; const promise = new Promise(resolve => { open = resolve; }); return { promise, open }; };
const until = async (predicate, label) => { for (let i = 0; i < 400 && !predicate(); i++) await tick(1); assert.ok(predicate(), label); };
const isLockKey = key => key === 'lock' || key.startsWith('lock:');
const lockUntil = state => Math.max(0, ...Object.entries(state.storage).filter(([key]) => isLockKey(key)).map(([, value]) => value.until));

let peers = 0;
const peerOf = api => createController({ ...api, instanceId: `peer${++peers}` });
function trio() {
    const fake = createFakeBrowser();
    const a = createController(fake.api); const b = peerOf(fake.api); const c = peerOf(fake.api);
    const send = (controller, message) => controller.handle(validateMessage(message));
    return { ...fake, a, b, c, send };
}
async function configured(t, domains = ['example.com', 'second.org']) {
    await t.send(t.a, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    const status = (await t.send(t.a, { type: 'GET_STATUS' })).status;
    await t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList, domains } });
}
const statusOf = async (t, controller) => (await t.send(controller, { type: 'GET_STATUS' })).status;
// Freezes the first storage.remove that contains a key matching `match` (after the caller has chosen the keys and checked ownership).
function freezeRemoval(t, match) {
    const hold = gate(); const real = t.api.storage.remove; const seen = { frozen: false, keys: [] };
    t.api.storage.remove = async keys => {
        if (!seen.frozen && keys.some(match)) { seen.frozen = true; seen.keys = [...keys]; await hold.promise; }
        return real(keys);
    };
    return { seen, release: () => hold.open(), restore: () => { t.api.storage.remove = real; } };
}
const deleteEverything = async (t, controller) => {
    const status = await statusOf(t, controller);
    return t.send(controller, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList } });
};

test('REVIEW 0b46c1d: a frozen cleanup of an EXPIRED session key cannot wipe the new session that re-used the key', async () => {
    const t = trio(); await configured(t);
    assert.ok((await t.send(t.a, { type: 'START_SESSION', minutes: 60 })).ok);
    t.state.now += 61 * MIN;                                       // A's first session has ended
    const freeze = freezeRemoval(t, isLockKey);
    const cleanup = t.send(t.b, { type: 'REPAIR' });                // B reconciles: selects A's expired key, checks ownership, freezes at remove
    await until(() => freeze.seen.frozen, 'B froze inside the removal of the stale session key');
    t.state.clockSkew += 60_000;                                    // B's lease expires
    freeze.restore();
    const second = await t.send(t.a, { type: 'START_SESSION', minutes: 120 });   // A starts a NEW session (old layout: the same storage key)
    assert.ok(second.ok, JSON.stringify(second.error));
    freezeRemoval; freeze.release(); await cleanup;                 // the old removal now runs
    const after = await statusOf(t, t.a);
    assert.ok(after.lock.active, 'the new session survived the late cleanup');
    assert.ok(lockUntil(t.state) >= t.state.now + 119 * MIN, 'its full 120-minute end time is intact');
    const attempt = await deleteEverything(t, t.a);
    assert.equal(attempt.ok, false);
    assert.equal(attempt.error.code, 'locked_weakening', 'deleting every blocked site is still refused');
    assert.deepEqual(after.settings.domains.sort(), ['example.com', 'second.org']);
});

test('late cleanup of a key whose session was EXTENDED meanwhile cannot shorten it', async () => {
    const t = trio(); await configured(t);
    assert.ok((await t.send(t.a, { type: 'START_SESSION', minutes: 60 })).ok);
    // C starts a longer (90 min) session: A's 60-minute entry becomes the smaller, obsolete one. Whoever selects it for removal freezes:
    // in the append-only layout that is C's own cleanup right after its start; in the old layout a later reconcile by B.
    const freeze = freezeRemoval(t, isLockKey);
    const c90 = t.send(t.c, { type: 'START_SESSION', minutes: 90 });
    await Promise.race([until(() => freeze.seen.frozen, 'x').catch(() => {}), c90]);
    let frozenOp = c90;
    if (!freeze.seen.frozen) { frozenOp = t.send(t.b, { type: 'REPAIR' }); await until(() => freeze.seen.frozen, 'B froze inside the removal of the smaller session entry'); }
    t.state.clockSkew += 60_000;                                    // the frozen worker's lease expires
    freeze.restore();
    assert.ok((await t.send(t.a, { type: 'START_SESSION', minutes: 120 })).ok);     // A EXTENDS its session to 120 min meanwhile
    freeze.release(); await frozenOp;                               // the removal chosen before the extension now runs
    assert.ok(lockUntil(t.state) >= t.state.now + 119 * MIN, `the extended end time is intact (${Math.round((lockUntil(t.state) - t.state.now) / MIN)} min left)`);
    assert.equal((await deleteEverything(t, t.c)).error?.code, 'locked_weakening');
    assert.ok((await statusOf(t, t.a)).lock.active);
});

test('late cleanup of EPOCH entries cannot make a later holder re-use an epoch already issued', async () => {
    const t = trio(); await configured(t);
    for (let i = 0; i < 3; i++) await t.send(t.c, { type: 'REPAIR' });
    const epochKeys = () => Object.keys(t.state.storage).filter(key => key.startsWith('ep:'));
    const freeze = freezeRemoval(t, key => key.startsWith('ep:'));
    const cleanup = t.send(t.b, { type: 'REPAIR' });
    await until(() => freeze.seen.frozen, 'B froze inside the removal of obsolete epoch entries');
    t.state.clockSkew += 60_000;
    freeze.restore();
    const issued = Math.max(...Object.keys(t.state.storage).filter(key => key.startsWith('ep:') || key.startsWith('cfg:')).map(key => Number(key.split(':')[1] === undefined ? 0 : key.split(':')[1])).filter(Number.isFinite));
    await t.send(t.a, { type: 'REPAIR' });                          // A takes a new, higher epoch while B is frozen
    freeze.release(); await cleanup;
    const afterA = Math.max(...epochKeys().map(key => Number(key.split(':')[1])).filter(Number.isFinite), 0);
    assert.ok(afterA > issued, 'the epoch A registered survived the late removal');
    const save = await t.send(t.c, { type: 'SAVE_SETTINGS', baseRevision: (await statusOf(t, t.c)).revision, settings: { ...noList, domains: ['example.com', 'later.org'] } });
    assert.ok(save.ok, JSON.stringify(save.error));
    const cfgEpochs = Object.keys(t.state.storage).filter(key => key.startsWith('cfg:')).map(key => Number(key.split(':')[1]));
    assert.ok(Math.max(...cfgEpochs) > afterA, 'a later holder got an epoch above every epoch issued before');
});

test('late WRITES of lock and epoch entries are harmless: they can only lengthen a session / lower-rank an epoch', async () => {
    const t = trio(); await configured(t);
    const real = t.api.storage.set; const hold = gate(); const seen = { frozen: false };
    t.api.storage.set = async items => {
        if (!seen.frozen && Object.keys(items).some(isLockKey)) { seen.frozen = true; await hold.promise; }
        return real(items);
    };
    const start = t.send(t.a, { type: 'START_SESSION', minutes: 60 });
    await until(() => seen.frozen, 'A froze at the write of its session entry');
    t.state.clockSkew += 60_000;
    t.api.storage.set = real;
    assert.ok((await t.send(t.b, { type: 'START_SESSION', minutes: 120 })).ok);
    hold.open(); await start;
    assert.ok(lockUntil(t.state) >= t.state.now + 119 * MIN, 'the late, shorter session write did not shorten the longer one');
    const staleEpoch = Object.keys(t.state.storage).filter(key => key.startsWith('ep:')).length;
    assert.ok(staleEpoch >= 1);
    assert.equal((await deleteEverything(t, t.b)).error?.code, 'locked_weakening');
});

test('mutex entries: a late removal or resurrection fails CLOSED (busy / ignored), never opens a second critical section', async () => {
    const t = trio(); await configured(t);
    // (a) an expired mutex entry that another instance removes while its owner re-acquires: the owner may get "busy", the state never changes
    const before = JSON.stringify(Object.entries(t.state.storage).filter(([key]) => key.startsWith('cfg:') || key === 'config'));
    t.state.storage['mx:ghost'] = { choosing: false, ticket: 1, exp: Date.now() + 60_000 };       // a live-looking holder that is long gone
    const quick = createController(t.api, { mutex: { leaseMs: 20000, waitMs: 60, pollMs: 2 } });
    const refused = await quick.handle(validateMessage({ type: 'SAVE_SETTINGS', baseRevision: (await statusOf(t, t.a)).revision, settings: { ...noList, domains: ['example.com'] } }));
    assert.equal(refused.ok, false); assert.equal(refused.error.code, 'busy');
    delete t.state.storage['mx:ghost'];
    // (b) a resurrected, long-expired entry (late renewal) does not block anyone
    t.state.storage['mx:resurrected'] = { choosing: false, ticket: 1, exp: Date.now() - 60_000 };
    const ok = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: (await statusOf(t, t.b)).revision, settings: { ...noList, domains: ['example.com', 'after.org'] } });
    assert.ok(ok.ok, JSON.stringify(ok.error));
    assert.notEqual(before, JSON.stringify(Object.entries(t.state.storage).filter(([key]) => key.startsWith('cfg:') || key === 'config')));
});

test('late EPOCH WRITE: a holder frozen while registering its epoch fails closed afterwards and writes nothing', async () => {
    const t = trio(); await configured(t);
    const rev = (await statusOf(t, t.a)).revision;
    const real = t.api.storage.set; const hold = gate(); const seen = { frozen: false };
    t.api.storage.set = async items => {
        if (!seen.frozen && Object.keys(items).some(key => key.startsWith('ep:'))) { seen.frozen = true; await hold.promise; }
        return real(items);
    };
    const slow = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'slow.org'] } });
    await until(() => seen.frozen, 'A froze while registering its epoch');
    t.state.clockSkew += 60_000;
    t.api.storage.set = real;
    const fast = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'fast.org'] } });
    assert.ok(fast.ok, JSON.stringify(fast.error));
    hold.open(); const late = await slow;
    assert.equal(late.ok, false);
    assert.equal(late.error.code, 'busy', 'the late holder noticed it lost its lease before writing anything');
    assert.deepEqual((await statusOf(t, t.b)).settings.domains.sort(), ['example.com', 'fast.org']);
});

test('late MUTEX REMOVAL: a holder whose mutex entry is removed behind its back cannot place a newer-looking write once another instance has taken over', async () => {
    const t = trio(); await configured(t);
    const rev = (await statusOf(t, t.a)).revision;
    const real = t.api.storage.set; const hold = gate(); const seen = { frozen: false };
    t.api.storage.set = async items => {
        if (!seen.frozen && Object.keys(items).some(key => key === 'config' || key.startsWith('cfg:'))) { seen.frozen = true; await hold.promise; }
        return real(items);
    };
    const slow = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: [] } });   // would delete every site
    await until(() => seen.frozen, 'A froze at its configuration write');
    delete t.state.storage[Object.keys(t.state.storage).find(key => key.startsWith('mx:') && !key.includes('ghost'))];   // a late cleanup removed A's mutex entry
    t.api.storage.set = real;
    const takeover = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'takeover.org'] } });
    assert.ok(takeover.ok, JSON.stringify(takeover.error));
    hold.open(); await slow;
    assert.deepEqual((await statusOf(t, t.b)).settings.domains.sort(), ['example.com', 'takeover.org']);
    assert.deepEqual(t.state.rules.flatMap(rule => rule.condition.requestDomains ?? []).sort(), ['example.com', 'takeover.org']);
});
