import { TabsiraError, toErrorPayload } from '../core/errors.js';
import { defaultConfig, parseSettings, migrate, weakeningReasons, settingsOf, exportSettings, mergeImport, LIMITS } from '../core/config.js';
import { findUnsupported } from '../core/phrases.js';
import { STARTER_TERMS } from '../core/starter-terms.js';
import { planRules, rulesMatch, BASE_RULESET_ID, PARAM_GROUPS } from '../core/rules.js';
import { isActive, SESSION_MINUTES, lockKey, mergeLocks } from '../core/lock.js';
import { normalizeDomain } from '../core/domains.js';
import { parseSchedules, scheduleState, schedulesWeaken } from '../core/schedules.js';
import { validMinutes, validExitDelay, commitmentStatus, addReleases } from '../core/commitment.js';
import { createWriteMutex } from './coordination.js';
import { configKey, newestConfig, listConfigRecords, obsoleteKeys } from '../core/records.js';

export const HOST_ORIGINS = Object.freeze(['http://*/*', 'https://*/*']);
export const SCHEDULE_ALARM = 'tabsira-schedule-boundary';
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
export function createController(api, { mutex: mutexOptions, featureController } = {}) {
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
        const newest = newestConfig(all);                              // highest (epoch, instance); see core/records.js
        const raw = { key: newest?.key ?? null, config: newest?.value };   // exactly what is stored, for the stale check / restore
        const locks = mergeLocks(all);
        const invalidConfigKeys = listConfigRecords(all).invalidKeys;
        let lock = { until: locks.until, exitDelay: locks.exitDelay };
        try {
            const result = migrate(newest?.value, lock);
            if (result.migrated) lock = { ...lock, until: Math.max(lock.until, result.lock.until), v0: result.lock.until };
            else lock = { until: locks.until, exitDelay: locks.exitDelay };
            if (locks.invalidKeys.length || invalidConfigKeys.length) return { kind: 'corrupt', reason: 'config_corrupt', lock, raw, lockKeys: locks, invalidLockKeys: [...locks.invalidKeys, ...invalidConfigKeys] };
            return { kind: result.fresh ? 'fresh' : 'ok', config: result.config, lock, migrated: result.migrated, raw, lockKeys: locks, snapshot: all };
        } catch {
            // A legacy store whose content cannot be migrated still carries its session end: honour it (RESET stays refused until it passes).
            const legacyEnd = newest?.value && typeof newest.value === 'object' && newest.value.v === undefined && Number.isSafeInteger(newest.value.lockedUntil) && newest.value.lockedUntil > 0 && newest.value.lockedUntil < 8.64e15 ? newest.value.lockedUntil : 0;
            lock = { ...lock, until: Math.max(lock.until, legacyEnd) };
            return { kind: 'corrupt', reason: 'config_corrupt', lock, raw, lockKeys: locks, invalidLockKeys: [...locks.invalidKeys, ...invalidConfigKeys] };
        }
    }

    const activeSettings = (config, lock) => {
        if (!config.onboarded) return { ...config, ...EMPTY_SETTINGS };
        const schedule = scheduleState(config.schedules, api.now());
        return schedule.configured && !schedule.active && !isActive(lock, api.now())
            ? { ...config, ...EMPTY_SETTINGS, baseList: true } : { ...config, baseList: true };
    };
    const planned = async config => planRules(activeSettings(config, mergeLocks(await api.storage.getAll())), supports);

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
    // True while the effective configuration record is still the one `expected` was read from.
    async function storedMatches(expected) {
        const now = newestConfig(await api.storage.getAll());
        return (now?.key ?? null) === expected.key && (expected.key !== 'config' || sameJson(now?.value, expected.config));
    }

    /**
     * Applies `config` to the browser and (when `persist`) to storage.
     * `expected` is { key, config } of the record the change is based on. Storage is append-only (core/records.js): the write
     * creates a record under THIS lock holder's epoch, so a write that arrives late (worker frozen past its lease) is dominated
     * by whatever later holders wrote and can never become the configuration. Ownership is re-checked before the writes, and the
     * effective record is re-read afterwards: if ours is not the effective one, the change is reported as `stale` and the browser
     * rules are rebuilt from storage. Rollback removes only our own record and is skipped (-> `busy`, reconciled by handle())
     * when the lease is gone. The session end time is never written here.
     */
    async function commit({ config, expected, persist }) {
        const plan = await planned(config);
        const before = await snapshot();
        let myKey = null;
        try {
            await setDynamicRules(plan.rules);
            await setBaseEnabled(plan.baseListEnabled);
            await mutex.assertOwner();
            if (!(await storedMatches(expected))) throw new TabsiraError('stale');
            if (persist) { myKey = configKey(mutex.epoch(), api.instanceId); await api.storage.set({ [myKey]: config }); }
            if (!(await verify(plan))) {
                // The browser may momentarily hold another instance's rules. If storage holds OUR record, re-apply once.
                if (persist && newestConfig(await api.storage.getAll())?.key === myKey) { await setDynamicRules(plan.rules); await setBaseEnabled(plan.baseListEnabled); }
                if (!(await verify(plan))) throw new TabsiraError('verify_failed');
            }
            const effective = newestConfig(await api.storage.getAll());
            if ((effective?.key ?? null) !== (persist ? myKey : expected.key)) throw new TabsiraError('stale');   // a later holder wrote: ours is dominated
            return plan;
        } catch (error) {
            // Lease lost (this worker was frozen past its lease): do nothing destructive. handle() re-runs reconciliation under
            // a fresh lock, which rebuilds the rules from the effective stored record.
            if (error instanceof TabsiraError && error.code === 'busy') throw error;
            let restored = true;
            const attempt = async step => { try { await step(); } catch { restored = false; } };
            await mutex.assertOwner();       // lease gone -> 'busy': skip the rollback entirely
            let newest = null;
            try { newest = newestConfig(await api.storage.getAll()); } catch { restored = false; }
            const effectiveKey = newest?.key ?? null;
            // Superseded: someone else's record is the effective one. Our record (if written) is dominated: drop it, follow storage.
            const supersededByOther = effectiveKey !== (expected.key) && effectiveKey !== myKey;
            if (supersededByOther) {
                if (myKey) await attempt(() => (newest ? api.storage.set({ [myKey]: newest.value }) : api.storage.remove([myKey])));   // keep it harmless even if it ever ranked first
                await attempt(async () => {
                    const current = await readState();
                    if (current.kind !== 'ok') return;
                    const rebuilt = await planned(current.config);
                    await setDynamicRules(rebuilt.rules);
                    await setBaseEnabled(rebuilt.baseListEnabled);
                });
            } else {
                // Our record is effective (or nothing was written): put the previous configuration back under OUR name (no deletion of anything
                // that others could depend on; a fresh install has nothing to restore, so our own record is removed), then the old rules.
                if (myKey) await attempt(() => (expected.config === undefined ? api.storage.remove([myKey]) : api.storage.set({ [myKey]: expected.config })));
                await attempt(() => setDynamicRules(before.rules));
                await attempt(() => setBaseEnabled(before.baseEnabled));
            }
            await mutex.assertOwner();       // the rollback itself may have been frozen: if the lease is gone, hand over to reconcile
            const code = supersededByOther && restored ? 'stale' : restored ? (error instanceof TabsiraError && error.code === 'stale' ? 'stale' : 'apply_failed') : 'apply_failed_rollback_failed';
            throw new TabsiraError(code, { cause: error instanceof TabsiraError ? error.code : 'api' });
        }
    }

    // ---- status ----
    async function computeStatus() {
        const state = await readState();
        const now = api.now();
        const status = { state: 'unknown', reasons: [], notes: [], settings: null, revision: 0, onboarded: false,
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
        status.commitment = commitmentStatus(state.config, state.lock, now);
        status.schedules = { items: state.config.schedules, ...scheduleState(state.config.schedules, now) };
        let actual, plan;
        try {
            const [snap, hosts, incognito] = await Promise.all([snapshot(), api.permissions.contains({ origins: [...HOST_ORIGINS] }), api.isIncognitoAllowed()]);
            actual = snap;
            status.permissions.hosts = !!hosts;
            status.incognitoAllowed = incognito;
            plan = await planned(state.config);
        } catch { status.reasons.push('api_error'); return status; }
        status.base.enabled = actual.baseEnabled;
        try { const meta = await api.baseMeta(); status.base = { ...status.base, domainCount: meta.domainCount ?? 0, version: meta.version ?? null, date: meta.upstreamDate ?? null, mandatory: state.config.onboarded, previewAvailable: true }; } catch { /* metadata is informational */ }
        status.notes = plan.narrowEdges.length ? [{ code: 'phrases_narrow_edges', count: plan.narrowEdges.length }] : [];
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

    async function syncScheduleAlarm(status) {
        if (!api.alarms) return;
        // The alarm is derived state. Every save, worker start, permission change, status
        // check and alarm wake rebuilds it from effective storage; the watchdog repairs
        // an old worker's late alarm write. Browser shutdown can delay alarm delivery.
        const candidates = [status.schedules?.nextChange, status.lock?.active ? status.lock.until : null]
            .filter(when => Number.isSafeInteger(when) && when > api.now());
        const when = candidates.length ? Math.min(...candidates) : null;
        try {
            const existing = (await api.alarms.getAll()).find(alarm => alarm.name === SCHEDULE_ALARM);
            if (when === null) { if (existing) await api.alarms.clear(SCHEDULE_ALARM); }
            else if (existing?.scheduledTime !== when) await api.alarms.create(SCHEDULE_ALARM, { when });
        } catch { /* Watchdog/start/message reconciliation still restores derived rules. */ }
    }

    async function statusNow() {
        const status = await computeStatus();
        await syncScheduleAlarm(status);
        await publishBadge(status);
        return status;
    }

    // ---- reconcile: make the browser match the stored configuration ----
    // Runs inside the write mutex when it may write (migration, repair). Storage clean-up removes only lock entries that
    // can no longer matter (valid entries smaller than the effective end time).
    // Removes only keys whose immutable value is dominated for ever (core/records.js), so even a removal that runs arbitrarily late
    // (worker frozen after choosing the keys) cannot reach a newer value - those live under different names. Failure is harmless.
    async function compactStorage() {
        const all = await api.storage.getAll();
        const stale = obsoleteKeys(all, { leaseNow: api.clock(), selfMutexKey: mutex.ownKey });
        if (!stale.length) return;
        await mutex.assertOwner();
        await api.storage.remove(stale);
    }

    async function reconcileTask() {
        const state = await readState();
        if (state.kind === 'ok') {
            const plan = await planned(state.config);
            const actual = await snapshot();
            const matches = rulesMatch(actual.rules, plan.rules) && actual.baseEnabled === plan.baseListEnabled;
            if (!matches || state.migrated) {
                await commit({ config: state.config, expected: state.raw, persist: !!state.migrated });
            }
        }
        // 'fresh' with leftover rules, 'corrupt' and 'error': never delete protection because of a read problem.
        return statusNow();
    }
    // A v0 store keeps its session end inside the legacy `config` key, which is never read again once ANY new configuration record exists
    // (save, import, onboarding, pin, reset or migration). So, inside the lock and before the operation can write anything, the legacy
    // session end is copied to a grow-only lock key (idempotent). A stop at any point leaves either the legacy value or the key.
    async function persistLegacyLock() {
        const state = await readState();
        if (state.kind === 'ok' && state.migrated && state.lock.v0 > 0 && (state.lockKeys?.until ?? 0) < state.lock.v0) await writeLock(state.lock.v0);
    }
    const guarded = task => mutex.run(async () => {
        await persistLegacyLock();
        const result = await task();
        try { await compactStorage(); } catch { /* clean-up is optional */ }
        return result;
    });
    const reconcile = () => serialize(() => guarded(reconcileTask)).catch(() => statusNow().catch(() => null));

    /** Records a session end time under a NEW key (write-once); the effective end is the maximum over all keys, so this can only lengthen. */
    async function writeLock(until, exitDelay = 60) {
        await mutex.assertOwner();
        await api.storage.set({ [lockKey(mutex.token(), api.instanceId)]: { until, exitDelay } });
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
        const next = { ...state.config, ...settings, baseList: true, revision: state.config.revision + 1, onboarded: true };
        if (isActive(state.lock, api.now())) {
            const reasons = weakeningReasons(state.config, next);
            if (reasons.length) throw new TabsiraError('locked_weakening', { reasons });
        }
        for (const mode of ['words', 'contains']) {
            const bad = await findUnsupported(settings[mode], mode === 'words' ? 'word' : 'contains', supports, PARAM_GROUPS.map(group => group.param));
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
        async START_SESSION({ minutes, exitDelay = 60 }) {
            if (!validMinutes(minutes) || !validExitDelay(exitDelay)) throw new TabsiraError('bad_request');
            const state = await requireWritable();
            if (state.kind === 'fresh' || !state.config.onboarded) throw new TabsiraError('session_needs_rules');
            const now = api.now();
            const status = await statusNow();
            if (status.state !== 'active') {
                // Never promise commitment around protection that is not actually in place.
                throw new TabsiraError(status.state === 'not_configured' ? 'session_needs_rules' : 'session_needs_active_protection');
            }
            // Pin: a copy of the effective configuration under THIS holder's epoch. Every configuration write that began earlier (a frozen
            // worker that resumes later) carries a lower epoch and is dominated by it, so nothing started before the session can land in it.
            const delay = isActive(state.lock, now) ? Math.max(exitDelay, state.lock.exitDelay, state.config.commitment.exitDelay) : exitDelay;
            const target = Math.max(state.lock.until, now + minutes * 60000);
            const next = { ...state.config, commitment: { ...state.config.commitment, exitDelay: delay,
                request: target > state.lock.until || delay > state.config.commitment.exitDelay ? null : state.config.commitment.request } };
            await commit({ config: next, expected: state.raw, persist: true });
            // Grow-only: only ever raises this instance's own key; the effective end time is the maximum over all keys.
            if (target > state.lock.until) await writeLock(target, delay);
            // The session record may have been written late (this holder frozen past its lease, another holder saved meanwhile). A start is
            // reported as success only if this holder still owns the lock, its pinned record is still the effective configuration, and
            // protection is active on it. The session entry itself is grow-only and is never deleted here: a late removal could take a newer
            // session with it (equal end times, or a longer entry that had dominated it).
            // If any of these fail, the session entry is already stored (grow-only), so the error says that a session may be running.
            const lateStart = code => new TabsiraError(code, { sessionMayBeActive: true });
            try { await mutex.assertOwner(); } catch { throw lateStart('session_start_inconsistent'); }
            if (newestConfig(await api.storage.getAll())?.key !== configKey(mutex.epoch(), api.instanceId)) throw lateStart('session_start_inconsistent');
            try { await reconcileTask(); } catch { throw lateStart('session_start_inconsistent'); }
            const after = await statusNow();
            if (after.state !== 'active') throw lateStart('session_start_inconsistent');
            return { status: after };
        },
        async GET_SCHEDULES() {
            const state = await requireWritable();
            return { schedules: state.config.schedules, revision: state.config.revision, status: await statusNow() };
        },
        async SAVE_SCHEDULES({ schedules, baseRevision }) {
            const state = await requireWritable();
            if (baseRevision !== undefined) checkRevision(state, baseRevision);
            const parsed = parseSchedules(schedules);
            if (isActive(state.lock, api.now()) && schedulesWeaken(state.config.schedules, parsed)) {
                throw new TabsiraError('locked_weakening', { reasons: ['schedule_reduced'] });
            }
            await commit({ config: { ...state.config, schedules: parsed, revision: state.config.revision + 1, onboarded: true, baseList: true }, expected: state.raw, persist: true });
            return { status: await statusNow() };
        },
        async BLOCK_CURRENT_SITE({ domain }) {
            const state = await requireWritable();
            const normalized = normalizeDomain(domain);
            const settings = settingsOf(state.config);
            // An explicit current-site block strengthens additional rules by removing covering exceptions.
            settings.allow = settings.allow.filter(exception => !(normalized === exception || normalized.endsWith(`.${exception}`)));
            settings.domains = [...new Set([...settings.domains, normalized])];
            await applySettings(state, parseSettings(settings));
            return { status: await statusNow() };
        },
        async REQUEST_EARLY_EXIT() {
            const state = await requireWritable();
            if (!isActive(state.lock, api.now())) throw new TabsiraError('session_expired');
            const current = state.config.commitment;
            if (current.request?.until === state.lock.until) return { status: await statusNow() };
            const delay = Math.max(current.exitDelay, state.lock.exitDelay);
            const keys = Object.keys(state.lockKeys.keys);
            addReleases(current.releases, keys); // refuse saturation before starting a wait
            const request = { readyAt: api.now() + delay * 60000, until: state.lock.until, keys };
            await commit({ config: { ...state.config, commitment: { ...current, exitDelay: delay, request } }, expected: state.raw, persist: true });
            return { status: await statusNow() };
        },
        async CANCEL_EARLY_EXIT() {
            const state = await requireWritable();
            await commit({ config: { ...state.config, commitment: { ...state.config.commitment, request: null } }, expected: state.raw, persist: true });
            return { status: await statusNow() };
        },
        async CONFIRM_EARLY_EXIT(_message, proof) {
            const state = await requireWritable();
            const request = state.config.commitment.request;
            if (!isActive(state.lock, api.now())) throw new TabsiraError('session_expired');
            if (!request || request.until !== state.lock.until) throw new TabsiraError('exit_not_requested');
            if (api.now() < request.readyAt) throw new TabsiraError('exit_waiting');
            if (!proof || !sameJson(request, proof.request)) throw new TabsiraError('exit_not_requested');
            if (!proof.generation || (await featureController.getPasswordGeneration()) !== proof.generation) throw new TabsiraError('password_invalid');
            // Natural expiry always wins, including while the password is being checked.
            if (!isActive(state.lock, api.now())) throw new TabsiraError('session_expired');
            const commitment = { ...state.config.commitment, request: null,
                releases: addReleases(state.config.commitment.releases, request.keys) };
            // A fresh fenced config record is the cancellation tombstone. Stale confirmation writes are
            // dominated by a later cancellation/start; it never deletes or overwrites any lock name.
            await commit({ config: { ...state.config, commitment }, expected: state.raw, persist: true });
            if (api.now() >= request.until) throw new TabsiraError('session_expired');
            await reconcileTask();
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
            if (!operation) throw new TabsiraError('bad_request');
            const readOnly = ['GET_STATUS', 'GET_EXPORT', 'GET_SCHEDULES'].includes(message.type);
            const result = await serialize(async () => {
                let proof;
                if (message.type === 'CONFIRM_EARLY_EXIT') {
                    // The security verifier shares the cross-instance write mutex. Verify outside
                    // it, then bind that result to both the request and credential generation under it.
                    const state = await requireWritable();
                    const request = state.config.commitment.request;
                    if (!isActive(state.lock, api.now())) throw new TabsiraError('session_expired');
                    if (!request || request.until !== state.lock.until) throw new TabsiraError('exit_not_requested');
                    if (api.now() < request.readyAt) throw new TabsiraError('exit_waiting');
                    if (!featureController?.getPasswordGeneration) throw new TabsiraError('password_invalid');
                    const generation = await featureController.getPasswordGeneration();
                    if (!generation || !(await featureController.verifyPassword(message.password))
                        || (await featureController.getPasswordGeneration()) !== generation) throw new TabsiraError('password_invalid');
                    proof = { request, generation };
                }
                return readOnly ? operation(message) : guarded(() => operation(message, proof));
            });
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
        // Commit first, remove the damaged keys only after it succeeded: if the commit fails nothing was lost (invalid keys are ignored by the
        // epoch numbering and the record ranking, so they cannot get in the way of the new record).
        await commit({ config: { ...defaultConfig(), onboarded: true, baseList: true, starterTerms: false, revision: 1 }, expected: state.raw, persist: true });
        if (state.invalidLockKeys?.length) { await mutex.assertOwner(); await api.storage.remove(state.invalidLockKeys); }
        return { status: await statusNow() };
    }

    return { handle, reconcile, statusNow, readState, supports, instanceId: api.instanceId };
}
