import { launch, openExtPage, send, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const S=process.cwd();
for (const lang of ['ar','en','de']) {
const b=await launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',extensionDir:S+'/ext',lang});
for (const pg of ['popup','options','onboarding']) for (const w of [360,320]) {
 const p=await openExtPage(b.context,b.extensionId,pg+'.html');await p.setViewportSize({width:w,height:700});await sleep(300);
 const r=await p.evaluate(()=>{const e=document.querySelector('.wordmark');const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),lines:Math.round(r.height/parseFloat(getComputedStyle(e).lineHeight)),text:e.textContent}});
 console.log(lang,pg,w,JSON.stringify(r)); await p.close();}
await b.context.close();}
