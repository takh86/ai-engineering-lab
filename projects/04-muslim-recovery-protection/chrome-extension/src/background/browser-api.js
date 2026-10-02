// Adapter over the WebExtensions API. `browser` (Firefox) and `chrome` (Chrome/Edge) both expose
// promise-returning MV3 APIs; the few differences are isolated here.
export function createBrowserApi(ext = globalThis.browser ?? globalThis.chrome) {
    return {
        id: ext.runtime.id,
        baseUrl: ext.runtime.getURL(''),
        now: () => Date.now(),
        storage: {
            get: keys => ext.storage.local.get(keys),
            set: items => ext.storage.local.set(items),
            remove: keys => ext.storage.local.remove(keys)
        },
        dnr: {
            getDynamicRules: () => ext.declarativeNetRequest.getDynamicRules(),
            updateDynamicRules: options => ext.declarativeNetRequest.updateDynamicRules(options),
            getEnabledRulesets: () => ext.declarativeNetRequest.getEnabledRulesets(),
            updateEnabledRulesets: options => ext.declarativeNetRequest.updateEnabledRulesets(options),
            isRegexSupported: options => ext.declarativeNetRequest.isRegexSupported(options)
        },
        baseMeta: () => fetch(ext.runtime.getURL('base-list-meta.json')).then(response => response.json()),
        permissions: { contains: query => ext.permissions.contains(query) },
        // null = the browser cannot say (treated as "unknown", never as "allowed").
        isIncognitoAllowed: async () => {
            try { return !!(await ext.extension.isAllowedIncognitoAccess()); } catch { return null; }
        },
        setBadge: async text => {
            await ext.action.setBadgeText({ text });
            if (text) await ext.action.setBadgeBackgroundColor({ color: '#b45309' });
        },
        // Chrome only: keep settings out of content scripts. Firefox has no such call and no content scripts here.
        restrictStorage: async () => {
            try { await ext.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }); } catch { /* optional hardening */ }
        }
    };
}
