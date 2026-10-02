import { TabsiraError } from './errors.js';
import { normalizeDomainList, isSameOrSubdomain } from './domains.js';
import { normalizePhraseList } from './phrases.js';
import { ALL_ENGINE_DOMAINS } from './engines.js';
import { emptyLock } from './lock.js';

export const SCHEMA_VERSION = 2;
export const LIMITS = Object.freeze({ domains: 1000, allow: 300, words: 60, contains: 40, importBytes: 262144 });

const USER_KEYS = ['baseList', 'starterTerms', 'domains', 'allow', 'words', 'contains'];
const STORED_KEYS = ['v', 'revision', 'onboarded', ...USER_KEYS];

export const defaultConfig = () => ({
    v: SCHEMA_VERSION, revision: 0, onboarded: false,
    baseList: true, starterTerms: true, domains: [], allow: [], words: [], contains: []
});

const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).length === keys.length && keys.every(key => key in object);

/** Validates and normalizes the user-editable part. Throws TabsiraError (never including input text). */
export function parseSettings(raw) {
    if (!exactKeys(raw, USER_KEYS)) throw new TabsiraError('config_invalid');
    if (typeof raw.baseList !== 'boolean' || typeof raw.starterTerms !== 'boolean') throw new TabsiraError('config_invalid');
    const domains = normalizeDomainList(raw.domains, { max: LIMITS.domains });
    const allow = normalizeDomainList(raw.allow, { max: LIMITS.allow, errorCode: 'allow_invalid' });
    const words = normalizePhraseList(raw.words, { max: LIMITS.words });
    const contains = normalizePhraseList(raw.contains, { max: LIMITS.contains });
    for (const blocked of domains) {
        if (allow.some(exception => isSameOrSubdomain(blocked, exception))) throw new TabsiraError('conflict_domain_allow');
    }
    for (const exception of allow) {
        if (ALL_ENGINE_DOMAINS.some(engine => isSameOrSubdomain(engine, exception) || isSameOrSubdomain(exception, engine))) {
            throw new TabsiraError('allow_search_engine');
        }
    }
    return { baseList: raw.baseList, starterTerms: raw.starterTerms, domains, allow, words, contains };
}

/** Strict validation of the stored object. Anything unexpected is "corrupt", never silently repaired. */
export function parseStored(raw) {
    if (!exactKeys(raw, STORED_KEYS) || raw.v !== SCHEMA_VERSION
        || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || typeof raw.onboarded !== 'boolean') {
        throw new TabsiraError('config_corrupt');
    }
    try {
        const settings = parseSettings(Object.fromEntries(USER_KEYS.map(key => [key, raw[key]])));
        return { v: SCHEMA_VERSION, revision: raw.revision, onboarded: raw.onboarded, ...settings };
    } catch (error) {
        if (error instanceof TabsiraError) throw new TabsiraError('config_corrupt');
        throw error;
    }
}

/**
 * Migrates what is in storage to the current schema.
 * Returns { config, lock, migrated } or throws TabsiraError('config_corrupt').
 * v0 is the Chrome prototype shape { domains, keywords, lockedUntil }; its substring keywords become
 * "contains" phrases so behaviour is unchanged, and its base list / starter terms stay off.
 */
export function migrate(storedConfig, storedLock) {
    if (storedConfig === undefined) return { config: defaultConfig(), lock: emptyLock(), migrated: false, fresh: true };
    if (storedConfig && storedConfig.v === undefined && Array.isArray(storedConfig.domains)) {
        try {
            const settings = parseSettings({
                baseList: false, starterTerms: false, allow: [], words: [],
                domains: storedConfig.domains, contains: Array.isArray(storedConfig.keywords) ? storedConfig.keywords : []
            });
            const until = Number.isSafeInteger(storedConfig.lockedUntil) && storedConfig.lockedUntil > 0 ? storedConfig.lockedUntil : 0;
            return { config: { v: SCHEMA_VERSION, revision: 1, onboarded: true, ...settings }, lock: { until }, migrated: true, fresh: false };
        } catch { throw new TabsiraError('config_corrupt'); }
    }
    return { config: parseStored(storedConfig), lock: storedLock, migrated: false, fresh: false };
}

const covers = (phrase, bySubstring) => bySubstring.some(shorter => phrase.includes(shorter));

/**
 * Reasons `next` gives LESS protection than `prev` (empty array = same or stronger).
 * Used during a commitment session. A removed entry is not weaker when a remaining entry already
 * covers it (a parent domain covers its subdomains; a "contains" phrase covers longer phrases).
 */
export function weakeningReasons(prev, next) {
    const reasons = [];
    if (prev.baseList && !next.baseList) reasons.push('base_list_disabled');
    if (prev.starterTerms && !next.starterTerms) reasons.push('starter_terms_disabled');
    if (prev.domains.some(d => !next.domains.some(n => isSameOrSubdomain(d, n)))) reasons.push('domain_removed');
    if (prev.words.some(w => !next.words.includes(w) && !covers(w, next.contains))) reasons.push('phrase_removed');
    if (prev.contains.some(c => !covers(c, next.contains))) reasons.push('phrase_removed');
    if (next.allow.some(a => !prev.allow.some(p => isSameOrSubdomain(a, p)))) reasons.push('exception_added');
    return [...new Set(reasons)];
}

export const settingsOf = config => Object.fromEntries(USER_KEYS.map(key => [key, config[key]]));

// ---- export / import ----
export const EXPORT_FORMAT = 'tabsira-settings';

export function exportSettings(config) {
    return { format: EXPORT_FORMAT, version: SCHEMA_VERSION, settings: settingsOf(config) };
}

/** Parses an export file and merges it into `current`. Merging only adds protection, except exceptions. */
export function mergeImport(current, text) {
    if (typeof text !== 'string' || text.length > LIMITS.importBytes) throw new TabsiraError('import_too_large');
    let data;
    try { data = JSON.parse(text); } catch { throw new TabsiraError('import_invalid'); }
    if (!exactKeys(data, ['format', 'version', 'settings']) || data.format !== EXPORT_FORMAT) throw new TabsiraError('import_invalid');
    if (data.version !== SCHEMA_VERSION) throw new TabsiraError('import_version', { expected: SCHEMA_VERSION });
    const imported = parseSettings(data.settings);
    const union = (a, b) => [...new Set([...a, ...b])];
    return parseSettings({
        baseList: current.baseList || imported.baseList,
        starterTerms: current.starterTerms || imported.starterTerms,
        domains: union(current.domains, imported.domains),
        allow: union(current.allow, imported.allow),
        words: union(current.words, imported.words),
        contains: union(current.contains, imported.contains)
    });
}
