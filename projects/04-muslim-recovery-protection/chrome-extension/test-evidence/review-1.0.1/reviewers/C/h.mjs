import { createController } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/controller.js';
import { validateMessage } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/background/messages.js';
import { createFakeBrowser } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit/fake-browser.mjs';
export { createController, createFakeBrowser };
export const noList = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
export const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));
export const gate = () => { let open; const promise = new Promise(r => { open = r; }); return { promise, open }; };
export const until = async (p, label) => { for (let i = 0; i < 600 && !p(); i++) await tick(1); if (!p()) throw new Error('timeout ' + label); };
let peers = 0;
export const peerOf = (api, opts) => createController({ ...api, instanceId: `peer${++peers}` }, opts);
export const send = (c, m) => c.handle(validateMessage(m));
export async function configured(t, domains = ['example.com']) {
    await send(t.a, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
    const s = (await send(t.a, { type: 'GET_STATUS' })).status;
    await send(t.a, { type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { ...noList, domains } });
}
export const status = async (t, c = t.a) => (await send(c, { type: 'GET_STATUS' })).status;
export const ruleDomains = st => st.rules.flatMap(r => r.condition.requestDomains ?? []).sort();
