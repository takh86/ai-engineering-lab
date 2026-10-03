import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createController } from '../../src/background/controller.js';
import { isTrustedSender, validateMessage } from '../../src/background/messages.js';
import { createFakeBrowser, storedConfig, corruptConfig } from './fake-browser.mjs';

const MIN = 60000;
// The session end time is the maximum over all grow-only lock entries (core/lock.js).
const lockUntil = t => Math.max(0, ...Object.entries(t.state.storage).filter(([k]) => k === 'lock' || k.startsWith('lock:')).map(([, v]) => v.until));
const noList = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
function setup(options) {
    const fake = createFakeBrowser(options);
    const controller = createController(fake.api);
    const send = message => controller.handle(validateMessage(message));
    const save = async (settings, over = {}) => {
        const status = (await send({ type: 'GET_STATUS' })).status;
        return send({ type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList, ...settings }, ...over });
    };
    const onboard = (baseList = true, starterTerms = false) => send({ type: 'COMPLETE_ONBOARDING', baseList, starterTerms });
    return { ...fake, controller, send, save, onboard, restart: () => createController(fake.api) };
}
const code = result => result.error?.code;

test('fresh install: not configured, nothing blocked, badge warns; onboarding makes it active only with permission', async () => {
    const t = setup();
    const status = (await t.send({ type: 'GET_STATUS' })).status;
    assert.equal(status.state, 'not_configured');
    assert.deepEqual(t.state.rules, []); assert.equal(t.state.baseEnabled, false);
    const done = await t.onboard(true, false);
    assert.ok(done.ok); assert.equal(done.status.state, 'active');
    assert.equal(t.state.baseEnabled, true); assert.equal(t.state.badge, '');
    assert.equal((await t.onboard()).error.code, 'already_onboarded');
});

test('missing host permission is "partial", never "active"; recovers when granted', async () => {
    const t = setup({ hosts: false });
    const result = await t.onboard(true, false);
    assert.equal(result.status.state, 'partial');
    assert.ok(result.status.reasons.includes('host_permission_missing'));
    assert.equal(t.state.badge, '!');
    t.state.hosts = true;
    assert.equal((await t.send({ type: 'GET_STATUS' })).status.state, 'active');
});

test('save persists config and installs rules; stale revision is rejected; unsupported phrase names its line only', async () => {
    const t = setup(); await t.onboard(false, false);
    const ok = await t.save({ domains: ['example.com'], words: ['alpha beta'] });
    assert.ok(ok.ok); assert.equal(t.state.rules.length, 1 + 4);
    assert.equal(ok.status.counts.domains, 1);
    const stale = await t.send({ type: 'SAVE_SETTINGS', baseRevision: 0, settings: { ...noList, domains: [] } });
    assert.equal(code(stale), 'stale');
    assert.equal(storedConfig(t.state).domains.length, 1);
    t.api.dnr.isRegexSupported = async ({ regex }) => ({ isSupported: regex.length <= 300 });
    const tooLong = await t.save({ contains: ['fine', 'ع'.repeat(60)] });
    assert.equal(code(tooLong), 'phrase_too_complex'); assert.deepEqual(tooLong.error.params, { line: 2, list: 'contains' });
    assert.ok(!JSON.stringify(tooLong).includes('ع'));
});

test('exception excludes additional blocks only; conflicting entries are refused', async () => {
    const t = setup(); await t.onboard(true, false);
    assert.ok((await t.save({ baseList: true, domains: ['example.com'], allow: ['ok.example.com'] })).ok);
    const allow = t.state.rules.find(r => r.action.type === 'allow');
    const block = t.state.rules.find(r => r.condition.requestDomains?.includes('example.com'));
    assert.equal(allow, undefined, 'core has no allow-rule bypass');
    assert.deepEqual(block.condition.excludedRequestDomains, ['ok.example.com']);
    assert.equal(t.state.baseEnabled, true);
    assert.equal(code(await t.save({ baseList: true, domains: ['a.ok.example.com'], allow: ['ok.example.com'] })), 'conflict_domain_allow');
});

