// Regression tests for LATE WRITES: a worker that was frozen past its lease resumes and performs the write it had
// already decided on. Found by the independent review of 7294cd6: re-checking ownership before a non-atomic
// storage write is not enough, because the freeze can happen AFTER the check. These tests freeze the writer exactly
// at the storage write (and at a rollback / repair) and assert that the newer state survives.
// The helpers read storage with their own inline logic so the same file can run against older layouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../../src/background/controller.js';
import { validateMessage } from '../../src/background/messages.js';
import { createFakeBrowser } from './fake-browser.mjs';

const noList = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));
const gate = () => { let open; const promise = new Promise(resolve => { open = resolve; }); return { promise, open }; };
// A write of the configuration, in either storage layout (single `config` key, or `cfg:<epoch>:<instance>` records).
const isConfigWrite = items => Object.keys(items).some(key => key === 'config' || key.startsWith('cfg:'));
// The configuration the browser state currently holds: the record with the highest epoch (ties: instance id), else the legacy key.
function storedConfig(state) {
    let best = null;
    for (const [key, value] of Object.entries(state.storage)) {
        const match = /^cfg:(\d+):(.+)$/u.exec(key);
        if (!match) continue;
        const rank = [Number(match[1]), match[2]];
        if (!best || rank[0] > best.rank[0] || (rank[0] === best.rank[0] && rank[1] > best.rank[1])) best = { rank, value };
    }
    return best ? best.value : state.storage.config;
}
const ruleDomains = state => state.rules.flatMap(rule => rule.condition.requestDomains ?? []).filter(domain => domain !== 'tabsira-selftest.test').sort();

let peers = 0;
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
// Freezes the NEXT configuration write of `t.api` (after ownership and compare checks, before the storage call itself).
function freezeNextConfigWrite(t, { thenFail = false } = {}) {
    const hold = gate(); const real = t.api.storage.set; const seen = { frozen: false };
    t.api.storage.set = async items => {
        if (!seen.frozen && isConfigWrite(items)) { seen.frozen = true; await hold.promise; if (thenFail) throw new Error('injected write failure'); }
        return real(items);
    };
    return { seen, release: () => { hold.open(); }, restore: () => { t.api.storage.set = real; } };
}
const until = async (predicate, label) => { for (let i = 0; i < 400 && !predicate(); i++) await tick(1); assert.ok(predicate(), label); };

test('REVIEW 7294cd6: a frozen SAVE that removes sites, resumed after the lease expired, newer save and START_SESSION, must not empty the list', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    const freeze = freezeNextConfigWrite(t);
    const oldSave = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: [] } });   // deletes every site
    await until(() => freeze.seen.frozen, 'A reached its configuration write');
    t.state.clockSkew += 60_000;                                    // its lease has expired
    const newer = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'newer.org'] } });
    assert.ok(newer.ok, JSON.stringify(newer.error));
    const started = await t.send(t.b, { type: 'START_SESSION', minutes: 60 });
    assert.ok(started.ok, JSON.stringify(started.error));
    freeze.release();                                               // the old write now happens
    const late = await oldSave; freeze.restore();
    const after = await statusOf(t, t.b);
    assert.deepEqual([...after.settings.domains].sort(), ['example.com', 'newer.org'], `stored sites survive (old save finished as ${late.ok ? 'ok' : late.error.code})`);
    assert.deepEqual(ruleDomains(t.state), ['example.com', 'newer.org'], 'browser rules follow the stored sites');
    assert.ok(after.lock.active, 'the session is still active');
    assert.equal(after.state, 'active', JSON.stringify(after.reasons));
    assert.equal(late.ok, false, 'the stale save is reported as not applied');
});

test('REVIEW variant: the newer instance only starts a session (no save); the frozen weakening save must still not land', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    const freeze = freezeNextConfigWrite(t);
    const oldSave = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: [] } });
    await until(() => freeze.seen.frozen, 'A reached its configuration write');
    t.state.clockSkew += 60_000;
    await statusOf(t, t.b);                                         // the frozen save had already changed the browser rules: a status check repairs them from storage
    const started = await t.send(t.b, { type: 'START_SESSION', minutes: 60 });
    assert.ok(started.ok, JSON.stringify(started.error));
    freeze.release(); await oldSave; freeze.restore();
    const after = await statusOf(t, t.b);
    assert.deepEqual(after.settings.domains, ['example.com'], 'a weakening write from before the session cannot land during it');
    assert.deepEqual(ruleDomains(t.state), ['example.com']);
    assert.ok(after.lock.active);
});

