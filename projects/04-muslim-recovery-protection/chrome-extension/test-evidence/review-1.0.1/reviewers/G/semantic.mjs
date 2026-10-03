// Property test: weakeningReasons(prev,next)==[] must imply "every URL blocked under prev is still blocked under next" (model: planRules output evaluated with JS RegExp).
import { weakeningReasons, parseSettings } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/config.js';
import { planRules } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/rules.js';
import { STARTER_TERMS } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/starter-terms.js';
let s = 777; const R = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; const pick = a => a[Math.floor(R() * a.length)]; const subset = (a, p) => a.filter(() => R() < p);
const DOM = ['a.example', 'b.a.example', 'c.example', 'd.c.example', 'e.d.c.example', 'f.example', 'ab.example', 'b.example'];
const PH = ['free porn', 'porn', 'por', 'ree p', 'free', 'ab', 'abc', 'bc', 'x y', 'xy', 'y z', 'ee', 'free  porn'];
const supports = async () => true;
const cache = new Map();
async function rulesFor(cfg) { const k = JSON.stringify(cfg); if (!cache.has(k)) cache.set(k, (await planRules({ ...cfg, onboarded: true }, supports)).rules); return cache.get(k); }
const matchesRule = (rule, url) => { const u = new URL(url); const c = rule.condition; if (c.requestDomains && !c.requestDomains.some(d => u.hostname === d || u.hostname.endsWith('.' + d))) return false; if (c.regexFilter && !new RegExp(c.regexFilter, c.isUrlFilterCaseSensitive === false ? 'i' : '').test(url)) return false; return true; };
const blocked = (rules, url) => { const m = rules.filter(r => matchesRule(r, url)).sort((a, b) => b.priority - a.priority); return !!m.length && m[0].action.type !== 'allow'; };
const urlsFor = cfg => { const out = []; for (const d of cfg.domains) out.push(`https://${d}/`, `https://x.y.${d}/p`); const ph = [...cfg.words, ...cfg.contains, ...cfg.words.slice(0, 2).map(w => w)]; for (const p of ph) for (const [host, param] of [['www.bing.com', 'q'], ['www.youtube.com', 'search_query']]) { const e = p.split(' ').map(encodeURIComponent); for (const form of [e.join('+'), e.join('%20'), 'zz+' + e.join('+') + '+yy', 'zz' + e.join('+') + 'zz', 'a%20' + e.join('+') ]) out.push(`https://${host}/search?${param}=${form}`); } return out; };
const mkCfg = () => ({ baseList: R() < .5, starterTerms: false, domains: subset(DOM, .35), allow: [], words: subset(PH, .25).map(x => x.replace(/\s+/g, ' ')), contains: subset(PH, .2).map(x => x.replace(/\s+/g, ' ')) });
let checked = 0, empty = 0, viol = 0;
for (let i = 0; i < 6000 && viol < 5; i++) {
  const prev = mkCfg(); const next = R() < .5 ? mkCfg() : { ...prev, domains: subset(prev.domains, .7).concat(subset(DOM, .2)), words: subset(prev.words, .6).concat(subset(PH, .1)), contains: subset(prev.contains, .6).concat(subset(PH, .1)) };
  for (const k of ['domains', 'words', 'contains']) next[k] = [...new Set(next[k])];
  let a, b; try { a = parseSettings(prev); b = parseSettings(next); } catch { continue; }
  checked++;
  const reasons = weakeningReasons({ ...a }, { ...b });
  if (reasons.length) continue; empty++;
  const rp = await rulesFor(a), rn = await rulesFor(b);
  for (const url of urlsFor(a)) if (blocked(rp, url) && !blocked(rn, url)) { viol++; console.log('SEMANTIC WEAKENING NOT FLAGGED\n prev', JSON.stringify(a), '\n next', JSON.stringify(b), '\n url', url); break; }
}
console.log({ checked, noReasons: empty, viol });