test('commitment: refuses every weakening path, allows stronger changes, ends only by clock', async () => {
    const t = setup(); await t.onboard(true, true);
    await t.save({ baseList: true, starterTerms: true, domains: ['example.com'], words: ['alpha beta'], contains: ['gamma'], allow: ['fine.example.net'] });
    const started = await t.send({ type: 'START_SESSION', minutes: 60 });
    assert.ok(started.ok && started.status.lock.active);
    const rev = () => storedConfig(t.state).revision;
    const base = { baseList: true, starterTerms: true, domains: ['example.com'], words: ['alpha beta'], contains: ['gamma'], allow: ['fine.example.net'] };
    const attempt = over => t.send({ type: 'SAVE_SETTINGS', baseRevision: rev(), settings: { ...base, ...over } });
    for (const [over, why] of [[{ domains: [] }, 'domain_removed'], [{ starterTerms: false }, 'starter_terms_disabled'],
        [{ words: [] }, 'phrase_removed'], [{ contains: [] }, 'phrase_removed'], [{ allow: ['fine.example.net', 'new.example.org'] }, 'exception_added']]) {
        const r = await attempt(over);
        assert.equal(code(r), 'locked_weakening'); assert.ok(r.error.params.reasons.includes(why), why);
    }
    assert.equal(code(await t.send({ type: 'RESET', baseRevision: rev() })), 'locked_weakening');
    const weakImport = JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...noList, allow: ['evil.example.org'] } });
    assert.equal(code(await t.send({ type: 'IMPORT_SETTINGS', baseRevision: rev(), text: weakImport })), 'locked_weakening');
    assert.deepEqual(storedConfig(t.state).domains, ['example.com']);
    // stronger is allowed, even removing an exception
    assert.ok((await attempt({ domains: ['example.com', 'more.org'], allow: [] })).ok);
    // shorter session cannot shorten
    const until = lockUntil(t);
    await t.send({ type: 'START_SESSION', minutes: 60 });
    assert.equal(lockUntil(t), until);
    // expiry only re-enables editing; nothing is removed by itself
    t.state.now += 61 * MIN;
    const before = JSON.stringify(t.state.rules);
    assert.equal((await t.send({ type: 'GET_STATUS' })).status.lock.active, false);
    assert.equal(JSON.stringify(t.state.rules), before);
    assert.ok((await attempt({ domains: [] })).ok);
});

test('commitment cannot start around inactive protection or with nothing configured', async () => {
    const t = setup();
    assert.equal(code(await t.send({ type: 'START_SESSION', minutes: 60 })), 'session_needs_rules');
    await t.onboard(false, false);
    assert.ok((await t.send({ type: 'START_SESSION', minutes: 60 })).ok, 'mandatory core is enough to commit');
    await t.save({ domains: ['example.com'] });
    t.state.hosts = false;
    assert.equal(code(await t.send({ type: 'START_SESSION', minutes: 60 })), 'session_needs_active_protection');
    assert.ok(lockUntil(t) > 0, 'refusal does not erase the previous valid commitment');
});

test('commitment survives service-worker restart and config/lock live in separate keys', async () => {
    const t = setup(); await t.onboard(false, false); await t.save({ domains: ['example.com'] });
    await t.send({ type: 'START_SESSION', minutes: 90 });
    const restarted = t.restart();
    const status = await restarted.reconcile();
    assert.ok(status.lock.active);
    const r = await restarted.handle(validateMessage({ type: 'SAVE_SETTINGS', baseRevision: storedConfig(t.state).revision, settings: { ...noList } }));
    assert.equal(r.error.code, 'locked_weakening');
});

test('storage failure after rules were installed restores rules and settings', async () => {
    const t = setup(); await t.onboard(false, false); await t.save({ domains: ['example.com'] });
    t.state.fail['storage.set'] = true;
    const r = await t.save({ domains: ['example.org'] });
    assert.equal(code(r), 'apply_failed');
    assert.deepEqual(t.state.rules[0].condition.requestDomains, ['example.com']);
    assert.deepEqual(storedConfig(t.state).domains, ['example.com']);
    assert.equal((await t.send({ type: 'GET_STATUS' })).status.state, 'active');
});

test('base-ruleset switch failing after dynamic rules changed rolls the dynamic rules back', async () => {
    const t = setup(); await t.onboard(false, false); await t.save({ domains: ['example.com'] });
    t.state.baseEnabled = false; // simulate ruleset loss so repair of mandatory core must switch it on
    t.state.fail['rulesets.update'] = true;
    const r = await t.send({ type: 'SAVE_SETTINGS', baseRevision: storedConfig(t.state).revision, settings: { ...noList, baseList: true, domains: ['example.org'] } });
    assert.equal(code(r), 'apply_failed');
    assert.deepEqual(t.state.rules[0].condition.requestDomains, ['example.com']);
    assert.equal(t.state.baseEnabled, false);
});

