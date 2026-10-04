// Shared helpers for real-browser tests (Playwright driving an installed Chromium-family browser).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** A local server answering every Host. Pages carry a marker title so tests can tell "real site" from "blocked". */
export async function startSite() {
    const hits = [];
    const server = http.createServer((request, response) => {
        hits.push(`${request.headers.host}${request.url}`);
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(`<!doctype html><title>REAL-SITE</title><p>site ${request.headers.host}</p>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return { port: server.address().port, hits, close: () => new Promise(resolve => server.close(resolve)) };
}

export async function launch({ executablePath, extensionDir, profileDir, headless = true, extraArgs = [], lang = 'ar' }) {
    const userDataDir = profileDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
        locale: lang, env: { ...process.env, LANGUAGE: lang, LANG: `${lang}.UTF-8` },
        executablePath, headless: false, // real "new headless" mode is requested through args (supports extensions)
        args: [...(headless ? ['--headless=new'] : []), '--no-sandbox', `--lang=${lang}`, '--no-first-run', '--no-default-browser-check',
            `--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`,
            '--host-resolver-rules=MAP *.test 127.0.0.1, MAP google.com 127.0.0.1, MAP *.google.com 127.0.0.1, MAP google.de 127.0.0.1, MAP *.google.de 127.0.0.1, MAP google.com.eg 127.0.0.1, MAP *.google.com.eg 127.0.0.1, MAP bing.com 127.0.0.1, MAP *.bing.com 127.0.0.1, MAP duckduckgo.com 127.0.0.1, MAP *.yahoo.com 127.0.0.1, MAP youtube.com 127.0.0.1, MAP www.youtube.com 127.0.0.1, MAP *.evil.example 127.0.0.1, MAP *.example 127.0.0.1',
            ...extraArgs]
    });
    let worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 60000 });
    const extensionId = new URL(worker.url()).host;
    // The worker's extension bindings appear slightly after the worker object does.
    for (let i = 0; i < 100; i++) {
        if (await worker.evaluate(() => typeof chrome?.runtime?.id === 'string' && !!chrome.declarativeNetRequest).catch(() => false)) break;
        await sleep(100);
    }
    // Only the extension's own pages and worker are monitored; test web pages may legitimately log errors.
    const evidence = { logs: [] };
    const watch = page => page.on('console', message => { if (page.url().startsWith('chrome-extension://')) evidence.logs.push(`${message.type()}: ${message.text()}`); });
    context.on('page', watch);
    const watchWorker = w => w.on('console', message => evidence.logs.push(`${message.type()}: ${message.text()}`));
    watchWorker(worker);
    context.on('serviceworker', w => { worker = w; watchWorker(w); });
    return { context, userDataDir, extensionId, getWorker: () => worker, evidence, version: () => context.browser()?.version?.() ?? 'unknown' };
}

/** Navigates and reports what the user would see. */
export async function visit(context, url) {
    const page = await context.newPage();
    const chain = [];
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) chain.push(frame.url()); });
    let error = null;
    try { await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' }); } catch (caught) { error = caught.message.split('\n')[0]; }
    await sleep(150);
    const result = { url: page.url(), title: await page.title().catch(() => ''), chain, error };
    result.blocked = result.url.includes('/blocked.html');
    result.real = result.title === 'REAL-SITE';
    await page.close();
    return result;
}

export const send = (page, message) => page.evaluate(m => chrome.runtime.sendMessage(m), message);

/** Status via an extension page (trusted sender), as the real UI does. */
export async function openExtPage(context, extensionId, name) {
    // After a reload/update the extension can be unavailable for a moment (ERR_BLOCKED_BY_CLIENT).
    for (let attempt = 0; ; attempt++) {
        const page = await context.newPage();
        try { await page.goto(`chrome-extension://${extensionId}/${name}`); return page; }
        catch (error) { await page.close().catch(() => {}); if (attempt >= 40) throw error; await sleep(500); }
    }
}

export const executableFor = name => ({
    chromium: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    edge: process.env.EDGE,
    chrome: process.env.CHROME   // official Google build (Chrome for Testing or branded Chrome) - never labelled as Chromium
}[name]);
