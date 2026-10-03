import { planRules, PARAM_GROUPS } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/rules.js';
import { phraseFragment } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/phrases.js';
const L = [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي']; let s = 5; const R = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const rnd = n => Array.from({ length: n }, () => L[Math.floor(R() * L.length)]).join('');
let mism = 0, total = 0, shownNoNarrow = 0, missing = 0;
for (let limit = 120; limit <= 700; limit += 7) for (let t = 0; t < 6; t++) {
  const words = [...new Set(Array.from({ length: 3 + Math.floor(R() * 6) }, () => (R() < .3 ? rnd(2 + Math.floor(R() * 5)) + ' ' + rnd(2 + Math.floor(R() * 5)) : R() < .5 ? rnd(3 + Math.floor(R() * 14)) : 'word' + 'abcdefghij'.slice(0, Math.floor(R() * 10)))))];
  const cfg = { baseList: false, starterTerms: false, domains: [], allow: [], words, contains: [], onboarded: true };
  const plan = await planRules(cfg, async regex => regex.length <= limit); total++;
  const actualNarrow = new Set();
  for (const rule of plan.rules.filter(r => r.condition.regexFilter)) {
    const rf = rule.condition.regexFilter; const narrow = !rf.includes('[+.(),_-]');
    if (!narrow) continue; for (const w of words) if (rf.includes(phraseFragment(w))) actualNarrow.add(w);
  }
  const noted = new Set(plan.narrowEdges); const unsupp = new Set(plan.unsupported);
  for (const w of actualNarrow) if (!noted.has(w) && !unsupp.has(w)) { missing++; console.log('NARROW USED BUT NOT NOTED', limit, w); }
  for (const w of noted) if (!actualNarrow.has(w)) { shownNoNarrow++; console.log('NOTED BUT NOT NARROW', limit, w); }
}
console.log({ total, missing, shownNoNarrow });
