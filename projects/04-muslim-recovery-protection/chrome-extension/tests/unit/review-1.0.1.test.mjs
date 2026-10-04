// Regression tests for the findings of the pre-release review of 1.0.0 (see docs/RELEASE-REVIEW-1.0.1.md).
// Each test names its finding ID. They fail on the 1.0.0 code (commit 1d845d0) and pass on 1.0.1.
// Mocks only exercise our own logic; DNR behaviour of these changes is covered by tests/e2e (checks R1.*).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../../src/background/controller.js';
import { createWriteMutex } from '../../src/background/coordination.js';
import { validateMessage } from '../../src/background/messages.js';
import * as phrases from '../../src/core/phrases.js';
const { normalizePhrase, buildPhraseRegex, phraseFragment } = phrases;
import { normalizeDomain } from '../../src/core/domains.js';
import { planRules, SELFTEST_DOMAIN } from '../../src/core/rules.js';
import { obsoleteKeys, listConfigRecords, maxEpoch } from '../../src/core/records.js';
import { mergeLocks } from '../../src/core/lock.js';
import { defaultConfig } from '../../src/core/config.js';
import { createFakeBrowser } from './fake-browser.mjs';

const noList = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const send = (controller, message) => controller.handle(validateMessage(message));
const onboard = async (c, over = {}) => {
    await send(c, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    const { status } = await send(c, { type: 'GET_STATUS' });
    if (Object.keys(over).length) await send(c, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList, ...over } });
};
const wideRe = (param, phrase) => new RegExp(buildPhraseRegex('word', param, [phraseFragment(phrase)]), 'i');
const url = (param, value) => `https://www.example-engine.test/search?hl=en&${param}=${value}`;

test('A-2/G-2a: whole-word boundaries accept quotes, punctuation, ".com" and "-" around the phrase, and still refuse letters/digits', () => {
    const re = wideRe('q', 'xvideos');
    for (const value of ['xvideos', 'xvideos.com', '%22xvideos%22', 'xvideos%2C', 'xvideos%21', 'xvideos%3F'.replace('%3F', '.'), 'www.xvideos.com', 'free+xvideos+now',
        'hentai-xvideos', '%28xvideos%29', 'a%2Cxvideos', 'a%2cxvideos', 'site:xvideos.com', 'site%3Axvideos.com', 'xvideos%3F', 'xvideos;', 'inurl:xvideos']) {
        assert.ok(re.test(url('q', value)), `must block q=${value}`);
    }
    for (const value of ['xvideosx', 'axvideos', 'xvideos1', '1xvideos', 'notxvideos', 'xvideo', 'xvideos%41', 'other']) {
        assert.ok(!re.test(url('q', value)), `must NOT block q=${value}`);
    }
    assert.ok(!re.test(url('other', 'xvideos.com') + '&q=ordinary'), 'another parameter never matches');
});

test('A-2/G-2a: a phrase too long for the wide boundary falls back to the narrow boundary (never becomes unsupported)', async () => {
    const phrase = 'a'.repeat(60);
    const narrowLength = buildPhraseRegex('word_narrow', 'q', [phraseFragment(phrase)]).length;
    assert.ok(buildPhraseRegex('word', 'q', [phraseFragment(phrase)]).length > narrowLength);
    assert.ok(buildPhraseRegex('word', 'q', [phraseFragment('ab')]).length <= narrowLength, 'the short phrase fits the wide form');
    const supports = async regex => regex.length <= narrowLength;       // fits narrow, not wide
    const packed = await phrases.packWord([phrase, 'ab'], supports, 'q');
    assert.deepEqual(packed.unsupported, []);
    assert.deepEqual(packed.narrow.flat(), [phrase]);
    assert.deepEqual(packed.chunks.flat(), ['ab']);
    assert.deepEqual(await phrases.findUnsupported([phrase], 'word', supports, ['q']), []);
});

