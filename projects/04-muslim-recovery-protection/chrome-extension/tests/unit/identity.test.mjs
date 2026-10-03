import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditStyles, auditDirectory } from '../../scripts/identity-audit.mjs';
import { commitmentCountdown, domainFromTabUrl, honestStatus } from '../../src/ui/popup-model.js';
import { blockCurrentSite } from '../../src/ui/popup-actions.js';
import { POPUP_COPY, popupText } from '../../src/ui/popup-copy.js';
const read = name => fs.readFileSync(new URL(`../../src/ui/${name}`, import.meta.url), 'utf8');

test('identity: all shipped styles remain inside the six approved colors without hue derivation', () => {
    assert.deepEqual(auditDirectory(fileURLToPath(new URL('../../src/ui', import.meta.url))), []);
    for (const css of ['a{color:#0F2347}', 'a{background:rgba(0,0,0,.1)}', 'a{background:linear-gradient(#0B3B8F,#1456C5)}', 'a{color:red}']) assert.ok(auditStyles(css).length, css);
    assert.deepEqual(auditStyles('a{color:var(--ink);background:#0B3B8F;stroke:currentColor}'), []);
});

test('identity: explicit light and dark override the system theme and local approved fonts are used', () => {
    const css = read('tokens.css');
    assert.match(css, /:root\[data-theme=light\]/u);
    assert.match(css, /:root\[data-theme=dark\]/u);
    assert.match(css, /prefers-color-scheme: dark/u);
    for (const match of css.matchAll(/url\(([^)]+)\)/gu)) assert.ok(fs.existsSync(new URL(`../../src/${match[1]}`, import.meta.url)));
    assert.match(css, /--font-heading: Cairo/u);
    assert.match(css, /--font-body: Tajawal/u);
});

test('popup: countdown derives each second from absolute deadline, clamps expiry and never wraps hours', () => {
    const lock = { active: true, until: 100000 };
    assert.equal(commitmentCountdown(lock, 50000, 50000).text, '00:00:50');
    assert.equal(commitmentCountdown(lock, 51000, 50000).text, '00:00:49');
    assert.equal(commitmentCountdown(lock, 51000, 50000).fraction, .98);
    assert.equal(commitmentCountdown(lock, 100000, 50000).fraction, 0);
    assert.equal(commitmentCountdown(lock, 100001).expired, true);
    assert.equal(commitmentCountdown({ active: false, until: 100000 }, 0).active, false);
    assert.equal(commitmentCountdown({ active: true, until: 'bad' }, 0).active, false);
    assert.equal(commitmentCountdown({ active: true, until: 9000000000000000 }, 0).active, false);
    assert.equal(commitmentCountdown({ active: true, until: 90000000 }, 0).text, '25:00:00');
});

test('popup: absent or malformed protection status fails honest and known states remain distinct', () => {
    for (const input of [undefined, null, {}, { state: 'protected' }]) assert.equal(honestStatus(input).state, 'unknown');
    for (const state of ['active', 'partial', 'unknown', 'not_configured']) assert.equal(honestStatus({ state }).state, state);
});

test('popup: current URL reduces to valid domain and rejects restricted/invalid/IP/shared suffix URLs', () => {
    assert.equal(domainFromTabUrl('https://www.example.com/private/path?secret=1#fragment'), 'example.com');
    assert.equal(domainFromTabUrl('https://münchen.de/path'), 'xn--mnchen-3ya.de');
    for (const raw of [undefined, 'chrome://settings/', 'about:blank', 'file:///tmp/a', 'https://user:secret@example.com/', 'http://localhost/', 'http://127.0.0.1/', 'https://github.io/', 'not a URL']) assert.equal(domainFromTabUrl(raw), null, raw);
});

test('popup: optional activeTab request starts synchronously and domain alone crosses the message boundary', async () => {
    const calls = [];
    const api = { permissions: { request: permission => { calls.push(permission); return Promise.resolve(true); } }, tabs: { query: async query => { calls.push(query); return [{ url: 'https://example.com/private?q=secret', title: 'Private title' }]; } } };
    const promise = blockCurrentSite(api, async message => { calls.push(message); return { ok: true }; });
    assert.deepEqual(calls, [{ permissions: ['activeTab'] }]);
    assert.equal(await promise, 'blocked');
    assert.deepEqual(calls, [{ permissions: ['activeTab'] }, { active: true, currentWindow: true }, { type: 'BLOCK_CURRENT_SITE', domain: 'example.com' }]);
    assert.ok(!JSON.stringify(calls).includes('secret'));
});

test('popup: denied permission never reads the tab; restricted tab never sends a block; worker failures are honest', async () => {
    let queries = 0; let sends = 0;
    const denied = { permissions: { request: async () => false }, tabs: { query: async () => { queries++; return []; } } };
    assert.equal(await blockCurrentSite(denied, async () => { sends++; }), 'permissionDenied');
    assert.equal(queries, 0); assert.equal(sends, 0);
    const invalid = { permissions: { request: async () => true }, tabs: { query: async () => [{ url: 'chrome://settings' }] } };
    assert.equal(await blockCurrentSite(invalid, async () => { sends++; }), 'unavailable');
    assert.equal(sends, 0);
    invalid.tabs.query = async () => [{ url: 'https://example.com/' }];
    assert.equal(await blockCurrentSite(invalid, async () => ({ ok: false })), 'blockFailed');
    invalid.permissions.request = () => { throw new Error('unavailable'); };
    assert.equal(await blockCurrentSite(invalid, async () => ({ ok: true })), 'unavailable');
});

test('popup: complete parallel translations, help always accessible and no popup safe test', () => {
    const keys = Object.keys(POPUP_COPY.ar).sort();
    for (const language of ['en', 'de']) assert.deepEqual(Object.keys(POPUP_COPY[language]).sort(), keys);
    for (const messages of Object.values(POPUP_COPY)) for (const value of Object.values(messages)) assert.ok(value.trim());
    assert.equal(popupText('home', 'de-DE'), 'Startseite');
    const html = read('popup.html');
    assert.match(html, /id="help" href="help.html"/u);
    assert.match(html, /href="recovery.html"/u); assert.match(html, /href="covenant.html"/u);
    assert.ok(!/safe.?test|selftest/iu.test(html + read('popup.js')));
    assert.match(html, /aria-labelledby="countdown-label" aria-live="off"/u);
    assert.match(read('popup.js'), /setInterval\(tick, 1000\)/u);
    assert.match(read('popup.js'), /blockButton.addEventListener\('click'/u);
});
