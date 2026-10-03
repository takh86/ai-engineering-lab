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
        assert.deepEqual(manifest.optional_permissions, ['activeTab', 'notifications']); // owner-approved, explicit opt-in only
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
        // UI files are flattened during packaging. Check the installed module graph,
        // rather than only source paths, to catch broken UI-to-core imports.
        for (const file of fs.readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.js'))) {
            const source = fs.readFileSync(path.join(dir, file), 'utf8');
            for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/gu)) {
                const resolved = path.resolve(dir, path.dirname(file), match[1]);
                assert.ok(resolved.startsWith(`${dir}${path.sep}`), `${target}/${file}: import escapes package`);
                assert.ok(fs.existsSync(resolved), `${target}/${file}: missing ${match[1]}`);
            }
        }
        const rules = JSON.parse(fs.readFileSync(path.join(dir, 'rulesets', 'base_adult.json'), 'utf8'));
        assert.equal(rules.length, 1);
        assert.equal(rules[0].condition.requestDomains.length, 242750 + 1);   // the list + the reserved self-test domain
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

test('base list: ONLY the two explicitly licensed sources, pinned to commits and hashes, with licence texts and notices bundled', () => {
    const provenance = JSON.parse(read('data', 'base-list', 'PROVENANCE.json'));
    assert.deepEqual(Object.keys(provenance.inputs).sort(), ['shadowwhisperer-adult.txt', 'sinfonietta-pornography-hosts.txt']);   // nothing else may feed the list
    assert.equal(provenance.snapshotEntries, 242750);
    assert.equal(provenance.counts.union - provenance.removedAsCoveredByParent, provenance.snapshotEntries);
    const sw = provenance.inputs['shadowwhisperer-adult.txt']; const sin = provenance.inputs['sinfonietta-pornography-hosts.txt'];
    assert.match(sw.licence.name, /Unlicense/u); assert.match(sin.licence.name, /MIT/u);
    for (const info of [sw, sin]) {
        assert.match(info.commit, /^[0-9a-f]{40}$/u); assert.match(info.sha256, /^[0-9a-f]{64}$/u); assert.match(info.gitBlob, /^[0-9a-f]{40}$/u);
        assert.ok(info.permalink.includes(info.commit), 'permalink is pinned to the commit');
        assert.match(info.licence.sha256, /^[0-9a-f]{64}$/u); assert.ok(info.licence.permalink.includes(info.commit));
        // the committed licence text is byte-identical to the licence at the pinned commit
        assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, info.licence.committedCopy))).digest('hex'), info.licence.sha256);
    }
    assert.ok(provenance.licenceCoverage['shadowwhisperer-adult.txt'] && provenance.licenceCoverage['sinfonietta-pornography-hosts.txt']);
    for (const excluded of ['The Block List Project porn.txt', 'HaGeZi dns-blocklists nsfw', 'zachlagden Pi-hole-Optimized-Blocklists nsfw', 'Clefspeare13 pornhosts']) assert.ok(provenance.examinedAndExcluded[excluded], excluded);
    const notices = read('data', 'base-list', 'THIRD_PARTY_NOTICES.md');
    for (const needle of ['ShadowWhisperer', 'Sinfonietta', 'free and unencumbered software', 'The MIT License', 'Copyright (c) 2016 Sinfonietta', sw.commit, sin.commit]) assert.ok(notices.includes(needle), needle);
    for (const forbidden of ['Block List Project', 'HaGeZi', 'zachlagden']) assert.ok(!notices.includes(forbidden), `${forbidden} must not appear in the shipped notices as a source`);
    assert.ok(fs.existsSync(path.join(out, 'chromium', 'THIRD_PARTY_NOTICES.txt')));
    const packedRules = JSON.parse(fs.readFileSync(path.join(out, 'chromium', 'rulesets', 'base_adult.json'), 'utf8'));
    const snapshot = packedRules[0].condition.requestDomains.filter(domain => domain !== 'tabsira-selftest.test');
    const preview = Buffer.from(`${snapshot.join('\n')}\n`);
    assert.ok(!fs.existsSync(path.join(out, 'chromium', 'base-domains.txt')), 'no duplicate snapshot shipped');
    assert.equal(crypto.createHash('sha256').update(preview).digest('hex'), provenance.snapshotSha256, 'preview is the exact licensed snapshot');
    // the shipped notice carries the full MIT text of Sinfonietta (condition of the licence)
    assert.ok(read('data', 'base-list', 'THIRD_PARTY_NOTICES.md').includes(read('data', 'base-list', 'licenses', 'LICENSE-Sinfonietta-MIT.txt').trim()));
});
