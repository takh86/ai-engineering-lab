import { launch, openExtPage, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext2' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const out = await page.evaluate(async () => {
  const { packWord, packPhrases } = await import('./core/phrases.js'); const { PARAM_GROUPS } = await import('./core/rules.js'); const { STARTER_TERMS } = await import('./core/starter-terms.js');
  const supports = async regex => (await chrome.declarativeNetRequest.isRegexSupported({ regex, isCaseSensitive: false })).isSupported;
  const res = {};
  const words = [...STARTER_TERMS].sort();
  for (const g of PARAM_GROUPS) { const p = await packWord(words, supports, g.param); res[g.param] = { wideRules: p.chunks.length, narrowRules: p.narrow.length, narrowPhrases: p.narrow.flat(), unsupported: p.unsupported }; }
  // user phrases of growing Arabic length: where does wide/narrow/unsupported switch per param?
  const lens = {};
  for (const g of PARAM_GROUPS) { lens[g.param] = []; for (let L = 8; L <= 18; L++) { const ph = 'ع'.repeat(L); const p = await packWord([ph], supports, g.param); lens[g.param].push(`${L}:${p.chunks.length ? 'W' : p.narrow.length ? 'n' : 'X'}`); } }
  return { res, lens };
});
console.log(JSON.stringify(out, null, 1));
await b.context.close();
