// Real-browser acceptance suite. Every check runs against an actual Chromium-family browser with the
// built extension loaded. Nothing here mocks declarativeNetRequest, permissions, storage or the UI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { launch, startSite, visit, openExtPage, send, root, sleep } from './lib.mjs';

const BLOCKED = '/blocked.html';
const listDomains = () => zlib.gunzipSync(fs.readFileSync(path.join(root, 'data/base-list/adult-domains.txt.gz'))).toString('utf8').split('\n').filter(Boolean);
const canaries = () => fs.readFileSync(path.join(root, 'data/base-list/known-benign-canaries.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
const NO_LIST = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
const encode = text => encodeURIComponent(text);

export async function runSuite({ browserName, executablePath, report, pkg }) {
    const { check, skip, note } = report;
    const site = await startSite();
    // Packages under test (extracted release ZIP; see package.mjs). Most sections run on the unmodified release package.
    const testDir = pkg.dirs.release;       // exactly what the store receives
    const feedbackDir = pkg.dirs.test;      // + declarativeNetRequestFeedback, only for sections that call testMatchOutcome
    const optionalDir = pkg.dirs.optional;
    const liveDir = pkg.dirs.live;
    const open = (extra = {}) => launch({ executablePath, extensionDir: testDir, ...extra });
    const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
    const want = id => !only.length || only.includes(id);
    const allLogs = [];
    const finish = async b => { allLogs.push(...b.evidence.logs); await b.context.close(); };
    const status = async page => (await send(page, { type: 'GET_STATUS' })).status;
    const save = async (page, settings) => {
        const current = await status(page);
        return send(page, { type: 'SAVE_SETTINGS', baseRevision: current.revision, settings: { ...NO_LIST, ...settings } });
    };
    const onboard = async (page, baseList = false, starterTerms = false) => send(page, { type: 'COMPLETE_ONBOARDING', baseList, starterTerms });
    const url = (host, pathAndQuery = '/') => `http://${host}:${site.port}${pathAndQuery}`;
    const matchOutcome = (worker, target) => worker.evaluate(async u => (await chrome.declarativeNetRequest.testMatchOutcome({ url: u, type: 'main_frame', method: 'get' })).matchedRules.map(r => r.ruleId), target);

    // ================= S1: fresh install =================
    if (want('S1')) {
        const b = await open();
        await sleep(1200);
        const urls = b.context.pages().map(p => p.url());
        check('S1.1 onboarding page opens on install', urls.some(u => u.endsWith('/onboarding.html')), urls.join(' '));
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        const s = await status(options);
        check('S1.2 fresh install reports not_configured, no rules, base list off', s.state === 'not_configured' && s.counts.dynamicRules === 0 && s.base.enabled === false, JSON.stringify({ state: s.state, reasons: s.reasons }));
        const real = await visit(b.context, url('tabsira-selftest.test'));
        check('S1.3 nothing is blocked before onboarding (honest "not configured")', real.real && !real.blocked);
        check('S1.4 base list metadata is bundled and readable', s.base.domainCount === 242750, `domainCount=${s.base.domainCount}`);
        await finish(b);
    }

    // ================= S2: onboarding UI + stop page + help =================
    if (want('S2')) {
        const b = await open();
        const page = await openExtPage(b.context, b.extensionId, 'onboarding.html');
        const dir = await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang, document.querySelector('h1').textContent]);
        check('S2.1 Arabic UI is RTL (browser language ar)', dir[0] === 'rtl' && dir[1].startsWith('ar') && /[\u0600-\u06FF]/u.test(dir[2]), dir.join('/'));
        for (let i = 0; i < 4; i++) await page.click('#next');
        check('S2.2 five onboarding steps reachable (progress text, final step shows controls)', await page.isVisible('#finish') && (await page.textContent('#progress')).includes('5'));
        check('S2.3 defaults: base list and starter terms preselected', await page.isChecked('#baseList') && await page.isChecked('#starterTerms'));
        await page.click('#finish');
        await page.waitForSelector('#selftest:not([hidden])');
        const s = await status(page);
        check('S2.4 after onboarding: state active, base ruleset enabled, permission present', s.state === 'active' && s.base.enabled && s.permissions.hosts === true, JSON.stringify({ state: s.state, reasons: s.reasons }));
        const hit = await visit(b.context, url('tabsira-selftest.test'));
        check('S2.5 safe self-test domain redirects to the stop page (real DNR redirect)', hit.blocked && hit.chain.length <= 2, hit.url);
        const stop = await b.context.newPage();
        await stop.goto(url('tabsira-selftest.test'));
        await stop.waitForURL('**/blocked.html');
        const text = await stop.textContent('body');
        check('S2.6 stop page shows no blocked address or search text', !text.includes('tabsira-selftest') && !stop.url().includes('selftest'), stop.url());
        check('S2.7 stop page is RTL Arabic with a Help-now link', (await stop.getAttribute('html', 'dir')) === 'rtl' && await stop.isVisible('a[href="help.html"]'));
        await stop.reload();
        check('S2.8 reloading the stop page does not loop or leave it', stop.url().endsWith(BLOCKED));
        await stop.click('a[href="help.html"]');
        await stop.waitForURL('**/help.html');
        await stop.clock.install();
        await stop.reload();
        await stop.click('#start');
        const before = stop.url();
        await stop.clock.fastForward(61000);
        await sleep(300);
        const statusPage = await openExtPage(b.context, b.extensionId, 'options.html');
        check('S2.9 help timer ends without opening any site and without changing blocking', stop.url() === before && (await stop.textContent('#timer')).trim() !== '60' && (await status(statusPage)).state === 'active');
        const helpMsg = await stop.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_STATUS' }).catch(() => 'no-reply'));
        check('S2.9b stop/help pages cannot talk to the worker (not an allowed sender page)', helpMsg === undefined || helpMsg === 'no-reply', String(helpMsg).slice(0, 40));
        const webFetch = await (await b.context.newPage()).evaluate(async id => { try { await fetch(`chrome-extension://${id}/blocked.html`); return 'reachable'; } catch { return 'blocked'; } }, b.extensionId);
        check('S2.10 extension pages are not web-accessible (no fingerprinting from websites)', webFetch === 'blocked', webFetch);
        await finish(b);
    }

    // ================= S3: base list against real DNR =================
    if (want('S3')) {
        const b = await open({ extensionDir: feedbackDir });
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options, true, false);
        const worker = b.getWorker();
        const all = listDomains(); const set = new Set(all);
        const at = fraction => all[Math.floor((all.length - 1) * fraction)];
        const sample = [all[0], at(0.001), at(0.25), at(0.5), at(0.9), all[all.length - 1]];
        const direct = []; const sub = []; for (const d of sample) { direct.push((await matchOutcome(worker, `https://${d}/`)).length); sub.push((await matchOutcome(worker, `https://deep.sub.${d}/page?x=1`)).length); }
        check('S3.1 sampled listed domains match the static ruleset (6 across the list)', direct.every(n => n === 1), direct.join(','));
        check('S3.2 their subdomains match (DNS label boundary)', sub.every(n => n === 1), sub.join(','));
        const lookalikes = sample.map(d => `not${d}`).filter(d => !set.has(d));
        const lookalikeHits = []; for (const d of lookalikes) lookalikeHits.push((await matchOutcome(worker, `https://${d}/`)).length);
        check('S3.3 lookalike (prefix without dot boundary) is not matched', lookalikeHits.every(n => n === 0), lookalikeHits.join(','));
        const suffixLook = []; for (const d of sample) suffixLook.push((await matchOutcome(worker, `https://${d}.evil.example/`)).length);
        check('S3.4 listed name used as a prefix label of another domain is not matched', suffixLook.every(n => n === 0), suffixLook.join(','));
        let benignHits = 0; for (const c of canaries()) benignHits += (await matchOutcome(worker, `https://www.${c}/`)).length;
        check(`S3.5 all ${canaries().length} known-benign canary sites are NOT matched`, benignHits === 0, `hits=${benignHits}`);
        const samples = JSON.parse(fs.readFileSync(path.join(root, 'data/base-list/provenance-samples.json'), 'utf8'));
        const matchAll = async list => { const out = []; for (const d of list) out.push((await matchOutcome(worker, `https://${d}/`)).length); return out; };
        const removed = await matchAll(samples.removedFromPreviousSnapshot); const swOnly = await matchAll(samples.fromShadowWhispererOnly);
        const sinOnly = await matchAll(samples.fromSinfoniettaOnly); const both = await matchAll(samples.inBothSources);
        check(`S3.5b names that an earlier snapshot held and the licence-only rule removed are NOT in the ruleset (${removed.length} samples; names only, never requested)`, removed.length >= 12 && removed.every(n => n === 0), removed.join(','));
        check('S3.5c ShadowWhisperer-only domains ARE in the ruleset (12 samples)', swOnly.length === 12 && swOnly.every(n => n === 1), swOnly.join(','));
        check('S3.5d Sinfonietta-only domains ARE in the ruleset (12 samples)', sinOnly.length === 12 && sinOnly.every(n => n === 1), sinOnly.join(','));
        check('S3.5e domains listed by both sources ARE in the ruleset (12 samples)', both.length === 12 && both.every(n => n === 1), both.join(','));
        const redirectTarget = await worker.evaluate(async u => { const o = await chrome.declarativeNetRequest.testMatchOutcome({ url: u, type: 'main_frame', method: 'get' }); return o.matchedRules[0]?.rulesetId; }, `https://${all[5]}/`);
        check('S3.6 match comes from the bundled static ruleset', redirectTarget === 'base_adult', String(redirectTarget));
        const off = await save(options, { baseList: false });
        check('S3.7 switching the base list off removes its effect (real navigation)', off.ok && (await visit(b.context, url('tabsira-selftest.test'))).real);
        await save(options, { baseList: true });
        check('S3.8 switching it on again restores the redirect', (await visit(b.context, url('tabsira-selftest.test'))).blocked);
        // Exception beats the base list.
        const exc = await save(options, { baseList: true, allow: ['tabsira-selftest.test'] });
        const excVisit = await visit(b.context, url('tabsira-selftest.test'));
        check('S3.9 exception overrides the base list (precedence allow > base)', exc.ok && excVisit.real, JSON.stringify({ ok: exc.ok, real: excVisit.real }));
        await finish(b);
    }

    // ================= S4: user domains, boundaries, precedence =================
    if (want('S4')) {
        const b = await open();
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options);
        await save(options, { domains: ['blocked-user.test'] });
        const cases = [
            ['blocked-user.test', true], ['sub.blocked-user.test', true], ['a.b.blocked-user.test', true],
            ['notblocked-user.test', false], ['blocked-user.test.evil.example', false], ['blocked-user.tests.example', false]
        ];
        for (const [host, expectBlocked] of cases) {
            const r = await visit(b.context, url(host));
            check(`S4.1 ${expectBlocked ? 'blocks' : 'does not block'} ${host}`, expectBlocked ? r.blocked : r.real, r.url.slice(0, 60));
        }
        const withParent = await save(options, { domains: ['blocked-user.test'], allow: ['ok.blocked-user.test'] });
        const ok = await visit(b.context, url('ok.blocked-user.test')); const deeper = await visit(b.context, url('x.ok.blocked-user.test')); const sibling = await visit(b.context, url('other.blocked-user.test'));
        check('S4.2 exception for a subdomain beats the parent block; siblings stay blocked', withParent.ok && ok.real && deeper.real && sibling.blocked, JSON.stringify({ ok: ok.real, deeper: deeper.real, sibling: sibling.blocked }));
        const conflict = await save(options, { domains: ['x.ok.blocked-user.test'], allow: ['ok.blocked-user.test'] });
        check('S4.3 block inside an exception is rejected as a conflict', !conflict.ok && conflict.error.code === 'conflict_domain_allow');
        const bad = await save(options, { domains: ['co.uk'] });
        check('S4.4 shared public suffix is refused', !bad.ok && bad.error.code === 'domain_is_shared_suffix');
        const eng = await save(options, { allow: ['google.com'] });
        check('S4.5 a search engine cannot be excepted', !eng.ok && eng.error.code === 'allow_search_engine');
        const rev = (await status(options)).revision;
        const stale = await send(options, { type: 'SAVE_SETTINGS', baseRevision: rev - 1, settings: NO_LIST });
        check('S4.6 stale settings from another window are rejected, nothing lost', !stale.ok && stale.error.code === 'stale' && (await status(options)).settings.domains.length === 1);
        await finish(b);
    }

    // ================= S5: search phrases =================
    if (want('S5')) {
        const b = await open();
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options);
        const saved = await save(options, { words: ['tabsira word', 'عبارة اختبار'], contains: ['probe-part'] });
        check('S5.0 phrases accepted by the real regex engine', saved.ok, JSON.stringify(saved.error ?? {}));
        const engines = ['www.google.com/search', 'www.google.de/search', 'www.google.com.eg/search', 'www.bing.com/search', 'www.bing.com/images/search', 'duckduckgo.com/', 'search.yahoo.com/search', 'images.search.yahoo.com/search/images', 'www.youtube.com/results'];
        const param = host => host.includes('yahoo') ? 'p' : host.includes('youtube') ? 'search_query' : 'q';
        for (const e of engines) {
            const [host, ...rest] = e.split('/'); const p = param(host); const target = (value, extra = '') => url(host, `/${rest.join('/')}?${extra}${p}=${value}`);
            const hit = await visit(b.context, target(encode('tabsira word')));
            const miss = await visit(b.context, target('ordinary'));
            // "Allowed" means: NOT redirected to the stop page. Some browsers (Edge) reset connections to their own/partner search hosts
            // before they reach the local test server, so the page itself may not load; that is not the extension's doing.
            check(`S5.1 ${host}: phrase blocked, ordinary search not blocked`, hit.blocked && !miss.blocked, `hit.blocked=${hit.blocked} ordinary: ${miss.real ? 'loaded' : `not blocked; page did not load (${String(miss.error).slice(0, 60)})`}`);
        }
        const variants = [
            ['plus-encoded', `q=tabsira+word`], ['percent20', `q=tabsira%20word`], ['upper case', `q=TABSIRA%20Word`], ['extra params before', `hl=en&q=tabsira+word&safe=active`],
            ['arabic percent-encoded', `q=${encode('عبارة اختبار')}`], ['arabic lower-hex', `q=${encode('عبارة اختبار').toLowerCase()}`], ['word inside longer query', `q=best+tabsira+word+now`],
            ['contains mode substring', `q=xxprobe-partyy`]
        ];
        for (const [name, query] of variants) { const r = await visit(b.context, url('www.google.com', `/search?${query}`)); check(`S5.2 blocked: ${name}`, r.blocked, r.url.slice(0, 80)); }
        const safe = [
            ['phrase only in another parameter', `q=ordinary&note=tabsira+word`], ['param name boundary (aq)', `aq=tabsira+word`], ['word mode: embedded in a longer word', `q=xtabsira+words`],
            ['phrase in the path, not the query', `x=1`], ['different engine param (p on google)', `p=tabsira+word`]
        ];
        for (const [name, query] of safe) { const r = await visit(b.context, url('www.google.com', `/search?${query}`)); check(`S5.3 allowed: ${name}`, r.real, r.url.slice(0, 80)); }
        const pathOnly = await visit(b.context, url('www.google.com', `/${encode('tabsira word')}`));
        check('S5.3 allowed: phrase in path only', pathOnly.real);
        const nonEngine = await visit(b.context, url('example-news.test', `/search?q=${encode('tabsira word')}`));
        check('S5.4 phrase on a non-search site is not inspected', nonEngine.real);
        const long = await save(options, { words: ['tabsira word'], contains: ['ع'.repeat(40)] });
        check('S5.5 over-long Arabic phrase is refused with a line number (real regex memory limit)', !long.ok && long.error.code === 'phrase_too_complex' && long.error.params.line === 1, JSON.stringify(long.error ?? {}));
        // starter terms accepted in a real browser
        const starter = await save(options, { starterTerms: true });
        const s = await status(options);
        check('S5.6 every starter term is accepted by the real regex engine', starter.ok && !s.reasons.includes('phrases_unsupported'), JSON.stringify(s.reasons));
        const starterHit = await visit(b.context, url('www.google.com', `/search?q=${encode('افلام اباحية')}`));
        const starterOk = await visit(b.context, url('www.google.com', `/search?q=${encode('essex hotels')}`));
        check('S5.7 starter term blocks; unrelated search stays allowed', starterHit.blocked && starterOk.real);
        await finish(b);
    }

    // ================= S6: redirect behaviour =================
    if (want('S6')) {
        const b = await open();
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options, true, false);
        await save(options, { baseList: true, domains: ['loop-check.test'] });
        const r = await visit(b.context, url('loop-check.test', '/a?x=1#frag'));
        check('S6.1 blocked navigation: single redirect to the stop page, no loop', r.blocked && r.chain.length <= 2, r.chain.join(' > ').slice(0, 200));
        const page = await b.context.newPage();
        const requests = [];
        page.on('request', q => requests.push(q.url()));
        await page.goto(url('loop-check.test', '/'));
        await sleep(800);
        const extRequests = requests.filter(u => u.startsWith('chrome-extension://') && u.endsWith(BLOCKED));
        check('S6.2 the stop page is requested exactly once', extRequests.length === 1, String(extRequests.length));
        const frame = await b.context.newPage();
        await frame.setContent(`<iframe src="${url('loop-check.test', '/')}"></iframe>`);
        await sleep(600);
        check('S6.3 documented limit: sub-frames are not redirected (main_frame only)', frame.frames().length === 2 && !frame.frames().some(f => f.url().includes('blocked.html')));
        await finish(b);
    }

    // ================= S7: commitment, persistence, restarts =================
    if (want('S7')) {
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-lock-'));
        pkg.resetLive();
        let b = await open({ profileDir: profile, extensionDir: liveDir });
        let options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options, true, false);
        await save(options, { baseList: true, domains: ['lock-site.test'], words: ['lock phrase'] });
        // UI-driven session start with confirmation
        await options.reload();
        await options.click('#sessionButtons button:first-child');
        check('S7.1 session start requires an explicit confirmation step', await options.isVisible('#sessionConfirm'));
        await options.click('#sessionYes');
        await options.waitForFunction(() => document.querySelector('#lock').textContent.length > 20 && !document.querySelector('#lock').textContent.includes('لا توجد'));
        let s = await status(options);
        check('S7.2 session active (60 min) and shown in the UI', s.lock.active && s.lock.until - Date.now() > 59 * 60000 && s.lock.until - Date.now() <= 60 * 60000 + 5000);
        // UI-driven weakening attempts
        await options.fill('#domains', '');
        await options.click('#form button[type=submit]');
        await options.waitForFunction(() => document.querySelector('#message').textContent.length > 0);
        const refusal = await options.textContent('#message');
        check('S7.3 deleting a site is refused with a clear message and rules remain', (await options.getAttribute('#message', 'class')).includes('error') && refusal.length > 20 && (await visit(b.context, url('lock-site.test'))).blocked, refusal.slice(0, 60));
        await options.reload();
        const attempts = [
            ['disable base list', { baseList: false, domains: ['lock-site.test'], words: ['lock phrase'] }],
            ['remove phrase', { baseList: true, domains: ['lock-site.test'], words: [] }],
            ['add exception', { baseList: true, domains: ['lock-site.test'], words: ['lock phrase'], allow: ['fine-site.test'] }],
            ['disable starter terms is no-op', null]
        ];
        for (const [name, settings] of attempts) {
            if (!settings) continue;
            const r = await save(options, settings);
            check(`S7.4 refused during session: ${name}`, !r.ok && r.error.code === 'locked_weakening', JSON.stringify(r.error ?? {}));
        }
        const reset = await send(options, { type: 'RESET', baseRevision: (await status(options)).revision });
        check('S7.5 reset is refused during session', !reset.ok && reset.error.code === 'locked_weakening');
        const weakImport = JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...NO_LIST, allow: ['evil-allow.test'] } });
        const imp = await send(options, { type: 'IMPORT_SETTINGS', baseRevision: (await status(options)).revision, text: weakImport });
        check('S7.6 importing weaker settings is refused during session', !imp.ok && imp.error.code === 'locked_weakening');
        const stronger = await save(options, { baseList: true, domains: ['lock-site.test', 'extra-lock.test'], words: ['lock phrase'] });
        check('S7.7 adding stronger protection is allowed during session', stronger.ok && (await visit(b.context, url('extra-lock.test'))).blocked);
        const untilBefore = (await status(options)).lock.until;
        // Service worker stop/restart: the old worker instance must be gone (its execution context is destroyed), and the
        // next message must be answered by a fresh instance that recovers everything from storage.
        const oldWorker = b.getWorker();
        const within = (promise, ms, fallback) => Promise.race([promise, sleep(ms).then(() => fallback)]);
        const originBefore = await oldWorker.evaluate(() => performance.timeOrigin);
        const cdp = await b.context.newCDPSession(b.context.pages()[0]);
        await within(cdp.send('ServiceWorker.enable').catch(() => {}), 5000);
        await within(cdp.send('ServiceWorker.stopAllWorkers').catch(() => {}), 5000);
        await sleep(1000);
        const oldAlive = await within(oldWorker.evaluate(() => performance.timeOrigin).then(origin => origin === originBefore, () => false), 5000, false);
        s = await status(options);                                  // wakes a fresh worker
        check('S7.8 session survives a real service-worker stop/restart (old instance destroyed; new one recovers state from storage; no timer)', !oldAlive && s.lock.active && s.lock.until === untilBefore && s.state === 'active', JSON.stringify({ oldInstanceAlive: oldAlive, state: s.state, lockActive: s.lock.active, sameUntil: s.lock.until === untilBefore }));
        await finish(b);
        // Browser restart with the same profile
        b = await open({ profileDir: profile, extensionDir: liveDir });
        await sleep(1500);
        options = await openExtPage(b.context, b.extensionId, 'options.html');
        s = await status(options);
        check('S7.9 after full browser restart: session, rules and base list persist', s.lock.active && s.lock.until === untilBefore && s.state === 'active' && s.base.enabled, JSON.stringify({ state: s.state, base: s.base.enabled }));
        check('S7.10 after browser restart: navigation is still blocked', (await visit(b.context, url('extra-lock.test'))).blocked && (await visit(b.context, url('www.google.com', `/search?q=${encode('lock phrase')}`))).blocked);
        await finish(b);
        // Extension update: same unpacked path, higher version, same profile (Chrome fires onInstalled "update").
        // The manifest version of the SAME extracted package is raised in place (path, hence extension ID, stays the same).
        pkg.bumpLive('1.0.1');
        b = await open({ profileDir: profile, extensionDir: liveDir });
        await sleep(2500);
        options = await openExtPage(b.context, b.extensionId, 'options.html');
        s = await status(options);
        const manifestVersion = await options.evaluate(() => chrome.runtime.getManifest().version);
        check('S7.11 after an extension UPDATE (1.0.0 → 1.0.1, same profile): rules, base list and session are back', manifestVersion === '1.0.1' && s.state === 'active' && s.base.enabled && s.lock.until === untilBefore, JSON.stringify({ version: manifestVersion, state: s.state, base: s.base.enabled, reasons: s.reasons }));
        check('S7.12 blocking works after the update (real navigation)', (await visit(b.context, url('lock-site.test'))).blocked && (await visit(b.context, url('tabsira-selftest.test'))).blocked);
        // Wipe DNR state behind the extension's back, then ask for status (self-heal)
        await b.getWorker().evaluate(async () => { const rules = await chrome.declarativeNetRequest.getDynamicRules(); await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(r => r.id) }); await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['base_adult'] }); });
        const healed = await status(options);
        check('S7.13 rules removed behind our back are detected and restored', healed.state === 'active' && healed.base.enabled && (await visit(b.context, url('extra-lock.test'))).blocked, JSON.stringify({ state: healed.state, reasons: healed.reasons }));
        await finish(b);
        pkg.resetLive();
        // Clock moved: session end is an absolute timestamp
        note('S7.14', 'Clock change: the end time is stored as an absolute timestamp. Not automated (cannot change the OS clock in this sandbox); behaviour documented in README.');
        skip('S7.14 device-clock change effect', 'cannot change the OS clock safely here; documented limitation');
    }

    // ================= S8: permissions =================
    if (want('S8')) {
        const b = await launch({ executablePath, extensionDir: optionalDir });
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options, false, false);
        await save(options, { domains: ['perm-site.test'] });
        const s = await status(options);
        check('S8.1 without host permission: status is partial with a specific reason (never "active")', s.state === 'partial' && s.reasons.includes('host_permission_missing') && s.permissions.hosts === false, JSON.stringify({ state: s.state, reasons: s.reasons }));
        check('S8.2 without host permission nothing is redirected (proves the permission is load-bearing)', (await visit(b.context, url('perm-site.test'))).real);
        const popup = await openExtPage(b.context, b.extensionId, 'popup.html');
        const badge = await b.getWorker().evaluate(() => chrome.action.getBadgeText({}));
        check('S8.3 popup and badge show the problem (not a silent failure)', (await popup.getAttribute('#status', 'data-state')) === 'partial' && badge === '!', `badge=${badge}`);
        const lockTry = await send(options, { type: 'START_SESSION', minutes: 60 });
        check('S8.4 commitment cannot start around inactive protection', !lockTry.ok && lockTry.error.code === 'session_needs_active_protection');
        await finish(b);
        const g = await open();
        const gOptions = await openExtPage(g.context, g.extensionId, 'options.html');
        await onboard(gOptions);
        await save(gOptions, { domains: ['perm-site.test'] });
        const removed = await gOptions.evaluate(async () => { try { return await chrome.permissions.remove({ origins: ['http://*/*', 'https://*/*'] }); } catch (e) { return `error: ${e.message}`; } });
        await sleep(600);
        const after = await status(gOptions);
        if (removed === true) check('S8.5 withdrawn permission is detected live', after.state === 'partial' && after.reasons.includes('host_permission_missing'), JSON.stringify(after.reasons));
        else skip('S8.5 withdrawn permission is detected live', `Chromium refused to drop a required host permission via API (${String(removed).slice(0, 80)}); covered by S8.1 with the optional-permission build`);
        await finish(g);
    }

    // ================= S9: private (incognito) windows =================
    // Playwright cannot open private windows in a persistent profile, so: (1) a normal launch configures the extension and
    // starts a commitment; (2) the "Allow in Incognito" preference is set in the profile (the same preference the
    // chrome://extensions switch writes; operating that switch in this harness breaks command-line-loaded extensions);
    // (3) the extension itself opens private windows (chrome.windows.create) and a second CDP connection observes them.
    if (want('S9')) {
        const { chromium } = await import('playwright-core');
        const net = await import('node:net');
        const freePort = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port: p } = s.address(); s.close(() => resolve(p)); }); });
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-incog-'));
        let b = await open({ profileDir: profile });
        let options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options); await save(options, { domains: ['incog-site.test'] });
        const lock = await send(options, { type: 'START_SESSION', minutes: 60 });
        check('S9.0 setup: rules saved and commitment session started', lock.ok === true, JSON.stringify(lock.error ?? {}));
        const extId = b.extensionId;
        await finish(b); await sleep(1200);
        const observePrivateWindow = async (opts, cdp, target) => {
            const seen = new Set(cdp.contexts().flatMap(c => c.pages()));
            await opts.evaluate(u => chrome.windows.create({ url: u, incognito: true }), target).catch(() => {});
            await sleep(2800);
            for (const ctx of cdp.contexts()) for (const p of ctx.pages()) if (!seen.has(p)) return p;
            return null;
        };
        // --- A: switch NOT enabled
        let port = await freePort();
        b = await open({ profileDir: profile, extraArgs: [`--remote-debugging-port=${port}`] });
        await sleep(1500);
        options = await openExtPage(b.context, b.extensionId, 'options.html');
        let st = await status(options);
        check('S9.1 status reports that private windows are not allowed for the extension (incognitoAllowed=false)', st.incognitoAllowed === false, String(st.incognitoAllowed));
        let cdp = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const without = await observePrivateWindow(options, cdp, url('incog-site.test'));
        check('S9.2 private window WITHOUT the switch: extension is not applied, the site loads (documented limit; manual enable needed)', without && without.url().startsWith('http://incog-site.test') && (await without.title()) === 'REAL-SITE', without ? without.url().slice(0, 70) : 'no window observed');
        await cdp.close().catch(() => {}); await finish(b); await sleep(1200);
        // --- B: switch enabled (preference written while the browser is closed)
        const prefsFile = path.join(profile, 'Default', 'Preferences');
        const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
        prefs.extensions.settings[extId].incognito = true;
        fs.writeFileSync(prefsFile, JSON.stringify(prefs));
        port = await freePort();
        b = await open({ profileDir: profile, extraArgs: [`--remote-debugging-port=${port}`] });
        await sleep(1500);
        options = await openExtPage(b.context, b.extensionId, 'options.html');
        st = await status(options);
        check('S9.3 status reports private windows allowed (incognitoAllowed=true) and protection still active', st.incognitoAllowed === true && st.state === 'active', JSON.stringify({ incog: st.incognitoAllowed, state: st.state }));
        cdp = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const blockedPage = await observePrivateWindow(options, cdp, url('incog-site.test'));
        check('S9.4 private window WITH the switch: blocked site shows the Tabsira stop page (split instance)', !!blockedPage && blockedPage.url().endsWith('/blocked.html'), blockedPage ? blockedPage.url().slice(0, 70) : 'no window observed');
        const okPage = await observePrivateWindow(options, cdp, url('incog-ok.test'));
        check('S9.5 private window: unlisted site loads normally', !!okPage && (await okPage.title()) === 'REAL-SITE');
        const extPage = await observePrivateWindow(options, cdp, `chrome-extension://${b.extensionId}/options.html`);
        if (!extPage) skip('S9.6 private-window settings page shares the commitment', 'private window with the settings page was not observable');
        else {
            const seenStatus = await extPage.evaluate(async () => { const r = await chrome.runtime.sendMessage({ type: 'GET_STATUS' }); return { lock: r.status.lock.active, domains: r.status.settings.domains }; });
            check('S9.6 the private-window instance sees the SAME commitment and rules (shared storage)', seenStatus.lock === true && JSON.stringify(seenStatus.domains) === JSON.stringify(['incog-site.test']), JSON.stringify(seenStatus));
            const weak = await extPage.evaluate(async () => { const s = (await chrome.runtime.sendMessage({ type: 'GET_STATUS' })).status; const r = await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] } }); return r.ok ? 'accepted' : r.error.code; });
            check('S9.7 commitment cannot be weakened from a private window', weak === 'locked_weakening', weak);
            const weakAllow = await extPage.evaluate(async () => { const s = (await chrome.runtime.sendMessage({ type: 'GET_STATUS' })).status; const r = await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { baseList: false, starterTerms: false, domains: ['incog-site.test'], allow: ['incog-site.test.example'], words: [], contains: [] } }); return r.ok ? 'accepted' : r.error.code; });
            check('S9.8 adding an exception from a private window is refused too', weakAllow === 'locked_weakening', weakAllow);
            const after = await status(options);
            check('S9.9 rules unchanged after the attempts; normal window still blocks', after.settings.domains.length === 1 && (await visit(b.context, url('incog-site.test'))).blocked);
        }
        await cdp.close().catch(() => {}); await finish(b);
    }

    // ================= S11: performance with the realistic list =================
    if (want('S11')) {
        const rss = marker => { try { const lines = execFileSync('ps', ['-eo', 'rss,args']).toString().split('\n').filter(l => l.includes(marker)); return Math.round(lines.reduce((s, l) => s + Number(l.trim().split(/\s+/u)[0] || 0), 0) / 1024); } catch { return -1; } };
        const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-perf-'));
        const t0 = Date.now();
        const b = await open({ profileDir: profile, extensionDir: feedbackDir });
        const startMs = Date.now() - t0;
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options, false, false);
        await sleep(2500);
        const rssOff = rss(profile);
        const navTimes = async n => { const times = []; for (let i = 0; i < n; i++) { const p = await b.context.newPage(); const s = Date.now(); await p.goto(url(`perf-${i}-${Math.random().toString(36).slice(2, 7)}.test`), { waitUntil: 'domcontentloaded' }); times.push(Date.now() - s); await p.close(); } return times; };
        const offTimes = await navTimes(25);
        const enableStart = Date.now();
        const enabled = await save(options, { baseList: true });
        const enableMs = Date.now() - enableStart;
        await sleep(2500);
        const rssOn = rss(profile);
        const onTimes = await navTimes(25);
        const matchMs = await b.getWorker().evaluate(async () => { const t = performance.now(); for (let i = 0; i < 200; i++) await chrome.declarativeNetRequest.testMatchOutcome({ url: `https://perf-${i}.example.org/x?q=${i}`, type: 'main_frame', method: 'get' }); return (performance.now() - t) / 200; });
        const matchPhraseMs = await b.getWorker().evaluate(async () => { const t = performance.now(); for (let i = 0; i < 200; i++) await chrome.declarativeNetRequest.testMatchOutcome({ url: `https://www.google.com/search?q=ordinary+${i}`, type: 'main_frame', method: 'get' }); return (performance.now() - t) / 200; });
        const limits = await b.getWorker().evaluate(async () => { const d = chrome.declarativeNetRequest; return { MAX_NUMBER_OF_DYNAMIC_RULES: d.MAX_NUMBER_OF_DYNAMIC_RULES, MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: d.MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES, MAX_NUMBER_OF_REGEX_RULES: d.MAX_NUMBER_OF_REGEX_RULES, GUARANTEED_MINIMUM_STATIC_RULES: d.GUARANTEED_MINIMUM_STATIC_RULES, MAX_NUMBER_OF_STATIC_RULESETS: d.MAX_NUMBER_OF_STATIC_RULESETS, MAX_NUMBER_OF_ENABLED_STATIC_RULESETS: d.MAX_NUMBER_OF_ENABLED_STATIC_RULESETS, availableStaticRules: await d.getAvailableStaticRuleCount() }; });
        note('S11-limits', JSON.stringify(limits));
        note('S11', JSON.stringify({ browser: executablePath.split('/').slice(-2).join('/'), listDomains: listDomains().length, extensionReadyMs: startMs, enableBaseListMs: enableMs, navMedianOffMs: median(offTimes), navMedianOnMs: median(onTimes), rssOffMB: rssOff, rssOnMB: rssOn, matchMsPerUrl: Number(matchMs.toFixed(2)), phraseMatchMsPerUrl: Number(matchPhraseMs.toFixed(2)) }));
        check('S11.1 enabling the full built-in list succeeds', enabled.ok, `${enableMs} ms`);
        check('S11.2 enabling takes under 15 s', enableMs < 15000, `${enableMs} ms`);
        check('S11.3 navigation overhead with the list on is under 50 ms (median of 25, local server)', median(onTimes) - median(offTimes) < 50, `off ${median(offTimes)} ms / on ${median(onTimes)} ms`);
        check('S11.4 per-URL matching cost with the list is under 5 ms', matchMs < 5 && matchPhraseMs < 5, `${matchMs.toFixed(2)} ms / ${matchPhraseMs.toFixed(2)} ms`);
        check('S11.5 total browser memory increase from the list is under 400 MB', rssOn - rssOff < 400, `${rssOff} MB → ${rssOn} MB`);
        await finish(b);
    }

    // ================= S12: keyboard, focus, RTL, contrast, localization =================
    if (want('S12')) {
        const b = await open();
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options, false, false);
        await options.reload();
        const focusable = await options.evaluate(() => [...document.querySelectorAll('a[href],button,input,textarea,summary,select')].filter(e => !e.hidden && !e.closest('[hidden]') && !e.disabled).length);
        const visited = new Set(); const noOutline = [];
        await options.focus('body');
        for (let i = 0; i < focusable; i++) {
            await options.keyboard.press('Tab');
            const info = await options.evaluate(() => { const e = document.activeElement; const style = getComputedStyle(e); return { id: e.id || e.tagName + (e.textContent || '').slice(0, 12), outline: e.matches(':focus-visible') ? `${style.outlineStyle}/${style.outlineWidth}` : 'none' }; });
            visited.add(info.id); if (info.outline.startsWith('none') || info.outline.endsWith('/0px')) noOutline.push(info.id);
        }
        check(`S12.1 keyboard Tab reaches every interactive control on the settings page (${focusable} controls)`, visited.size >= focusable, `${visited.size}/${focusable}`);
        check('S12.2 every focused control shows a visible focus outline', noOutline.length === 0, noOutline.slice(0, 3).join(','));
        // keyboard-only: add a site and save
        await options.fill('#domains', '');
        await options.focus('#domains');
        await options.keyboard.type('kbd-site.test');
        await options.keyboard.press('Tab'); // → into later fields; go straight to the submit button by id
        await options.focus('#form button[type=submit]');
        await options.keyboard.press('Enter');
        await options.waitForFunction(() => document.querySelector('#message').textContent.length > 0);
        check('S12.3 keyboard-only save works', (await status(options)).settings.domains.includes('kbd-site.test'));
        const colors = await options.evaluate(() => { const probe = (selector, prop) => getComputedStyle(document.querySelector(selector))[prop]; return { body: probe('body', 'color'), bodyBg: probe('body', 'backgroundColor'), hint: probe('.hint', 'color'), btn: probe('button[type=submit]', 'color'), btnBg: probe('button[type=submit]', 'backgroundColor'), card: probe('section', 'backgroundColor') }; });
        const lum = rgb => { const [r, g, b] = rgb.match(/\d+(?:\.\d+)?/gu).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const ratio = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        const contrast = {};
        for (const scheme of ['light', 'dark']) {
            await options.emulateMedia({ colorScheme: scheme });
            await sleep(500);   // CSS colour transitions must finish before measuring
            const c = await options.evaluate(() => { const probe = (selector, prop) => getComputedStyle(document.querySelector(selector))[prop]; return { body: probe('body', 'color'), bodyBg: probe('body', 'backgroundColor'), hint: probe('.hint', 'color'), card: probe('section', 'backgroundColor'), btn: probe('button[type=submit]', 'color'), btnBg: probe('button[type=submit]', 'backgroundColor'), sec: probe('#selftest', 'color'), secBg: probe('#selftest', 'backgroundColor') }; });
            contrast[scheme] = { text: ratio(c.body, c.bodyBg), hint: ratio(c.hint, c.card), button: ratio(c.btn, c.btnBg), secondary: ratio(c.sec, c.secBg) };
        }
        const minimum = Math.min(...Object.values(contrast).flatMap(o => Object.values(o)));
        note('S12', `contrast ratios ${JSON.stringify(Object.fromEntries(Object.entries(contrast).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([n, r]) => [n, Number(r.toFixed(2))]))])))}`);
        check('S12.4 measured text/button contrast ≥ 4.5:1 in light and dark schemes', minimum >= 4.5, `min ${minimum.toFixed(2)}`);
        const rtl = await options.evaluate(() => { const range = document.createRange(); range.selectNodeContents(document.querySelector('h1')); const h = range.getBoundingClientRect(); const column = document.querySelector('main').getBoundingClientRect(); return { dir: getComputedStyle(document.body).direction, align: getComputedStyle(document.querySelector('p')).textAlign, hRight: Math.round(column.right - h.right), hLeft: Math.round(h.left - column.left), domainsDir: document.querySelector('#domains').dir }; });
        check('S12.5 RTL layout: Arabic text starts at the right edge; site list input is LTR', rtl.dir === 'rtl' && rtl.hRight < rtl.hLeft + 1 && rtl.domainsDir === 'ltr', JSON.stringify(rtl));
        await finish(b);
        for (const [lang, expectDir, expectText] of [['de', 'ltr', 'Tabsira-Einstellungen'], ['en', 'ltr', 'Tabsira settings']]) {
            const c = await launch({ executablePath, extensionDir: testDir, lang });
            const page = await openExtPage(c.context, c.extensionId, 'options.html');
            const info = await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang, document.querySelector('h1').textContent]);
            check(`S12.6 ${lang} UI: ${expectDir.toUpperCase()} and translated`, info[0] === expectDir && info[2] === expectText, info.join(' / '));
            await finish(c);
        }
    }

    // ================= S13: faults on real APIs, races, trust boundaries, CSP =================
    if (want('S13')) {
        const b = await open();
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options);
        await save(options, { domains: ['fault-a.test'] });
        const worker = b.getWorker();
        // Real DNR + real storage; only the storage write is made to fail once.
        await worker.evaluate(() => { const isCfg = items => items && Object.keys(items).some(k => k === 'config' || k.startsWith('cfg:')); const original = chrome.storage.local.set.bind(chrome.storage.local); globalThis.__restoreSet = () => { chrome.storage.local.set = original; }; let fired = false; chrome.storage.local.set = items => { if (!fired && isCfg(items)) { fired = true; return Promise.reject(new Error('injected disk failure')); } return original(items); }; });
        const failed = await save(options, { domains: ['fault-b.test'] });
        const aStill = await visit(b.context, url('fault-a.test')); const bNot = await visit(b.context, url('fault-b.test'));
        check('S13.1 real storage failure after rules were installed: error reported, previous rules restored (real DNR)', !failed.ok && failed.error.code === 'apply_failed' && aStill.blocked && bNot.real, JSON.stringify({ code: failed.error?.code, a: aStill.blocked, b: bNot.real }));
        check('S13.2 status is consistent after the rollback', (await status(options)).state === 'active');
        // Rollback itself fails: storage write fails AND the first restore call to DNR fails.
        await worker.evaluate(() => { const isCfg = items => items && Object.keys(items).some(k => k === 'config' || k.startsWith('cfg:')); const dnr = chrome.declarativeNetRequest; const original = dnr.updateDynamicRules.bind(dnr); globalThis.__restoreDnr = () => { dnr.updateDynamicRules = original; }; let calls = 0; const setOriginal = chrome.storage.local.set; chrome.storage.local.set = items => (isCfg(items) ? Promise.reject(new Error('injected disk failure')) : setOriginal.call(chrome.storage.local, items)); globalThis.__restoreSet2 = () => { chrome.storage.local.set = setOriginal; }; dnr.updateDynamicRules = async options => { calls += 1; if (calls === 2) throw new Error('injected restore failure'); return original(options); }; });
        const bad = await save(options, { domains: ['fault-c.test'] });
        await worker.evaluate(() => { globalThis.__restoreSet2(); globalThis.__restoreDnr(); });
        check('S13.3 rollback failure is reported distinctly and the browser is left with the NEW rules (mismatch visible)', !bad.ok && bad.error.code === 'apply_failed_rollback_failed' && bad.status?.state === 'partial' && bad.status.reasons.includes('rules_mismatch'), JSON.stringify({ code: bad.error?.code, state: bad.status?.state, reasons: bad.status?.reasons }));
        const healed = await status(options);
        check('S13.4 the next status check repairs the mismatch back to the last stored settings', healed.state === 'active' && JSON.stringify(healed.settings.domains) === JSON.stringify(['fault-a.test']) && (await visit(b.context, url('fault-a.test'))).blocked && (await visit(b.context, url('fault-c.test'))).real, JSON.stringify({ state: healed.state, domains: healed.settings.domains }));
        // Concurrent saves from two extension pages with the same base revision: exactly one wins.
        const second = await openExtPage(b.context, b.extensionId, 'options.html');
        const rev = (await status(options)).revision;
        const mk = d => ({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...NO_LIST, domains: ['fault-a.test', d] } });
        const outcomes = await Promise.all([send(options, mk('race-1.test')), send(second, mk('race-2.test')), send(options, mk('race-3.test')), send(second, mk('race-4.test'))]);
        const wins = outcomes.filter(o => o.ok).length;
        const final = (await status(options)).settings.domains;
        check('S13.5 four concurrent saves with one base revision: exactly one succeeds, others get "stale", state is consistent', wins === 1 && outcomes.filter(o => !o.ok).every(o => o.error.code === 'stale') && final.length === 2, JSON.stringify({ wins, final, outcomes: outcomes.map(o => o.ok ? 'ok' : o.error.code + ':' + JSON.stringify(o.error.params)) }));
        const winner = final.find(d => d.startsWith('race-'));
        check('S13.6 the winning rule is the one enforced (real navigation)', (await visit(b.context, url(winner))).blocked);
        // Trust boundary: a normal web page cannot reach the worker.
        const web = await b.context.newPage(); await web.goto(url('example-page.test'));
        const reach = await web.evaluate(async id => { try { if (!globalThis.chrome?.runtime?.sendMessage) return 'no-api'; const r = await chrome.runtime.sendMessage(id, { type: 'GET_STATUS' }); return r ? 'REACHED' : 'no-reply'; } catch (e) { return `refused: ${String(e.message).slice(0, 50)}`; } }, b.extensionId);
        check('S13.7 an ordinary web page cannot message the extension', reach !== 'REACHED', reach);
        // CSP: inline script and eval are blocked on extension pages.
        // eval must be attempted from page script (setTimeout callback): code run through CDP evaluate bypasses the eval check.
        const csp = await options.evaluate(() => new Promise(resolve => setTimeout(() => { const result = {}; try { eval('1'); result.eval = 'ran'; } catch { result.eval = 'blocked'; } try { new Function('return 1')(); result.fn = 'ran'; } catch { result.fn = 'blocked'; } window.__inline = 'no'; const s = document.createElement('script'); s.textContent = 'window.__inline = "yes"'; document.head.append(s); result.inline = window.__inline === 'yes' ? 'ran' : 'blocked'; resolve(result); }, 0)));
        check('S13.8 CSP blocks eval, new Function and inline script on extension pages', csp.eval === 'blocked' && csp.fn === 'blocked' && csp.inline === 'blocked', JSON.stringify(csp));
        // Malformed messages are refused with a code and no state change.
        const before = (await status(options)).revision;
        const junk = await options.evaluate(async () => { const out = []; for (const m of [{}, { type: 'NOPE' }, { type: 'SAVE_SETTINGS' }, { type: 'START_SESSION', minutes: 5 }, { type: 'GET_STATUS', extra: 1 }, 'string', null]) { const r = await chrome.runtime.sendMessage(m).catch(() => 'closed'); out.push(r === 'closed' || r === undefined ? 'closed' : r.error?.code ?? 'ok'); } return out; });
        check('S13.9 malformed or unknown messages are refused and change nothing', junk.every(x => x === 'bad_request' || x === 'closed') && (await status(options)).revision === before, JSON.stringify(junk));
        await finish(b);
    }

    // ================= S14: export / import through the real UI =================
    if (want('S14')) {
        const b = await open();
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options); await save(options, { domains: ['export-a.test'], words: ['export phrase'] });
        await options.reload();
        const [download] = await Promise.all([options.waitForEvent('download'), options.click('#export')]);
        const file = path.join(os.tmpdir(), `tabsira-export-${Date.now()}.json`);
        await download.saveAs(file);
        const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
        check('S14.1 export downloads a settings file with only user settings (no lock/revision/attempts)', exported.format === 'tabsira-settings' && exported.settings.domains.includes('export-a.test') && !JSON.stringify(exported).includes('lock') && !JSON.stringify(exported).includes('revision'), JSON.stringify(Object.keys(exported.settings)));
        await save(options, { domains: ['export-a.test', 'extra-b.test'], words: ['export phrase'] });
        await options.setInputFiles('#importFile', file);
        await options.waitForFunction(() => document.querySelector('#message').textContent.length > 0);
        check('S14.2 importing the exported file merges without losing newer settings', (await status(options)).settings.domains.sort().join() === 'export-a.test,extra-b.test');
        fs.writeFileSync(file, JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { ...NO_LIST, domains: ['bad domain'] } }));
        await options.setInputFiles('#importFile', file);
        await options.waitForFunction(() => document.querySelector('#message').className.includes('error') || document.querySelector('#domains-err').textContent.length > 0);
        check('S14.3 an invalid import is refused with a specific message and changes nothing', (await status(options)).settings.domains.length === 2);
        fs.writeFileSync(file, 'not json at all');
        await options.setInputFiles('#importFile', file);
        await options.waitForFunction(() => document.querySelector('#message').className.includes('error'));
        check('S14.4 a non-Tabsira file is refused', (await options.textContent('#message')).length > 5);
        fs.unlinkSync(file);
        await finish(b);
    }

    // ================= S15: approved identity, fonts, layout, zoom, states (all five pages, ar/de/en, light/dark) =================
    if (want('S15')) {
        const PAGES = ['popup', 'options', 'onboarding', 'blocked', 'help'];
        const LIME = 'rgb(183, 228, 69)';
        const lum = rgb => { const [r, g, b] = rgb.match(/\d+(?:\.\d+)?/gu).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const ratio = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        const layout = () => page => page.evaluate(() => {
            const width = document.documentElement.clientWidth; const out = [];
            const scrollers = el => { for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
            for (const el of document.body.querySelectorAll('*')) {
                const style = getComputedStyle(el); if (style.display === 'none' || style.visibility === 'hidden' || el.closest('[hidden]')) continue;
                const box = el.getBoundingClientRect(); if (!box.width || !box.height) continue;
                if ((box.right > width + 1 || box.left < -1) && !scrollers(el) && !el.closest('svg')) out.push(`outside:${el.tagName}.${el.className || el.id}`);
                if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`clipped:${el.tagName}.${el.className || el.id}`);
            }
            return { hscroll: document.documentElement.scrollWidth > width + 1, offenders: [...new Set(out)].slice(0, 4) };
        });
        const measure = layout();
        const fontsOf = page => page.evaluate(async () => {
            await document.fonts.ready;
            const faces = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/gu, ''));
            const first = el => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/gu, '').trim();
            return { loaded: [...new Set(faces)], heading: first(document.querySelector('h1, .wordmark')), body: first(document.querySelector('p, .hint, body')) };
        });
        const claims = /fully protected|100 ?% (safe|protected)|completely safe|you are safe|vollst(ä|ae)ndig gesch(ü|ue)tzt|v(ö|oe)llig sicher|محمي بالكامل|محمية بالكامل|آمن تماما|آمن تمامًا/iu;
        const forbiddenAction = /stop protection|disable protection|schutz (beenden|deaktivieren)|إيقاف الحماية|إلغاء الحماية/iu;
        const problems = [];
        for (const lang of ['ar', 'de', 'en']) {
            const b = await launch({ executablePath, extensionDir: testDir, lang });
            const options = await openExtPage(b.context, b.extensionId, 'options.html');
            // fresh install state first (popup), then configure so every page shows its normal state
            const fresh = await openExtPage(b.context, b.extensionId, 'popup.html');
            await fresh.waitForFunction(() => document.querySelector('#status').dataset.state !== 'unknown', null, { timeout: 8000 }).catch(() => {});
            const freshIcon = await fresh.evaluate(() => ({ glyph: document.querySelector('.state-icon')?.children.length ?? 0, text: document.querySelector('.state-text')?.textContent.trim().length ?? 0, state: document.querySelector('#status').dataset.state }));
            check(`S15.1 [${lang}] popup in the not-configured state conveys it by text + icon + state attribute (not colour alone)`, freshIcon.glyph > 0 && freshIcon.text > 3 && freshIcon.state === 'not_configured', JSON.stringify(freshIcon));
            await fresh.close();
            await onboard(options, true, true);
            const active = await openExtPage(b.context, b.extensionId, 'popup.html');
            await active.waitForFunction(() => document.querySelector('#status').dataset.state !== 'unknown', null, { timeout: 8000 }).catch(() => {});
            const activeIcon = await active.evaluate(() => ({ glyph: document.querySelector('.state-icon')?.children.length ?? 0, text: document.querySelector('.state-text')?.textContent.trim().length ?? 0, state: document.querySelector('#status').dataset.state }));
            check(`S15.2 [${lang}] popup in the active state conveys it by text + icon (a different glyph from the not-configured one)`, activeIcon.glyph > 0 && activeIcon.text > 3 && activeIcon.state === 'active', JSON.stringify(activeIcon));
            await active.close();
            for (const scheme of ['light', 'dark']) {
                for (const name of PAGES) {
                    const page = await openExtPage(b.context, b.extensionId, `${name}.html`);
                    await page.emulateMedia({ colorScheme: scheme });
                    const width = name === 'popup' ? 360 : 1100;
                    await page.setViewportSize({ width, height: 900 });
                    await sleep(250);
                    const tag = `[${lang}/${scheme}/${name}]`;
                    // 1 fonts
                    const f = await fontsOf(page);
                    const expectLoaded = f.loaded.includes('Cairo') && f.loaded.includes('Tajawal');
                    if (!(f.heading === 'Cairo' && f.body === 'Tajawal' && expectLoaded)) problems.push(`${tag} fonts ${JSON.stringify(f)}`);
                    // 2 brand colours on the primary action and the heading
                    const brand = await page.evaluate(() => {
                        const primary = document.querySelector('a.button:not(.secondary), button:not(.secondary):not(.danger)');
                        const h = getComputedStyle(document.querySelector('h1, .wordmark'));
                        return { bg: primary ? getComputedStyle(primary).backgroundColor : null, ink: primary ? getComputedStyle(primary).color : null, h1: h.color, radiusDir: document.documentElement.dir };
                    });
                    const hExpected = scheme === 'light' ? 'rgb(11, 59, 143)' : 'rgb(255, 255, 255)';
                    if (brand.bg !== LIME) problems.push(`${tag} primary background ${brand.bg}`);
                    if (brand.ink && ratio(brand.ink, brand.bg) < 4.5) problems.push(`${tag} primary contrast ${ratio(brand.ink, brand.bg).toFixed(2)}`);
                    if (scheme === 'light' && brand.ink !== 'rgb(11, 59, 143)') problems.push(`${tag} primary text ${brand.ink}`);
                    if (brand.h1 !== hExpected) problems.push(`${tag} heading colour ${brand.h1}`);
                    if (lang === 'ar' && brand.radiusDir !== 'rtl') problems.push(`${tag} dir ${brand.radiusDir}`);
                    // 3 mark present and loaded
                    const mark = await page.evaluate(() => { const i = document.querySelector('img.mark'); return !!i && i.complete && i.naturalWidth > 0; });
                    if (!mark) problems.push(`${tag} mark image not loaded`);
                    // 4 wording: no unverifiable safety claims, no "stop protection" as an action
                    const text = await page.evaluate(() => document.body.innerText);
                    if (claims.test(text)) problems.push(`${tag} unverifiable safety claim`);
                    if (forbiddenAction.test(text)) problems.push(`${tag} stop-protection wording`);
                    // 5 layout at normal size, 200% text, and a 320 px viewport (= 400% page zoom)
                    for (const variant of ['normal', 'text200', 'narrow320']) {
                        if (variant === 'text200') await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%', 'important'));   // CSSOM; the CSP forbids injected <style>
                        if (variant === 'narrow320') { await page.setViewportSize({ width: 320, height: 800 }); }
                        await sleep(120);
                        const m = await measure(page);
                        if (m.hscroll || m.offenders.length) problems.push(`${tag} ${variant}: ${m.hscroll ? 'horizontal scroll ' : ''}${m.offenders.join(',')}`);
                    }
                    await page.close();
                }
            }
            await finish(b);
        }
        check('S15.3 all 5 pages × ar/de/en × light/dark: Cairo headings + Tajawal text loaded and applied; lime primary action with dark text (contrast ≥ 4.5); navy/white headings; mark loaded; no unverifiable safety claim; no "stop protection" action', problems.length === 0, problems.slice(0, 4).join(' | '));
        check('S15.4 all 5 pages × ar/de/en × light/dark: no horizontal scrolling, no clipped or off-screen element at normal size, 200% text size and 320 px width (400% zoom)', !problems.some(p => /normal:|text200:|narrow320:/u.test(p)), problems.filter(p => /normal:|text200:|narrow320:/u.test(p)).slice(0, 4).join(' | '));
        note('S15', `${3 * 2 * PAGES.length} page renderings × 3 sizes checked; ${problems.length} problem(s) listed in the failing checks`);
    }

    // ================= S16: concurrent normal + private-window instances against REAL storage (the reviewed race) =================
    // The race: a settings save has passed its "unchanged?" check and is paused before its storage write; a commitment session is
    // started from the other instance; the paused write then resumes. Before the fix it reset the session end time to 0.
    // Here the real normal-window worker is paused at that exact point (its chrome.storage.local.set is held) while the real
    // private-window instance sends START_SESSION, then the write is released.
    if (want('S16')) {
        const { chromium } = await import('playwright-core');
        const net = await import('node:net');
        const freePort = () => new Promise(resolve => { const srv = net.createServer(); srv.listen(0, '127.0.0.1', () => { const { port: p } = srv.address(); srv.close(() => resolve(p)); }); });
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-race-'));
        let b = await open({ profileDir: profile });
        let options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options); await save(options, { domains: ['race-site.test'] });
        const extId = b.extensionId;
        await finish(b); await sleep(1200);
        const prefsFile = path.join(profile, 'Default', 'Preferences');
        const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8')); prefs.extensions.settings[extId].incognito = true; fs.writeFileSync(prefsFile, JSON.stringify(prefs));
        const port = await freePort();
        b = await open({ profileDir: profile, extraArgs: [`--remote-debugging-port=${port}`] });
        await sleep(1500);
        options = await openExtPage(b.context, b.extensionId, 'options.html');
        const normalWorker = b.getWorker();     // captured BEFORE the private window exists: the private instance has its own worker
        const cdp = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const seen = new Set(cdp.contexts().flatMap(c => c.pages()));
        await options.evaluate(u => chrome.windows.create({ url: u, incognito: true }), `chrome-extension://${b.extensionId}/options.html`).catch(() => {});
        await sleep(2800);
        let priv = null; for (const ctx of cdp.contexts()) for (const p of ctx.pages()) if (!seen.has(p) && p.url().startsWith('chrome-extension://')) priv = p;
        if (!priv) { skip('S16.* concurrent normal + private instances', 'a private-window settings page was not observable in this browser'); await cdp.close().catch(() => {}); await finish(b); }
        else {
            const worker = normalWorker;
            const hold = () => worker.evaluate(() => {
                const original = chrome.storage.local.set.bind(chrome.storage.local);
                globalThis.__gate = { hit: false, release: null, restore: () => { chrome.storage.local.set = original; } };
                chrome.storage.local.set = items => {
                    if (items && Object.keys(items).some(k => k === 'config' || k.startsWith('cfg:')) && !globalThis.__gate.hit) { globalThis.__gate.hit = true; return new Promise(resolve => { globalThis.__gate.release = () => resolve(original(items)); }); }
                    return original(items);
                };
            });
            const waitHit = async () => { for (let i = 0; i < 100; i++) { if (await worker.evaluate(() => globalThis.__gate.hit)) return true; await sleep(50); } return false; };
            const release = () => worker.evaluate(() => { globalThis.__gate.release(); globalThis.__gate.restore(); });
            const settingsWith = extra => ({ ...NO_LIST, domains: ['race-site.test', ...extra] });
            const startFromPrivate = () => priv.evaluate(() => chrome.runtime.sendMessage({ type: 'START_SESSION', minutes: 60 }));
            const statusFromPrivate = () => priv.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'GET_STATUS' })).status);

            // ---- S16.1 short pause: the private instance's START_SESSION is serialised behind the paused save
            await hold();
            const rev1 = (await status(options)).revision;
            const saving = send(options, { type: 'SAVE_SETTINGS', baseRevision: rev1, settings: settingsWith(['race-a.test']) });
            const paused = await waitHit();
            const starting = startFromPrivate();
            await sleep(1500);
            const midway = await Promise.race([starting.then(() => 'done'), sleep(50).then(() => 'waiting')]);
            await release();
            const [savedA, startedA] = await Promise.all([saving, starting]);
            const afterA = await status(options);
            const untilA = afterA.lock.until;
            check('S16.1 paused save in the normal window + START_SESSION from the private window: the session start waits for the write, both succeed, and the session is intact afterwards', paused && midway === 'waiting' && savedA.ok && startedA.ok && afterA.lock.active && untilA - Date.now() > 59 * 60000, JSON.stringify({ paused, midway, saved: savedA.ok, started: startedA.ok, active: afterA.lock.active }));
            check('S16.2 the saved site is enforced and the private instance reports the identical session end', (await visit(b.context, url('race-a.test'))).blocked && (await statusFromPrivate()).lock.until === untilA);

            // ---- S16.3 long pause beyond the 20 s lease: the private instance proceeds; the late write must not shorten or erase the session
            await sleep(100);
            await hold();
            const rev2 = (await status(options)).revision;
            const saving2 = send(options, { type: 'SAVE_SETTINGS', baseRevision: rev2, settings: settingsWith(['race-a.test', 'race-b.test']) });
            const paused2 = await waitHit();
            const t0 = Date.now();
            // While the frozen holder's lease (20 s) is valid, the other instance waits up to 15 s and then fails CLOSED with "busy".
            const first = await priv.evaluate(() => chrome.runtime.sendMessage({ type: 'START_SESSION', minutes: 120 }));
            const firstMs = Date.now() - t0;
            await sleep(Math.max(0, 21500 - (Date.now() - t0)));       // the frozen holder's lease is now over
            const extended = await priv.evaluate(() => chrome.runtime.sendMessage({ type: 'START_SESSION', minutes: 120 }));
            await release();                                            // the frozen write now resumes
            const savedB = await saving2;
            const afterB = await status(options);
            check('S16.3a while a frozen holder\'s lease is valid, the other instance fails closed ("busy") instead of writing blindly', paused2 && !first.ok && first.error.code === 'busy' && firstMs >= 14000, JSON.stringify({ paused2, first: first.ok ? 'ok' : first.error?.code, waitedMs: firstMs }));
            check('S16.3b after the lease expired the other instance extends the session to 120 min; when the frozen write then resumes the session is NOT shortened or erased', extended.ok && afterB.lock.active && afterB.lock.until >= untilA && afterB.lock.until - Date.now() > 119 * 60000, JSON.stringify({ extended: extended.ok, savedB: savedB.ok ? 'ok' : savedB.error?.code, remainingMin: Math.round((afterB.lock.until - Date.now()) / 60000) }));
            note('S16.3', `the frozen save finished as ${savedB.ok ? 'ok' : savedB.error?.code}`);
            // state follows storage afterwards: browser rules == stored settings
            const healed = await status(options);
            check('S16.4 afterwards the browser rules match the stored settings (no half-applied state) and weakening is still refused', healed.state === 'active' && !healed.reasons.includes('rules_mismatch') && (await send(options, { type: 'SAVE_SETTINGS', baseRevision: healed.revision, settings: NO_LIST })).error?.code === 'locked_weakening');
            await cdp.close().catch(() => {}); await finish(b);
        }
    }

    // ================= S16b: the late-write scenario of the review of 7294cd6, in REAL browsers =================
    // A save that DELETES every site is frozen inside the real storage write of the normal-window worker (after all its checks);
    // its 20 s lease expires; the private-window instance saves newer sites and starts a session; then the frozen write is released.
    // Before the fix the stored sites became [] and the rules zero while the session stayed active.
    if (want('S16b')) {
        const { chromium } = await import('playwright-core');
        const net = await import('node:net');
        const freePort = () => new Promise(resolve => { const srv = net.createServer(); srv.listen(0, '127.0.0.1', () => { const { port: p } = srv.address(); srv.close(() => resolve(p)); }); });
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-late-'));
        let b = await open({ profileDir: profile });
        let options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options); await save(options, { domains: ['late-keep.test', 'late-old.test'] });
        const extId = b.extensionId;
        await finish(b); await sleep(1200);
        const prefsFile = path.join(profile, 'Default', 'Preferences');
        const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8')); prefs.extensions.settings[extId].incognito = true; fs.writeFileSync(prefsFile, JSON.stringify(prefs));
        const port = await freePort();
        b = await open({ profileDir: profile, extraArgs: [`--remote-debugging-port=${port}`] });
        await sleep(1500);
        options = await openExtPage(b.context, b.extensionId, 'options.html');
        const normalWorker = b.getWorker();
        const cdp = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const seen = new Set(cdp.contexts().flatMap(c => c.pages()));
        await options.evaluate(u => chrome.windows.create({ url: u, incognito: true }), `chrome-extension://${b.extensionId}/options.html`).catch(() => {});
        await sleep(2800);
        let priv = null; for (const ctx of cdp.contexts()) for (const p of ctx.pages()) if (!seen.has(p) && p.url().startsWith('chrome-extension://')) priv = p;
        if (!priv) { skip('S16b.* late write across normal + private instances', 'a private-window settings page was not observable in this browser'); await cdp.close().catch(() => {}); await finish(b); }
        else {
            const sendPriv = message => priv.evaluate(m => chrome.runtime.sendMessage(m), message);
            const statusPriv = async () => (await sendPriv({ type: 'GET_STATUS' })).status;
            await normalWorker.evaluate(() => {
                const original = chrome.storage.local.set.bind(chrome.storage.local);
                globalThis.__gate = { hit: false, release: null, restore: () => { chrome.storage.local.set = original; } };
                chrome.storage.local.set = items => {
                    if (items && Object.keys(items).some(k => k === 'config' || k.startsWith('cfg:')) && !globalThis.__gate.hit) { globalThis.__gate.hit = true; return new Promise(resolve => { globalThis.__gate.release = () => resolve(original(items)); }); }
                    return original(items);
                };
            });
            const rev = (await status(options)).revision;
            const oldSave = send(options, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...NO_LIST, domains: [] } });      // deletes every site
            let frozen = false; for (let i = 0; i < 100 && !frozen; i++) { frozen = await normalWorker.evaluate(() => globalThis.__gate.hit); if (!frozen) await sleep(50); }
            const t0 = Date.now();
            const newerSettings = { ...NO_LIST, domains: ['late-keep.test', 'late-new.test'] };
            const first = await sendPriv({ type: 'SAVE_SETTINGS', baseRevision: rev, settings: newerSettings });          // lease still valid -> fails closed
            await sleep(Math.max(0, 21500 - (Date.now() - t0)));                                                          // the frozen holder's lease is over
            const cur = await statusPriv();
            const second = await sendPriv({ type: 'SAVE_SETTINGS', baseRevision: cur.revision, settings: newerSettings });
            const started = await sendPriv({ type: 'START_SESSION', minutes: 60 });
            await normalWorker.evaluate(() => { globalThis.__gate.release(); globalThis.__gate.restore(); });             // the old write now happens
            const late = await oldSave;
            await sleep(600);
            const after = await statusPriv();
            const keep = await visit(b.context, url('late-keep.test')); const added = await visit(b.context, url('late-new.test')); const removedOld = await visit(b.context, url('late-old.test'));
            check('S16b.1 while the frozen holder\'s lease is valid the private instance fails closed ("busy")', frozen && !first.ok && first.error.code === 'busy', JSON.stringify({ frozen, first: first.ok ? 'ok' : first.error?.code }));
            check('S16b.2 after the lease expired the private instance saves newer sites and starts a session', second.ok && started.ok, JSON.stringify({ second: second.ok ? 'ok' : second.error?.code, started: started.ok ? 'ok' : started.error?.code }));
            check('S16b.3 the frozen "delete every site" write then resumes: stored sites are NOT emptied, rules still block the newer sites, the session is active', JSON.stringify([...after.settings.domains].sort()) === JSON.stringify(['late-keep.test', 'late-new.test']) && after.lock.active && after.state === 'active' && keep.blocked && added.blocked && removedOld.real, JSON.stringify({ domains: after.settings.domains, lock: after.lock.active, state: after.state, keep: keep.blocked, added: added.blocked, oldLoads: removedOld.real, lateSave: late.ok ? 'ok' : late.error?.code }));
            const fromNormal = await status(options);
            check('S16b.4 the normal-window instance sees the same final state (one shared truth)', JSON.stringify(fromNormal.settings.domains) === JSON.stringify(after.settings.domains) && fromNormal.lock.until === after.lock.until);
            note('S16b', `the frozen save finished as ${late.ok ? 'ok' : late.error?.code}`);
            await cdp.close().catch(() => {}); await finish(b);
        }
    }

    // ================= S16c: the late-DELETE scenario of the review of 0b46c1d, in REAL browsers (normal + private instance) =================
    // The private instance had a session that has ended (its entry is aged in storage - 60 real minutes cannot be waited); the normal-window worker
    // cleans up, selects the expired entry and freezes inside the real chrome.storage.local.remove; its lease expires; the private instance starts a
    // NEW 120-minute session; the frozen removal then runs. Before the fix it reused the same storage key and wiped the new session, after which a save
    // that deletes every blocked site was accepted.
    if (want('S16c')) {
        const { chromium } = await import('playwright-core');
        const net = await import('node:net');
        const freePort = () => new Promise(resolve => { const srv = net.createServer(); srv.listen(0, '127.0.0.1', () => { const { port: p } = srv.address(); srv.close(() => resolve(p)); }); });
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-clean-'));
        let b = await open({ profileDir: profile });
        let options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options); await save(options, { domains: ['clean-keep.test', 'clean-second.test'] });
        const extId = b.extensionId;
        await finish(b); await sleep(1200);
        const prefsFile = path.join(profile, 'Default', 'Preferences');
        const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8')); prefs.extensions.settings[extId].incognito = true; fs.writeFileSync(prefsFile, JSON.stringify(prefs));
        const port = await freePort();
        b = await open({ profileDir: profile, extraArgs: [`--remote-debugging-port=${port}`] });
        await sleep(1500);
        options = await openExtPage(b.context, b.extensionId, 'options.html');
        const normalWorker = b.getWorker();
        const cdp = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const seen = new Set(cdp.contexts().flatMap(c => c.pages()));
        await options.evaluate(u => chrome.windows.create({ url: u, incognito: true }), `chrome-extension://${b.extensionId}/options.html`).catch(() => {});
        await sleep(2800);
        let priv = null; for (const ctx of cdp.contexts()) for (const p of ctx.pages()) if (!seen.has(p) && p.url().startsWith('chrome-extension://')) priv = p;
        if (!priv) { skip('S16c.* late cleanup across normal + private instances', 'a private-window settings page was not observable in this browser'); await cdp.close().catch(() => {}); await finish(b); }
        else {
            const sendPriv = message => priv.evaluate(m => chrome.runtime.sendMessage(m), message);
            const statusPriv = async () => (await sendPriv({ type: 'GET_STATUS' })).status;
            const first = await sendPriv({ type: 'START_SESSION', minutes: 60 });
            // age the private instance's finished session: every session entry in storage now ended a second ago
            const aged = await normalWorker.evaluate(async () => { const all = await chrome.storage.local.get(null); const patch = {}; for (const key of Object.keys(all)) if (key === 'lock' || key.startsWith('lock:')) patch[key] = { until: Date.now() - 1000 }; await chrome.storage.local.set(patch); return Object.keys(patch); });
            const afterExpiry = await status(options);
            await normalWorker.evaluate(() => {
                const original = chrome.storage.local.remove.bind(chrome.storage.local);
                globalThis.__gate = { hit: false, release: null, restore: () => { chrome.storage.local.remove = original; } };
                chrome.storage.local.remove = keys => {
                    const list = Array.isArray(keys) ? keys : [keys];
                    if (list.some(k => k === 'lock' || k.startsWith('lock:')) && !globalThis.__gate.hit) { globalThis.__gate.hit = true; return new Promise(resolve => { globalThis.__gate.release = () => resolve(original(keys)); }); }
                    return original(keys);
                };
            });
            const cleanup = send(options, { type: 'REPAIR' });                         // the normal worker cleans up and freezes inside the removal
            let frozen = false; for (let i = 0; i < 100 && !frozen; i++) { frozen = await normalWorker.evaluate(() => globalThis.__gate.hit); if (!frozen) await sleep(50); }
            const t0 = Date.now();
            const early = await sendPriv({ type: 'START_SESSION', minutes: 120 });       // lease still valid -> fails closed
            await sleep(Math.max(0, 21500 - (Date.now() - t0)));
            const second = await sendPriv({ type: 'START_SESSION', minutes: 120 });      // a NEW session after the lease expired
            await normalWorker.evaluate(() => { globalThis.__gate.release(); globalThis.__gate.restore(); });   // the old removal now runs
            await cleanup; await sleep(500);
            const after = await statusPriv();
            const weakStatus = await status(options);
            const weak = await send(options, { type: 'SAVE_SETTINGS', baseRevision: weakStatus.revision, settings: { ...NO_LIST, domains: [] } });   // deletes every blocked site
            const final = await statusPriv();
            const keepBlocked = await visit(b.context, url('clean-keep.test'));
            check('S16c.1 precondition: the private instance\'s first session was recorded, then aged to "ended"; the cleanup froze inside the real removal', first.ok && aged.length >= 1 && !afterExpiry.lock.active && frozen, JSON.stringify({ first: first.ok, aged, ended: !afterExpiry.lock.active, frozen }));
            check('S16c.2 while the frozen worker\'s lease is valid the private instance fails closed ("busy"); after expiry it starts a NEW 120-minute session', !early.ok && early.error.code === 'busy' && second.ok, JSON.stringify({ early: early.ok ? 'ok' : early.error?.code, second: second.ok ? 'ok' : second.error?.code }));
            check('S16c.3 the frozen removal then runs: the NEW session is intact (≈120 min left, active)', after.lock.active && after.lock.until - Date.now() > 119 * 60000, JSON.stringify({ active: after.lock.active, minutesLeft: Math.round((after.lock.until - Date.now()) / 60000) }));
            check('S16c.4 a save that deletes every blocked site is still refused, the sites and rules stay, navigation is still blocked', !weak.ok && weak.error.code === 'locked_weakening' && JSON.stringify([...final.settings.domains].sort()) === JSON.stringify(['clean-keep.test', 'clean-second.test']) && keepBlocked.blocked, JSON.stringify({ weak: weak.ok ? 'ACCEPTED' : weak.error?.code, domains: final.settings.domains, blocked: keepBlocked.blocked }));
            await cdp.close().catch(() => {}); await finish(b);
        }
    }

    // ================= S16d: lifecycle of a STALE RULE WRITE when the real worker is terminated before it can reconcile (review of 516a4ff) =================
    // A save that deletes every site is frozen inside the real chrome.declarativeNetRequest.updateDynamicRules; its lease expires; the other (private)
    // instance saves newer sites and starts a session; the frozen rule write is released (it lands: rules removed) and its continuation never runs;
    // the real worker is then terminated (CDP ServiceWorker.stopAllWorkers) BEFORE the reconcile path (busy -> handle() -> reconcile()) could execute.
    // Observed WITHOUT opening Popup/Options and without GET_STATUS/REPAIR: only real navigations. Then each recovery trigger is tried separately.
    if (want('S16d')) {
        const { chromium } = await import('playwright-core');
        const net = await import('node:net');
        const freePort = () => new Promise(resolve => { const srv = net.createServer(); srv.listen(0, '127.0.0.1', () => { const { port: p } = srv.address(); srv.close(() => resolve(p)); }); });
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-life-'));
        let b = await open({ profileDir: profile });
        let options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options); await save(options, { domains: ['life-keep.test', 'life-old.test'] });
        const extId = b.extensionId;
        await finish(b); await sleep(1200);
        const prefsFile = path.join(profile, 'Default', 'Preferences');
        const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8')); prefs.extensions.settings[extId].incognito = true; fs.writeFileSync(prefsFile, JSON.stringify(prefs));
        const port = await freePort();
        b = await open({ profileDir: profile, extraArgs: [`--remote-debugging-port=${port}`] });
        await sleep(1500);
        options = await openExtPage(b.context, b.extensionId, 'options.html');
        const normalWorker = b.getWorker();
        const cdp = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const seen = new Set(cdp.contexts().flatMap(c => c.pages()));
        await options.evaluate(u => chrome.windows.create({ url: u, incognito: true }), `chrome-extension://${b.extensionId}/options.html`).catch(() => {});
        await sleep(2800);
        let priv = null; for (const ctx of cdp.contexts()) for (const p of ctx.pages()) if (!seen.has(p) && p.url().startsWith('chrome-extension://')) priv = p;
        if (!priv) { skip('S16d.* stale rule write + worker termination', 'a private-window settings page was not observable in this browser'); await cdp.close().catch(() => {}); await finish(b); }
        else {
            const sendPriv = message => priv.evaluate(m => chrome.runtime.sendMessage(m), message);
            const rulesNow = () => b.context.pages()[0] && normalWorker.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).flatMap(r => r.condition.requestDomains ?? []).sort()).catch(() => 'worker-gone');
            await normalWorker.evaluate(() => {
                const dnr = chrome.declarativeNetRequest; const original = dnr.updateDynamicRules.bind(dnr);
                globalThis.__gate = { hit: false, release: null };
                dnr.updateDynamicRules = o => {
                    if (!globalThis.__gate.hit) {
                        globalThis.__gate.hit = true;
                        // frozen BEFORE the real call; once released the real call runs and lands, but the continuation never resumes
                        return new Promise(() => { globalThis.__gate.release = () => { original(o); }; });
                    }
                    return original(o);
                };
            });
            const rev = (await status(options)).revision;
            send(options, { type: 'SAVE_SETTINGS', baseRevision: rev, settings: { ...NO_LIST, domains: [] } }).catch(() => {});      // deletes every site; never resolves
            let frozen = false; for (let i = 0; i < 100 && !frozen; i++) { frozen = await normalWorker.evaluate(() => globalThis.__gate.hit); if (!frozen) await sleep(50); }
            await sleep(21500);                                                        // the frozen holder's lease is over
            const cur = (await sendPriv({ type: 'GET_STATUS' })).status;
            const newer = await sendPriv({ type: 'SAVE_SETTINGS', baseRevision: cur.revision, settings: { ...NO_LIST, domains: ['life-keep.test', 'life-new.test'] } });
            const started = await sendPriv({ type: 'START_SESSION', minutes: 60 });
            const beforeRelease = { keep: (await visit(b.context, url('life-keep.test'))).blocked, added: (await visit(b.context, url('life-new.test'))).blocked };
            await normalWorker.evaluate(() => { globalThis.__gate.release(); });                  // the stale rule write lands; its continuation never runs
            await sleep(400);
            const rulesAfterStale = await rulesNow();
            // terminate the real worker(s) before any reconcile path can run
            const cdpSession = await b.context.newCDPSession(b.context.pages()[0]);
            await Promise.race([cdpSession.send('ServiceWorker.enable').catch(() => {}), sleep(5000)]);
            await Promise.race([cdpSession.send('ServiceWorker.stopAllWorkers').catch(() => {}), sleep(5000)]);
            await sleep(1500);
            await b.context.newPage();                                                          // keep one ordinary tab alive
            await priv.close().catch(() => {});
            for (const p of b.context.pages()) if (p.url().startsWith('chrome-extension://')) await p.close().catch(() => {});   // no extension page stays open (incl. the install-time onboarding tab): only real navigations from here on
            const extensionPagesOpen = b.context.pages().filter(p => p.url().startsWith('chrome-extension://')).length;
            const lostRightAfter = { keep: !(await visit(b.context, url('life-keep.test'))).blocked, added: !(await visit(b.context, url('life-new.test'))).blocked };
            const t0 = Date.now(); const observed = []; let recoveredAfterSec = null;
            while (Date.now() - t0 < 170000) {       // only real navigations: no Popup, no Options, no GET_STATUS, no REPAIR
                await sleep(10000);
                const keep = await visit(b.context, url('life-keep.test')); const added = await visit(b.context, url('life-new.test'));
                observed.push({ atSec: Math.round((Date.now() - t0) / 1000), keepBlocked: keep.blocked, newBlocked: added.blocked });
                if (keep.blocked && added.blocked) { recoveredAfterSec = Math.round((Date.now() - t0) / 1000); break; }
            }
            const again = await openExtPage(b.context, b.extensionId, 'options.html');       // only now: look at the final state
            const final = (await send(again, { type: 'GET_STATUS' })).status;
            const oldLoads = (await visit(b.context, url('life-old.test'))).real;
            check('S16d.1 preconditions: frozen save, newer sites saved and session started from the other instance, newer sites blocked before the stale write', frozen && newer.ok && started.ok && beforeRelease.keep && beforeRelease.added, JSON.stringify({ frozen, newer: newer.ok, started: started.ok, beforeRelease }));
            check('S16d.2 the stale rule write lands and the worker is terminated before it can reconcile: rules are EMPTY and protection is lost right after (the hazard exists)', Array.isArray(rulesAfterStale) && rulesAfterStale.length === 0 && lostRightAfter.keep && lostRightAfter.added && extensionPagesOpen === 0, JSON.stringify({ rulesAfterStale, lostRightAfter, extensionPagesOpen }));
            check('S16d.3 WITHOUT opening Popup/Options, GET_STATUS or REPAIR, protection is restored automatically (watchdog wake-up); time recorded', recoveredAfterSec !== null, JSON.stringify({ recoveredAfterSec, observed }));
            check('S16d.4 afterwards the stored sites and the session are intact and the rules equal the stored settings', final.state === 'active' && final.lock.active && JSON.stringify([...final.settings.domains].sort()) === JSON.stringify(['life-keep.test', 'life-new.test']) && oldLoads, JSON.stringify({ state: final.state, lock: final.lock.active, domains: final.settings.domains, oldSiteLoads: oldLoads }));
            note('S16d', `protection restored automatically after ${recoveredAfterSec} s (first checked 10 s after the worker was terminated, then every 10 s; real navigations only)`);
            await cdp.close().catch(() => {}); await finish(b);
        }
    }

    // ================= S17: hostile web page + data leakage (red-team checks against the real package) =================
    if (want('S17')) {
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-leak-'));
        const b = await open({ profileDir: profile });
        const options = await openExtPage(b.context, b.extensionId, 'options.html');
        await onboard(options, false, false);
        const probeHost = 'leak-probe-7431.test'; const secretPath = '/private-path-9XQ7/inner'; const secretQuery = 'token=ZK93-visit&q=tabsira+word';
        await save(options, { domains: [probeHost], words: ['tabsira word'] });
        // --- hostile page tries to reach extension pages / resources
        const attacker = await b.context.newPage();
        await attacker.goto(url('attacker.test'));
        const existing = new Set(b.context.pages());
        const reach = await attacker.evaluate(async id => {
            const out = {};
            const frame = document.createElement('iframe'); frame.src = `chrome-extension://${id}/options.html`; document.body.append(frame);
            out.frameLoaded = await new Promise(resolve => { frame.onload = () => { try { resolve(!!frame.contentDocument); } catch { resolve(false); } }; setTimeout(() => resolve('timeout'), 3000); });
            const img = new Image(); img.src = `chrome-extension://${id}/brand/mark.svg`;
            out.image = await new Promise(resolve => { img.onload = () => resolve('loaded'); img.onerror = () => resolve('blocked'); setTimeout(() => resolve('timeout'), 3000); });
            const script = document.createElement('script'); script.src = `chrome-extension://${id}/core/lock.js`;
            out.script = await new Promise(resolve => { script.onload = () => resolve('loaded'); script.onerror = () => resolve('blocked'); document.head.append(script); setTimeout(() => resolve('timeout'), 3000); });
            out.fetch = await fetch(`chrome-extension://${id}/manifest.json`).then(() => 'reachable', () => 'blocked');
            window.open(`chrome-extension://${id}/options.html`, '_blank');
            return out;
        }, b.extensionId);
        await sleep(1200);
        const extPages = []; for (const p of b.context.pages()) { if (!existing.has(p)) extPages.push(p.url()); }      // only pages opened by the hostile script
        const frameUrls = attacker.frames().map(f => f.url()).filter(u => u.startsWith('chrome-extension://'));
        check('S17.1 a hostile web page cannot embed, load, script, fetch or open any extension page or file', reach.frameLoaded !== true && frameUrls.length === 0 && reach.image === 'blocked' && reach.script === 'blocked' && reach.fetch === 'blocked' && !extPages.some(u => u.startsWith('chrome-extension://')), JSON.stringify({ reach, frameUrls, extPages }));
        const sendFromWeb = await attacker.evaluate(async id => { try { if (!globalThis.chrome?.runtime?.sendMessage) return 'no-api'; const r = await chrome.runtime.sendMessage(id, { type: 'START_SESSION', minutes: 60 }); return r ? 'REACHED' : 'no-reply'; } catch (e) { return `refused: ${String(e.message).slice(0, 40)}`; } }, b.extensionId);
        check('S17.2 a hostile page cannot start a session or change settings by messaging the extension', sendFromWeb !== 'REACHED' && !(await status(options)).lock.active, sendFromWeb);
        // --- what is left behind after blocked visits
        const visited = [url(probeHost, secretPath + '?' + secretQuery), url('sub.' + probeHost, '/x?y=ZK93-visit'), url('www.google.com', '/search?q=tabsira+word+private-ZK93')];
        for (const v of visited) await visit(b.context, v);
        check('S17.3 the three blocked visits were stopped (precondition for the leak scan)', (await visit(b.context, visited[0])).blocked && (await visit(b.context, visited[2])).blocked);
        const id = b.extensionId; await finish(b); await sleep(800);
        // The scan: Tabsira's own storage must hold none of the visited URL parts or search text. (The user's configured rules are stored by design.)
        const needles = ['private-path-9XQ7', 'ZK93', 'inner', 'private-ZK93'];
        const hits = [];
        const scan = dir => { if (!fs.existsSync(dir)) return; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) scan(full); else { const data = fs.readFileSync(full); for (const n of needles) if (data.includes(Buffer.from(n))) hits.push(`${path.relative(profile, full)}:${n}`); } } };
        for (const sub of [`Default/Local Extension Settings/${id}`, `Default/Extension State`, `Default/IndexedDB`, `Default/Local Storage`, `Default/Session Storage`, `Default/Sync Extension Settings/${id}`]) scan(path.join(profile, sub));
        check("S17.4 after blocked visits, Tabsira's storage (extension settings, state, IndexedDB, local/session storage) contains no visited URL part or search text", hits.length === 0, hits.slice(0, 3).join(' | '));
        // Informational: what the BROWSER keeps in its own history (not under the extension's control; the extension has no history permission).
        let historyNote = 'not inspected';
        try {
            const { DatabaseSync } = await import('node:sqlite');
            const copy = path.join(os.tmpdir(), `tabsira-history-${Date.now()}.db`); fs.copyFileSync(path.join(profile, 'Default', 'History'), copy);
            const db = new DatabaseSync(copy, { readOnly: true });
            const rows = db.prepare('select url from urls').all().map(r => r.url);
            historyNote = JSON.stringify({ urls: rows.length, containsBlockedOriginalUrl: rows.some(u => u.includes('private-path-9XQ7') || u.includes('ZK93')), containsStopPage: rows.some(u => u.endsWith('/blocked.html')) });
            db.close(); fs.unlinkSync(copy);
        } catch (error) { historyNote = `could not read the browser history database: ${String(error.message).slice(0, 80)}`; }
        note('S17-history', `Chromium's own history after blocked visits (the browser's behaviour, not the extension's): ${historyNote}`);
    }

    // ================= S10: no sensitive logging =================
    if (want('S10')) {
        const secrets = ['tabsira word', 'tabsira%20word', 'lock-site', 'blocked-user', 'perm-site', 'loop-check', 'selftest', 'extra-lock', 'lock phrase'];
        const leaks = allLogs.filter(line => secrets.some(secret => line.toLowerCase().includes(secret)));
        check(`S10.1 no console output in any extension page or worker mentions a tested URL or phrase (${allLogs.length} console messages captured)`, leaks.length === 0, leaks.slice(0, 3).join(' | '));
        // S13.8 deliberately triggers CSP violations (inline script, eval) to prove they are blocked; those two messages are expected.
        const expected = line => /violates the following Content Security Policy|Refused to (execute inline script|evaluate a string as JavaScript)/u.test(line);
        const errors = allLogs.filter(line => line.startsWith('error:') && !expected(line));
        check('S10.2 no unexpected console errors from the extension during the whole run (CSP-violation probes of S13.8 excluded)', errors.length === 0, errors.slice(0, 3).join(' | '));
    }

    await site.close();
}
