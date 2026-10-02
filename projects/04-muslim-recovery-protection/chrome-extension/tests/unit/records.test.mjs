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

test('records: compaction keeps the two newest records and the highest epoch entry, nothing else relevant', () => {
    const snapshot = { config: 1, 'cfg:1:a': 1, 'cfg:2:a': 1, 'cfg:3:b': 1, 'ep:a': { n: 3 }, 'ep:b': { n: 7 }, 'ep:c': { n: 5 }, 'lock:a': { until: 1 } };
    assert.deepEqual(obsoleteKeys(snapshot).sort(), ['cfg:1:a', 'config', 'ep:a', 'ep:c']);
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
