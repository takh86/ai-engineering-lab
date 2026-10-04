// Adversarial inputs for the trust boundaries: import files, user-entered domains/phrases, messages, stored state.
// (Complements core/controller tests; written as part of the V1.1 security review - see docs/security-review.md.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, isSameOrSubdomain } from '../../src/core/domains.js';
import { normalizePhrase, buildPhraseRegex, phraseFragment } from '../../src/core/phrases.js';
import { parseSettings, mergeImport, defaultConfig, settingsOf, LIMITS } from '../../src/core/config.js';
import { isTrustedSender, validateMessage } from '../../src/background/messages.js';
import { mergeLocks } from '../../src/core/lock.js';
import { TabsiraError } from '../../src/core/errors.js';

const base = () => ({ ...settingsOf(defaultConfig()), baseList: false, starterTerms: false });
const envelope = settings => JSON.stringify({ format: 'tabsira-settings', version: 2, settings });
// Every failure must be a TabsiraError with a code - never a TypeError, never a message containing the input.
const refuses = (fn, secret) => assert.throws(fn, error => error instanceof TabsiraError && typeof error.code === 'string' && (!secret || !JSON.stringify(error).includes(secret)));

test('import: prototype-pollution payloads, duplicate/extra keys and wrong types are refused without side effects', () => {
    const polluted = '{"format":"tabsira-settings","version":2,"settings":{"__proto__":{"polluted":"yes"},"baseList":false,"starterTerms":false,"domains":[],"allow":[],"words":[],"contains":[]}}';
    refuses(() => mergeImport(base(), polluted));
    refuses(() => mergeImport(base(), '{"format":"tabsira-settings","version":2,"constructor":{"prototype":{"polluted":"yes"}},"settings":{}}'));
    refuses(() => mergeImport(base(), envelope({ ...base(), extra: 1 })));
    refuses(() => mergeImport(base(), envelope({ ...base(), domains: 'example.com' })));
    refuses(() => mergeImport(base(), envelope({ ...base(), domains: [['nested.example']] })));
    refuses(() => mergeImport(base(), envelope({ ...base(), domains: [{ toString: 1 }] })));
    refuses(() => mergeImport(base(), envelope({ ...base(), baseList: 'true' })));
    refuses(() => mergeImport(base(), '[]'));
    refuses(() => mergeImport(base(), 'null'));
    refuses(() => mergeImport(base(), '{"a":'.repeat(5000)));                       // deep, malformed
    assert.equal({}.polluted, undefined);
    assert.equal(Object.prototype.polluted, undefined);
});

test('import: size and count limits hold (no unbounded storage or CPU)', () => {
    refuses(() => mergeImport(base(), ' '.repeat(LIMITS.importBytes + 1)));
    const many = Array.from({ length: LIMITS.domains + 1 }, (_, i) => `site-${i}.example`);
    refuses(() => mergeImport(base(), envelope({ ...base(), domains: many })));
    refuses(() => parseSettings({ ...base(), words: Array.from({ length: LIMITS.words + 1 }, (_, i) => `phrase number ${i}`) }));
    refuses(() => parseSettings({ ...base(), domains: ['a'.repeat(300) + '.example'] }));
});

test('domains: hostile spellings are refused or normalised to what DNS would match', () => {
    for (const bad of ['evil.example\u202E.com', 'evil.example\u0000.com', 'a\tb.example', 'evil.example\nx.com', 'http://u:p@evil.example', 'evil.example:8080', 'evil.example/#x', '[::1]', '0x7f.0.0.1', '1.1.1.1']) {
        refuses(() => normalizeDomain(bad), 'evil');
    }
    assert.equal(normalizeDomain('evil\u200B.example'), 'evil.example');         // an invisible character is dropped, the stored name is clean ASCII
    // IDNA full stop and case folding give the ASCII name; a homograph stays a DIFFERENT name.
    assert.equal(normalizeDomain('Example\u3002COM'), 'example.com');
    const homograph = normalizeDomain('\u0430pple.example');                               // first letter is Cyrillic
    assert.match(homograph, /^xn--/u);
    assert.ok(!isSameOrSubdomain(homograph, 'apple.example') && !isSameOrSubdomain('apple.example', homograph));
});

