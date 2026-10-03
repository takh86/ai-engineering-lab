import fs from 'node:fs';
import { launch, openExtPage, send, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const S='/tmp/claude-0/-home-user-ai-engineering-lab/76910e72-6eb0-5df8-a0a7-f9c1d34aa315/scratchpad/review/E';
const exe='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out={overflow:[],small:[],kbd:{},aria:{},lang:{}};
for (const lang of ['ar','en','de']) {
  const b = await launch({ executablePath: exe, extensionDir: S+'/ext', lang });
  const opt = await openExtPage(b.context, b.extensionId, 'options.html');
  await send(opt, {type:'COMPLETE_ONBOARDING', baseList:true, starterTerms:true});
  await sleep(1000);
  for (const page of ['popup','options','onboarding','blocked','help']) {
    const p = await openExtPage(b.context, b.extensionId, page+'.html');
    await sleep(300);
    out.lang[lang+'/'+page] = await p.evaluate(()=>({lang:document.documentElement.lang,dir:document.documentElement.dir,title:document.title,fontLatin:getComputedStyle(document.body).fontFamily}));
    // overflow tests
    for (const [w,h,label] of [[320,640,'320px'],[640,800,'200%zoom@1280'],[320,800,'400%zoom@1280']]) {
      await p.setViewportSize({width:w,height:h}); await sleep(100);
      const r = await p.evaluate(()=>{const de=document.documentElement;const bad=[];for(const e of document.querySelectorAll('body *')){const r=e.getBoundingClientRect();if(r.width&&(r.right>de.clientWidth+1||r.left<-1)&&!e.closest('svg'))bad.push(e.tagName+'#'+e.id+'.'+e.className+' L'+Math.round(r.left)+' R'+Math.round(r.right));}return {sw:de.scrollWidth,cw:de.clientWidth,bad:bad.slice(0,5)}});
      if (r.sw>r.cw+1||r.bad.length) out.overflow.push({lang,page,label,...r});
    }
    // popup viewport as real popup 360 wide
    await p.setViewportSize({width: page==='popup'?360:1000,height:800});
    // target sizes
    const sm = await p.evaluate(()=>[...document.querySelectorAll('a,button,input,summary,textarea')].filter(e=>e.offsetParent||e.tagName==='INPUT').map(e=>{const r=e.getBoundingClientRect();return {t:e.tagName+'#'+e.id,w:Math.round(r.width),h:Math.round(r.height)}}).filter(x=>x.w&&(x.w<24||x.h<24)));
    if (sm.length) out.small.push({lang,page,sm});
    // keyboard: tab order
    await p.bringToFront(); await p.evaluate(()=>document.activeElement?.blur());
    const seq=[]; 
    for (let i=0;i<40;i++){ await p.keyboard.press('Tab'); const f = await p.evaluate(()=>{const e=document.activeElement; if(!e||e===document.body)return null; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return {t:e.tagName+(e.id?'#'+e.id:''),name:(e.getAttribute('aria-label')||e.textContent||e.labels?.[0]?.textContent||'').trim().slice(0,30),x:Math.round(r.x),y:Math.round(r.y),outline:cs.outlineStyle+' '+cs.outlineWidth,fv:e.matches(':focus-visible')}}); if(!f) break; if(seq.length&&seq[0].t===f.t&&seq[0].name===f.name) break; seq.push(f);}
    out.kbd[lang+'/'+page]=seq;
    const snap = await p.locator('body').ariaSnapshot().catch(e=>String(e));
    out.aria[lang+'/'+page]=snap;
    await p.close();
  }
  await b.context.close();
}
fs.writeFileSync(S+'/ui2.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out.overflow,null,0)); console.log(JSON.stringify(out.small)); 
for (const k of Object.keys(out.kbd)) if(k.startsWith('en/')||k.startsWith('ar/options')) console.log(k, out.kbd[k].map(f=>f.t+'['+f.name+']'+(f.fv?'':'!nofv')+(f.outline.startsWith('none')?'!noout':'')).join(' > '));
console.log(JSON.stringify(out.lang['de/popup']));
