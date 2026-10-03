import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, isSameOrSubdomain } from '../../src/core/domains.js';
import { normalizePhrase, buildPhraseRegex, phraseFragment, packPhrases } from '../../src/core/phrases.js';
import { parseSettings, parseStored, migrate, weakeningReasons, mergeImport, exportSettings, defaultConfig, LIMITS } from '../../src/core/config.js';
import { planRules, canonicalRules, rulesMatch, PARAM_GROUPS, PRIORITY } from '../../src/core/rules.js';
import { extend, isActive, emptyLock } from '../../src/core/lock.js';
import { STARTER_TERMS } from '../../src/core/starter-terms.js';

const settings = (over = {}) => ({ baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [], ...over });
const throwsCode = (fn, code) => assert.throws(fn, error => error.code === code, `expected ${code}`);

test('domains: normalization, www strip, punycode, strict rejection without echoing input', () => {
    assert.equal(normalizeDomain(' HTTPS://Www.Example.COM/ '), 'example.com');
    assert.equal(normalizeDomain('مثال.إختبار'), 'xn--mgbh0fb.xn--kgbechtv');
    for (const [input, code] of [['*.example.com', 'domain_wildcard_or_space'], ['example.com/path', 'domain_has_path'], ['example.com?q=x', 'domain_has_path'],
        ['ftp://example.com', 'domain_invalid'], ['user:pw@example.com', 'domain_has_path'], ['localhost', 'domain_invalid'], ['-bad.example', 'domain_invalid'],
        ['example.com:443', 'domain_has_path'], ['192.168.0.1', 'domain_is_ip'], ['', 'domain_empty'], ['co.uk', 'domain_is_shared_suffix'], ['blogspot.com', 'domain_is_shared_suffix']]) {
        throwsCode(() => normalizeDomain(input), code);
    }
    try { normalizeDomain('secret-site.example/path'); } catch (error) { assert.ok(!JSON.stringify(error).includes('secret-site')); }
});

test('domains: boundary semantics are label based, never substring', () => {
    assert.ok(isSameOrSubdomain('a.b.example.com', 'example.com'));
    assert.ok(isSameOrSubdomain('example.com', 'example.com'));
    assert.ok(!isSameOrSubdomain('badexample.com', 'example.com'));
    assert.ok(!isSameOrSubdomain('example.com.evil.org', 'example.com'));
});

test('phrases: NFKC, Arabic marks and tatweel, invisible characters, case, whitespace', () => {
    assert.equal(normalizePhrase('  Test   PHRASE '), 'test phrase');
    assert.equal(normalizePhrase('عَبَارَة'), 'عبارة');            // diacritics stripped
    assert.equal(normalizePhrase('عبــارة'), 'عبارة');              // tatweel stripped
    assert.equal(normalizePhrase('ﻻم'), 'لام');                    // presentation form folded
    assert.equal(normalizePhrase('ab​c‮d'), 'abcd');      // zero-width + bidi override removed, not rejected
    assert.equal(normalizePhrase('ＡＢＣ'), 'abc');                  // full-width Latin
    throwsCode(() => normalizePhrase('a'), 'phrase_length');
    throwsCode(() => normalizePhrase('x'.repeat(61)), 'phrase_length');
    throwsCode(() => normalizePhrase('a\u0007bc'), 'phrase_control_chars');
    throwsCode(() => normalizePhrase('--  --'), 'phrase_no_letters');
});

const urlFor = (param, value, extra = '') => `https://www.example-engine.test/search?${extra}${param}=${value}`;
const re = (mode, phrases, param = 'q') => new RegExp(buildPhraseRegex(mode, param, phrases.map(phraseFragment)), 'i');

