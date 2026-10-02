// Shared helpers for every extension page. No logging, no storage of page content, no network.
const ext = globalThis.browser ?? globalThis.chrome;

export const t = (key, ...substitutions) => ext.i18n.getMessage(key, substitutions.map(String)) || key;

export function applyI18n(root = document) {
    for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    for (const node of root.querySelectorAll('[data-i18n-attr]')) {
        for (const pair of node.dataset.i18nAttr.split(';')) {
            const [attribute, key] = pair.split(':');
            node.setAttribute(attribute, t(key));
        }
    }
}

export function initPage() {
    document.documentElement.lang = ext.i18n.getUILanguage();
    document.documentElement.dir = ext.i18n.getMessage('@@bidi_dir') === 'ltr' ? 'ltr' : 'rtl';
    document.title = t(document.documentElement.dataset.title ?? 'extShortName');
    applyI18n();
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
    if (!ext.i18n.getMessage(key)) return t('err_unexpected');
    let text;
    if (code === 'phrase_length') text = t(key, params.min, params.max);
    else if (code === 'too_many_domains' || code === 'too_many_phrases') text = t(key, params.max);
    else text = t(key);
    return params.line ? text + t('err_line', params.line) : text;
}

const formatTime = ms => new Date(ms).toLocaleString(ext.i18n.getUILanguage(), { dateStyle: 'short', timeStyle: 'short' });
export const formatDate = value => value ?? '—';

/** Fills the standard status block. Returns the status for callers that need details. */
export function renderStatus(status, { box, reasonList, lock, incognito }) {
    const state = status?.state ?? 'unknown';
    box.dataset.state = state;
    box.querySelector('.state-text').textContent = t(`state_${state}`);
    reasonList.replaceChildren(...(status?.reasons ?? []).map(reason => Object.assign(document.createElement('li'), { textContent: t(`reason_${reason}`) })));
    reasonList.hidden = !reasonList.children.length;
    if (lock) lock.textContent = status?.lock?.active ? t('lock_active', `\u2066${formatTime(status.lock.until)}\u2069`) : t('lock_none');
    if (incognito) incognito.textContent = status?.incognitoAllowed === true ? t('incog_on') : status?.incognitoAllowed === false ? t('incog_off') : t('incog_unknown');
}

export const SAFE_TEST_URL = 'https://tabsira-selftest.test/';
