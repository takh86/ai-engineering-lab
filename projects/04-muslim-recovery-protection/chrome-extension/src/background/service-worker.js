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

const start = async () => { await api.restrictStorage(); await controller.reconcile(); };
ext.runtime.onStartup.addListener(start);
ext.runtime.onInstalled.addListener(async details => {
    await start();
    if (details.reason === 'install') await ext.tabs?.create?.({ url: ext.runtime.getURL('onboarding.html') });
});
ext.permissions.onAdded?.addListener(() => { controller.reconcile(); });
ext.permissions.onRemoved?.addListener(() => { controller.reconcile(); });
