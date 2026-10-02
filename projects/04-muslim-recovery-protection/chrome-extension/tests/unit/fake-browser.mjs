// Test double for the browser API. It is NOT evidence of real declarativeNetRequest behaviour;
// that is covered by tests/e2e in real browsers. It models: atomic dynamic-rule replacement,
// browser-side reordering/normalization of returned rules, static ruleset switching, permission
// state, and one-shot failure injection per operation.
export function createFakeBrowser({ regexLimit = 400, hosts = true, incognito = true } = {}) {
    const state = {
        storage: {}, rules: [], baseEnabled: false, hosts, incognito, now: 1_700_000_000_000, badge: '',
        fail: {}, calls: []
    };
    // state.fail[name] = n  -> the next n calls of `name` throw (true means 1).
    const failOnce = name => {
        const n = state.fail[name];
        if (!n) return;
        state.fail[name] = n === true ? 0 : n - 1;
        throw new Error('injected failure');
    };
    const scramble = rule => ({
        // Real browsers may reorder keys and add defaults; the controller must not depend on that.
        condition: { ...rule.condition, requestDomains: rule.condition.requestDomains ? [...rule.condition.requestDomains].reverse() : undefined },
        priority: rule.priority, action: rule.action, id: rule.id
    });
    const api = {
        id: 'test-extension', baseUrl: 'chrome-extension://test-extension/',
        now: () => state.now,
        storage: {
            get: async keys => {
                failOnce('storage.get'); state.calls.push('storage.get');
                const list = Array.isArray(keys) ? keys : [keys];
                return Object.fromEntries(list.filter(k => k in state.storage).map(k => [k, structuredClone(state.storage[k])]));
            },
            set: async items => { failOnce('storage.set'); state.calls.push('storage.set'); for (const [k, v] of Object.entries(items)) state.storage[k] = structuredClone(v); },
            remove: async keys => { failOnce('storage.remove'); for (const k of keys) delete state.storage[k]; }
        },
        dnr: {
            getDynamicRules: async () => { failOnce('dnr.get'); return state.rules.map(r => scramble(structuredClone(r))); },
            updateDynamicRules: async ({ removeRuleIds = [], addRules = [] }) => {
                failOnce('dnr.update'); state.calls.push('dnr.update');
                const next = state.rules.filter(r => !removeRuleIds.includes(r.id));
                for (const rule of addRules) {
                    if (next.some(r => r.id === rule.id)) throw new Error('duplicate id');
                    next.push(structuredClone(rule));
                }
                state.rules = next;
            },
            getEnabledRulesets: async () => { failOnce('rulesets.get'); return state.baseEnabled ? ['base_adult'] : []; },
            updateEnabledRulesets: async ({ enableRulesetIds = [], disableRulesetIds = [] }) => {
                failOnce('rulesets.update'); state.calls.push('rulesets.update');
                if (enableRulesetIds.includes('base_adult')) state.baseEnabled = true;
                if (disableRulesetIds.includes('base_adult')) state.baseEnabled = false;
            },
            isRegexSupported: async ({ regex }) => ({ isSupported: regex.length <= regexLimit, reason: 'memoryLimitExceeded' })
        },
        permissions: { contains: async () => { failOnce('permissions'); return state.hosts; } },
        isIncognitoAllowed: async () => state.incognito,
        baseMeta: async () => ({ domainCount: 1234, version: 'test', upstreamDate: '2026-07-18' }),
        setBadge: async text => { state.badge = text; }
    };
    return { api, state };
}
