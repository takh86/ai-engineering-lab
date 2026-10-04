import { corpus } from './corpus.mjs';
import { launch, openExtPage, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const inputs = corpus();
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const res = await page.evaluate(async (inputs) => {
  const { normalizeDomain } = await import('./core/domains.js');
  const out = [];
  for (const input of inputs) {
    let host = null, code = null; try { host = normalizeDomain(input); } catch (e) { code = e.code; }
    let bh = null; try { bh = new URL(input.includes('://') ? input : 'https://' + input).hostname; } catch { bh = 'THROWS'; }
    let dnr = 'n/a';
    if (host) { dnr = 'ok'; try { await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [{ id: 9999, priority: 1, action: { type: 'block' }, condition: { requestDomains: [host], resourceTypes: ['main_frame'] } }], removeRuleIds: [9999] }); } catch (e) { dnr = String(e.message).slice(0, 80); } }
    out.push({ input, host, code, bh, dnr });
  }
  return out;
}, inputs);
let n = 0;
for (const r of res) {
  const norm = r.bh.replace(/\.$/, '').replace(/^www\./, '');
  if (r.host && (norm !== r.host || r.dnr !== 'ok')) console.log('ACCEPTED-MISMATCH', JSON.stringify(r));
  // rejected but browser parses to a plain navigable host with >=2 ldh labels
  if (!r.host && r.bh !== 'THROWS' && /^[a-z0-9-]+(\.[a-z0-9-]+)+\.?$/.test(r.bh) && !/^\d+(\.\d+)*$/.test(r.bh) && !['domain_has_path','domain_is_shared_suffix','domain_is_ip'].includes(r.code)) { n++; console.log('REJECTED-BUT-NAVIGABLE', JSON.stringify(r)); }
}
console.log('accepted', res.filter(r=>r.host).length, 'of', res.length, 'rejected-but-navigable', n);
await b.context.close();
