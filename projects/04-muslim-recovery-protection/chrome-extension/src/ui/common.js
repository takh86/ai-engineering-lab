// Shared helpers for every extension page. No logging, no storage of page content, no network.
import { settingsText, SUPPORTED_LANGUAGES } from './settings-copy.js';

const ext = globalThis.browser ?? globalThis.chrome;

let language = SUPPORTED_LANGUAGES.includes(ext?.i18n?.getUILanguage?.().split('-')[0]) ? ext.i18n.getUILanguage().split('-')[0] : 'ar';
let messages = null;
let profile = null;
export const uiLanguage = () => language;
export const featureT = (key, ...substitutions) => settingsText(language, key, substitutions);
export const t = (key, ...substitutions) => {
    if (key.startsWith('set_')) return featureT(key, ...substitutions);
    const entry = messages?.[key];
    if (!entry) return ext.i18n.getMessage(key, substitutions.map(String)) || key;
    let text = entry.message;
    for (const [name, item] of Object.entries(entry.placeholders ?? {})) {
        const value = item.content.replace(/\$(\d+)/gu, (_, n) => String(substitutions[Number(n) - 1] ?? ''));
        text = text.replace(new RegExp(`\\$${name}\\$`, 'giu'), value);
    }
    return text.replace(/\$(\d+)/gu, (_, n) => String(substitutions[Number(n) - 1] ?? ''));
};

export async function setPageLanguage(value) {
    language = SUPPORTED_LANGUAGES.includes(value) ? value : 'ar';
    try {
        const response = await fetch(ext.runtime.getURL(`_locales/${language}/messages.json`));
        if (!response.ok) throw new Error('unavailable');
        messages = await response.json();
    } catch { messages = null; }
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = t(document.documentElement.dataset.title ?? 'extShortName');
    applyI18n();
}

export async function getPublicProfile() { return send({ type: 'GET_PUBLIC_PROFILE' }); }

export function applyI18n(root = document) {
    for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    for (const node of root.querySelectorAll('[data-i18n-attr]')) {
        for (const pair of node.dataset.i18nAttr.split(';')) {
            const [attribute, key] = pair.split(':');
            node.setAttribute(attribute, t(key));
        }
    }
}

export async function initPage() {
    // The fallback strings, rather than an unsupported browser locale, determine the initial layout.
    document.documentElement.lang = t('ui_lang');
    document.documentElement.dir = t('ui_dir') === 'ltr' ? 'ltr' : 'rtl';
    document.title = t(document.documentElement.dataset.title ?? 'extShortName');
    applyI18n();
    const reply = await getPublicProfile();
    profile = reply.ok ? reply.profile : null;
    if (profile?.theme) document.documentElement.dataset.theme = profile.theme;
    await setPageLanguage(profile?.language ?? language);
    return { profile, security: reply.security ?? { enabled: false, locked: true } };
}

export async function send(message) {
    try {
        const reply = await ext.runtime.sendMessage(message);
        if (reply && typeof reply === 'object') return reply;
    } catch { /* fall through */ }
    return { ok: false, error: { code: 'worker_unreachable', params: {} }, status: null };
}

export const openOptions = () => ext.runtime.openOptionsPage();
export const extensionVersion = () => ext.runtime.getManifest().version;
export const hostOrigins = ['http://*/*', 'https://*/*'];
export const hasHostPermission = () => ext.permissions.contains({ origins: hostOrigins }).catch(() => false);
export const requestHostPermission = () => ext.permissions.request({ origins: hostOrigins }).catch(() => false);

/** Localized, user-text-free error message (line number appended when known). */
export function errorText(error) {
    const code = error?.code ?? 'unexpected';
    const params = error?.params ?? {};
    const key = `err_${code}`;
    if (!(messages?.[key] ?? ext.i18n.getMessage(key))) return t('set_unavailable');
    let text;
    if (code === 'phrase_length') text = t(key, params.min, params.max);
    else if (code === 'too_many_domains' || code === 'too_many_phrases') text = t(key, params.max);
    else text = t(key);
    return params.line ? text + t('err_line', params.line) : text;
}

const formatTime = ms => new Date(ms).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' });
export const formatDate = value => value ?? '—';

// Status glyphs (drawn, not coloured emoji): state is conveyed by icon + text + colour, never colour alone.
const SVG = 'http://www.w3.org/2000/svg';
const GLYPHS = {
    active: [['circle', { cx: 12, cy: 12, r: 9.5 }], ['path', { d: 'M7.5 12.5l3 3 6-6.5' }]],                       // check in circle: rules installed
    partial: [['path', { d: 'M12 3.5l9.5 16.5h-19z' }], ['path', { d: 'M12 10v4.5M12 17.2v.3' }]],                  // triangle with !
    unknown: [['circle', { cx: 12, cy: 12, r: 9.5 }], ['path', { d: 'M9.5 9.5a2.6 2.6 0 115 .8c0 1.6-2.5 2-2.5 3.7M12 17.2v.3' }]],  // ? in circle
    not_configured: [['circle', { cx: 12, cy: 12, r: 9.5, 'stroke-dasharray': '3 3' }], ['path', { d: 'M8.5 12h7' }]]  // dashed circle: nothing set up
};
function drawGlyph(svg, state) {
    svg.replaceChildren(...(GLYPHS[state] ?? GLYPHS.unknown).map(([tag, attributes]) => {
        const node = document.createElementNS(SVG, tag);
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
        return node;
    }));
}

/** Fills the standard status block. */
export function renderStatus(status, { box, reasonList, lock, incognito }) {
    const state = status?.state ?? 'unknown';
    box.dataset.state = state;
    drawGlyph(box.querySelector('.state-icon'), state);
    box.querySelector('.state-text').textContent = t(`state_${state}`);
    // Notes describe a matching limit without changing the protection state.
    reasonList.replaceChildren(
        ...(status?.reasons ?? []).map(reason => Object.assign(document.createElement('li'), { textContent: t(`reason_${reason}`) })),
        ...(status?.notes ?? []).map(note => Object.assign(document.createElement('li'), { textContent: t(`note_${note.code}`, note.count), className: 'note' })));
    reasonList.hidden = !reasonList.children.length;
    if (lock) lock.textContent = status?.lock?.active ? t('lock_active', `\u2066${formatTime(status.lock.until)}\u2069`) : t('lock_none');
    if (incognito) incognito.textContent = status?.incognitoAllowed === true ? t('incog_on') : status?.incognitoAllowed === false ? t('incog_off') : t('incog_unknown');
}

export const SAFE_TEST_URL = 'https://tabsira-selftest.test/';