test('phrases: encoded forms (+, %20, case of hex, apostrophe) match; other parameters and path do not', () => {
    for (const phrase of ['test phrase', 'عبارة اختبار', "it's here", 'c++']) {
        const regex = re('contains', [phrase]);
        const encoded = encodeURIComponent(phrase);
        assert.ok(regex.test(urlFor('q', encoded)), phrase);
        assert.ok(regex.test(urlFor('q', encoded.replaceAll('%20', '+'), 'hl=ar&')), phrase);
        assert.ok(regex.test(urlFor('q', encoded.toLowerCase())), `lowercase hex ${phrase}`);
        assert.ok(!regex.test(urlFor('q', 'ordinary', `other=${encoded}&`)), `other param ${phrase}`);
        assert.ok(!regex.test(`https://x.test/${encoded}`), `path ${phrase}`);
        assert.ok(!regex.test(urlFor('aq', encoded)), `param name boundary ${phrase}`);
    }
    assert.ok(re('contains', ["it's here"]).test(urlFor('q', 'it%27s+here')));
});

test('phrases: whole-word mode avoids substring false blocks; contains mode is intentionally broader', () => {
    const word = re('word', ['sex']);
    assert.ok(word.test(urlFor('q', 'sex')));
    assert.ok(word.test(urlFor('q', 'free+sex+now')));
    assert.ok(word.test(urlFor('q', 'free%20sex')));
    assert.ok(!word.test(urlFor('q', 'essex+hotels')));
    assert.ok(!word.test(urlFor('q', 'sexual+health')));
    assert.ok(re('contains', ['sex']).test(urlFor('q', 'essex+hotels')));
    // Arabic: whole word must start and end at a separator
    const arabic = re('word', ['سكس']);
    assert.ok(arabic.test(urlFor('q', encodeURIComponent('افلام سكس'))));
    assert.ok(!arabic.test(urlFor('q', encodeURIComponent('سكسي'))));
});

test('phrases: multi-word phrase tolerates repeated spaces and either space encoding', () => {
    const regex = re('word', ['free porn']);
    for (const value of ['free+porn', 'free%20porn', 'free++porn', 'free+%20porn', 'best+free+porn+sites']) assert.ok(regex.test(urlFor('q', value)), value);
    assert.ok(!regex.test(urlFor('q', 'freeporn')));
});

test('packing is deterministic, respects the regex budget and reports unsupported phrases', async () => {
    const lengthOf = (...phrases) => buildPhraseRegex('word', 'q', phrases.map(phraseFragment)).length;
    const phrases = ['alpha one', 'beta two', 'gamma three', 'delta four', 'epsilon five', 'zeta six'];
    const limit = lengthOf(...phrases.slice(0, 3));
    const supports = async regex => regex.length <= limit;
    const first = await packPhrases(phrases, 'word', supports, 'q');
    const second = await packPhrases(phrases, 'word', supports, 'q');
    assert.deepEqual(first, second);
    assert.ok(first.chunks.length >= 2 && first.unsupported.length === 0);
    assert.deepEqual(first.chunks.flat().sort(), [...phrases].sort());
    for (const chunk of first.chunks) assert.ok(lengthOf(...chunk) <= limit);
    const tight = lengthOf('ok word') + 5;
    const tooLong = await packPhrases(['x'.repeat(60), 'ok word'], 'word', async regex => regex.length <= tight, 'q');
    assert.deepEqual(tooLong.unsupported, ['x'.repeat(60)]);
    assert.deepEqual(tooLong.chunks.flat(), ['ok word']);
    // a longer parameter name leaves less room, so the same phrase can fit for q but not for search_query
    const edge = lengthOf('alpha one');
    assert.deepEqual((await packPhrases(['alpha one'], 'word', async regex => regex.length <= edge, 'q')).unsupported, []);
    assert.deepEqual((await packPhrases(['alpha one'], 'word', async regex => regex.length <= edge, 'search_query')).unsupported, ['alpha one']);
});

test('settings: bounds, uniqueness, exact keys, conflicts with exceptions and search engines', () => {
    assert.deepEqual(parseSettings(settings({ domains: ['EXAMPLE.com', 'example.com'], contains: ['عبارة   اختبار', 'عبارة اختبار'] })).domains, ['example.com']);
    throwsCode(() => parseSettings({ ...settings(), extra: 1 }), 'config_invalid');
    throwsCode(() => parseSettings(settings({ baseList: 'yes' })), 'config_invalid');
    throwsCode(() => parseSettings(settings({ domains: Array(LIMITS.domains + 1).fill('example.com') })), 'too_many_domains');
    throwsCode(() => parseSettings(settings({ domains: ['a.example.com'], allow: ['example.com'] })), 'conflict_domain_allow');
    assert.doesNotThrow(() => parseSettings(settings({ domains: ['example.com'], allow: ['ok.example.com'] })));
    throwsCode(() => parseSettings(settings({ allow: ['google.com'] })), 'allow_search_engine');
    throwsCode(() => parseSettings(settings({ allow: ['yahoo.com'] })), 'allow_search_engine');
});

