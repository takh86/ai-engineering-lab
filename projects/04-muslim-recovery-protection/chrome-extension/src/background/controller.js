import { TabsiraError, toErrorPayload } from '../core/errors.js';
import { defaultConfig, parseSettings, migrate, weakeningReasons, settingsOf, exportSettings, mergeImport, LIMITS } from '../core/config.js';
import { findUnsupported } from '../core/phrases.js';
import { STARTER_TERMS } from '../core/starter-terms.js';
import { planRules, rulesMatch, BASE_RULESET_ID } from '../core/rules.js';
import { isActive, SESSION_MINUTES, LOCK_KEY_PREFIX, mergeLocks } from '../core/lock.js';
import { createWriteMutex } from './coordination.js';

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
export function createController(api, { mutex: mutexOptions } = {}) {
    let queue = Promise.resolve();
    const mutex = createWriteMutex(api, mutexOptions);   // cross-instance (normal + private window) write coordination
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
    // The configuration lives in `config`; the session end time lives in grow-only `lock:<instance>` keys (core/lock.js).
    // A configuration write never touches any lock key, so a late configuration write cannot erase or shorten a session.
    async function readState() {
        let all;
        try { all = await api.storage.getAll(); }
        catch { return { kind: 'error', reason: 'storage_error' }; }
        const raw = { config: all.config };           // exactly what is stored, for compare-and-set / restore
        const locks = mergeLocks(all);
        let lock = { until: locks.until };
        try {
            const result = migrate(all.config, lock);
            if (result.migrated) lock = { until: Math.max(lock.until, result.lock.until), v0: result.lock.until };
            else lock = { until: locks.until };
            if (locks.invalidKeys.length) return { kind: 'corrupt', reason: 'config_corrupt', lock, raw, lockKeys: locks, invalidLockKeys: locks.invalidKeys };
            return { kind: result.fresh ? 'fresh' : 'ok', config: result.config, lock, migrated: result.migrated, raw, lockKeys: locks };
        } catch { return { kind: 'corrupt', reason: 'config_corrupt', lock, raw, lockKeys: locks, invalidLockKeys: locks.invalidKeys }; }
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
        const now = await api.storage.get('config');
        return sameJson(now.config, expected.config);
    }

    /**
     * Applies `config` to the browser and (when `persist`) storage, atomically from the caller's view.
     * `expected` is the exact raw storage content ({ config }, possibly undefined) the change is based on: it is
     * compared right before writing and restored on failure. Runs inside the write mutex; the lease is re-checked right
     * before the write. The session end time is never written here.
     */
    async function commit({ config, expected, persist }) {
        const plan = await planRules(activeSettings(config), supports);
        const before = await snapshot();
        let touchedStorage = false;
        try {
            await setDynamicRules(plan.rules);
            await setBaseEnabled(plan.baseListEnabled);
            if (persist) {
                // A normal and a private-window instance of this worker can both write (Chromium "split" mode).
                // Re-check right before writing, and again after, so an interleaved write is reported, not lost silently.
                await mutex.assertOwner();
                if (!(await storedMatches(expected))) throw new TabsiraError('stale');
                touchedStorage = true;
                await api.storage.set({ config });
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
            // Lease lost (this worker was paused past its lease and another instance may have written): do nothing
            // destructive here. handle() re-runs reconciliation under the mutex, which makes the browser follow storage.
            if (error instanceof TabsiraError && error.code === 'busy') throw error;
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
                    await attempt(() => (expected.config === undefined ? api.storage.remove(['config']) : api.storage.set({ config: expected.config })));
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
    // Runs inside the write mutex when it may write (migration, repair). Storage clean-up removes only lock entries that
    // can no longer matter (expired, or smaller than the effective end time).
    async function compactLocks(state) {
        const now = api.now();
        const stale = Object.entries(state.lockKeys?.keys ?? {}).filter(([, until]) => until <= now || until < state.lock.until).map(([key]) => key);
        // keep exactly one entry when a session is active: the largest (first in sort order)
        if (stale.length) { await mutex.assertOwner(); await api.storage.remove(stale); }
    }

    async function reconcileTask() {
        const state = await readState();
        if (state.kind === 'ok') {
            const plan = await planRules(activeSettings(state.config), supports);
            const actual = await snapshot();
            const matches = rulesMatch(actual.rules, plan.rules) && actual.baseEnabled === plan.baseListEnabled;
            if (!matches || state.migrated) {
                await commit({ config: state.config, expected: state.raw, persist: !!state.migrated });
                if (state.migrated && state.lock.v0 > 0) await writeLock(state.lock.v0);
            }
            if (mutex.isHeld()) { try { await compactLocks(await readState()); } catch { /* clean-up is optional */ } }
        }
        // 'fresh' with leftover rules, 'corrupt' and 'error': never delete protection because of a read problem.
        return statusNow();
    }
    const guarded = task => mutex.run(task);
    const reconcile = () => serialize(() => guarded(reconcileTask)).catch(() => statusNow().catch(() => null));

    /** Raises this instance's own lock entry to `until` (never lowers it) and verifies the merged result. */
    async function writeLock(until) {
        await mutex.assertOwner();
        const key = `${LOCK_KEY_PREFIX}${api.instanceId}`;
        const own = (await api.storage.get(key))[key];
        if (own && Number.isSafeInteger(own.until) && own.until >= until) return;
        await api.storage.set({ [key]: { until } });
        if (mergeLocks(await api.storage.getAll()).until < until) throw new TabsiraError('apply_failed');
    }

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
        await commit({ config: next, expected: state.raw, persist: true });
    }

    const checkRevision = (state, baseRevision) => {
        if (state.config.revision !== baseRevision) throw new TabsiraError('stale');
    };

    const operations = {
        async GET_STATUS() {
            let status = await statusNow();
            if (status.reasons.includes('rules_mismatch')) status = await guarded(reconcileTask).catch(() => status);
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
            // Grow-only: only ever raises this instance's own key; the effective end time is the maximum over all keys.
            const target = Math.max(state.lock.until, now + minutes * 60000);
            if (target > state.lock.until) await writeLock(target);
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
        async REPAIR() { return { status: await reconcileTask() }; },   // runs inside the mutex (see handle)
        async GET_EXPORT() {
            const state = await requireWritable();
            return { text: JSON.stringify(exportSettings(state.config), null, 2) };
        }
    };

    async function handle(message) {
        try {
            const operation = operations[message.type];
            const readOnly = message.type === 'GET_STATUS' || message.type === 'GET_EXPORT';
            const result = await serialize(() => (readOnly ? operation(message) : guarded(() => operation(message))));
            return { ok: true, ...result };
        } catch (error) {
            let status = null;
            try { status = await statusNow(); } catch { /* keep error only */ }
            if (error instanceof TabsiraError && ['busy', 'stale'].includes(error.code)) status = (await reconcile()) ?? status;
            return { ok: false, error: toErrorPayload(error), status };
        }
    }

    // On a corrupt store RESET is the only write allowed without readable state. An active commitment
    // (its end time is stored separately) still blocks it.
    async function resetCorruptTask(state) {
        if (state.lock && isActive(state.lock, api.now())) throw new TabsiraError('locked_weakening', { reasons: ['reset'] });
        await commit({ config: { ...defaultConfig(), onboarded: true, baseList: false, starterTerms: false, revision: 1 }, expected: state.raw, persist: true });
        if (state.invalidLockKeys?.length) { await mutex.assertOwner(); await api.storage.remove(state.invalidLockKeys); }
        return { status: await statusNow() };
    }

    return { handle, reconcile, statusNow, readState, supports, instanceId: api.instanceId };
}
