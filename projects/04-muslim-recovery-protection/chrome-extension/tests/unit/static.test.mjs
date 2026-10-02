import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const locales = Object.fromEntries(['ar', 'en', 'de'].map(l => [l, JSON.parse(read('src', '_locales', l, 'messages.json'))]));
let out;
before(() => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-build-'));
    execFileSync('node', ['scripts/build.mjs'], { cwd: root, env: { ...process.env, TABSIRA_OUT: out }, stdio: 'pipe' });
});

test('locales: identical keys and placeholders in ar/en/de; no empty messages', () => {
    const keys = Object.keys(locales.ar).sort();
    for (const lang of ['en', 'de']) assert.deepEqual(Object.keys(locales[lang]).sort(), keys, lang);
    for (const key of keys) {
        const placeholders = lang => JSON.stringify(Object.keys(locales[lang][key].placeholders ?? {}));
        for (const lang of ['en', 'de']) assert.equal(placeholders(lang), placeholders('ar'), `${lang}:${key}`);
        for (const lang of Object.keys(locales)) assert.ok(locales[lang][key].message.trim(), `${lang}:${key} empty`);
    }
});

test('locales: every key used by HTML, JS and manifest exists; store length limits hold', () => {
    const used = new Set();
    for (const file of fs.readdirSync(path.join(root, 'src', 'ui'))) {
        const text = read('src', 'ui', file);
        for (const m of text.matchAll(/data-i18n(?:-attr)?="([^"]+)"/gu)) m[1].split(';').forEach(pair => used.add(pair.includes(':') ? pair.split(':')[1] : pair));
        for (const m of text.matchAll(/\bt\('([a-z0-9_]+)'/gu)) used.add(m[1]);
        for (const m of text.matchAll(/data-title="([^"]+)"/gu)) used.add(m[1]);
    }
    for (const state of ['not_configured', 'active', 'partial', 'unknown']) used.add(`state_${state}`);
    for (const m of read('src', 'background', 'controller.js').matchAll(/reasons\.push\('([a-z_]+)'\)/gu)) used.add(`reason_${m[1]}`);
    for (const m of read('src', 'background', 'controller.js').matchAll(/reason: '([a-z_]+)'/gu)) used.add(`reason_${m[1]}`);
    const codes = new Set();
    for (const dir of ['core', 'background']) for (const file of fs.readdirSync(path.join(root, 'src', dir))) for (const m of read('src', dir, file).matchAll(/TabsiraError\('([a-z_]+)'/gu)) codes.add(m[1]);
    for (const code of codes) if (code !== 'verify_failed') used.add(`err_${code}`);
    for (const key of ['extName', 'extShortName', 'extDescription', 'incog_on', 'incog_off', 'incog_unknown', 'err_line']) used.add(key);
    const missing = [...used].filter(key => !(key in locales.ar));
    assert.deepEqual(missing, []);
    assert.ok(locales.ar.extDescription.message.length <= 132 && locales.en.extDescription.message.length <= 132 && locales.de.extDescription.message.length <= 132);
    assert.ok(Object.values(locales).every(l => l.extName.message.length <= 75 && l.extShortName.message.length <= 12));
});

test('locales: error messages never embed user input placeholders other than numbers', () => {
    for (const lang of Object.keys(locales)) for (const [key, value] of Object.entries(locales[lang])) {
        if (key.startsWith('err_')) for (const placeholder of Object.values(value.placeholders ?? {})) assert.match(placeholder.content, /^\$[1-3]$/u);
    }
});

test('pages: CSP-clean HTML (no inline script/style/handlers, no remote URLs), lang/dir present', () => {
    for (const file of fs.readdirSync(path.join(root, 'src', 'ui')).filter(f => f.endsWith('.html'))) {
        const html = read('src', 'ui', file);
        assert.ok(!/<script(?![^>]*\bsrc=)/iu.test(html), `${file} inline script`);
        assert.ok(!/<style/iu.test(html) && !/\sstyle="/iu.test(html), `${file} inline style`);
        assert.ok(!/\son[a-z]+="/iu.test(html), `${file} inline handler`);
        assert.ok(!/(?:src|href)="https?:\/\/(?!tabsira-selftest\.test)/iu.test(html), `${file} remote resource`);
        assert.match(html, /<html lang="ar" dir="rtl"/u);
        assert.ok(/data-title=/u.test(html));
    }
});

test('manifest (both targets): least permissions, strict CSP, minimal web-accessible resources, no content scripts, version injected, split only on Chromium', () => {
    for (const target of ['chromium', 'firefox']) {
        const manifest = JSON.parse(fs.readFileSync(path.join(out, target, 'manifest.json'), 'utf8'));
        assert.equal(manifest.manifest_version, 3);
        assert.equal(manifest.version, JSON.parse(read('package.json')).version);
        assert.deepEqual([...manifest.permissions].sort(), ['alarms', 'declarativeNetRequest', 'storage']);   // 'alarms' = watchdog wake-up, no install warning
        assert.deepEqual(manifest.host_permissions, ['http://*/*', 'https://*/*']);
        if (target === 'chromium') assert.equal(manifest.web_accessible_resources, undefined);   // no fixed-ID fingerprint
        else assert.deepEqual(manifest.web_accessible_resources, [{ resources: ['blocked.html'], matches: ['http://*/*', 'https://*/*'] }]);   // Firefox requirement, random UUID
        assert.equal(manifest.content_scripts, undefined);
        assert.equal(manifest.externally_connectable, undefined);
        assert.equal(manifest.incognito, target === 'chromium' ? 'split' : undefined);   // Firefox only supports spanning (default)
        assert.match(manifest.content_security_policy.extension_pages, /^default-src 'none'; script-src 'self'/u);
        assert.ok(!/unsafe|http:|https:|\*/u.test(manifest.content_security_policy.extension_pages));
        assert.equal(manifest.default_locale, 'ar');
        assert.equal(manifest.declarative_net_request.rule_resources[0].enabled, false);
    }
    const firefox = JSON.parse(fs.readFileSync(path.join(out, 'firefox', 'manifest.json'), 'utf8'));
    assert.equal(firefox.background.service_worker, undefined);
    assert.deepEqual(firefox.background.scripts, ['background/service-worker.js']);
    assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'] });
    const chromium = JSON.parse(fs.readFileSync(path.join(out, 'chromium', 'manifest.json'), 'utf8'));
    assert.equal(chromium.background.service_worker, 'background/service-worker.js');
    assert.equal(chromium.minimum_chrome_version, '120');
});

test('build output: every file the manifest and pages reference exists; base ruleset is one rule', () => {
    for (const target of ['chromium', 'firefox']) {
        const dir = path.join(out, target);
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
        const refs = [manifest.action.default_popup, manifest.options_ui.page, ...Object.values(manifest.icons), manifest.declarative_net_request.rule_resources[0].path,
            ...(manifest.background.scripts ?? [manifest.background.service_worker])];
        for (const ref of refs) assert.ok(fs.existsSync(path.join(dir, ref)), `${target}: ${ref}`);
        for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
            const html = fs.readFileSync(path.join(dir, file), 'utf8');
            for (const m of html.matchAll(/(?:src|href)="([^":#]+)"/gu)) assert.ok(fs.existsSync(path.join(dir, m[1])), `${target}/${file}: ${m[1]}`);
        }
        const rules = JSON.parse(fs.readFileSync(path.join(dir, 'rulesets', 'base_adult.json'), 'utf8'));
        assert.equal(rules.length, 1);
        assert.ok(rules[0].condition.requestDomains.length > 650000);
        assert.ok(rules[0].condition.requestDomains.includes('tabsira-selftest.test'));
        assert.deepEqual(rules[0].condition.resourceTypes, ['main_frame']);
    }
});

test('build is reproducible: two builds give byte-identical ZIPs', () => {
    const second = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-build2-'));
    execFileSync('node', ['scripts/build.mjs'], { cwd: root, env: { ...process.env, TABSIRA_OUT: second }, stdio: 'pipe' });
    const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    for (const name of fs.readdirSync(out).filter(f => f.endsWith('.zip'))) assert.equal(sha(path.join(out, name)), sha(path.join(second, name)), name);
});

test('base list: provenance names every input with its licence, excludes GPL/unlicensed sources, notices are bundled', () => {
    const provenance = JSON.parse(read('data', 'base-list', 'PROVENANCE.json'));
    assert.equal(provenance.upstreamCommit, null);
    assert.ok(provenance.snapshotEntries > 650000);
    const inputs = provenance.inputs;
    assert.match(inputs['shadowwhisperer-adult.txt'].licence, /Unlicense/u);
    assert.match(inputs['sinfonietta-pornography-hosts.txt'].licence, /MIT/u);
    assert.match(inputs['blp-porn.txt'].licence, /Unlicense/u);
    for (const traceOnly of ['hagezi-nsfw.txt', 'zachlagden-nsfw.txt', 'clefspeare13-porn-hosts.txt']) assert.match(inputs[traceOnly].use, /TRACE ONLY/u);
    for (const info of Object.values(inputs)) assert.match(info.sha256, /^[0-9a-f]{64}$/u);
    const notices = read('data', 'base-list', 'THIRD_PARTY_NOTICES.md');
    for (const needle of ['Sinfonietta', 'ShadowWhisperer', 'Block List Project', 'free and unencumbered', 'MIT License']) assert.ok(notices.includes(needle), needle);
    assert.ok(fs.existsSync(path.join(out, 'chromium', 'THIRD_PARTY_NOTICES.txt')));
});