test('A-1/G-3: SAVE refuses a phrase that no rule can express for EVERY search parameter (not only q)', async () => {
    const phrase = 'a'.repeat(20);
    const limit = buildPhraseRegex('word_narrow', 'q', [phraseFragment(phrase)]).length;   // fits for q, not for search_query (longer name)
    assert.ok(buildPhraseRegex('word_narrow', 'search_query', [phraseFragment(phrase)]).length > limit);
    const fake = createFakeBrowser({ regexLimit: limit });
    const c = createController(fake.api);
    await onboard(c);
    const { status } = await send(c, { type: 'GET_STATUS' });
    const reply = await send(c, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList, words: [phrase] } });
    assert.equal(reply.ok, false);
    assert.equal(reply.error.code, 'phrase_too_complex');
});

test('A-6/B-2: the safe-test domain is redirected by a user rule even when the built-in list is off', async () => {
    const fake = createFakeBrowser();
    const plan = await planRules({ ...defaultConfig(), onboarded: true, baseList: false, domains: ['mysite.test'] }, async () => true);
    const covering = plan.rules.filter(rule => rule.action.type === 'redirect' && (rule.condition.requestDomains ?? []).includes(SELFTEST_DOMAIN));
    assert.equal(covering.length, 1);
    const none = await planRules({ ...defaultConfig(), onboarded: true, baseList: false, starterTerms: false }, async () => true);
    assert.equal(none.rules.length, 0, 'nothing enabled -> no rules at all (honest not_configured)');
    void fake;
});

test('A-4/G-8: a lone surrogate in a phrase is rejected as phrase_invalid (no raw URIError)', () => {
    assert.throws(() => normalizePhrase('ab\ud800cd'), error => error.code === 'phrase_invalid');
    assert.throws(() => normalizePhrase('\udc00abc'), error => error.code === 'phrase_invalid');
    assert.equal(normalizePhrase('ab😀cd'), 'ab😀cd');
});

test('A-8: repeated www. prefixes are stripped in one step (stored form is already canonical)', () => {
    assert.equal(normalizeDomain('www.www.example.com'), 'example.com');
    assert.equal(normalizeDomain(normalizeDomain('www.www.example.com')), 'example.com');
});

test('G-9b: common Arab/Asian shared suffixes are refused as sites', () => {
    for (const suffix of ['org.sa', 'net.sa', 'net.eg', 'net.ae', 'org.ae', 'ac.ae', 'net.pk', 'org.pk', 'edu.pk', 'org.bd', 'net.my', 'org.my', 'ac.id', 'web.id', 'uk.com', 'co.com']) {
        assert.throws(() => normalizeDomain(suffix), error => error.code === 'domain_is_shared_suffix', suffix);
    }
});

test('G-4/C-6b: a lease that claims to expire far in the future is ignored (cannot lock everyone out)', async () => {
    const fake = createFakeBrowser();
    fake.state.storage['mx:ghost'] = { choosing: false, ticket: 1, exp: Date.now() + 3_600_000 };
    const mutex = createWriteMutex(fake.api, { leaseMs: 200, waitMs: 400, pollMs: 2 });
    let ran = false;
    await mutex.run(async () => { ran = true; });
    assert.ok(ran, 'acquired despite the implausible ghost lease');
});

test('C-3: a storage failure while registering for the mutex does not leave a live entry behind', async () => {
    const fake = createFakeBrowser();
    const mutex = createWriteMutex(fake.api, { leaseMs: 5000, waitMs: 400, pollMs: 2 });
    const real = fake.api.storage.getAll; let calls = 0;
    fake.api.storage.getAll = async () => { if (++calls === 1) throw new Error('injected'); return real(); };
    await assert.rejects(() => mutex.run(async () => {}));
    assert.deepEqual(Object.keys(fake.state.storage).filter(key => key.startsWith('mx:')), [], 'no orphan mutex entry');
});

test('C-4: compaction never removes a valid session because another lock-like entry is invalid', () => {
    const snapshot = { 'lock:1-1:a': { until: 5_000 }, 'lock:2-1:b': { until: 8.7e15 }, 'lock:3-1:c': { until: 4_000, extra: 1 } };
    const stale = obsoleteKeys(snapshot, { now: 1_000 });
    assert.ok(!stale.includes('lock:1-1:a'), 'the valid session end survives');
    assert.equal(mergeLocks(snapshot).until, 5_000);
});

