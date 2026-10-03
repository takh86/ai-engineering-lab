import { launch, openExtPage, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
import { phraseFragment, buildPhraseRegex } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/phrases.js';
import { STARTER_TERMS } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/starter-terms.js';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const supp = regex => page.evaluate(r => chrome.declarativeNetRequest.isRegexSupported({ regex: r, isCaseSensitive: false }).then(x => x.isSupported), regex);
for (const param of ['q','p','text','search_query']) {
  const reduced=[];
  for (const t of STARTER_TERMS) if(!(await supp(buildPhraseRegex('word',param,[phraseFragment(t)])))) reduced.push(t);
  console.log(param, 'reduced starter terms:', reduced.length, JSON.stringify(reduced));
}
await b.context.close();
