// node tests/e2e/firefox-private.mjs   (FIREFOX=... GECKODRIVER=...; build first: node scripts/build.mjs)
// Firefox PRIVATE-window behaviour of the extracted release package, two profiles:
//   A: add-on installed with "Run in Private Windows" ALLOWED   -> protection and commitment must hold in a private window
//   B: add-on installed with it NOT allowed (the default)      -> documented limit: the extension is not applied there
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { startGecko } from './webdriver.mjs';
import { createReport } from './report.mjs';
import { root, sleep } from './lib.mjs';
import { preparePackage } from './package.mjs';

const FIREFOX = process.env.FIREFOX; const GECKODRIVER = process.env.GECKODRIVER;
if (!FIREFOX || !GECKODRIVER) { process.stderr.write('set FIREFOX and GECKODRIVER\n'); process.exit(2); }
const version = execFileSync(FIREFOX, ['--version']).toString().trim();
const pkg = preparePackage('firefox', { work: path.join(root, '.pkg-under-test', 'firefox-private') });
const report = createReport({ browserName: 'firefox-private', version, extra: { package: pkg.info, addonInstall: 'temporary (geckodriver moz/addon/install, allowPrivateBrowsing true / false)' } });
const { check, skip } = report;
process.stdout.write(`# ${version} private windows on ${report.meta.os}\n# package ${pkg.info.zip} sha256 ${pkg.info.zipSha256}\n`);

const ADDON_ID = '{6e6f9f5e-6c45-4f0a-9d8a-5b1f0f6a7c11}';
const UUID = '2f6f2d3e-0a4b-4d6e-8f10-6f3a1c2b9a77';
const EXT = `moz-extension://${UUID}`;
const NO_LIST = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const proxy = http.createServer((request, response) => { response.setHeader('content-type', 'text/html; charset=utf-8'); response.end('<!doctype html><title>REAL-SITE</title><p>site</p>'); });
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
const prefs = {
    'network.proxy.type': 1, 'network.proxy.http': '127.0.0.1', 'network.proxy.http_port': proxy.address().port, 'network.proxy.allow_hijacking_localhost': true,
    'network.proxy.no_proxies_on': '', 'extensions.webextensions.uuids': JSON.stringify({ [ADDON_ID]: UUID }),
    'intl.accept_languages': 'en', 'browser.shell.checkDefaultBrowser': false, 'datareporting.policy.dataSubmissionEnabled': false, 'toolkit.telemetry.enabled': false,
    'browser.startup.page': 0, 'extensions.autoDisableScopes': 0
};

async function start(allowPrivateBrowsing) {
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-ffp-'));
    const d = await startGecko({ geckodriver: GECKODRIVER, firefox: FIREFOX, profileDir, prefs });
    await d.installAddon(pkg.dirs.release, { allowPrivateBrowsing });
    await sleep(1500);
    await d.openExtensionTab(`${EXT}/options.html`);
    const optionsTab = await d.current();
    const msgIn = async (handle, message) => { await d.switchTo(handle); return d.run('return await browser.runtime.sendMessage(arguments[0]);', message); };
    const msg = message => msgIn(optionsTab, message);
    const status = async () => (await msg({ type: 'GET_STATUS' })).status;
    const save = async settings => { const s = await status(); return msg({ type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { ...NO_LIST, ...settings } }); };
    // Opens a PRIVATE window on `url` from the browser context; returns { handle, isPrivate }.
    const openPrivate = async url => {
        const before = await d.handles();
        const privateResult = await d.chromeRun(`
            const first = Services.wm.getMostRecentWindow('navigator:browser');
            const w = first.OpenBrowserWindow({ private: true });
            for (let i = 0; i < 100 && !(w.gBrowser && w.gBrowser.selectedBrowser); i++) await new Promise(resolve => w.setTimeout(resolve, 100));
            await w.delayedStartupPromise;
            w.gBrowser.selectedBrowser.fixupAndLoadURIString(arguments[0], { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
            const { PrivateBrowsingUtils } = ChromeUtils.importESModule('resource://gre/modules/PrivateBrowsingUtils.sys.mjs');
            return PrivateBrowsingUtils.isWindowPrivate(w);`, url);
        const isPrivate = privateResult && privateResult.__error ? `error: ${privateResult.__error}` : privateResult;
        await sleep(1800);
        const after = await d.handles();
        const fresh = after.filter(h => !before.includes(h));
        return { handle: fresh[fresh.length - 1], isPrivate, count: fresh.length };
    };
    const look = async handle => { await d.switchTo(handle); return { url: await d.url(), title: await d.title().catch(() => '') }; };
    return { d, profileDir, msg, msgIn, status, save, openPrivate, look, optionsTab };
}

