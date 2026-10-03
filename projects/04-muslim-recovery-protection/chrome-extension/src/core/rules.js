import { ENGINES } from './engines.js';
import { STARTER_TERMS } from './starter-terms.js';
import { packPhrases, phraseFragment, buildPhraseRegex } from './phrases.js';

// Precedence (higher priority wins in declarativeNetRequest):
// Exceptions exclude domains only from dynamic additional rules.
// The static bundled list has no exception or off switch after setup.
//   2  user sites / phrases
//   1  mandatory built-in base list
// An exception and a user block for the same site cannot coexist (rejected when saving).
export const PRIORITY = Object.freeze({ BASE: 1, USER: 2, ALLOW: 3 });
export const RULE_ID = Object.freeze({ USER_DOMAINS: 1, ALLOW: 2, PHRASE_FIRST: 100 });
export const BASE_RULESET_ID = 'base_adult';
export const BLOCKED_PATH = '/blocked.html';
// The base ruleset also carries this reserved test domain so the safe self-test works offline:
// the redirect happens before any DNS lookup, so the domain never has to exist.
export const SELFTEST_DOMAIN = 'tabsira-selftest.test';

const redirect = () => ({ type: 'redirect', redirect: { extensionPath: BLOCKED_PATH } });
const MAIN_FRAME = ['main_frame'];

// Search engines grouped by query-parameter name, so one phrase rule covers every engine using it.
export const PARAM_GROUPS = (() => {
    const groups = new Map();
    for (const engine of ENGINES) groups.set(engine.param, [...(groups.get(engine.param) ?? []), ...engine.domains]);
    return [...groups].map(([param, domains]) => ({ param, domains: [...new Set(domains)].sort() }));
})();

/** The phrase lists after applying the starter-terms switch. Sorted so rule output is deterministic. */
export function effectivePhrases(config) {
    const words = [...new Set([...config.words, ...(config.starterTerms ? STARTER_TERMS : [])])].sort();
    return { words, contains: [...config.contains].sort() };
}

/**
 * Computes the rules the browser should hold for `config`.
 * `supports(regex)` is the browser's isRegexSupported; results depend on the browser's regex memory.
 * Returns { rules, baseListEnabled, unsupported: string[] } (unsupported = phrases the browser rejects for
 * at least one search-engine parameter group).
 */
export async function planRules(config, supports) {
    const rules = [];
    if (config.domains.length) {
        rules.push({ id: RULE_ID.USER_DOMAINS, priority: PRIORITY.USER, action: redirect(),
            condition: { requestDomains: [...config.domains].sort(), excludedRequestDomains: [...config.allow].sort(), resourceTypes: MAIN_FRAME } });
    }
    const phrases = effectivePhrases(config);
    const unsupported = new Set();
    let id = RULE_ID.PHRASE_FIRST;
    for (const mode of ['word', 'contains']) {
        const list = mode === 'word' ? phrases.words : phrases.contains;
        for (const group of PARAM_GROUPS) {
            // Packed per parameter: a longer parameter name leaves less regex memory for the phrases.
            const { chunks, unsupported: rejected } = await packPhrases(list, mode, supports, group.param);
            rejected.forEach(phrase => unsupported.add(phrase));
            for (const chunk of chunks) {
                rules.push({ id: id++, priority: PRIORITY.USER, action: redirect(), condition: {
                    requestDomains: group.domains, excludedRequestDomains: [...config.allow].sort(), resourceTypes: MAIN_FRAME, isUrlFilterCaseSensitive: false,
                    regexFilter: buildPhraseRegex(mode, group.param, chunk.map(phraseFragment))
                } });
            }
        }
    }
    return { rules, baseListEnabled: config.onboarded ? true : config.baseList, unsupported: [...unsupported] };
}

// ---- canonical comparison with what the browser reports back ----
const SORTED_ARRAYS = new Set(['requestDomains', 'excludedRequestDomains', 'resourceTypes']);
function canon(value, key) {
    if (Array.isArray(value)) {
        const items = value.map(item => canon(item));
        return SORTED_ARRAYS.has(key) ? items.sort() : items;
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const name of Object.keys(value).sort()) {
            const child = canon(value[name], name);
            // Browsers may add or drop defaults (false, empty list); those carry no meaning.
            if (child === undefined || child === null || child === false || (Array.isArray(child) && !child.length)) continue;
            out[name] = child;
        }
        return out;
    }
    return value;
}

export const canonicalRules = rules => rules.map(rule => canon(rule)).sort((a, b) => a.id - b.id);

export const rulesMatch = (actual, expected) => JSON.stringify(canonicalRules(actual)) === JSON.stringify(canonicalRules(expected));
