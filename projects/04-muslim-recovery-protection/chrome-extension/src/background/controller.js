import { TabsiraError, toErrorPayload } from '../core/errors.js';
import { defaultConfig, parseSettings, migrate, weakeningReasons, settingsOf, exportSettings, mergeImport, LIMITS } from '../core/config.js';
import { findUnsupported } from '../core/phrases.js';
import { STARTER_TERMS } from '../core/starter-terms.js';
import { planRules, rulesMatch, BASE_RULESET_ID } from '../core/rules.js';
import { emptyLock, isLockValid, isActive, extend, SESSION_MINUTES } from '../core/lock.js';

export const HOST_ORIGINS = Object.freeze(['http://*/*', 'https://*/*']);
const EMPTY_SETTINGS = Object.freeze({ baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] });

/**
 * All protection logic. `api` is a thin adapter over the browser (see browser-api.js) so the same
 * code runs against real Chrome/Edge/Firefox and against test doubles.
 *
 * Rules are always derived from the stored configuration. A change is applied as:
 *   snapshot -> install dynamic rules -> switch base ruleset -> persist config -> read back & verify
 * and any failure restores the snapshot. If even the restore fails, the stored configuration is still
 * the last good one and the next reconcile makes the browser match it again.
 * No function here logs, and no error carries user-entered text.
 */
