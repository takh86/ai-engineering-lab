import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SETTINGS_COPY, settingsText, initialFaith, durationToMinutes, domainPreviewPage, mergeSelectedDomains } from '../../src/ui/settings-copy.js';

test('settings choices: faith follows explicit initial religion independently of language', () => {
    for (const language of ['ar', 'en', 'de']) {
        assert.equal(initialFaith('muslim'), true, language);
        assert.equal(initialFaith('non-muslim'), false, language);
        assert.equal(initialFaith(null), false, language);
        const locale = JSON.parse(fs.readFileSync(new URL(`../../src/_locales/${language}/messages.json`, import.meta.url)));
        assert.deepEqual(Object.keys(SETTINGS_COPY[language]).sort(), Object.keys(SETTINGS_COPY.ar).sort());
        for (const [key, text] of Object.entries(SETTINGS_COPY[language])) {
            assert.ok(text.trim(), `${language}:${key}`);
            assert.ok(locale[key]?.message.trim(), `shared locale missing ${language}:${key}`);
            assert.notEqual(settingsText(language, key), key);
        }
        assert.match(settingsText(language, 'set_preview_count', [123, 2, 3]), /123/u);
    }
});

test('commitment duration preserves one-year and integer bounds for every unit', () => {
    assert.equal(durationToMinutes(10, 1), 10);
    assert.equal(durationToMinutes(1, 60), 60);
    assert.equal(durationToMinutes(1, 1440), 1440);
    assert.equal(durationToMinutes(1, 10080), 10080);
    assert.equal(durationToMinutes(1, 43200), 43200);
    assert.equal(durationToMinutes(525600, 1), 525600);
    for (const [amount, unit] of [[0, 60], [-1, 60], [9, 1], [0.5, 60], ['not-number', 60], [1, 999], [525601, 1], [13, 43200], [Infinity, 1]]) assert.equal(durationToMinutes(amount, unit), null);
    assert.equal(durationToMinutes(61, 1, 60), null);
});

test('domain preview filters actual domain strings, clamps paging and preserves selected domains', () => {
    const domains = Array.from({ length: 123 }, (_, i) => `example${i}.test`);
    assert.deepEqual(domainPreviewPage(domains, '', 2).items, domains.slice(100));
    assert.equal(domainPreviewPage(domains, '', 99).page, 2);
    assert.equal(domainPreviewPage(domains, '', -1).page, 0);
    assert.deepEqual(domainPreviewPage(domains, ' EXAMPLE122 ', 8).items, ['example122.test']);
    assert.deepEqual(domainPreviewPage(domains, 'absent', 9), { items: [], total: 0, page: 0, pages: 1 });
    assert.deepEqual(mergeSelectedDomains(['a.test'], new Set(['a.test', 'b.test'])), ['a.test', 'b.test']);
    assert.equal(mergeSelectedDomains(['a.test'], ['b.test'], 1), null);
});

test('security, schedule and prayer errors are explicit in all three locales', () => {
    const codes = ['access_locked', 'password_invalid', 'invalid_recovery', 'recovery_unavailable', 'security_corrupt', 'security_unavailable', 'storage_error', 'exit_waiting', 'exit_not_requested', 'session_expired', 'schedule_conflict', 'schedule_invalid', 'prayer_invalid', 'prayer_permission'];
    for (const language of ['ar', 'en', 'de']) {
        const locale = JSON.parse(fs.readFileSync(new URL(`../../src/_locales/${language}/messages.json`, import.meta.url)));
        for (const code of codes) assert.ok(locale[`err_${code}`]?.message.trim(), `${language}:${code}`);
    }
});