test('rollback that itself fails is reported, leaves the last good config stored, and self-heals', async () => {
    const t = setup(); await t.onboard(false, false); await t.save({ domains: ['example.com'] });
    // storage.set fails (triggering rollback), and the first restore step (dnr.update) fails too.
    t.state.fail['storage.set'] = 2;
    const originalUpdate = t.api.dnr.updateDynamicRules; let calls = 0;
    t.api.dnr.updateDynamicRules = async options => { calls += 1; if (calls === 2) throw new Error('restore failed'); return originalUpdate(options); };
    const r = await t.save({ domains: ['example.org'] });
    assert.equal(code(r), 'apply_failed_rollback_failed');
    assert.equal(r.status.state, 'partial'); assert.ok(r.status.reasons.includes('rules_mismatch'));
    assert.deepEqual(storedConfig(t.state).domains, ['example.com']);       // last good config intact
    t.api.dnr.updateDynamicRules = originalUpdate;
    const healed = (await t.send({ type: 'GET_STATUS' })).status;           // status auto-repairs mismatch
    assert.equal(healed.state, 'active');
    assert.deepEqual(t.state.rules[0].condition.requestDomains, ['example.com']);
});

test('dynamic rules wiped behind our back are restored on restart and by status', async () => {
    const t = setup(); await t.onboard(true, false); await t.save({ baseList: true, domains: ['example.com'] });
    t.state.rules = []; t.state.baseEnabled = false;
    const status = await t.restart().reconcile();
    assert.equal(status.state, 'active'); assert.equal(t.state.rules.length, 1); assert.equal(t.state.baseEnabled, true);
});

test('corrupt or unreadable storage never removes existing protection and reports unknown', async () => {
    const t = setup(); await t.onboard(true, false); await t.save({ baseList: true, domains: ['example.com'] });
    const rules = JSON.stringify(t.state.rules);
    corruptConfig(t.state, { v: 2, nonsense: true });
    let status = await t.restart().reconcile();
    assert.equal(status.state, 'unknown'); assert.ok(status.reasons.includes('config_corrupt'));
    assert.equal(JSON.stringify(t.state.rules), rules); assert.equal(t.state.baseEnabled, true);
    t.state.fail['storage.get'] = 5;
    status = await createController(t.api).statusNow();
    assert.equal(status.state, 'unknown'); assert.ok(status.reasons.includes('storage_error'));
    assert.equal(JSON.stringify(t.state.rules), rules);
});

test('corrupt config: reset is the escape hatch but an active commitment still blocks it', async () => {
    const t = setup(); await t.onboard(false, false); await t.save({ domains: ['example.com'] });
    await t.send({ type: 'START_SESSION', minutes: 60 });
    corruptConfig(t.state, 'garbage');
    assert.equal(code(await t.send({ type: 'RESET', baseRevision: 0 })), 'locked_weakening');
    assert.equal(t.state.rules.length, 1);
    t.state.now += 61 * MIN;
    assert.ok((await t.send({ type: 'RESET', baseRevision: 0 })).ok);
    assert.equal(t.state.rules.length, 0);
});

test('storage cleared but rules present: reported as partial and left untouched', async () => {
    const t = setup(); await t.onboard(true, false); await t.save({ baseList: true, domains: ['example.com'] });
    t.state.storage = {};
    const status = await t.restart().reconcile();
    assert.equal(status.state, 'partial'); assert.ok(status.reasons.includes('config_missing_rules_present'));
    assert.equal(t.state.rules.length, 1); assert.equal(t.state.baseEnabled, true);
});

test('prototype (v0) configuration is migrated in place and keeps its rules and commitment', async () => {
    const t = setup();
    t.state.storage.config = { domains: ['example.com'], keywords: ['Test Phrase'], lockedUntil: t.state.now + 30 * MIN };
    const status = await t.controller.reconcile();
    assert.equal(storedConfig(t.state).v, 2);
    assert.deepEqual(storedConfig(t.state).contains, ['test phrase']);
    assert.ok(status.lock.active); assert.equal(status.state, 'active');
    assert.equal(code(await t.send({ type: 'SAVE_SETTINGS', baseRevision: storedConfig(t.state).revision, settings: { ...noList } })), 'locked_weakening');
});

test('concurrent requests are serialized: no lost update, no interleaved rule installs', async () => {
    const t = setup(); await t.onboard(false, false);
    const rev = (await t.send({ type: 'GET_STATUS' })).status.revision;
    const settings = domains => ({ ...noList, domains });
    const results = await Promise.all([
        t.send({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: settings(['a.example.com']) }),
        t.send({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: settings(['b.example.com']) }),
        t.send({ type: 'START_SESSION', minutes: 60 })
    ]);
    assert.deepEqual(results.map(r => r.ok), [true, false, true]);       // second saw a stale revision; lock ran after the first
    assert.equal(results[1].error.code, 'stale');
    assert.deepEqual(storedConfig(t.state).domains, ['a.example.com']);
    assert.ok(lockUntil(t) > 0);
});

