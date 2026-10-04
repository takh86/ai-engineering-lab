import fs from 'node:fs';
import { launch, openExtPage, send, executableFor, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext3', lang: 'en' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false }); await page.reload(); await sleep(600);
// simulate the worker reporting a failed apply whose rollback also failed (real worker code path: code apply_failed_rollback_failed)
await page.evaluate(() => { const orig = chrome.runtime.sendMessage.bind(chrome.runtime); chrome.runtime.sendMessage = async m => (m.type === 'IMPORT_SETTINGS' ? { ok: false, error: { code: 'apply_failed_rollback_failed', params: {} }, status: null } : orig(m)); });
fs.writeFileSync('imp2.json', JSON.stringify({ format: 'tabsira-settings', version: 2, settings: { baseList: false, starterTerms: false, domains: ['n.example'], allow: [], words: [], contains: [] } }));
await page.setInputFiles('#importFile', 'imp2.json'); await sleep(400); await page.click('#importYes'); await sleep(400);
console.log(await page.evaluate(() => document.querySelector('#message').textContent));
await b.context.close();
