// node tests/e2e/firefox-run.mjs   (FIREFOX=/path/to/firefox GECKODRIVER=/path/to/geckodriver; build with: node scripts/build.mjs --test)
// Real Firefox, driven by geckodriver. The add-on is installed as a TEMPORARY add-on (stock Firefox only accepts
// signed add-ons permanently), so "restart" tests reinstall it into the same profile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { startGecko } from './webdriver.mjs';
import { createReport } from './report.mjs';
import { root, sleep } from './lib.mjs';

const FIREFOX = process.env.FIREFOX; const GECKODRIVER = process.env.GECKODRIVER;
if (!FIREFOX || !GECKODRIVER) { process.stderr.write('set FIREFOX and GECKODRIVER\n'); process.exit(2); }
const version = execFileSync(FIREFOX, ['--version']).toString().trim();
const report = createReport({ browserName: 'firefox', version, extra: { addonInstall: 'temporary (geckodriver moz/addon/install)', note: 'Firefox build is the conda-forge repackaging of the Mozilla release, not a mozilla.org download' } });
const { check, skip } = report;
process.stdout.write(`# ${version} on ${report.meta.os}\n`);

const ADDON_ID = '{6e6f9f5e-6c45-4f0a-9d8a-5b1f0f6a7c11}';
const UUID = '2f6f2d3e-0a4b-4d6e-8f10-6f3a1c2b9a77';
const EXT = `moz-extension://${UUID}`;
const addonDir = path.join(root, 'dist-test/firefox');

// Local server doubling as an HTTP proxy: every http:// request, whatever the host, gets the marker page.
const hits = [];
const proxy = http.createServer((request, response) => { hits.push(request.url); response.setHeader('content-type', 'text/html; charset=utf-8'); response.end('<!doctype html><title>REAL-SITE</title><p>site</p>'); });
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
const proxyPort = proxy.address().port;
const NO_LIST = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const prefs = {
    'network.proxy.type': 1, 'network.proxy.http': '127.0.0.1', 'network.proxy.http_port': proxyPort, 'network.proxy.allow_hijacking_localhost': true,
    'network.proxy.no_proxies_on': '', 'extensions.webextensions.uuids': JSON.stringify({ [ADDON_ID]: UUID }),
    'intl.accept_languages': 'ar,en', 'intl.locale.requested': 'ar', 'general.useragent.locale': 'ar',
    'browser.shell.checkDefaultBrowser': false, 'datareporting.policy.dataSubmissionEnabled': false, 'toolkit.telemetry.enabled': false,
    'browser.startup.page': 0, 'extensions.autoDisableScopes': 0
};
const rssMb = () => { try { const out = execFileSync('ps', ['-eo', 'rss,args']).toString().split('\n').filter(l => l.includes(FIREFOX.replace(/\/firefox$/u, ''))); return Math.round(out.reduce((s, l) => s + Number(l.trim().split(/\s+/u)[0] || 0), 0) / 1024); } catch { return -1; } };