test('C-6a/G-5: a transient forward clock error cannot permanently delete the newest session entry', () => {
    const snapshot = { 'lock:1-1:a': { until: 5_000 } };
    assert.deepEqual(obsoleteKeys(snapshot, { now: 10_000_000 }), []);
});

test('G-7b: an out-of-range epoch in storage is ignored for numbering and flagged as invalid (reset can clear it)', () => {
    const snapshot = { 'cfg:999999999999999:zz': { revision: 1 }, 'ep:999999999999999:zz': { n: 1 } };
    assert.equal(maxEpoch(snapshot), 0);
    assert.deepEqual(listConfigRecords(snapshot).invalidKeys, ['cfg:999999999999999:zz']);
});

test('C-2/G-6: a v0 session end is written BEFORE the migrated record, so it cannot be lost between the two writes', async () => {
    const fake = createFakeBrowser();
    const lockedUntil = fake.state.now + 3_600_000;
    fake.state.storage.config = { domains: ['legacy.example'], keywords: [], lockedUntil };
    // The migrated config write fails once (worker dies after the lock write, before the record): the session must already be stored.
    fake.state.fail['storage.set'] = 1;
    const c = createController(fake.api);
    await c.reconcile();
    const stored = mergeLocks(fake.state.storage).until;
    assert.ok(stored >= lockedUntil, `session end stored first (stored=${stored})`);
});

// ---------- scenario tests requested by the Owner (START_SESSION frozen at the session write; legacy sessions) ----------
const gate = () => { let open; const promise = new Promise(resolve => { open = resolve; }); return { promise, open }; };
const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));
const until = async (predicate, label) => { for (let i = 0; i < 400 && !predicate(); i++) await tick(1); assert.ok(predicate(), label); };
let peerCount = 0;
const peerOf = api => createController({ ...api, instanceId: `rv${++peerCount}` });
const lockEnd = state => mergeLocks(state.storage).until;

test('SCENARIO 1a: START_SESSION frozen at the session-record write (after the ownership check); lease expires; another controller saves WEAKER settings; the old start must not return success', async () => {
    const fake = createFakeBrowser(); const a = createController(fake.api); const b = peerOf(fake.api);
    await onboard(a, { domains: ['example.com', 'second.org'] });
    const hold = gate(); const real = fake.api.storage.set; const seen = { frozen: false };
    fake.api.storage.set = async items => {
        if (!seen.frozen && Object.keys(items).some(key => key.startsWith('lock:'))) { seen.frozen = true; await hold.promise; }
        return real(items);
    };
    const slow = send(a, { type: 'START_SESSION', minutes: 60 });
    await until(() => seen.frozen, 'A froze at its session record write');
    fake.state.clockSkew += 60_000;                                          // A's lease expires
    fake.api.storage.set = real;
    const rev = (await send(b, { type: 'GET_STATUS' })).status.revision;
    const weaker = await send(b, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...noList } });   // no session is active yet, so this is allowed
    assert.ok(weaker.ok, JSON.stringify(weaker.error));
    hold.open(); const late = await slow;
    assert.equal(late.ok, false, 'the old start must not report success on empty protection');
    assert.ok(['busy', 'stale', 'session_start_inconsistent'].includes(late.error.code), late.error.code);
    assert.equal(late.error.code, 'session_start_inconsistent', 'frozen AFTER the pin: the lock key was written, so the error says a session may be running');
    assert.equal(late.error.params.sessionMayBeActive, true);
    const status = (await send(b, { type: 'GET_STATUS' })).status;
    assert.deepEqual(status.settings.domains, [], 'the newer, weaker settings are the effective ones (not overwritten by the old start)');
});

