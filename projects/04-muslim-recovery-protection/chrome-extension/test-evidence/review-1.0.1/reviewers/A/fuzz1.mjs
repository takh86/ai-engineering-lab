const P='/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/core/';
const {normalizeDomain,isSameOrSubdomain}=await import(P+'domains.js');
const {normalizePhrase,phraseFragment,buildPhraseRegex}=await import(P+'phrases.js');
const {TabsiraError}=await import(P+'errors.js');
const cfg=await import(P+'config.js');
let seed=12345; const rnd=()=> (seed=(seed*1664525+1013904223)>>>0)/2**32;
const pick=a=>a[Math.floor(rnd()*a.length)];
const atoms=['a','b','ab','example','com','.','..','-','_','--','xn--','www.','http://','https://','//','/','?','#',':','@','%','%41','*',' ','\t','\n','é','İ','ß','ǅ','＠','。','．','ａ','١','مثال','\u200b','\u202e','\u0000','[',']','::1','1','192.168.0.1','0x7f.1','localhost','co.uk','github.io','com.','EXAMPLE','Ⅷ','℀','a\u0301','\u00ad'];
const bad=[]; let okDom=0, rejDom=0;
for(let i=0;i<200000;i++){
  let s=''; const n=1+Math.floor(rnd()*6); for(let j=0;j<n;j++) s+=pick(atoms);
  try{ const h=normalizeDomain(s); okDom++;
    if(normalizeDomain(h)!==h) bad.push(['domain not idempotent',s,h]);
    if(!/^[a-z0-9.-]+$/.test(h)) bad.push(['domain charset',s,h]);
    if(h.startsWith('www.')) bad.push(['domain keeps www',s,h]);
    if(/^\d+(\.\d+){3}$/.test(h)) bad.push(['ip accepted',s,h]);
    if(h.split('.').some(l=>l.length>63||l.startsWith('-')||l.endsWith('-'))) bad.push(['label',s,h]);
  }catch(e){ rejDom++; if(!(e instanceof TabsiraError)) bad.push(['non-TabsiraError domain',s,String(e)]); if(e.message.includes(s)&&s.length>3) bad.push(['error leaks input',s,e.message]); }
}
console.log('domain ok/rej',okDom,rejDom);
let okP=0,rejP=0;
const patoms0=['a','b','free','porn','سكس','أفلام','ـ','َ','ِّ','İ','ß','ﷲ','ﻻ','ﺳ','Ａ','\u200d','\u202e',' ','  ','\t','\n','\u00a0','.','+','%','(',')','[',']','\\','$','^','*','?','|','{','}',"'",'"','&','#','=','1','٣','-','_','\u0000','\u007f','😀','\ud800'];
const patoms=process.env.SURR?patoms0:patoms0.filter(x=>x!=='\ud800');
for(let i=0;i<200000;i++){
  let s=''; const n=1+Math.floor(rnd()*7); for(let j=0;j<n;j++) s+=pick(patoms);
  try{ const p=normalizePhrase(s); okP++;
    const p2=normalizePhrase(p);
    if(p2!==p) bad.push(['phrase not idempotent',JSON.stringify(s),JSON.stringify(p),JSON.stringify(p2)]);
    if(/^\s|\s$/.test(p)||/\s\s/.test(p)||/[\t\n\u00a0]/.test(p)) bad.push(['phrase whitespace',JSON.stringify(s),JSON.stringify(p)]);
    // regex builds, compiles in JS, and matches own encoding in both separators
    for(const mode of ['word','contains']){
      const re=new RegExp(buildPhraseRegex(mode,'q',[phraseFragment(p)]),'i');
      const url1='https://www.google.com/search?q='+encodeURIComponent(p).replace(/%20/g,'+');
      const url2='https://www.google.com/search?hl=en&q='+encodeURIComponent(p);
      const url3='https://www.google.com/search?q=zz+'+encodeURIComponent(p)+'&x=1';
      for(const u of [url1,url2,url3]) if(!re.test(u)) bad.push(['own phrase not matched',mode,JSON.stringify(p),u]);
    }
  }catch(e){ rejP++; if(!(e instanceof TabsiraError)) bad.push(['non-TabsiraError phrase',JSON.stringify(s),String(e)]); }
}
console.log('phrase ok/rej',okP,rejP);
console.log('problems',bad.length); const seen=new Set(); for(const b of bad){const k=b[0]; if(seen.has(k)&&Math.random()<.97) continue; seen.add(k); console.log(JSON.stringify(b).slice(0,300));}
