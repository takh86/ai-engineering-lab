import { normalizeDomain } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/domains.js';
import { corpus } from './corpus.mjs';
import { launch, openExtPage, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const inputs = corpus();
const acc = []; const codes = {};
for (const i of inputs) { try { acc.push([i, normalizeDomain(i)]); } catch (e) { codes[e.code] = (codes[e.code]||0)+1; } }
console.log('inputs', inputs.length, 'accepted', acc.length, JSON.stringify(codes));
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const res = await page.evaluate(async (acc) => {
  const out = [];
  for (const [input, host] of acc) {
    let bh = null; try { bh = new URL(input.includes('://') ? input : 'https://' + input).hostname; } catch { bh = 'THROWS'; }
    let dnr = 'ok';
    try { await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [{ id: 9999, priority: 1, action: { type: 'block' }, condition: { requestDomains: [host], resourceTypes: ['main_frame'] } }], removeRuleIds: [9999] }); } catch (e) { dnr = String(e.message).slice(0, 80); }
    out.push({ input, host, bh, dnr });
  }
  return out;
}, acc);
let bad = 0;
for (const r of res) {
  const bh = r.bh.replace(/\.$/, '').replace(/^www\./, '');
  if (bh !== r.host || r.dnr !== 'ok') { bad++; console.log(JSON.stringify(r)); }
}
console.log('mismatch/dnr-reject', bad, 'of', res.length);
for (const r of res.slice(0, 0)) console.log(r);
await b.context.close();