async function session(profileDir) {
    const d = await startGecko({ geckodriver: GECKODRIVER, firefox: FIREFOX, profileDir, prefs });
    await d.installAddon(addonDir);
    await sleep(1500);
    await d.openExtensionTab(`${EXT}/options.html`);          // geckodriver cannot navigate to moz-extension:// itself
    const optionsTab = await d.current();
    const webTab = await d.newTab();                            // a second tab for ordinary browsing
    const msg = async message => { await d.switchTo(optionsTab); return d.run('return await browser.runtime.sendMessage(arguments[0]);', message); };
    const status = async () => (await msg({ type: 'GET_STATUS' })).status;
    const save = async settings => { const s = await status(); return msg({ type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { ...NO_LIST, ...settings } }); };
    const visit = async target => {
        await d.switchTo(webTab);
        await d.goto('about:blank'); hits.length = 0;
        await d.goto(target).catch(() => {});
        await sleep(300);
        const url = await d.url(); const title = await d.title().catch(() => '');
        return { url, title, blocked: url.startsWith(EXT) && url.endsWith('/blocked.html'), real: title === 'REAL-SITE' };
    };
    const inOptions = async code => { await d.switchTo(optionsTab); return d.run(code); };
    const back = async () => {};
    return { d, msg, status, save, visit, back, inOptions };
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-ff-'));
let s;
try {
    s = await session(profile);
    // ---- F1: install ----
    const st0 = await s.status();
    check('F1.1 temporary install succeeds; options page loads; worker answers (Firefox event page)', st0?.state === 'not_configured', JSON.stringify(st0?.state));
    check('F1.2 base list metadata readable', st0?.base?.domainCount > 900000, String(st0?.base?.domainCount));
    const dir = await s.inOptions('return [document.documentElement.dir, document.documentElement.lang, document.querySelector("h1").textContent];');
    check('F1.3 UI follows the Firefox locale (en-US build → English, LTR, translated)', dir[0] === 'ltr' && dir[1].startsWith('en') && dir[2] === 'Tabsira settings', JSON.stringify(dir));
    skip('F1.3b Arabic RTL UI inside Firefox', 'needs the Arabic Firefox language pack, not installable offline here; Arabic/RTL rendering is verified in Chromium and Edge');
    const perm = await s.inOptions('return await browser.permissions.contains({ origins: ["http://*/*", "https://*/*"] });');
    check('F1.4 host permission state is reported (informational)', typeof perm === 'boolean', String(perm));
    const real = await s.visit('http://tabsira-selftest.test/');
    check('F1.5 nothing blocked before onboarding', real.real, real.url);
    await s.back();

    // ---- F2: onboarding + base list ----
    const rssBefore = rssMb();
    const t0 = Date.now();
    const done = await s.msg({ type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: false });
    const enableMs = Date.now() - t0;
    check('F2.1 onboarding with base list succeeds', done.ok === true, JSON.stringify(done.error ?? done.status?.reasons));
    check('F2.2 status active (permission present) — or an honest partial with the reason', done.status.state === 'active' || (done.status.state === 'partial' && done.status.reasons.includes('host_permission_missing')), JSON.stringify(done.status));
    const hostGranted = done.status.permissions.hosts;
    report.note('F2', `onboarding+enable base list took ${enableMs} ms; host permission granted: ${hostGranted}; RSS (all Firefox processes) before ≈ ${rssBefore} MB, after enable ≈ ${rssMb()} MB`);
    const hit = await s.visit('http://tabsira-selftest.test/');
    if (hostGranted) check('F2.3 safe self-test domain redirects to the stop page (real Firefox DNR redirect)', hit.blocked, hit.url);
    else check('F2.3 without host permission nothing is redirected (state reported as partial)', hit.real, hit.url);
    await s.back();

    if (hostGranted) {
        // ---- F3: user rules and boundaries ----
        await s.save({ domains: ['blocked-user.test'] });
        for (const [host, expected] of [['blocked-user.test', true], ['sub.blocked-user.test', true], ['notblocked-user.test', false], ['blocked-user.test.evil.example', false]]) {
            const r = await s.visit(`http://${host}/`);
            check(`F3.1 ${expected ? 'blocks' : 'does not block'} ${host}`, expected ? r.blocked : r.real, r.url.slice(0, 70));
        }
        await s.back();
        const exc = await s.save({ domains: ['blocked-user.test'], allow: ['ok.blocked-user.test'] });
        const ok = await s.visit('http://ok.blocked-user.test/'); const sib = await s.visit('http://other.blocked-user.test/');
        check('F3.2 exception for a subdomain beats the parent block; sibling stays blocked', exc.ok && ok.real && sib.blocked, JSON.stringify({ ok: ok.real, sib: sib.blocked }));
        await s.back();
        const excBase = await s.save({ baseList: true, allow: ['tabsira-selftest.test'] });
        const baseOverridden = await s.visit('http://tabsira-selftest.test/');
        check('F3.3 exception overrides the built-in list', excBase.ok && baseOverridden.real, baseOverridden.url.slice(0, 70));
        await s.back();
        await s.save({ baseList: true });

        // ---- F4: phrases ----
        const sp = await s.save({ baseList: true, words: ['tabsira word', 'عبارة اختبار'], contains: ['probe-part'] });
        check('F4.0 phrases accepted by the real Firefox regex engine', sp.ok, JSON.stringify(sp.error ?? {}));
        const enc = encodeURIComponent;
        const cases = [
            ['google plus', 'http://www.google.com/search?q=tabsira+word', true], ['google %20', 'http://www.google.com/search?q=tabsira%20word', true],
            ['google upper', 'http://www.google.com/search?q=TABSIRA%20Word', true], ['google arabic', `http://www.google.com/search?q=${enc('عبارة اختبار')}`, true],
            ['google.de', 'http://www.google.de/search?q=tabsira+word', true], ['bing images', 'http://www.bing.com/images/search?q=tabsira+word', true],
            ['yahoo p', 'http://search.yahoo.com/search?p=tabsira+word', true], ['youtube', 'http://www.youtube.com/results?search_query=tabsira+word', true],
            ['contains', 'http://www.google.com/search?q=xxprobe-partyy', true],
            ['ordinary', 'http://www.google.com/search?q=ordinary', false], ['other param', 'http://www.google.com/search?q=ordinary&note=tabsira+word', false],
            ['aq boundary', 'http://www.google.com/search?aq=tabsira+word', false], ['embedded word', 'http://www.google.com/search?q=xtabsira+words', false],
            ['wrong param on engine', 'http://www.google.com/search?p=tabsira+word', false], ['non-engine site', 'http://news.test/search?q=tabsira+word', false]
        ];
        for (const [name, url, expected] of cases) { const r = await s.visit(url); check(`F4.1 ${expected ? 'blocked' : 'allowed'}: ${name}`, expected ? r.blocked : r.real, r.url.slice(0, 70)); }
        await s.back();
        const longSave = await s.save({ baseList: true, contains: ['ع'.repeat(40)] });
        if (longSave.ok) {
            const longHit = await s.visit(`http://www.google.com/search?q=${enc('ع'.repeat(40))}`);
            check('F4.2 Firefox accepts a 40-letter Arabic phrase (no 2 KB regex limit observed, unlike Chromium) and it is enforced', longHit.blocked, longHit.url.slice(0, 70));
            report.note('F4.2', 'Firefox accepted a phrase that Chromium/Edge refuse (regex memory limit); the extension still validates through isRegexSupported on each browser.');
        } else check('F4.2 over-long Arabic phrase refused with a line number', longSave.error.code === 'phrase_too_complex' && longSave.error.params.line === 1, JSON.stringify(longSave.error));
        await s.back();
        const starter = await s.save({ baseList: true, starterTerms: true });
        const ss = await s.status();
        check('F4.3 every starter term is accepted by the Firefox regex engine', starter.ok && !ss.reasons.includes('phrases_unsupported'), JSON.stringify(ss.reasons));

        // ---- F5: commitment ----
        await s.save({ baseList: true, domains: ['lock-site.test'], words: ['lock phrase'] });
        const started = await s.msg({ type: 'START_SESSION', minutes: 60 });
        check('F5.1 session starts (60 min)', started.ok && started.status.lock.active, JSON.stringify(started.error ?? {}));
        const weak = await s.save({ baseList: false, domains: ['lock-site.test'], words: ['lock phrase'] });
        const weak2 = await s.save({ baseList: true, domains: [], words: ['lock phrase'] });
        const weak3 = await s.save({ baseList: true, domains: ['lock-site.test'], words: ['lock phrase'], allow: ['x-allow.test'] });
        check('F5.2 weakening refused during session (disable list / remove site / add exception)', [weak, weak2, weak3].every(r => !r.ok && r.error.code === 'locked_weakening'));
        const rst = await s.msg({ type: 'RESET', baseRevision: (await s.status()).revision });
        check('F5.3 reset refused during session', !rst.ok && rst.error.code === 'locked_weakening');
        const strong = await s.save({ baseList: true, domains: ['lock-site.test', 'extra-lock.test'], words: ['lock phrase'] });
        check('F5.4 adding stronger protection allowed', strong.ok && (await s.visit('http://extra-lock.test/')).blocked);
        await s.back();
        const until = (await s.status()).lock.until;
        const stopped = await s.d.quit();
        await sleep(1500);
        // ---- F6: browser restart, same profile ----
        s = await session(profile);
        const after = await s.status();
        check('F6.1 after browser restart (add-on re-installed temporarily): session persists', after.lock.active && after.lock.until === until, JSON.stringify({ state: after.state, until: after.lock.until === until }));
        check('F6.2 after restart: rules and base list persist or are restored by reconcile', after.state === 'active' && after.base.enabled, JSON.stringify({ state: after.state, reasons: after.reasons, base: after.base.enabled }));
        check('F6.3 after restart: navigation blocked (user domain, base list, phrase)', (await s.visit('http://extra-lock.test/')).blocked && (await s.visit('http://tabsira-selftest.test/')).blocked && (await s.visit('http://www.google.com/search?q=lock+phrase')).blocked);
        await s.back();
        // ---- F7: wipe rules behind our back ----
        await s.inOptions('const r = await browser.declarativeNetRequest.getDynamicRules(); await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: r.map(x => x.id) }); await browser.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ["base_adult"] }); return true;');
        const healed = await s.status();
        check('F7.1 rules removed behind our back are detected and restored', healed.state === 'active' && healed.base.enabled && (await s.visit('http://extra-lock.test/')).blocked, JSON.stringify({ state: healed.state, reasons: healed.reasons }));
        await s.back();
        // ---- F8: perf ----
        const timing = async () => { await s.d.switchTo(await s.d.newTab()); const times = []; for (let i = 0; i < 15; i++) { const t = Date.now(); await s.d.goto(`http://perf-${i}.test/`).catch(() => {}); times.push(Date.now() - t); } times.sort((a, b) => a - b); return times[Math.floor(times.length / 2)]; };
        const withList = await timing(); const rssOn = rssMb();
        report.note('F8', `Firefox median navigation (15 loads, local proxy) with base list on: ${withList} ms; RSS (all Firefox processes) ≈ ${rssOn} MB`);
        check('F8.1 median local navigation with the 937k-domain ruleset enabled is under 250 ms', withList < 250, `${withList} ms`);
        // ---- F6b: withdrawn permission ----
        const removed = await s.inOptions('try { return await browser.permissions.remove({ origins: ["http://*/*", "https://*/*"] }); } catch (e) { return "error: " + e.message; }');
        await sleep(800);
        const afterRemove = await s.status();
        if (removed === true) check('F6b.1 withdrawn website permission is detected (status partial + specific reason)', afterRemove.state === 'partial' && afterRemove.reasons.includes('host_permission_missing'), JSON.stringify(afterRemove.reasons));
        else skip('F6b.1 withdrawn website permission is detected', `Firefox refused to remove it via API: ${String(removed).slice(0, 80)}`);
        if (removed === true) {
            const lockTry = await s.msg({ type: 'START_SESSION', minutes: 60 });
            check('F6b.2 a commitment session can still be extended but nothing weakens (lock already active)', lockTry.ok === true || lockTry.error?.code === 'session_needs_active_protection');
            const grant = await s.inOptions('try { return await browser.permissions.request({ origins: ["http://*/*", "https://*/*"] }); } catch (e) { return "error: " + e.message.slice(0, 60); }');
            report.note('F6b', `permissions.request outside a user gesture returned: ${JSON.stringify(grant)} (Firefox requires a click on the onboarding/consent page)`);
        }
    } else {
        skip('F3–F7 (rules, phrases, commitment, restart)', 'host permission was not granted to the temporary add-on in Firefox; permission-grant flow needs a user prompt that WebDriver cannot answer');
    }
} catch (error) {
    check('FX.crash harness completed without an exception', false, error.message);
} finally {
    await s?.d.quit().catch(() => {}); proxy.close();
}
fs.mkdirSync(path.join(root, 'test-evidence'), { recursive: true });
const summary = report.save(path.join(root, 'test-evidence', 'e2e-firefox.json'));
process.stdout.write(`\nSUMMARY ${JSON.stringify(summary)}\n`);
process.exit(summary.FAIL ? 1 : 0);
