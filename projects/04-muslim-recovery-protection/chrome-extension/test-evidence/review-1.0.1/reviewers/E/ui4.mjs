import { launch, openExtPage, send, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const S=process.cwd();
for (const lang of ['ar','de']) {
const b=await launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',extensionDir:S+'/ext',lang});
const o=await openExtPage(b.context,b.extensionId,'options.html');
await send(o,{type:'COMPLETE_ONBOARDING',baseList:true,starterTerms:true});
for (const [pg,w,sch] of [['popup',360,'dark'],['options',320,'dark'],['onboarding',320,'light'],['help',320,'light']]){
 const p=await openExtPage(b.context,b.extensionId,pg+'.html');await p.emulateMedia({colorScheme:sch});await p.setViewportSize({width:w,height:700});await sleep(300);
 if(pg==='onboarding'){for(let i=0;i<4;i++)await p.click('#next');}
 await p.screenshot({path:`${S}/shots/narrow-${pg}-${lang}-${w}-${sch}.png`,fullPage:pg!=='options'});
 if(pg==='options'&&lang==='de'){ await p.evaluate(()=>document.querySelector('#baseList').scrollIntoView()); await p.screenshot({path:`${S}/shots/checkbox-dark-de.png`,clip:{x:0,y:0,width:320,height:700}});
   await p.focus('#reset'); await p.keyboard.press('Enter'); await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await sleep(300); console.log('after cancel active (300ms later):',await p.evaluate(()=>document.activeElement.tagName+'#'+document.activeElement.id)); }
 await p.close();}
await b.context.close();}