test('late ROLLBACK: a save whose write fails after a freeze must not restore its old snapshot over a newer state', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    const freeze = freezeNextConfigWrite(t, { thenFail: true });
    const oldSave = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'doomed.org'] } });
    await until(() => freeze.seen.frozen, 'A reached its configuration write');
    t.state.clockSkew += 60_000;
    const newer = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'newer.org'] } });
    assert.ok(newer.ok, JSON.stringify(newer.error));
    await t.send(t.b, { type: 'START_SESSION', minutes: 60 });
    freeze.release();                                               // the write fails -> A's rollback code runs now
    const late = await oldSave; freeze.restore();
    assert.equal(late.ok, false);
    assert.deepEqual(ruleDomains(t.state), ['example.com', 'newer.org'], 'rules were not rolled back to the old snapshot');
    const after = await statusOf(t, t.b);
    assert.deepEqual([...after.settings.domains].sort(), ['example.com', 'newer.org']);
    assert.ok(after.lock.active);
});

test('late IMPORT: a frozen import resumed after newer saves cannot overwrite them', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    const file = JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...noList, domains: ['imported.org'] } });
    const freeze = freezeNextConfigWrite(t);
    const oldImport = t.send(t.a, { type: 'IMPORT_SETTINGS', baseRevision: rev, text: file });
    await until(() => freeze.seen.frozen, 'A reached its configuration write');
    t.state.clockSkew += 60_000;
    const newer = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'newer.org'] } });
    assert.ok(newer.ok);
    freeze.release(); await oldImport; freeze.restore();
    const after = await statusOf(t, t.b);
    assert.ok(after.settings.domains.includes('newer.org') && after.settings.domains.includes('example.com'), JSON.stringify(after.settings.domains));
    assert.deepEqual(ruleDomains(t.state), [...after.settings.domains].sort(), 'rules equal the stored sites');
});

test('late writes in a chain: three frozen older saves landing in any order never beat the newest save', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    const freezes = []; const sends = [];
    const instances = [t.a, peerOf(t.api), peerOf(t.api)];
    for (let i = 0; i < 3; i++) {
        const hold = gate(); const real = t.api.storage.set; let frozen = false;
        t.api.storage.set = async items => { if (!frozen && isConfigWrite(items)) { frozen = true; await hold.promise; } return real(items); };
        sends.push(t.send(instances[i], { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: [`old-${i}.org`] } }));
        await until(() => frozen, `writer ${i} frozen`);
        freezes.push({ release: hold.open, restore: () => { t.api.storage.set = real; } });
        t.state.clockSkew += 60_000;                                // each lease expires before the next writer starts
        t.api.storage.set = real;
    }
    const newest = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['newest.org'] } });
    assert.ok(newest.ok, JSON.stringify(newest.error));
    for (const index of [1, 2, 0]) freezes[index].release();
    await Promise.all(sends);
    const after = await statusOf(t, t.b);
    assert.deepEqual(after.settings.domains, ['newest.org']);
    assert.deepEqual(ruleDomains(t.state), ['newest.org']);
    assert.deepEqual(storedConfig(t.state).domains, ['newest.org']);
});

// Freezes the Nth call of the browser's updateDynamicRules (the rule write itself), after the writer has made all its checks.
function freezeRuleWrite(t, nth = 1) {
    const hold = gate(); const real = t.api.dnr.updateDynamicRules; let calls = 0; const seen = { frozen: false };
    t.api.dnr.updateDynamicRules = async options => {
        calls += 1;
        if (calls === nth) { seen.frozen = true; await hold.promise; }
        return real(options);
    };
    return { seen, release: () => hold.open(), restore: () => { t.api.dnr.updateDynamicRules = real; } };
}

