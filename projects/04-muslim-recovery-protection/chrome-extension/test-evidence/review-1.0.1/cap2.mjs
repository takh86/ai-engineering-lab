import { launch, openExtPage, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
import { phraseFragment } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/phrases.js';
import { STARTER_TERMS } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/starter-terms.js';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const supp = regex => page.evaluate(r => chrome.declarativeNetRequest.isRegexSupported({ regex: r, isCaseSensitive: false }).then(x => x.isSupported), regex);
const cands = {
 C3: [`(?:[+.,!_-]|%2[0-9A-F])`, `(?:[+.,!_-]|%2[0-9A-F]|&|#|$)`],
 C4: [`(?:[+.,_-]|%2[0-2CDEF])`, `(?:[+.,_-]|%2[0-2CDEF]|&|#|$)`],
 C5: [`(?:[+.,_-]|%2[02CE])`, `(?:[+.,_-]|%2[02CE]|&|#|$)`],
};
for (const [name,[bef,aft]] of Object.entries(cands)) {
  const build = (param,frags)=> `[?&]${param}=(?:[^&#]*${bef})?(?:${frags.join('|')})${aft}`;
  const row={};
  for (const param of ['q','p','text','search_query']) { let max=0; for (let L=2;L<=40;L++){ if (await supp(build(param,[phraseFragment('ع'.repeat(L))]))) max=L; else break;} row[param]=max; }
  const bad=[]; for (const t of STARTER_TERMS) if(!(await supp(build('search_query',[phraseFragment(t)])))) bad.push(t);
  console.log(name, JSON.stringify(row), 'starter terms unsupported on search_query:', bad.length, bad.map(x=>[...x].length));
}
console.log(STARTER_TERMS.map(t=>[...t].length).join(','));
await b.context.close();
