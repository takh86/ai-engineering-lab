import { createBrowserApi } from './browser-api.js';
import { createController } from './controller.js';
import { isTrustedSender, validateMessage } from './messages.js';
import { toErrorPayload } from '../core/errors.js';

const ext = globalThis.browser ?? globalThis.chrome;
const api = createBrowserApi(ext);
const controller = createController(api);

// Everything below only registers listeners; no timers, no persistent in-memory state beyond caches.
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isTrustedSender(sender, api)) return false;
    let clean;
    try { clean = validateMessage(message); }
    catch (error) { sendResponse({ ok: false, error: toErrorPayload(error), status: null }); return false; }
    controller.handle(clean).then(sendResponse, () => sendResponse({ ok: false, error: { code: 'unexpected', params: {} }, status: null }));
    return true;
});

// Watchdog. Browser rules are derived state and the browser offers no conditional write: a worker that was frozen past its lease can still land a
// stale rule write and then be terminated before its own reconciliation runs (review of 516a4ff; test S16d). Nothing else wakes a terminated worker,
// so an alarm wakes it periodically (and every start of the worker checks once): if the rules differ from the stored settings they are rebuilt under
// the write lock. Read-only when everything matches. Recovery time: see README "Recovery".
const WATCHDOG_ALARM = 'tabsira-verify';
const verifyRules = () => controller.handle({ type: 'GET_STATUS' }).catch(() => {});     // GET_STATUS repairs a rules mismatch under the write lock
const ensureWatchdog = async () => {
    try { if (!(await ext.alarms.get(WATCHDOG_ALARM))) await ext.alarms.create(WATCHDOG_ALARM, { delayInMinutes: 1, periodInMinutes: 1 }); } catch { /* alarms unavailable: other triggers still apply */ }
};
ext.alarms?.onAlarm.addListener(alarm => { if (alarm.name === WATCHDOG_ALARM) verifyRules(); });
ensureWatchdog();
verifyRules();

const start = async () => { await api.restrictStorage(); await ensureWatchdog(); await controller.reconcile(); };
ext.runtime.onStartup.addListener(start);
ext.runtime.onInstalled.addListener(async details => {
    await start();
    if (details.reason === 'install') await ext.tabs?.create?.({ url: ext.runtime.getURL('onboarding.html') });
});
ext.permissions.onAdded?.addListener(() => { controller.reconcile(); });
ext.permissions.onRemoved?.addListener(() => { controller.reconcile(); });
