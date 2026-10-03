// C-7: baseRevision is a plain equality token, but corrupt-RESET (controller.js:362) and v0 migration (config.js) write revision 1, so a revision value
// can be seen twice with different content (ABA): an old tab holding revision 1 passes checkRevision after the store was reset.
import { createController, createFakeBrowser, noList, send, status, configured } from './h.mjs';
import { corruptConfig } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
const fake = createFakeBrowser(); const a = createController(fake.api);
await send(a, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
const tabOld = (await status({}, a)); console.log('old tab loaded at revision', tabOld.revision);       // revision 1
await send(a, { type: 'SAVE_SETTINGS', baseRevision: 1, settings: { ...noList, domains: ['a.com'] } });
await send(a, { type: 'SAVE_SETTINGS', baseRevision: 2, settings: { ...noList, domains: ['a.com', 'b.com'] } });
corruptConfig(fake.state, { garbage: true });
const reset = await send(a, { type: 'RESET', baseRevision: 0 }); console.log('RESET after corruption -> revision', reset.status.revision, 'sites', reset.status.settings.domains);
const r = await send(a, { type: 'SAVE_SETTINGS', baseRevision: tabOld.revision, settings: { ...noList, domains: ['old-tab.com'] } });
console.log('old tab SAVE with stale baseRevision', tabOld.revision, '=> accepted =', r.ok);