test('SCENARIO 1b: a failed late start never deletes or cancels a NEWER successful session, even with an equal end time', async () => {
    const fake = createFakeBrowser(); const a = createController(fake.api); const b = peerOf(fake.api);
    await onboard(a, { domains: ['example.com'] });
    const hold = gate(); const real = fake.api.storage.set; const seen = { frozen: false };
    fake.api.storage.set = async items => {
        if (!seen.frozen && Object.keys(items).some(key => key.startsWith('lock:'))) { seen.frozen = true; await hold.promise; }
        return real(items);
    };
    const slow = send(a, { type: 'START_SESSION', minutes: 60 });                // target T = now + 60 min (the fake session clock is frozen, so B's target is EQUAL)
    await until(() => seen.frozen, 'A froze at its session record write');
    fake.state.clockSkew += 60_000;
    fake.api.storage.set = real;
    const newer = await send(b, { type: 'START_SESSION', minutes: 60 });          // B starts its own session successfully
    assert.ok(newer.ok, JSON.stringify(newer.error));
    const end = lockEnd(fake.state);
    hold.open(); const late = await slow;                                          // A's old write lands now and its start fails
    assert.equal(late.ok, false);
    // Late clean-up of dominated entries by anyone (including the tie): the effective end must stay.
    await send(a, { type: 'REPAIR' }); await send(b, { type: 'REPAIR' }); await send(b, { type: 'GET_STATUS' });
    assert.equal(lockEnd(fake.state), end, 'the session end is intact after the late write and any clean-up');
    const status = (await send(b, { type: 'GET_STATUS' })).status;
    assert.ok(status.lock.active && status.state === 'active', 'the newer session is still active');
    const attempt = await send(b, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList } });
    assert.equal(attempt.ok, false); assert.equal(attempt.error.code, 'locked_weakening');
});

test('SCENARIO 1c: equal end times - removing the tie "loser" entry (any order) never changes the effective end', () => {
    const snapshot = { 'lock:3-1:a': { until: 9_000 }, 'lock:2-1:z': { until: 9_000 } };
    const stale = obsoleteKeys(snapshot, {});
    assert.equal(stale.length, 1, 'exactly one of the two equal entries is dominated');
    const rest = Object.fromEntries(Object.entries(snapshot).filter(([key]) => !stale.includes(key)));
    assert.equal(mergeLocks(rest).until, 9_000);
});

const legacy = (fake, until) => { fake.state.storage.config = { domains: ['legacy.example'], keywords: [], lockedUntil: until }; };

test('SCENARIO 2a: a legacy store with an ACTIVE session: a plain SAVE stores the session end first, so the next weakening is still refused', async () => {
    const fake = createFakeBrowser(); const until = fake.state.now + 3 * 3_600_000; legacy(fake, until);
    const c = createController(fake.api);
    // No status call first (it would reconcile and migrate): the legacy revision is 1 and SAVE comes straight in.
    const saved = await send(c, { type: 'SAVE_SETTINGS', baseRevision: 1, settings: { ...noList, domains: ['legacy.example', 'added.example'] } });   // stronger: allowed
    assert.ok(saved.ok, JSON.stringify(saved.error));
    assert.ok(lockEnd(fake.state) >= until, 'the legacy session end now lives in a lock key');
    const fresh = peerOf(fake.api);                                              // another controller, legacy key no longer read
    const status = (await send(fresh, { type: 'GET_STATUS' })).status;
    assert.ok(status.lock.active);
    const weaken = await send(fresh, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList } });
    assert.equal(weaken.ok, false); assert.equal(weaken.error.code, 'locked_weakening');
});

test('SCENARIO 2b: a legacy store with an active session: IMPORT directly before any reconcile keeps the session', async () => {
    const fake = createFakeBrowser(); const until = fake.state.now + 3 * 3_600_000; legacy(fake, until);
    const c = createController(fake.api);
    const rev = 1;                                                               // legacy revision; no status call (it would reconcile first)
    const text = JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...noList, domains: ['imported.example'] } });
    const done = await send(c, { type: 'IMPORT_SETTINGS', baseRevision: rev, text });
    assert.ok(done.ok, JSON.stringify(done.error));
    assert.ok(lockEnd(fake.state) >= until);
    const status = (await send(peerOf(fake.api), { type: 'GET_STATUS' })).status;
    assert.ok(status.lock.active && status.lock.until >= until);
});

