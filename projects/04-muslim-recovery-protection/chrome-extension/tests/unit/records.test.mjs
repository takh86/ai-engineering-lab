import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newestConfig, listConfigRecords, maxEpoch, obsoleteKeys, configKey } from '../../src/core/records.js';
import { createController } from '../../src/background/controller.js';
import { validateMessage } from '../../src/background/messages.js';
import { createFakeBrowser } from './fake-browser.mjs';

test('records: the effective configuration is the highest (epoch, instance); the legacy single key is epoch 0', () => {
    const snapshot = { config: { id: 'legacy' }, 'cfg:2:a': { id: 'a2' }, 'cfg:10:a': { id: 'a10' }, 'cfg:10:b': { id: 'b10' }, 'cfg:9:z': { id: 'z9' } };
    assert.equal(newestConfig(snapshot).value.id, 'b10');                      // 10 > 9 numerically (not as text); tie -> higher instance id
    assert.equal(newestConfig({ config: { id: 'legacy' } }).value.id, 'legacy');
    assert.equal(newestConfig({}), null);
    assert.deepEqual(listConfigRecords(snapshot).records.map(r => r.key), ['cfg:10:b', 'cfg:10:a', 'cfg:9:z', 'cfg:2:a', 'config']);
});

test('records: malformed or look-alike keys are reported, never ranked', () => {
    const listed = listConfigRecords({ 'cfg:x:a': 1, 'cfg:5': 1, 'cfg:5:': 1, 'cfg:5:a:b': 1, 'cfg:-1:a': 1, 'cfg:99999999999999999:a': 1, 'xcfg:5:a': 1, cfg: 1 });
    assert.equal(listed.records.length, 0);
    assert.equal(listed.invalidKeys.length, 6);
    assert.ok(listed.invalidKeys.includes('cfg:x:a') && listed.invalidKeys.includes('cfg:99999999999999999:a'));
    assert.ok(!listed.invalidKeys.includes('xcfg:5:a'));
});

test('records: epochs only grow; tampered epoch values are ignored', () => {
    assert.equal(maxEpoch({}), 0);
    assert.equal(maxEpoch({ 'ep:a': { n: 4 }, 'ep:b': { n: 9 }, 'cfg:12:c': 1 }), 12);
    assert.equal(maxEpoch({ 'ep:a': { n: -5 }, 'ep:b': { n: 1.5 }, 'ep:c': { n: 'x' }, 'ep:d': { n: 1e16 }, 'ep:e': null }), 0);
});

test('records: cleanup lists only keys that are dominated for ever (older records, lower epochs, expired or smaller sessions, long-dead mutex entries)', () => {
    const snapshot = {
        config: 1, 'cfg:1:a': 1, 'cfg:2:a': 1, 'cfg:3:b': 1,
        'ep:3:a': { n: 3 }, 'ep:7:b': { n: 7 }, 'ep:5:c': { n: 5 },
        'lock:1-1:a': { until: 500 }, 'lock:2-1:b': { until: 9000 }, 'lock:3-1:c': { until: 9000 }, 'lock:4-1:d': { until: 20000 }, lock: { until: 100 },
        'mx:dead': { choosing: false, ticket: 1, exp: 1000 }, 'mx:recent': { choosing: false, ticket: 1, exp: 9_000_000 }, 'mx:self': { choosing: false, ticket: 1, exp: 1 }
    };
    const stale = obsoleteKeys(snapshot, { now: 10000, leaseNow: 9_000_000 + 1000, selfMutexKey: 'mx:self' }).sort();
    // sessions: 'lock:4-1:d' (20000) is the only one that is neither expired (<= now 10000) nor dominated
    assert.deepEqual(stale, ['cfg:1:a', 'config', 'ep:3:a', 'ep:5:c', 'lock', 'lock:1-1:a', 'lock:2-1:b', 'lock:3-1:c', 'mx:dead'].sort());
    // two live entries with the SAME end time: exactly one stays (the one with the higher key name)
    const tie = obsoleteKeys({ 'lock:1-1:a': { until: 99999 }, 'lock:2-1:b': { until: 99999 } }, { now: 10000 });
    assert.deepEqual(tie, ['lock:1-1:a']);
});

test('a tampered record that is the newest makes the state corrupt (fail closed), it never falls back to an older record', async () => {
    const fake = createFakeBrowser(); const controller = createController(fake.api);
    const send = message => controller.handle(validateMessage(message));
    await send({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    fake.state.storage['cfg:999999:attacker'] = { v: 2, nonsense: true };
    const status = (await send({ type: 'GET_STATUS' })).status;
    assert.equal(status.state, 'unknown');
    assert.ok(status.reasons.includes('config_corrupt'));
    fake.state.storage['cfg:bad-format'] = 1;                                   // not a record key at all
    assert.ok((await send({ type: 'GET_STATUS' })).status.reasons.includes('config_corrupt'));
    assert.ok(configKey(3, 'abc').startsWith('cfg:3:'));
});

test('commitment cancellation and request lists have finite entry and lock-name bounds', async () => {
    const { parseCommitment, addReleases, COMMITMENT_LIMITS } = await import('../../src/core/commitment.js');
    const names = Array.from({ length: COMMITMENT_LIMITS.maxReleases }, (_, i) => `lock:${i}:worker`);
    const state = { exitDelay: 60, request: null, releases: names };
    assert.equal(parseCommitment(state).releases.length, COMMITMENT_LIMITS.maxReleases);
    assert.deepEqual(addReleases(names, [names[0]]), names, 'repeated already-released names do not consume capacity');
    assert.throws(() => addReleases(names, ['lock:new:worker']), error => error.code === 'commitment_release_limit');
    assert.throws(() => parseCommitment({ ...state, releases: [...names, 'lock:new:worker'] }), error => error.code === 'config_corrupt');
    assert.throws(() => parseCommitment({ ...state, releases: [`lock:${'a'.repeat(COMMITMENT_LIMITS.maxLockKeyLength)}`] }), error => error.code === 'config_corrupt');
    for (const keys of [[...names, 'lock:new:worker'], [`lock:${'a'.repeat(COMMITMENT_LIMITS.maxLockKeyLength)}`]]) {
        assert.throws(() => parseCommitment({ ...state, request: { readyAt: 1, until: 2, keys } }), error => error.code === 'config_corrupt');
    }
});

test('configuration, lock merging and record selection have no circular module dependencies', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const visiting = new Set(), visited = new Set();
    async function check(url) {
        const file = fileURLToPath(url);
        assert.equal(visiting.has(file), false, `circular module dependency through ${path.basename(file)}`);
        if (visited.has(file)) return;
        visiting.add(file);
        const source = await readFile(url, 'utf8');
        for (const [, relative] of source.matchAll(/(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gu)) {
            if (relative.startsWith('.')) await check(new URL(relative, url));
        }
        visiting.delete(file); visited.add(file);
    }
    for (const name of ['config', 'lock', 'records']) await check(new URL(`../../src/core/${name}.js`, import.meta.url));
});
