import { TabsiraError } from './errors.js';

export const SECURITY_LIMITS = Object.freeze({ bytes: 262144, text: 4000, notes: 16000, customSteps: 100, favorites: 500, reviews: 100 });
export const NEEDS = Object.freeze(['hunger', 'fatigue', 'loneliness', 'anger', 'boredom', 'stress']);
export const PRAYERS = Object.freeze(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
export const PRAYER_METHODS = Object.freeze(['MWL', 'ISNA', 'Egypt', 'Karachi']);
export const fail = (code = 'bad_request') => { throw new TabsiraError(code); };
export const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export function object(value, allowed, required = []) {
    if (!plain(value) || Object.getOwnPropertySymbols(value).length) fail();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
        if (!allowed.includes(key) || !descriptor.enumerable || !('value' in descriptor)) fail();
    }
    if (required.some(key => !Object.hasOwn(value, key))) fail();
    return value;
}
export function boundedJson(value, maxBytes = SECURITY_LIMITS.bytes) {
    let count = 0;
    const seen = new Set();
    function visit(item, depth) {
        if (++count > 12000 || depth > 8) fail();
        if (item === null || typeof item === 'boolean') return;
        if (typeof item === 'number') { if (!Number.isFinite(item)) fail(); return; }
        if (typeof item === 'string') { if (item.length > maxBytes) fail(); return; }
        if (typeof item !== 'object' || seen.has(item)) fail();
        seen.add(item);
        if (Array.isArray(item)) {
            if (Object.getPrototypeOf(item) !== Array.prototype || Object.getOwnPropertySymbols(item).length
                || item.length > 1000 || Object.keys(item).length !== item.length) fail();
            for (let index = 0; index < item.length; index++) {
                const d = Object.getOwnPropertyDescriptor(item, String(index));
                if (!d || !('value' in d)) fail();
                visit(d.value, depth + 1);
            }
        } else {
            if (!plain(item) || Object.getOwnPropertySymbols(item).length) fail();
            for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
                if (['__proto__', 'constructor', 'prototype'].includes(key) || !d.enumerable || !('value' in d)) fail();
                visit(d.value, depth + 1);
            }
        }
        seen.delete(item);
    }
    visit(value, 0);
    if (new TextEncoder().encode(JSON.stringify(value)).length > maxBytes) fail();
}
const text = (value, max = SECURITY_LIMITS.text) => {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail();
    return value;
};
const list = (value, max, parse) => {
    if (!Array.isArray(value) || value.length > max) fail();
    return value.map(parse);
};
const unique = value => { if (new Set(value).size !== value.length) fail(); return value; };
const needList = value => unique(list(value, NEEDS.length, item => { if (!NEEDS.includes(item)) fail(); return item; }));
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(value)) fail(); return value; };

export const defaultProfile = () => ({ language: 'ar', religion: null, faith: false, theme: 'light', prayer: {
    enabled: false, latitude: null, longitude: null, city: '', timeZone: '', asr: 'standard', method: 'MWL', adjustment: 0, prayers: [...PRAYERS]
} });
export function parsePrayer(value, base = defaultProfile().prayer) {
    object(value, ['enabled', 'latitude', 'longitude', 'city', 'timeZone', 'asr', 'method', 'adjustment', 'prayers']);
    const result = { ...base, ...value };
    if (typeof result.enabled !== 'boolean' || !PRAYER_METHODS.includes(result.method)) fail();
    for (const [key, limit] of [['latitude', 90], ['longitude', 180]]) {
        if (result[key] !== null && (typeof result[key] !== 'number' || !Number.isFinite(result[key]) || Math.abs(result[key]) > limit)) fail();
    }
    if (!Number.isInteger(result.adjustment) || Math.abs(result.adjustment) > 120 || !['standard', 'hanafi'].includes(result.asr)) fail();
    result.city = text(result.city, 200);
    result.timeZone = text(result.timeZone, 100);
    if (result.timeZone) { try { new Intl.DateTimeFormat('en', { timeZone: result.timeZone }); } catch { fail(); } }
    result.prayers = unique(list(result.prayers, PRAYERS.length, item => { if (!PRAYERS.includes(item)) fail(); return item; }));
    if (result.enabled && (result.latitude === null || result.longitude === null || !result.prayers.length)) fail();
    return result;
}
export function parseProfile(value, base = defaultProfile()) {
    object(value, ['language', 'religion', 'faith', 'theme', 'prayer']);
    const result = { ...base, ...value };
    if (!['ar', 'en', 'de'].includes(result.language) || ![null, 'muslim', 'non-muslim'].includes(result.religion)
        || typeof result.faith !== 'boolean' || !['light', 'dark'].includes(result.theme)) fail();
    result.prayer = parsePrayer(value.prayer ?? {}, base.prayer);
    return result;
}
export const defaultVault = () => ({ covenant: null, notes: '', customSteps: [], favorites: [], unsuitable: [], reviews: [] });
export function parseVault(value) {
    boundedJson(value);
    object(value, ['covenant', 'notes', 'customSteps', 'favorites', 'unsuitable', 'reviews']);
    const result = { ...defaultVault(), ...value };
    if (result.covenant !== null) {
        const c = object(result.covenant, ['purpose', 'harms', 'values', 'needs', 'plan'], ['purpose', 'harms', 'values', 'needs', 'plan']);
        result.covenant = { purpose: text(c.purpose), harms: text(c.harms), values: text(c.values), needs: needList(c.needs), plan: text(c.plan) };
    }
    result.notes = text(result.notes, SECURITY_LIMITS.notes);
    result.customSteps = list(result.customSteps, SECURITY_LIMITS.customSteps, item => {
        object(item, ['id', 'text', 'needs'], ['id', 'text', 'needs']);
        return { id: id(item.id), text: text(item.text), needs: needList(item.needs) };
    });
    unique(result.customSteps.map(item => item.id));
    result.favorites = unique(list(result.favorites, SECURITY_LIMITS.favorites, id));
    result.unsuitable = unique(list(result.unsuitable, SECURITY_LIMITS.favorites, id));
    result.reviews = list(result.reviews, SECURITY_LIMITS.reviews, item => {
        object(item, ['stageNeeds', 'task', 'care', 'trigger', 'ifText', 'thenText', 'createdAt'], ['stageNeeds', 'task', 'care', 'trigger', 'ifText', 'thenText', 'createdAt']);
        if (!Number.isSafeInteger(item.createdAt) || item.createdAt < 0 || item.createdAt > 8640000000000000) fail();
        return { stageNeeds: needList(item.stageNeeds), task: text(item.task), care: text(item.care), trigger: text(item.trigger), ifText: text(item.ifText), thenText: text(item.thenText), createdAt: item.createdAt };
    });
    boundedJson(result);
    return result;
}
export function validatePassword(value) {
    if (typeof value !== 'string' || value.length < 8 || value.length > 256) fail('password_invalid');
    return value;
}
