import { launch, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
import { phraseFragment } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/phrases.js';
import { STARTER_TERMS } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/starter-terms.js';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const supp = regex => page.evaluate(r => chrome.declarativeNetRequest.isRegexSupported({ regex: r, isCaseSensitive: false }).then(x => x.isSupported), regex);
const P = '[+._~!()\'*,-]';
const cands = {
 C0: ['(?:\\+|%20)', '(?:\\+|%20|&|#|$)'],
 C1: [`(?:${P}|%(?:2[0-9A-F]|3[A-F]|5F))`, `(?:${P}|%(?:2[0-9A-F]|3[A-F]|5F)|&|#|$)`],
 C2: [`(?:[+._~!()'*,-]|%2[0-9A-F])`, `(?:[+._~!()'*,-]|%2[0-9A-F]|&|#|$)`],
 C3: [`(?:[+.,!_-]|%2[0-9A-F])`, `(?:[+.,!_-]|%2[0-9A-F]|&|#|$)`],
};
const longest = [...STARTER_TERMS].map(t=>[...t].length).sort((a,b)=>b-a)[0];
console.log('starter terms', STARTER_TERMS.length, 'longest', longest);
for (const [name,[bef,aft]] of Object.entries(cands)) {
  const build = (mode,param,frags)=> mode==='contains' ? `[?&]${param}=[^&#]*(?:${frags.join('|')})` : `[?&]${param}=(?:[^&#]*${bef})?(?:${frags.join('|')})${aft}`;
  const row={};
  for (const mode of ['word']) for (const param of ['q','p','text','search_query']) { let max=0; for (let L=2;L<=40;L++){ if (await supp(build(mode,param,[phraseFragment('ع'.repeat(L))]))) max=L; else break;} row[param]=max; }
  // pack all starter terms into how many chunks for q
  let chunks=0, cur=[]; for (const t of STARTER_TERMS){ const trial=[...cur,t]; if (await supp(build('word','search_query',trial.map(phraseFragment)))) cur=trial; else { chunks++; cur=[t]; } } if(cur.length) chunks++;
  console.log(name, JSON.stringify(row), 'starter chunks(search_query)=', chunks);
}
await b.context.close();
