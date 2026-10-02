import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, normalizeConfig, buildRules, assertNoWeakening } from '../rules.js';
test('domain normalization and strict rejection', () => {
    assert.equal(normalizeDomain(' HTTPS://Example.COM/ '), 'example.com');
    assert.equal(normalizeDomain('مثال.إختبار'), 'xn--mgbh0fb.xn--kgbechtv');
    for (const input of ['*.example.com','example.com/path','example.com?q=x','ftp://example.com','user:pw@example.com','localhost','-bad.example','example.com:443?x=1']) assert.throws(() => normalizeDomain(input));
});
test('bounded unique input and Arabic normalization', () => {
    assert.deepEqual(normalizeConfig({ domains: ['EXAMPLE.com','example.com'], keywords: ['عبارة   اختبار','عبارة اختبار'] }), { domains: ['example.com'], keywords: ['عبارة اختبار'] });
    assert.throws(() => normalizeConfig({ domains: Array(201).fill('example.com'), keywords: [] }));
    assert.throws(() => normalizeConfig({ domains: [], keywords: ['\u202eabc'] }));
});
test('rules use domain boundaries and main-frame-only redirects', () => {
    const rules = buildRules({ domains: ['example.com'], keywords: [] });
    assert.deepEqual(rules[0].condition, { requestDomains: ['example.com'], resourceTypes: ['main_frame'] });
    assert.equal(rules[0].action.redirect.extensionPath, '/blocked.html');
    assert.deepEqual(buildRules({ domains: [], keywords: [] }), []);
});
test('search expression contains metacharacters safely and confines matching to the parameter', () => {
    for (const keyword of ['test phrase','عبارة اختبار','c++']) {
        const rule = buildRules({ domains: [], keywords: [keyword] })[0];
        const regex = new RegExp(rule.condition.regexFilter, 'i');
        assert.ok(regex.test('https://www.google.com/search?q=' + encodeURIComponent(keyword)));
        assert.ok(regex.test('https://www.google.com/search?q=' + encodeURIComponent(keyword).replaceAll('%20','+') + '&safe=active'));
        assert.ok(!regex.test('https://www.google.com/search?q=ordinary&other=' + encodeURIComponent(keyword)));
        assert.ok(!regex.test('https://www.google.com/' + encodeURIComponent(keyword)));
    }
});
test('commitment permits additions but refuses deletions until expiry', () => {
    const previous = { domains: ['example.com'], keywords: ['test'], lockedUntil: 200 };
    assert.throws(() => assertNoWeakening(previous, { domains: [], keywords: ['test'] }, 100));
    assert.throws(() => assertNoWeakening(previous, { domains: ['example.com'], keywords: [] }, 100));
    assert.doesNotThrow(() => assertNoWeakening(previous, { domains: ['example.com','example.org'], keywords: ['test'] }, 100));
    assert.doesNotThrow(() => assertNoWeakening(previous, { domains: [], keywords: [] }, 200));
});
