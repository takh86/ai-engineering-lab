// The service-worker entry point is loaded against a stub of the extension API: the watchdog alarm must be created on start, must survive an
// existing alarm, and must trigger a rules check that REPAIRS a mismatch (the state left by a late rule write whose worker was terminated).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeBrowser } from './fake-browser.mjs';

test('service worker: registers the watchdog alarm, checks on every start, and rebuilds rules left behind by a terminated late writer', async () => {
    const fake = createFakeBrowser();
    const listeners = { alarm: [], message: [] }; const created = [];
    const noop = { addListener() {} };
    globalThis.chrome = {
        runtime: { id: fake.api.id, getURL: p => `${fake.api.baseUrl}${p}`, onMessage: { addListener: fn => listeners.message.push(fn) }, onStartup: noop, onInstalled: noop },
        permissions: { onAdded: noop, onRemoved: noop, contains: fake.api.permissions.contains },
        alarms: { getAll: async () => created, clear: async () => true, get: async () => created.at(-1), create: async (name, info) => { created.push({ name, ...info }); }, onAlarm: { addListener: fn => listeners.alarm.push(fn) } },
        storage: { local: { get: async keys => (keys === null ? fake.api.storage.getAll() : fake.api.storage.get(keys)), set: fake.api.storage.set, remove: fake.api.storage.remove, setAccessLevel: async () => {} } },
        declarativeNetRequest: { ...fake.api.dnr }, extension: { isAllowedIncognitoAccess: async () => true },
        action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} }, tabs: { create: async () => {} }
    };
    globalThis.fetch = async () => ({ json: async () => ({ domainCount: 1, version: 't', upstreamDate: 'd' }) });
    await import('../../src/background/service-worker.js');
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(created.length, 1, 'the watchdog alarm was created once');
    assert.equal(created[0].name, 'tabsira-verify');
    assert.ok(created[0].periodInMinutes <= 1, 'it fires at least once a minute');
    assert.equal(listeners.alarm.length, 1);
    // A configured state whose browser rules were replaced by a stale writer, with no worker left to reconcile it.
    fake.state.storage['cfg:1:setup'] = { v: 2, revision: 2, onboarded: true, baseList: false, starterTerms: false, domains: ['example.com'], allow: [], words: [], contains: [] };
    fake.state.rules = [];
    listeners.alarm[0]({ name: 'some-other-alarm' });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(fake.state.rules.length, 0, 'an unrelated alarm does nothing');
    listeners.alarm[0]({ name: 'tabsira-verify' });
    for (let i = 0; i < 100 && !fake.state.rules.length; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(fake.state.rules.flatMap(rule => rule.condition.requestDomains).filter(domain => domain !== 'tabsira-selftest.test'), ['example.com'], 'the watchdog rebuilt the rules from the stored settings');
    // The dedicated boundary alarm takes the same repair path, without waiting for the
    // one-minute watchdog; obsolete boundary wakes reconcile effective storage only.
    fake.state.rules = [];
    listeners.alarm[0]({ name: 'tabsira-schedule-boundary' });
    for (let i = 0; i < 100 && !fake.state.rules.length; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(fake.state.rules.flatMap(rule => rule.condition.requestDomains).filter(domain => domain !== 'tabsira-selftest.test'), ['example.com']);
    delete globalThis.chrome; delete globalThis.fetch;
});