test('SCENARIO 2c: START_SESSION on a legacy store whose old end is LONGER than the new one does not lose the old end', async () => {
    const fake = createFakeBrowser(); const until = fake.state.now + 3 * 3_600_000; legacy(fake, until);
    const c = createController(fake.api);
    await send(c, { type: 'REPAIR' });                                           // installs the migrated rules (this store is not onboarded-by-UI, only legacy)
    const reply = await send(c, { type: 'START_SESSION', minutes: 60 });
    assert.ok(reply.ok, JSON.stringify(reply.error));
    assert.ok(lockEnd(fake.state) >= until, `old end kept (${lockEnd(fake.state)} vs ${until})`);
    const pinned = Object.entries(fake.state.storage).filter(([key]) => key.startsWith('cfg:')).map(([, value]) => value);
    assert.ok(pinned.every(value => value.v !== undefined), 'the pinned record is current-schema, never legacy-shaped');
});

test('SCENARIO 2d: stop right after the migrated record is written (before any later lock write) then a weakening save from another controller is refused', async () => {
    const fake = createFakeBrowser(); const until = fake.state.now + 3 * 3_600_000; legacy(fake, until);
    // The worker dies at the first session-key write (1.0.0 wrote it AFTER the migrated record: the end was lost for good).
    const real = fake.api.storage.set; let died = 0;
    fake.api.storage.set = async items => { if (!died && Object.keys(items).some(key => key.startsWith('lock:'))) { died++; throw new Error('worker stopped'); } return real(items); };
    await createController(fake.api).reconcile();
    fake.api.storage.set = real;
    const other = peerOf(fake.api);
    const status = (await send(other, { type: 'GET_STATUS' })).status;
    assert.ok(status.lock.active, 'session survives the interrupted migration');
    const weaken = await send(other, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList } });
    assert.equal(weaken.ok, false); assert.equal(weaken.error.code, 'locked_weakening');
});

test('SCENARIO 2e: two controllers on one legacy store (one migrating, one saving) end with the session intact', async () => {
    const fake = createFakeBrowser(); const until = fake.state.now + 3 * 3_600_000; legacy(fake, until);
    const a = createController(fake.api); const b = peerOf(fake.api);
    await Promise.all([a.reconcile(), send(b, { type: 'SAVE_SETTINGS', baseRevision: 1, settings: { ...noList, domains: ['legacy.example', 'b.example'] } })]);
    assert.ok(lockEnd(fake.state) >= until);
    const status = (await send(a, { type: 'GET_STATUS' })).status;
    assert.ok(status.lock.active);
});

test('G2-2: a planted out-of-range epoch is reported as corrupt and RESET clears it (no permanent "stale")', async () => {
    const fake = createFakeBrowser(); const c = createController(fake.api);
    await onboard(c, { domains: ['example.com'] });
    fake.state.storage['cfg:999999999999:zz'] = { v: 2 };
    const status = (await send(c, { type: 'GET_STATUS' })).status;
    assert.equal(status.state, 'unknown');
    const reset = await send(c, { type: 'RESET', baseRevision: 0 });
    assert.ok(reset.ok, JSON.stringify(reset.error));
    assert.ok(!('cfg:999999999999:zz' in fake.state.storage));
});

test('G2-6: the wide edge needs a real hex digit after %2 (a malformed %2# is not a boundary)', () => {
    assert.ok(!wideRe('q', 'tabsira word').test('https://e.test/s?x=1&q=zz%2#tabsira+word'));
    assert.ok(wideRe('q', 'tabsira word').test('https://e.test/s?q=%22tabsira+word%22'));
});

