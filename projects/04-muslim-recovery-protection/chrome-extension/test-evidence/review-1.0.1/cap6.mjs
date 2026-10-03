import { launch, openExtPage, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
import { phraseFragment } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/phrases.js';
import { STARTER_TERMS } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/starter-terms.js';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const supp = regex => page.evaluate(r => chrome.declarativeNetRequest.isRegexSupported({ regex: r, isCaseSensitive: false }).then(x => x.isSupported), regex);
const sets = {
 N7: [`[+.(),_:;-]|%2[0-9A-F]`],
};
for (const [name,[edge]] of Object.entries(sets)) {
  const build=(param,frag)=>`[?&]${param}=(?:[^&#]*(?:${edge}))?(?:${frag})(?:${edge}|&|#|$)`;
  const out={};
  for (const param of ['q','search_query']) { let ok=0; for (const t of STARTER_TERMS) if (await supp(build(param,phraseFragment(t)))) ok++; out[param]=ok+'/'+STARTER_TERMS.length; }
  console.log(name, JSON.stringify(out));
}
await b.context.close();
