import { TabsiraError } from '../core/errors.js';
import { validMinutes, validExitDelay } from '../core/commitment.js';
import { LIMITS } from '../core/config.js';

// Trust is limited to our exact extension pages; feature-controller additionally checks each page capability.
export const ALLOWED_SENDER_PAGES = Object.freeze(['popup.html', 'options.html', 'onboarding.html', 'blocked.html', 'help.html', 'covenant.html', 'recovery.html']);
const MAX_MESSAGE_CHARS = LIMITS.importBytes + 4096;

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const hasExactly = (object, keys) => isObject(object) && Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));
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
        case 'GET_STATUS': case 'REPAIR': case 'GET_EXPORT': case 'GET_SCHEDULES': case 'REQUEST_EARLY_EXIT': case 'CANCEL_EARLY_EXIT':
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
            if ((!hasExactly(message, ['type', 'minutes']) && !hasExactly(message, ['type', 'minutes', 'exitDelay']))
                || !validMinutes(message.minutes) || (message.exitDelay !== undefined && !validExitDelay(message.exitDelay))) bad();
            return message.exitDelay === undefined ? { type: message.type, minutes: message.minutes } : { type: message.type, minutes: message.minutes, exitDelay: message.exitDelay };
        case 'SAVE_SCHEDULES':
            if ((!hasExactly(message, ['type', 'schedules']) && !hasExactly(message, ['type', 'schedules', 'baseRevision']))
                || !Array.isArray(message.schedules) || (message.baseRevision !== undefined && !isRevision(message.baseRevision))) bad();
            return { ...message };
        case 'BLOCK_CURRENT_SITE':
            if (!hasExactly(message, ['type', 'domain']) || typeof message.domain !== 'string' || message.domain.length > 2048) bad();
            return { ...message };
        case 'CONFIRM_EARLY_EXIT':
            if (!hasExactly(message, ['type', 'password']) || typeof message.password !== 'string' || message.password.length > 256) bad();
            return { ...message };
        default:
            return bad();
    }
}