test('phrases: control and bidi characters are removed or refused; regex metacharacters are literal in the generated rule', () => {
    assert.equal(normalizePhrase('a\u202Eb\u200Bc d'), normalizePhrase('abc d'));
    refuses(() => normalizePhrase('x'));                                                // below the minimum length
    refuses(() => normalizePhrase('.*'));                                               // no letters at all
    const urlFor = (value, param = 'q') => `https://www.google.com/search?${param}=${value}`;
    for (const phrase of ['a.b', 'a|b', '(ab)', '[ab]', 'a*b', 'a+b', 'a?b', 'a^b', 'a$b', 'a\\b', 'a{2}b']) {
        const regex = new RegExp(buildPhraseRegex('contains', 'q', [phraseFragment(normalizePhrase(phrase))]), 'i');
        assert.ok(regex.test(urlFor(encodeURIComponent(phrase))), `matches its own text: ${phrase}`);
        for (const other of ['axb', 'zzz', 'ab', 'aab', 'a b', 'ordinary']) assert.ok(!regex.test(urlFor(encodeURIComponent(other))), `${phrase} must not match ${other}`);
    }
});

test('messages: sender spoofing by URL tricks, other extensions, frames and web origins is refused', () => {
    const ctx = { id: 'ext', baseUrl: 'chrome-extension://ext/' };
    const page = { id: 'ext', url: 'chrome-extension://ext/options.html', frameId: 0 };
    for (const url of ['chrome-extension://ext/options.html@evil.example/', 'chrome-extension://ext/options.htmlx', 'chrome-extension://ext/../blocked.html', 'chrome-extension://extension/options.html', 'https://ext/options.html', 'chrome-extension://ext/', 'chrome-extension://ext/options.html/..%2f']) {
        assert.ok(!isTrustedSender({ ...page, url }, ctx), url);
    }
    assert.ok(!isTrustedSender({ ...page, tab: undefined, frameId: 1 }, ctx));
    assert.ok(!isTrustedSender({ ...page, id: undefined }, ctx));
    assert.ok(!isTrustedSender({ ...page, origin: 'https://evil.example', url: 'https://evil.example/' }, ctx));
});

test('messages: validator ignores prototype tricks and never returns the raw object', () => {
    const evil = JSON.parse('{"type":"SAVE_SETTINGS","baseRevision":1,"settings":{},"__proto__":{"type":"RESET"}}');
    assert.throws(() => validateMessage(evil), error => error.code === 'bad_request');            // extra own key
    const ok = validateMessage({ type: 'SAVE_SETTINGS', baseRevision: 3, settings: { x: 1 } });
    assert.deepEqual(Object.keys(ok), ['type', 'baseRevision', 'settings']);
    for (const revision of [1.5, NaN, Infinity, -0.1, 2 ** 60, '3', null]) assert.throws(() => validateMessage({ type: 'RESET', baseRevision: revision }), error => error.code === 'bad_request');
    const cyclic = { type: 'SAVE_SETTINGS', baseRevision: 1, settings: {} }; cyclic.settings.self = cyclic;
    assert.throws(() => validateMessage(cyclic), error => error.code === 'bad_request');
});

test('stored lock state: tampered values are detected, never trusted, and only ever LENGTHEN a session', () => {
    const snapshot = { 'lock:a': { until: 5000 }, 'lock:b': { until: 9000 }, lock: { until: 7000 } };
    assert.equal(mergeLocks(snapshot).until, 9000);
    for (const bad of [{ until: -1 }, { until: 1.5 }, { until: '9' }, { until: 9e15 }, { until: 1, extra: 1 }, null, 7, [], { until: NaN }]) {
        const merged = mergeLocks({ ...snapshot, 'lock:evil': bad });
        assert.deepEqual(merged.invalidKeys, ['lock:evil']);
        assert.equal(merged.until, 9000);
    }
    // keys that merely look similar are not lock keys
    assert.equal(mergeLocks({ locked: { until: 1e12 }, 'xlock:a': { until: 1e12 }, 'mx:a': { until: 1e12 } }).until, 0);
});
