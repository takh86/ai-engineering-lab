import { launch, openExtPage, send, executableFor, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
let r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
r = await send(page, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { baseList: false, starterTerms: false, domains: ['blocked.example'], allow: [], words: [], contains: [] } });
console.log('baseline', r.ok, r.status.state, 'rules', r.status.counts.dynamicRules);
// precondition equivalent to "worker killed while holding the lock during a +1h clock error, clock now corrected": a mutex entry whose lease lies 1 h ahead
await page.evaluate(() => chrome.storage.local.set({ 'mx:dead-worker': { choosing: false, ticket: 1, exp: Date.now() + 3600e3 } }));
// rules removed behind the extension's back (what a late stale write would do)
await b.getWorker().evaluate(async () => { const ex = await chrome.declarativeNetRequest.getDynamicRules(); await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ex.map(x => x.id) }); });
const t0 = Date.now();
const rep = await send(page, { type: 'REPAIR' });
console.log('REPAIR ->', rep.ok, rep.error?.code, (Date.now() - t0) + ' ms', 'state', rep.status?.state, JSON.stringify(rep.status?.reasons));
const save = await send(page, { type: 'SAVE_SETTINGS', baseRevision: rep.status.revision, settings: { baseList: false, starterTerms: false, domains: ['blocked.example', 'b2.example'], allow: [], words: [], contains: [] } });
console.log('SAVE ->', save.ok, save.error?.code);
console.log('dynamic rules now:', (await b.getWorker().evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).length);
await b.context.close();
