// Minimal W3C WebDriver client for geckodriver (no dependencies). Playwright cannot drive stock Firefox
// with extensions, so Firefox is exercised through geckodriver + temporary add-on install.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { sleep } from './lib.mjs';

const freePort = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

export async function startGecko({ geckodriver, firefox, profileDir, prefs, args = ['-headless'] }) {
    const port = await freePort();
    const proc = spawn(geckodriver, ['--port', String(port), '--host', '127.0.0.1', '--binary', firefox, '--allow-system-access'], { stdio: 'ignore' });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) { try { await fetch(`${base}/status`); break; } catch { await sleep(100); } }
    const call = async (method, url, body) => {
        const response = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
        const json = await response.json();
        if (!response.ok) throw new Error(`${method} ${url.replace(/\/session\/[^/]+/u, '')}: ${json.value?.error} ${String(json.value?.message).slice(0, 200)}`);
        return json.value;
    };
    const created = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'firefox', acceptInsecureCerts: true,
        'moz:firefoxOptions': { args: [...args, ...(profileDir ? ['-profile', profileDir] : [])], prefs } } } });
    const id = created.sessionId;
    const s = `/session/${id}`;
    await call('POST', `${s}/timeouts`, { pageLoad: 10000, script: 30000 });
    const driver = {
        base, sid: id,
        capabilities: created.capabilities,
        installAddon: path => call('POST', `${s}/moz/addon/install`, { path, temporary: true }),
        url: () => call('GET', `${s}/url`),
        title: () => call('GET', `${s}/title`),
        goto: url => call('POST', `${s}/url`, { url }),
        // geckodriver refuses to navigate to moz-extension:// URLs, so the tab is opened from the browser (chrome) context.
        openExtensionTab: async url => {
            await call('POST', `${s}/moz/context`, { context: 'chrome' });
            await call('POST', `${s}/execute/sync`, { script: 'const win = Services.wm.getMostRecentWindow("navigator:browser"); const tab = win.gBrowser.addTab(arguments[0], { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); win.gBrowser.selectedTab = tab; return true;', args: [url] });
            await call('POST', `${s}/moz/context`, { context: 'content' });
            await sleep(1500);
            const handles = await call('GET', `${s}/window/handles`);
            await call('POST', `${s}/window`, { handle: handles[handles.length - 1] });
        },
        handles: () => call('GET', `${s}/window/handles`),
        current: () => call('GET', `${s}/window`),
        switchTo: handle => call('POST', `${s}/window`, { handle }),
        newTab: async () => { const handle = await call('POST', `${s}/window/new`, { type: 'tab' }); await call('POST', `${s}/window`, { handle: handle.handle }); return handle.handle; },
        closeTab: async () => { await call('DELETE', `${s}/window`); const handles = await call('GET', `${s}/window/handles`); if (handles.length) await call('POST', `${s}/window`, { handle: handles[handles.length - 1] }); },
        // Runs async code inside the current page (an extension page when on moz-extension://).
        run: (code, ...args) => call('POST', `${s}/execute/async`, { script: `const done = arguments[arguments.length - 1]; (async () => { ${code} })().then(done, error => done({ __error: String(error && error.message || error) }));`, args }),
        text: async selector => { const [el] = Object.values(await call('POST', `${s}/element`, { using: 'css selector', value: selector })); return call('GET', `${s}/element/${el}/text`); },
        click: async selector => { const [el] = Object.values(await call('POST', `${s}/element`, { using: 'css selector', value: selector })); return call('POST', `${s}/element/${el}/click`, {}); },
        quit: async () => { await call('DELETE', s).catch(() => {}); proc.kill(); }
    };
    return driver;
}