test('stored config: strict validation and prototype (v0) migration', () => {
    assert.equal(migrate(undefined).fresh, true);
    const v0 = migrate({ domains: ['example.com'], keywords: ['Test Phrase'], lockedUntil: 12345 });
    assert.deepEqual(v0.config.contains, ['test phrase']);
    assert.equal(v0.config.baseList, true);
    assert.equal(v0.lock.until, 12345);
    assert.ok(v0.migrated && v0.config.onboarded);
    const good = { ...defaultConfig(), onboarded: true };
    assert.deepEqual(parseStored(good), good);
    for (const bad of [{ ...good, v: 3 }, { ...good, revision: -1 }, { ...good, domains: ['not a domain'] }, { ...good, junk: 1 }, 'x', null, { ...good, baseList: 1 }]) {
        throwsCode(() => parseStored(bad), 'config_corrupt');
    }
});

test('weakening: every way of reducing protection is detected; stronger or equal changes are not', () => {
    const prev = { ...defaultConfig(), baseList: true, starterTerms: true, domains: ['example.com', 'a.test.org'], words: ['alpha beta'], contains: ['gamma'], allow: ['fine.example.net'] };
    const next = over => ({ ...prev, ...over });
    assert.deepEqual(weakeningReasons(prev, prev), []);
    assert.deepEqual(weakeningReasons(prev, next({ baseList: false })), ['base_list_disabled']);
    assert.deepEqual(weakeningReasons(prev, next({ starterTerms: false })), ['starter_terms_disabled']);
    assert.deepEqual(weakeningReasons(prev, next({ domains: ['example.com'] })), ['domain_removed']);
    assert.deepEqual(weakeningReasons(prev, next({ words: [] })), ['phrase_removed']);
    assert.deepEqual(weakeningReasons(prev, next({ contains: [] })), ['phrase_removed']);
    assert.deepEqual(weakeningReasons(prev, next({ allow: ['fine.example.net', 'new.example.org'] })), ['exception_added']);
    // stronger / equal
    assert.deepEqual(weakeningReasons(prev, next({ domains: ['example.com', 'test.org', 'more.com'] })), []);       // parent covers subdomain
    assert.deepEqual(weakeningReasons(prev, next({ words: [], contains: ['gamma', 'alpha'] })), []);                // contains covers word
    assert.deepEqual(weakeningReasons(prev, next({ allow: [] })), []);                                              // removing an exception strengthens
    assert.deepEqual(weakeningReasons(prev, next({ allow: ['sub.fine.example.net', 'fine.example.net'] })), []);    // within existing exception
});

test('import/export: round trip, merge-only, rejects malformed, unknown version and oversize', () => {
    const current = { baseList: true, starterTerms: false, domains: ['example.com'], allow: [], words: ['alpha beta'], contains: [] };
    const exported = JSON.stringify(exportSettings({ ...defaultConfig(), ...current }));
    assert.deepEqual(mergeImport(current, exported), current);
    const other = JSON.stringify({ format: 'tabsira-settings', version: 2, settings: settings({ domains: ['other.org'], baseList: false, contains: ['delta'] }) });
    const merged = mergeImport(current, other);
    assert.deepEqual(merged.domains.sort(), ['example.com', 'other.org']);
    assert.equal(merged.baseList, true);               // an import can never switch the base list off
    assert.deepEqual(merged.contains, ['delta']);
    throwsCode(() => mergeImport(current, '{'), 'import_invalid');
    throwsCode(() => mergeImport(current, JSON.stringify({ format: 'other', version: 2, settings: {} })), 'import_invalid');
    throwsCode(() => mergeImport(current, JSON.stringify({ format: 'tabsira-settings', version: 9, settings: settings() })), 'import_version');
    throwsCode(() => mergeImport(current, 'x'.repeat(LIMITS.importBytes + 1)), 'import_too_large');
    throwsCode(() => mergeImport(current, JSON.stringify({ format: 'tabsira-settings', version: 2, settings: settings({ domains: ['bad domain'] }) })), 'domain_wildcard_or_space');
    assert.ok(!exported.includes('lock') && !exported.includes('revision'));
});