let a, b;
try {
    // ================= A: private windows allowed =================
    a = await start(true);
    const done = await a.msg({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    check('F9.0 setup: onboarding done; host permission granted to the temporary add-on', done.ok === true && done.status.permissions.hosts === true, JSON.stringify(done.error ?? done.status?.permissions));
    await a.save({ domains: ['incog-site.test'] });
    const lock = await a.msg({ type: 'START_SESSION', minutes: 60 });
    check('F9.1 commitment session started (60 min)', lock.ok === true && lock.status.lock.active, JSON.stringify(lock.error ?? {}));
    const st = await a.status();
    check('F9.2 status reports that private windows are allowed for the extension (incognitoAllowed=true)', st.incognitoAllowed === true, String(st.incognitoAllowed));
    const blocked = await a.openPrivate('http://incog-site.test/');
    const blockedLook = blocked.handle ? await a.look(blocked.handle) : { url: '', title: '' };
    check('F9.3 a real PRIVATE window (PrivateBrowsingUtils.isWindowPrivate) on a blocked site shows the Tabsira stop page', blocked.isPrivate === true && blockedLook.url.startsWith(EXT) && blockedLook.url.endsWith('/blocked.html'), JSON.stringify({ isPrivate: blocked.isPrivate, url: blockedLook.url.slice(0, 80), handles: blocked.count }));
    const ok = await a.openPrivate('http://incog-ok.test/');
    const okLook = ok.handle ? await a.look(ok.handle) : { url: '', title: '' };
    check('F9.4 private window: an unlisted site loads normally', ok.isPrivate === true && okLook.title === 'REAL-SITE', JSON.stringify(okLook));
    // the extension's own page inside a private window
    const priv = await a.openPrivate(`${EXT}/options.html`);
    if (!priv.handle) skip('F9.5–F9.7 settings page inside a private window', 'private window with the settings page was not observable');
    else {
        const seen = await a.msgIn(priv.handle, { type: 'GET_STATUS' });
        check('F9.5 the settings page in the private window sees the SAME commitment and rules', seen.status.lock.active && JSON.stringify(seen.status.settings.domains) === JSON.stringify(['incog-site.test']), JSON.stringify({ lock: seen.status.lock.active, domains: seen.status.settings.domains }));
        const weak = await a.msgIn(priv.handle, { type: 'SAVE_SETTINGS', baseRevision: seen.status.revision, settings: NO_LIST });
        const weakAllow = await a.msgIn(priv.handle, { type: 'SAVE_SETTINGS', baseRevision: seen.status.revision, settings: { ...NO_LIST, domains: ['incog-site.test'], allow: ['x-allow.test'] } });
        check('F9.6 commitment cannot be weakened from the private window (removal and exception both refused)', !weak.ok && weak.error.code === 'locked_weakening' && !weakAllow.ok && weakAllow.error.code === 'locked_weakening', JSON.stringify([weak.error?.code, weakAllow.error?.code]));
        const stronger = await a.msgIn(priv.handle, { type: 'SAVE_SETTINGS', baseRevision: seen.status.revision, settings: { ...NO_LIST, domains: ['incog-site.test', 'incog-more.test'] } });
        const more = await a.openPrivate('http://incog-more.test/');
        const moreLook = more.handle ? await a.look(more.handle) : { url: '' };
        check('F9.7 stronger protection added from the private window is enforced in it', stronger.ok && moreLook.url.endsWith('/blocked.html'), JSON.stringify({ ok: stronger.ok, url: moreLook.url.slice(0, 60) }));
    }
    const after = await a.status();
    check('F9.8 afterwards the normal instance still has session and rules (one shared state)', after.lock.active && after.state === 'active' && after.settings.domains.includes('incog-more.test'), JSON.stringify({ state: after.state, domains: after.settings.domains }));
    await a.d.quit(); a = null;

    // ================= B: private windows NOT allowed (default) =================
    b = await start(false);
    await b.msg({ type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    await b.save({ domains: ['incog-site.test'] });
    const stB = await b.status();
    check('F9.9 without "Run in Private Windows": status honestly reports incognitoAllowed=false', stB.incognitoAllowed === false, String(stB.incognitoAllowed));
    const normalB = await b.openPrivate('http://incog-site.test/');   // a private window
    const lookB = normalB.handle ? await b.look(normalB.handle) : { url: '', title: '' };
    check('F9.10 documented limit: in a private window WITHOUT the switch the extension is not applied and the site loads', normalB.isPrivate === true && lookB.title === 'REAL-SITE' && !lookB.url.startsWith(EXT), JSON.stringify({ isPrivate: normalB.isPrivate, ...lookB }));
} catch (error) {
    check('F9.crash harness completed without an exception', false, error.message);
} finally {
    await a?.d.quit().catch(() => {}); await b?.d.quit().catch(() => {}); proxy.close();
}
fs.mkdirSync(path.join(root, 'test-evidence'), { recursive: true });
const summary = report.save(path.join(root, 'test-evidence', 'e2e-firefox-private.json'));
process.stdout.write(`\nSUMMARY ${JSON.stringify(summary)}\n`);
process.exit(summary.FAIL ? 1 : 0);