test('NOTES: a whole word that only fits the narrow edge is reported (status note), never shown as plain full protection', async () => {
    const phrase = 'a'.repeat(60);
    const narrowLength = buildPhraseRegex('word_narrow', 'q', [phraseFragment(phrase)]).length;
    const fake = createFakeBrowser({ regexLimit: narrowLength + 60 });          // wide form of this phrase does not fit, the narrow one does for q
    void fake;
    const supports = async regex => regex.length <= narrowLength;
    const plan = await planRules({ ...defaultConfig(), onboarded: true, baseList: false, starterTerms: false, words: [phrase, 'ab'] }, supports);
    assert.deepEqual(plan.narrowEdges, [phrase]);
    const control = createFakeBrowser({ regexLimit: narrowLength });
    const c = createController(control.api);
    await onboard(c);
    const { status } = await send(c, { type: 'GET_STATUS' });
    const saved = await send(c, { type: 'SAVE_SETTINGS', baseRevision: status.revision, settings: { ...noList, words: ['ab'] } });
    assert.ok(saved.ok);
    assert.deepEqual(saved.status.notes, [], 'a phrase with full word edges carries no note');
});

test('G3-2: a CORRUPT legacy store still honours its session end: RESET is refused while it runs', async () => {
    for (const bad of [{ domains: ['http://bad/path'] }, { domains: ['*.wild.example'] }, { domains: ['ok.example'], keywords: ['x'] }, { domains: Array.from({ length: 1001 }, (_, i) => `d${i}.example`) }]) {
        const fake = createFakeBrowser(); const until = fake.state.now + 90 * 60_000;
        fake.state.storage.config = { ...bad, lockedUntil: until };
        const c = createController(fake.api);
        const status = (await send(c, { type: 'GET_STATUS' })).status;
        assert.ok(status.lock.active, `session end read from the corrupt legacy store (${JSON.stringify(bad).slice(0, 30)})`);
        const reset = await send(c, { type: 'RESET', baseRevision: 0 });
        assert.equal(reset.ok, false); assert.equal(reset.error.code, 'locked_weakening');
        fake.state.now = until + 1000;
        assert.ok((await send(c, { type: 'RESET', baseRevision: 0 })).ok, 'after the session RESET works again');
    }
});

test('G3-3: the wide edge covers operators and question marks; documented non-edges stay non-edges', () => {
    const re = wideRe('q', 'xvideos');
    for (const value of ['site:xvideos.com', 'inurl:xvideos', 'xvideos%3F', 'xvideos?', 'xvideos;', 'a%3Bxvideos']) assert.ok(re.test(url('q', value)), `must block q=${value}`);
    for (const value of ['[xvideos]', 'xvideos|x', 'xvideos%D8%9F', 'x%D8%9Fxvideosa']) assert.equal(re.test(url('q', value)), false, `documented limit q=${value}`);
});

test('G4-2: a legacy session end above the lock ceiling is ignored (the store stays usable)', async () => {
    for (const absurd of [8.7e15, Number.MAX_SAFE_INTEGER]) {
        const fake = createFakeBrowser();
        fake.state.storage.config = { domains: ['legacy.example'], keywords: [], lockedUntil: absurd };
        const c = createController(fake.api);
        const saved = await send(c, { type: 'SAVE_SETTINGS', baseRevision: 1, settings: { ...noList, domains: ['legacy.example', 'more.example'] } });
        assert.ok(saved.ok, JSON.stringify(saved.error));
        const status = (await send(c, { type: 'GET_STATUS' })).status;
        assert.equal(status.lock.active, false, 'no session invented from an absurd value');
        assert.ok((await send(c, { type: 'RESET', baseRevision: status.revision })).ok);
    }
});

test('G4-4: a RESET whose commit fails does not drop a damaged session key (commit first, clean up after)', async () => {
    const fake = createFakeBrowser(); const c = createController(fake.api);
    await onboard(c, { domains: ['example.com'] });
    fake.state.storage['lock:1-1:bad'] = { until: 'x' };                            // damaged entry: the store reads as corrupt
    fake.state.fail['dnr.update'] = 3;                                                // the RESET's rule update fails
    const reset = await send(c, { type: 'RESET', baseRevision: 0 });
    assert.equal(reset.ok, false);
    assert.ok('lock:1-1:bad' in fake.state.storage, 'the damaged key is still there after the failed RESET');
    fake.state.fail['dnr.update'] = 0;
    assert.ok((await send(c, { type: 'RESET', baseRevision: 0 })).ok);
    assert.ok(!('lock:1-1:bad' in fake.state.storage), 'removed after a successful RESET');
});