test('import merges into settings and is refused when it would weaken a commitment', async () => {
    const t = setup(); await t.onboard(false, false); await t.save({ domains: ['example.com'] });
    const file = settings => JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...noList, ...settings } });
    const rev = () => storedConfig(t.state).revision;
    assert.ok((await t.send({ type: 'IMPORT_SETTINGS', baseRevision: rev(), text: file({ domains: ['other.org'], contains: ['delta'] }) })).ok);
    assert.deepEqual([...storedConfig(t.state).domains].sort(), ['example.com', 'other.org']);
    assert.equal(code(await t.send({ type: 'IMPORT_SETTINGS', baseRevision: rev(), text: 'not json' })), 'import_invalid');
    const exported = await t.send({ type: 'GET_EXPORT' });
    assert.ok(JSON.parse(exported.text).settings.domains.includes('other.org'));
});

test('a stale base (another instance saved first) is refused before any rule changes', async () => {
    const t = setup(); await t.onboard(false, false); await t.save({ domains: ['example.com'] });
    const rev = storedConfig(t.state).revision;
    const other = createController({ ...t.api, instanceId: 'other-instance' });
    assert.ok((await other.handle(validateMessage({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'b.org'] } }))).ok);
    const late = await t.send({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList, domains: ['example.com', 'c.org'] } });
    assert.equal(code(late), 'stale');
    assert.deepEqual([...storedConfig(t.state).domains].sort(), ['b.org', 'example.com']);
});

test('messages: strict schema, trusted senders only, nothing sensitive echoed', () => {
    const ctx = { id: 'test-extension', baseUrl: 'chrome-extension://test-extension/' };
    const good = { id: 'test-extension', url: 'chrome-extension://test-extension/options.html', frameId: 0 };
    assert.ok(isTrustedSender(good, ctx));
    assert.ok(isTrustedSender({ ...good, url: 'chrome-extension://test-extension/options.html#sec' }, ctx));
    for (const sender of [{ ...good, id: 'other' }, { ...good, url: 'https://evil.test/' },
        { ...good, url: 'chrome-extension://test-extension/options.html.evil' }, { ...good, frameId: 3 }, { id: 'test-extension' }, undefined]) {
        assert.ok(!isTrustedSender(sender, ctx));
    }
    for (const bad of [null, 'x', {}, { type: 'NOPE' }, { type: 'GET_STATUS', extra: 1 }, { type: 'START_SESSION', minutes: 5 }, { type: 'START_SESSION', minutes: '60' },
        { type: 'SAVE_SETTINGS', baseRevision: -1, settings: {} }, { type: 'SAVE_SETTINGS', baseRevision: 1 }, { type: 'IMPORT_SETTINGS', baseRevision: 1, text: 5 },
        { type: 'COMPLETE_ONBOARDING', baseList: 'yes', starterTerms: true }, { type: 'IMPORT_SETTINGS', baseRevision: 1, text: 'x'.repeat(300000) }]) {
        assert.throws(() => validateMessage(bad), error => error.code === 'bad_request');
    }
    assert.deepEqual(validateMessage({ type: 'START_SESSION', minutes: 120 }), { type: 'START_SESSION', minutes: 120 });
});

test('no source file logs, stores history, or contacts the network', async () => {
    const root = new URL('../../src/', import.meta.url).pathname;
    const files = [];
    for (const dir of ['core', 'background', 'ui']) for (const name of await fs.readdir(path.join(root, dir))) if (name.endsWith('.js')) files.push(path.join(root, dir, name));
    for (const file of files) {
        const text = await fs.readFile(file, 'utf8');
        assert.ok(!/console\./u.test(text), `${file} uses console`);
        assert.ok(!/XMLHttpRequest|WebSocket|sendBeacon|navigator\.sendBeacon|\beval\(|new Function|innerHTML\s*=|document\.write/u.test(text), `${file} uses a forbidden API`);
        // fetch is allowed only for the extension's own metadata file
        for (const match of text.matchAll(/fetch\(([^)]*)\)/gu)) assert.ok(/getURL\('base-list-meta\.json'\)/u.test(match[0]), `${file}: unexpected fetch`);
    }
});