test('late RULE WRITE: a save frozen inside its rule write, resumed after a newer save, leaves rules that follow storage', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    const freeze = freezeRuleWrite(t);
    const oldSave = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'old.org'] } });
    await until(() => freeze.seen.frozen, 'A reached its rule write');
    t.state.clockSkew += 60_000;
    freeze.restore();
    const newer = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'newer.org'] } });
    assert.ok(newer.ok, JSON.stringify(newer.error));
    freeze.release(); await oldSave;
    assert.deepEqual(ruleDomains(t.state), ['example.com', 'newer.org'], 'rules follow the stored configuration immediately (before any status call)');
    assert.deepEqual(storedConfig(t.state).domains, ['example.com', 'newer.org']);
});

test('late ROLLBACK RULE WRITE: a rollback frozen inside its rule restore cannot leave the old snapshot behind a newer save', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    const real = t.api.storage.set; let failed = false;
    t.api.storage.set = async items => { if (!failed && isConfigWrite(items)) { failed = true; throw new Error('injected write failure'); } return real(items); };
    // A's rule installs succeed; its configuration write fails; its rollback (the 2nd rule write) is frozen.
    const freeze = freezeRuleWrite(t, 2);
    const oldSave = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'doomed.org'] } });
    await until(() => freeze.seen.frozen, 'A reached its rollback rule write');
    t.state.clockSkew += 60_000;
    freeze.restore(); t.api.storage.set = real;
    const newer = await t.send(t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'newer.org'] } });
    assert.ok(newer.ok, JSON.stringify(newer.error));
    freeze.release(); const late = await oldSave;
    assert.equal(late.ok, false);
    assert.deepEqual(ruleDomains(t.state), ['example.com', 'newer.org'], 'the stale rollback did not survive');
    assert.deepEqual(storedConfig(t.state).domains, ['example.com', 'newer.org']);
});

test('late ROLLBACK OF THE RECORD: a rollback frozen while restoring its own record cannot leave the store without a configuration', async () => {
    const t = pair(); await configured(t);
    const rev = (await statusOf(t)).revision;
    // A writes its record, then verification fails (the browser reports no rules) -> A starts restoring the previous configuration under its own name, frozen.
    const real = t.api.storage.set; const hold = gate(); const seen = { frozen: false }; let writes = 0;
    t.api.storage.set = async items => {
        if (isConfigWrite(items)) { writes += 1; if (writes === 2 && !seen.frozen) { seen.frozen = true; await hold.promise; } }
        const result = await real(items); if (isConfigWrite(items) && writes === 1) lying = true; return result;
    };
    const realGet = t.api.dnr.getDynamicRules; let lying = false;
    t.api.dnr.getDynamicRules = async () => (lying ? [] : realGet());
    const oldSave = t.send(t.a, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'doomed.org'] } });
    await until(() => seen.frozen, 'A reached the restore of its own record');
    lying = false; t.api.dnr.getDynamicRules = realGet;
    t.state.clockSkew += 60_000;
    await statusOf(t, t.b);                                          // another instance repairs and cleans up meanwhile
    hold.open(); await oldSave; t.api.storage.set = real;
    assert.ok(storedConfig(t.state), 'a configuration record still exists');
    const after = await statusOf(t, t.b);
    assert.equal(after.state, 'active', JSON.stringify(after.reasons));
    assert.deepEqual(after.settings.domains, ['example.com']);
});

test('compaction keeps the two newest records and the highest epoch entry; storage does not grow without bound', async () => {
    const t = pair(); await configured(t);
    for (let i = 0; i < 6; i++) {
        const rev = (await statusOf(t)).revision;
        await t.send(i % 2 ? t.a : t.b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', `site-${i}.org`] } });
    }
    await t.a.reconcile(); await t.b.reconcile();
    const records = Object.keys(t.state.storage).filter(key => key.startsWith('cfg:'));
    const epochs = Object.keys(t.state.storage).filter(key => key.startsWith('ep:'));
    assert.ok(records.length <= 2, records.join());
    assert.ok(epochs.length <= 2, epochs.join());
    assert.deepEqual(storedConfig(t.state).domains, ['example.com', 'site-5.org']);
});
