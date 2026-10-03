// Builds browser packages into dist/. No dependencies; output is deterministic.
//   node scripts/build.mjs   -> dist/chromium, dist/firefox + the store ZIPs (byte-reproducible)
// There is no separate "test build": the real-browser tests extract these very ZIPs (tests/e2e/package.mjs) and, for the few
// checks that need it, patch manifest.json only (extra permission / optional host access / higher version).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { zipDirectory } from './zip.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outRoot = process.env.TABSIRA_OUT ? path.resolve(process.env.TABSIRA_OUT) : path.join(root, 'dist');   // TABSIRA_OUT: unit tests build into a temp dir
const SELFTEST_DOMAIN = 'tabsira-selftest.test';
const HOSTS = ['http://*/*', 'https://*/*'];

const copyDir = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const source = path.join(from, entry.name); const target = path.join(to, entry.name);
        if (entry.isDirectory()) copyDir(source, target); else fs.copyFileSync(source, target);
    }
};

function baseManifest() {
    // 'alarms' (no install warning): the only way for the extension to be woken after its worker was terminated, so that a rule set left
    // behind by a late write is detected and rebuilt from storage (see service-worker.js, README "Recovery").
    const permissions = ['storage', 'declarativeNetRequest', 'alarms'];
    return {
        manifest_version: 3,
        name: '__MSG_extName__', short_name: '__MSG_extShortName__', description: '__MSG_extDescription__',
        version: pkg.version, default_locale: 'ar',
        icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 96: 'icons/icon-96.png', 128: 'icons/icon-128.png' },
        permissions,
        // Both are requested only after an explicit user gesture. No tabs/history/geolocation permission.
        optional_permissions: ['activeTab', 'notifications'],
        host_permissions: HOSTS,
        action: { default_popup: 'popup.html', default_title: '__MSG_extShortName__', default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } },
        options_ui: { page: 'options.html', open_in_tab: true },
        declarative_net_request: { rule_resources: [{ id: 'base_adult', enabled: false, path: 'rulesets/base_adult.json' }] },
        // Chromium: no web_accessible_resources - redirecting to the stop page does not need them (verified), and leaving
        // them out stops websites from detecting the extension by its fixed ID. Firefox needs one (see MANIFESTS.firefox).
        content_security_policy: { extension_pages: "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'" }
    };
}
const MANIFESTS = {
    // "split": in "spanning" mode Chromium cannot show extension pages in private windows, so a redirect to the stop
    // page ends in ERR_BLOCKED_BY_CLIENT there (verified). With "split" the private window gets the stop page and, as
    // verified, shares storage.local with the normal instance, so a commitment session holds in every window.
    chromium: () => ({ ...baseManifest(), minimum_chrome_version: '120', incognito: 'split', background: { service_worker: 'background/service-worker.js', type: 'module' } }),
    firefox: () => ({
        ...baseManifest(),
        background: { scripts: ['background/service-worker.js'], type: 'module' },
        // Firefox refuses a redirect to an extension page unless it is web-accessible (verified on Firefox 157). Its
        // moz-extension:// host is a random per-profile UUID, so this does not let websites detect the extension.
        web_accessible_resources: [{ resources: ['blocked.html'], matches: ['http://*/*', 'https://*/*'] }],
        browser_specific_settings: { gecko: { id: '{6e6f9f5e-6c45-4f0a-9d8a-5b1f0f6a7c11}', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } }
    })
};

// Static ruleset: ONE rule whose requestDomains carries the whole snapshot (a list counts as one rule).
function buildBaseList() {
    const dir = path.join(root, 'data', 'base-list');
    const domains = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'adult-domains.txt.gz'))).toString('utf8').split('\n').filter(Boolean);
    const provenance = JSON.parse(fs.readFileSync(path.join(dir, 'PROVENANCE.json'), 'utf8'));
    if (domains.length !== provenance.snapshotEntries) throw new Error('snapshot size does not match PROVENANCE.json');
    const digest = crypto.createHash('sha256').update(`${domains.join('\n')}\n`).digest('hex');
    if (digest !== provenance.snapshotSha256) throw new Error('snapshot hash does not match PROVENANCE.json');
    const rule = { id: 1, priority: 1, action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
        condition: { requestDomains: [SELFTEST_DOMAIN, ...domains], resourceTypes: ['main_frame'] } };
    const meta = { version: pkg.version, domainCount: domains.length, upstreamDate: provenance.retrievedAt, retrievedAt: provenance.retrievedAt,
        snapshotSha256: provenance.snapshotSha256, source: provenance.name, license: 'Unlicense / MIT (see THIRD_PARTY_NOTICES.txt)' };
    return { rules: `${JSON.stringify([rule])}\n`, meta: `${JSON.stringify(meta, null, 2)}\n`, preview: `${domains.join('\n')}\n` };
}

function buildTarget(target, baseList) {
    const out = path.join(outRoot, target);
    fs.rmSync(out, { recursive: true, force: true });
    copyDir(path.join(root, 'src', 'ui'), out);
    copyDir(path.join(root, 'src', 'core'), path.join(out, 'core'));
    copyDir(path.join(root, 'src', 'background'), path.join(out, 'background'));
    copyDir(path.join(root, 'src', '_locales'), path.join(out, '_locales'));
    copyDir(path.join(root, 'src', 'icons'), path.join(out, 'icons'));
    copyDir(path.join(root, 'src', 'fonts'), path.join(out, 'fonts'));
    fs.mkdirSync(path.join(out, 'brand'));
    fs.copyFileSync(path.join(root, 'src', 'brand', 'mark.svg'), path.join(out, 'brand', 'mark.svg'));
    fs.mkdirSync(path.join(out, 'rulesets'));
    fs.writeFileSync(path.join(out, 'rulesets', 'base_adult.json'), baseList.rules);
    fs.writeFileSync(path.join(out, 'base-list-meta.json'), baseList.meta);
    // The review/import UI previews the exact licensed snapshot, never a substitute phrase list.
    fs.writeFileSync(path.join(out, 'base-domains.txt'), baseList.preview);
    fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(MANIFESTS[target](), null, 2)}\n`);
    fs.copyFileSync(path.join(root, 'data', 'base-list', 'THIRD_PARTY_NOTICES.md'), path.join(out, 'THIRD_PARTY_NOTICES.txt'));
    return out;
}

const baseList = buildBaseList();
fs.mkdirSync(outRoot, { recursive: true });
for (const target of Object.keys(MANIFESTS)) {
    const dir = buildTarget(target, baseList);
    const zip = path.join(outRoot, `tabsira-${target}-${pkg.version}.zip`);
    zipDirectory(dir, zip);
    const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
    process.stdout.write(`${path.relative(root, zip)}  ${fs.statSync(zip).size} bytes  sha256 ${sha}\n`);
}
