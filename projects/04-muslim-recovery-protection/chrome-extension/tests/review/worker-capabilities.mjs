import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const dir = resolve(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
const { createFakeBrowser } = await import(pathToFileURL(resolve(dir, 'tests/unit/fake-browser.mjs')).href);
const { api, state } = createFakeBrowser();
let listener;
const noopEvent = { addListener() {} };
const alarms = new Map();
globalThis.chrome = {
    runtime: { id: api.id, getURL: path => `${api.baseUrl}${path}`, onMessage: { addListener(fn) { listener = fn; } }, onStartup: noopEvent, onInstalled: noopEvent },
    storage: { local: { get: keys => keys === null ? api.storage.getAll() : api.storage.get(keys), set: api.storage.set, remove: api.storage.remove } },
    declarativeNetRequest: api.dnr,
    alarms: { get: async name => alarms.get(name), getAll: async () => [...alarms.values()], create: async (name, data) => { alarms.set(name, { name, ...data }); }, clear: async name => alarms.delete(name), onAlarm: noopEvent },
    notifications: { create: async () => {} },
    permissions: { contains: api.permissions.contains, onAdded: noopEvent, onRemoved: noopEvent },
    extension: { isAllowedIncognitoAccess: async () => true },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { create: async () => {} }
};
await import(pathToFileURL(resolve(dir, 'src/background/service-worker.js')).href);
const sender = page => ({ id: api.id, url: `${api.baseUrl}${page}`, frameId: 0 });
function dispatch(message, source = sender('options.html')) {
    return new Promise(resolve => { const handled = listener(message, source, resolve); if (handled === false) resolve(undefined); });
}
const okay = reply => { assert.equal(reply.ok, true, JSON.stringify(reply)); return reply; };
okay(await dispatch({ type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: false }));
okay(await dispatch({ type: 'SAVE_PRIVATE_DATA', data: { notes: 'PRIVATE_CANARY', covenant: { purpose: 'secret', harms: '', values: '', needs: [], plan: '' } } }));
const recoveryCode = okay(await dispatch({ type: 'SET_PASSWORD', password: 'validpassword' })).recoveryCode;
okay(await dispatch({ type: 'LOCK_ACCESS' }));
for (const type of ['GET_EXPORT', 'GET_SCHEDULES', 'RESET', 'SAVE_SETTINGS', 'IMPORT_SETTINGS', 'REQUEST_EARLY_EXIT']) {
    const reply = await dispatch({ type, ...(type === 'RESET' ? { baseRevision: 1 } : type === 'SAVE_SETTINGS' ? { baseRevision: 1, settings: {} } : type === 'IMPORT_SETTINGS' ? { baseRevision: 1, text: '{}' } : {}) });
    assert.equal(reply.ok, false); assert.equal(reply.error.code, 'access_locked');
}
const status = okay(await dispatch({ type: 'GET_STATUS' })).status;
assert.equal(status.settings, undefined); assert.equal(status.schedules.items, undefined); assert.equal(JSON.stringify(status).includes('PRIVATE_CANARY'), false);
for (const page of ['blocked.html', 'help.html', 'recovery.html', 'covenant.html']) {
    okay(await dispatch({ type: 'GET_PUBLIC_PROFILE' }, sender(page)));
    for (const type of ['GET_STATUS', 'GET_EXPORT', 'RESET', 'START_SESSION', 'UNLOCK', 'RECOVER_PASSWORD', 'PRAYER_ENABLE']) {
        const reply = await dispatch({ type, password: 'validpassword', recoveryCode }, sender(page)); assert.equal(reply.ok, false, `${page}:${type}`);
    }
}
okay(await dispatch({ type: 'UNLOCK', password: 'validpassword' }));
for (const [page, keys] of [['help.html', ['customSteps', 'favorites', 'unsuitable']], ['recovery.html', ['reviews']], ['covenant.html', ['covenant']]]) assert.deepEqual(Object.keys(okay(await dispatch({ type: 'GET_PRIVATE_DATA' }, sender(page))).data).sort(), keys.sort());
assert.equal((await dispatch({ type: 'SAVE_PRIVATE_DATA', data: { notes: 'overwrite' } }, sender('help.html'))).ok, false);
for (const url of ['https://example.com/options.html', `${api.baseUrl}options.htmlx`, `${api.baseUrl}options.html/evil`, `${api.baseUrl}options.html@evil/`]) assert.equal(await dispatch({ type: 'GET_PRIVATE_DATA' }, { ...sender('options.html'), url }), undefined);
assert.equal(await dispatch({ type: 'GET_PRIVATE_DATA' }, { ...sender('options.html'), frameId: 1 }), undefined);
const protection = Object.fromEntries(Object.entries(state.storage).filter(([key]) => key.startsWith('cfg:') || key.startsWith('lock')));
okay(await dispatch({ type: 'RECOVER_PASSWORD', recoveryCode, password: 'newpassword' }));
assert.deepEqual(Object.fromEntries(Object.entries(state.storage).filter(([key]) => key.startsWith('cfg:') || key.startsWith('lock'))), protection);
console.log(JSON.stringify({ repo: dir, result: 'PASS', coverage: 'Actual service-worker listener with fake WebExtension APIs; sender capability boundaries, worker password gates, status redaction, recovery protection invariance' }, null, 2));