export function createController(api) {
    let queue = Promise.resolve();
    const supportCache = new Map();

    const serialize = task => {
        const run = queue.then(task, task);
        queue = run.then(() => {}, () => {});
        return run;
    };

    const supports = async regex => {
        if (supportCache.has(regex)) return supportCache.get(regex);
        const result = await api.dnr.isRegexSupported({ regex, isCaseSensitive: false });
        supportCache.set(regex, !!result.isSupported);
        return !!result.isSupported;
    };

    // ---- reading state ----
    async function readState() {
        let stored;
        try { stored = await api.storage.get(['config', 'lock']); }
        catch { return { kind: 'error', reason: 'storage_error' }; }
        const raw = { config: stored.config, lock: stored.lock };   // exactly what is stored, for compare-and-set / restore
        let lock = stored.lock === undefined ? emptyLock() : stored.lock;
        if (!isLockValid(lock)) lock = null;
        try {
            const result = migrate(stored.config, lock ?? undefined);
            if (!result.fresh && !isLockValid(result.lock)) return { kind: 'corrupt', reason: 'config_corrupt', lock: null, raw };
            return { kind: result.fresh ? 'fresh' : 'ok', config: result.config, lock: result.lock, migrated: result.migrated, raw };
        } catch { return { kind: 'corrupt', reason: 'config_corrupt', lock, raw }; }
    }

    const activeSettings = config => (config.onboarded ? config : { ...config, ...EMPTY_SETTINGS });

    async function snapshot() {
        const [rules, enabled] = await Promise.all([api.dnr.getDynamicRules(), api.dnr.getEnabledRulesets()]);
        return { rules, baseEnabled: enabled.includes(BASE_RULESET_ID) };
    }

    async function setDynamicRules(rules) {
        const existing = await api.dnr.getDynamicRules();
        await api.dnr.updateDynamicRules({ removeRuleIds: existing.map(rule => rule.id), addRules: rules });
    }

    async function setBaseEnabled(enabled) {
        const current = (await api.dnr.getEnabledRulesets()).includes(BASE_RULESET_ID);
        if (current === enabled) return;
        await api.dnr.updateEnabledRulesets(enabled ? { enableRulesetIds: [BASE_RULESET_ID] } : { disableRulesetIds: [BASE_RULESET_ID] });
    }

    async function verify(plan) {
        const { rules, baseEnabled } = await snapshot();
        return rulesMatch(rules, plan.rules) && baseEnabled === plan.baseListEnabled;
    }

    // chrome.storage hands objects back with sorted keys, so compare structurally (real-browser finding).
    const stable = value => JSON.stringify(value, (_, item) => (item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item));
    const sameJson = (a, b) => stable(a) === stable(b);
    async function storedMatches(expected) {
        const now = await api.storage.get(['config', 'lock']);
        return sameJson(now.config, expected.config) && sameJson(now.lock, expected.lock);
    }

    /**
     * Applies `config` to the browser and (when `persist`) storage, atomically from the caller's view.
     * `expected` is the exact raw storage content ({ config, lock }, possibly undefined values) the change is based on:
     * it is compared right before writing and restored on failure.
     */
    async function commit({ config, lock, expected, persist }) {
        const plan = await planRules(activeSettings(config), supports);
        const before = await snapshot();
        let touchedStorage = false;
        try {
            await setDynamicRules(plan.rules);
            await setBaseEnabled(plan.baseListEnabled);
            if (persist) {
                // A normal and a private-window instance of this worker can both write (Chromium "split" mode).
                // Re-check right before writing, and again after, so an interleaved write is reported, not lost silently.
                if (!(await storedMatches(expected))) throw new TabsiraError('stale');
                touchedStorage = true;
                await api.storage.set({ config, lock });
            }
            if (!(await verify(plan))) {
                // The browser may momentarily hold another instance's rules (private window saving at the same instant).
                // If storage holds OUR configuration, re-apply our rules once; otherwise it is a real failure.
                const stored = persist ? (await api.storage.get('config')).config : undefined;
                if (persist && sameJson(stored, config)) { await setDynamicRules(plan.rules); await setBaseEnabled(plan.baseListEnabled); }
                if (!(await verify(plan))) throw new TabsiraError('verify_failed');
            }
            if (persist && !sameJson((await api.storage.get('config')).config, config)) throw new TabsiraError('stale');
            return plan;
        } catch (error) {
            let restored = true;
            const attempt = async step => { try { await step(); } catch { restored = false; } };
            // If another worker instance (private window) wrote the configuration after we did, its write is the
            // newer truth: keep it and make the browser rules follow it instead of restoring our snapshot.
            let supersededByOther = !touchedStorage && error instanceof TabsiraError && error.code === 'stale';
            if (touchedStorage) {
                try {
                    const stored = (await api.storage.get('config')).config;
                    supersededByOther = !sameJson(stored, config) && !sameJson(stored, expected.config);
                } catch { restored = false; }
            }
            if (supersededByOther) {
                await attempt(async () => {
                    const current = await readState();
                    if (current.kind !== 'ok') return;
                    const plan = await planRules(activeSettings(current.config), supports);
                    await setDynamicRules(plan.rules);
                    await setBaseEnabled(plan.baseListEnabled);
                });
            } else {
                await attempt(() => setDynamicRules(before.rules));
                await attempt(() => setBaseEnabled(before.baseEnabled));
                if (touchedStorage) {
                    await attempt(() => (expected.config === undefined ? api.storage.remove(['config', 'lock']) : api.storage.set({ config: expected.config, ...(expected.lock !== undefined ? { lock: expected.lock } : {}) })));
                }
            }
            const code = supersededByOther && restored ? 'stale' : restored ? (error instanceof TabsiraError && error.code === 'stale' ? 'stale' : 'apply_failed') : 'apply_failed_rollback_failed';
            throw new TabsiraError(code, { cause: error instanceof TabsiraError ? error.code : 'api' });
        }
    }

    // ---- status ----
    async function computeStatus() {
        const state = await readState();
        const now = api.now();
        const status = { state: 'unknown', reasons: [], settings: null, revision: 0, onboarded: false,
            lock: { active: false, until: 0 }, counts: {}, permissions: { hosts: null }, incognitoAllowed: null,
            base: { enabled: false, domainCount: 0, version: null, date: null }, sessionMinutes: [...SESSION_MINUTES], limits: LIMITS };
        if (state.kind === 'error' || state.kind === 'corrupt') {
            status.reasons.push(state.reason);
            if (state.lock) status.lock = { active: isActive(state.lock, now), until: state.lock.until };
            return status;
        }
        status.revision = state.config.revision;
        status.onboarded = state.config.onboarded;
        status.settings = settingsOf(state.config);
        status.lock = { active: isActive(state.lock, now), until: state.lock.until };
        let actual, plan;
        try {
            const [snap, hosts, incognito] = await Promise.all([snapshot(), api.permissions.contains({ origins: [...HOST_ORIGINS] }), api.isIncognitoAllowed()]);
            actual = snap;
            status.permissions.hosts = !!hosts;
            status.incognitoAllowed = incognito;
            plan = await planRules(activeSettings(state.config), supports);
        } catch { status.reasons.push('api_error'); return status; }
        status.base.enabled = actual.baseEnabled;
        try { const meta = await api.baseMeta(); status.base = { ...status.base, domainCount: meta.domainCount ?? 0, version: meta.version ?? null, date: meta.upstreamDate ?? null }; } catch { /* metadata is informational */ }
        status.counts = {
            dynamicRules: actual.rules.length, domains: state.config.domains.length, allow: state.config.allow.length,
            words: state.config.words.length, contains: state.config.contains.length,
            starter: state.config.starterTerms ? STARTER_TERMS.length : 0
        };
        const matches = rulesMatch(actual.rules, plan.rules) && actual.baseEnabled === plan.baseListEnabled;
        if (state.kind === 'fresh') {
            if (actual.rules.length || actual.baseEnabled) { status.state = 'partial'; status.reasons.push('config_missing_rules_present'); }
            else { status.state = 'not_configured'; status.reasons.push('onboarding_pending'); }
            return status;
        }
        const cfg = state.config;
        const anything = cfg.baseList || cfg.starterTerms || cfg.domains.length || cfg.words.length || cfg.contains.length;
        if (!cfg.onboarded) { status.state = 'not_configured'; status.reasons.push('onboarding_pending'); return status; }
        if (!anything) { status.state = 'not_configured'; status.reasons.push('nothing_enabled'); if (!matches) status.reasons.push('rules_mismatch'); return status; }
        if (!status.permissions.hosts) status.reasons.push('host_permission_missing');
        if (!matches) status.reasons.push('rules_mismatch');
        if (plan.unsupported.length) status.reasons.push('phrases_unsupported');
        status.state = status.reasons.length ? 'partial' : 'active';
        return status;
    }

    async function publishBadge(status) {
        try { await api.setBadge(status.state === 'active' ? '' : '!'); } catch { /* cosmetic only */ }
    }

    async function statusNow() {
        const status = await computeStatus();
        await publishBadge(status);
        return status;
    }

    // ---- reconcile: make the browser match the stored configuration ----
    async function reconcileTask() {
        const state = await readState();
        if (state.kind === 'ok') {
            const plan = await planRules(activeSettings(state.config), supports);
            const actual = await snapshot();
            const matches = rulesMatch(actual.rules, plan.rules) && actual.baseEnabled === plan.baseListEnabled;
            if (!matches || state.migrated) {
                await commit({ config: state.config, lock: state.lock, expected: state.raw, persist: !!state.migrated });
            }
        }
        // 'fresh' with leftover rules, 'corrupt' and 'error': never delete protection because of a read problem.
        return statusNow();
    }
    const reconcile = () => serialize(reconcileTask).catch(() => statusNow().catch(() => null));

    // ---- operations ----
    async function requireWritable() {
        const state = await readState();
        if (state.kind === 'error') throw new TabsiraError('storage_unavailable');
        if (state.kind === 'corrupt') throw new TabsiraError('config_corrupt');
        return state;
    }

    async function applySettings(state, settings) {
        const next = { ...state.config, ...settings, revision: state.config.revision + 1, onboarded: true };
        if (isActive(state.lock, api.now())) {
            const reasons = weakeningReasons(state.config, next);
            if (reasons.length) throw new TabsiraError('locked_weakening', { reasons });
        }
        for (const mode of ['words', 'contains']) {
            const bad = await findUnsupported(settings[mode], mode === 'words' ? 'word' : 'contains', supports, 'q');
            if (bad.length) throw new TabsiraError('phrase_too_complex', { line: bad[0], list: mode });
        }
        await commit({ config: next, lock: state.lock, expected: state.raw, persist: true });
    }

    const checkRevision = (state, baseRevision) => {
        if (state.config.revision !== baseRevision) throw new TabsiraError('stale');
    };

    const operations = {
        async GET_STATUS() {
            let status = await statusNow();
            if (status.reasons.includes('rules_mismatch')) status = await reconcileTask().catch(() => status);
            return { status };
        },
        async SAVE_SETTINGS({ baseRevision, settings }) {
            const state = await requireWritable();
            checkRevision(state, baseRevision);
            await applySettings(state, parseSettings(settings));
            return { status: await statusNow() };
        },
        async IMPORT_SETTINGS({ baseRevision, text }) {
            const state = await requireWritable();
            checkRevision(state, baseRevision);
            await applySettings(state, mergeImport(settingsOf(state.config), text));
            return { status: await statusNow() };
        },
        async COMPLETE_ONBOARDING({ baseList, starterTerms }) {
            const state = await requireWritable();
            if (state.config.onboarded) throw new TabsiraError('already_onboarded');
            await applySettings(state, { ...settingsOf(state.config), baseList, starterTerms });
            return { status: await statusNow() };
        },
        async START_SESSION({ minutes }) {
            const state = await requireWritable();
            if (state.kind === 'fresh' || !state.config.onboarded) throw new TabsiraError('session_needs_rules');
            const now = api.now();
            const status = await statusNow();
            if (status.state !== 'active') {
                // Never promise commitment around protection that is not actually in place.
                throw new TabsiraError(status.state === 'not_configured' ? 'session_needs_rules' : 'session_needs_active_protection');
            }
            const lock = extend(state.lock, minutes, now);
            try {
                await api.storage.set({ lock });
                const check = await api.storage.get('lock');
                if (!check.lock || check.lock.until !== lock.until) throw new Error('read-back mismatch');
            } catch {
                try { await api.storage.set({ lock: state.lock }); } catch { /* reported below */ }
                throw new TabsiraError('apply_failed');
            }
            return { status: await statusNow() };
        },
        async RESET({ baseRevision }) {
            const raw = await readState();
            if (raw.kind === 'corrupt') return resetCorruptTask(raw);
            const state = await requireWritable();
            checkRevision(state, baseRevision);
            await applySettings(state, { ...EMPTY_SETTINGS });
            return { status: await statusNow() };
        },
        async REPAIR() { return { status: await reconcileTask() }; },
        async GET_EXPORT() {
            const state = await requireWritable();
            return { text: JSON.stringify(exportSettings(state.config), null, 2) };
        }
    };

    async function handle(message) {
        try {
            const operation = operations[message.type];
            const result = await serialize(() => operation(message));
            return { ok: true, ...result };
        } catch (error) {
            let status = null;
            try { status = await statusNow(); } catch { /* keep error only */ }
            return { ok: false, error: toErrorPayload(error), status };
        }
    }

    // On a corrupt store RESET is the only write allowed without readable state. An active commitment
    // (its end time is stored separately) still blocks it.
    async function resetCorruptTask(state) {
        if (state.lock && isActive(state.lock, api.now())) throw new TabsiraError('locked_weakening', { reasons: ['reset'] });
        await commit({ config: { ...defaultConfig(), onboarded: true, baseList: false, starterTerms: false, revision: 1 }, lock: emptyLock(), expected: state.raw, persist: true });
        return { status: await statusNow() };
    }

    return { handle, reconcile, statusNow, readState, supports };
}
