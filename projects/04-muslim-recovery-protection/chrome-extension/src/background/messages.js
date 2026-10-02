import { TabsiraError } from '../core/errors.js';
import { SESSION_MINUTES } from '../core/lock.js';
import { LIMITS } from '../core/config.js';

// Only these extension pages may talk to the service worker. blocked/help pages never do.
export const ALLOWED_SENDER_PAGES = Object.freeze(['popup.html', 'options.html', 'onboarding.html']);
const MAX_MESSAGE_CHARS = LIMITS.importBytes + 4096;

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const hasExactly = (object, keys) => isObject(object) && Object.keys(object).length === keys.length && keys.every(key => key in object);
const isRevision = value => Number.isSafeInteger(value) && value >= 0;

/** Sender must be our own extension page (not a content script, web page or another extension). */
export function isTrustedSender(sender, { id, baseUrl }) {
    if (!sender || sender.id !== id || typeof sender.url !== 'string') return false;
    if (sender.frameId !== undefined && sender.frameId !== 0) return false;
    return ALLOWED_SENDER_PAGES.some(page => {
        const prefix = `${baseUrl}${page}`;
        return sender.url === prefix || sender.url.startsWith(`${prefix}?`) || sender.url.startsWith(`${prefix}#`);
    });
}

/** Strict, allow-listed message schema. Anything else is rejected before any state is read. */
export function validateMessage(message) {
    if (!isObject(message) || typeof message.type !== 'string') throw new TabsiraError('bad_request');
    let size = 0;
    try { size = JSON.stringify(message).length; } catch { throw new TabsiraError('bad_request'); }
    if (size > MAX_MESSAGE_CHARS) throw new TabsiraError('bad_request');
    const bad = () => { throw new TabsiraError('bad_request'); };
    switch (message.type) {
        case 'GET_STATUS': case 'REPAIR': case 'GET_EXPORT':
            if (!hasExactly(message, ['type'])) bad();
            return { type: message.type };
        case 'SAVE_SETTINGS':
            if (!hasExactly(message, ['type', 'baseRevision', 'settings']) || !isRevision(message.baseRevision) || !isObject(message.settings)) bad();
            return { type: message.type, baseRevision: message.baseRevision, settings: message.settings };
        case 'IMPORT_SETTINGS':
            if (!hasExactly(message, ['type', 'baseRevision', 'text']) || !isRevision(message.baseRevision) || typeof message.text !== 'string') bad();
            return { type: message.type, baseRevision: message.baseRevision, text: message.text };
        case 'RESET':
            if (!hasExactly(message, ['type', 'baseRevision']) || !isRevision(message.baseRevision)) bad();
            return { type: message.type, baseRevision: message.baseRevision };
        case 'COMPLETE_ONBOARDING':
            if (!hasExactly(message, ['type', 'baseList', 'starterTerms']) || typeof message.baseList !== 'boolean' || typeof message.starterTerms !== 'boolean') bad();
            return { type: message.type, baseList: message.baseList, starterTerms: message.starterTerms };
        case 'START_SESSION':
            if (!hasExactly(message, ['type', 'minutes']) || !SESSION_MINUTES.includes(message.minutes)) bad();
            return { type: message.type, minutes: message.minutes };
        default:
            return bad();
    }
}