test('lock: bounded customizable minutes, never shortens, expiry only re-enables editing', () => {
    const now = 1000;
    assert.equal(extend(emptyLock(), 9, now), null);
    const first = extend(emptyLock(), 90, now);
    assert.equal(first.until, now + 90 * 60000);
    assert.equal(extend(first, 60, now).until, first.until);
    assert.ok(isActive(first, now + 1) && !isActive(first, first.until));
});

test('rules: precedence, one rule per list, deterministic ids, comparison ignores browser reordering', async () => {
    const supports = async () => true;
    const config = { ...defaultConfig(), onboarded: true, domains: ['b.com', 'a.com'], allow: ['ok.a.com'], words: ['x phrase'], starterTerms: false };
    const plan = await planRules(config, supports);
    const byId = Object.fromEntries(plan.rules.map(r => [r.id, r]));
    assert.equal(byId[1].priority, PRIORITY.USER);
    assert.equal(byId[2], undefined, 'no global allow rule can override core');
    assert.deepEqual(byId[1].condition.excludedRequestDomains, ['ok.a.com']);
    assert.ok(PRIORITY.USER > PRIORITY.BASE);
    assert.deepEqual(byId[1].condition.requestDomains, ['a.com', 'b.com']);
    assert.equal(plan.rules.length, 1 + PARAM_GROUPS.length);
    assert.ok(plan.rules.every(r => r.action.type === 'allow' || r.action.redirect.extensionPath === '/blocked.html'));
    assert.ok(plan.rules.every(r => r.condition.resourceTypes.join() === 'main_frame'));
    const again = await planRules(config, supports);
    assert.deepEqual(again.rules, plan.rules);
    const shuffled = [...plan.rules].reverse().map(r => ({ ...r, condition: { ...r.condition, requestDomains: [...r.condition.requestDomains].reverse(), isUrlFilterCaseSensitive: r.condition.isUrlFilterCaseSensitive ?? false } }));
    assert.ok(rulesMatch(shuffled, plan.rules));
    const tampered = structuredClone(plan.rules); tampered[0].condition.requestDomains.push('extra.com');
    assert.ok(!rulesMatch(tampered, plan.rules));
    assert.equal(canonicalRules(plan.rules).length, plan.rules.length);
});

test('rules: starter terms are whole-word, deduplicated with user words, and switch off', async () => {
    const supports = async () => true;
    const withStarter = await planRules({ ...defaultConfig(), onboarded: true, starterTerms: true, baseList: false, words: [STARTER_TERMS[0]] }, supports);
    const without = await planRules({ ...defaultConfig(), onboarded: true, starterTerms: false, baseList: false }, supports);
    assert.equal(without.rules.length, 0);
    assert.ok(withStarter.rules.length > 0 && withStarter.baseListEnabled === true);
    assert.equal(new Set(STARTER_TERMS).size, STARTER_TERMS.length);
});

test('worst case: maximum phrases, one phrase per rule, stays far below the browser dynamic/regex rule limits', async () => {
    const words = Array.from({ length: LIMITS.words }, (_, i) => `word${String(i).padStart(3, '0')} alpha`);
    const contains = Array.from({ length: LIMITS.contains }, (_, i) => `part${String(i).padStart(3, '0')} beta`);
    // supports() accepts only a single phrase per rule, the worst packing possible
    const supports = async regex => !/\|/u.test(regex);
    const plan = await planRules({ ...defaultConfig(), onboarded: true, baseList: true, starterTerms: true, words, contains, domains: ['a.example'], allow: ['b.example'] }, supports);
    const regexRules = plan.rules.filter(rule => rule.condition.regexFilter).length;
    assert.ok(plan.rules.length < 1000 && regexRules < 1000, `rules=${plan.rules.length} regex=${regexRules}`);   // Chromium: 1,000 regex rules, 30,000 dynamic rules
});
