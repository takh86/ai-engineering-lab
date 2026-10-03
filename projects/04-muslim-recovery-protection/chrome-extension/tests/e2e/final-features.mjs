// Installed release ZIP acceptance. No mocked browser APIs or protection clock.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {preparePackage} from './package.mjs';
import {launch,openExtPage,send,visit,startSite,root} from './lib.mjs';
import {createReport} from './report.mjs';
const pkg=preparePackage('chromium');
const report=createReport({browserName:'Chromium',version:'not started',extra:pkg.info});
const evidence=path.join(root,'test-evidence');fs.mkdirSync(evidence,{recursive:true});
let browser,site;
const check=(name,reply)=>report.check(name,!!reply,typeof reply==='object'?JSON.stringify(reply):'');
try {
 browser=await launch({executablePath:process.env.CHROMIUM??chromium.executablePath(),extensionDir:pkg.dirs.release});
 report.meta.version=browser.version();
 site=await startSite();
 const options=await openExtPage(browser.context,browser.extensionId,'options.html');
 const initial=await send(options,{type:'GET_PUBLIC_PROFILE'});
 check('fresh install: prayer notifications disabled',initial.ok&&initial.profile.prayer.enabled===false);
 check('faith choice independent of language', (await send(options,{type:'SAVE_PUBLIC_PROFILE',profile:{language:'ar',religion:'muslim',faith:true,theme:'light'}})).ok);
 const setup=await send(options,{type:'COMPLETE_ONBOARDING',baseList:true,starterTerms:false});
 check('onboarding activates core protection',setup.ok&&setup.status.base.enabled);
 const settings={baseList:true,starterTerms:false,domains:['blocked-user.test'],allow:['tabsira-selftest.test'],words:[],contains:[]};
 let status=(await send(options,{type:'GET_STATUS'})).status;
 check('additional domain can be added',(await send(options,{type:'SAVE_SETTINGS',baseRevision:status.revision,settings})).ok);
 check('exception cannot bypass core',(await visit(browser.context,`http://tabsira-selftest.test:${site.port}/`)).blocked);
 check('additional domain really redirects',(await visit(browser.context,`http://blocked-user.test:${site.port}/`)).blocked);
 const safe=await visit(browser.context,`http://ordinary.test:${site.port}/`);check('benign page remains available',safe.real);
 const schedules=[{id:'night',days:[0,1,2,3,4,5,6],start:'22:00',end:'06:00',enabled:true}];
 check('weekly overnight schedule saves',(await send(options,{type:'SAVE_SCHEDULES',schedules})).ok);
 const overlap=await send(options,{type:'SAVE_SCHEDULES',schedules:[...schedules,{id:'clash',days:[1],start:'05:00',end:'07:00',enabled:true}]});
 check('overnight overlap rejected',!overlap.ok&&overlap.error.code==='schedule_conflict');
 for(const language of ['ar','en','de']) {
  check(`${language}: profile saves`,(await send(options,{type:'SAVE_PUBLIC_PROFILE',profile:{language,theme:language==='de'?'dark':'light'}})).ok);
  for(const file of ['popup.html','options.html','help.html','recovery.html','covenant.html']) {
   const page=await openExtPage(browser.context,browser.extensionId,file);
   await page.waitForFunction(lang=>document.documentElement.lang===lang,language);
   check(`${language}: ${file} localized`,await page.getAttribute('html','dir')===(language==='ar'?'rtl':'ltr'));
   if(file==='popup.html')check(`${language}: popup has no safe-test action`,!(await page.locator('a[href*="tabsira-selftest"]').count()));
   if(language==='ar'&&file==='recovery.html')await page.screenshot({path:path.join(evidence,'final-features-recovery.png'),fullPage:true});
   await page.close();
  }
 }
 const password='Tabsira-private-test-987';
 const secured=await send(options,{type:'SET_PASSWORD',password});
 check('independent password returns one-time recovery code',secured.ok&&typeof secured.recoveryCode==='string');
 check('private notes saved',(await send(options,{type:'SAVE_PRIVATE_DATA',data:{notes:'private-e2e-marker'}})).ok);
 check('custom commitment starts',(await send(options,{type:'START_SESSION',minutes:180,exitDelay:60})).ok);
 check('early exit requires explicit request',(await send(options,{type:'REQUEST_EARLY_EXIT'})).ok);
 const early=await send(options,{type:'CONFIRM_EARLY_EXIT',password});check('waiting period cannot be skipped',!early.ok);
 check('access can be locked',(await send(options,{type:'LOCK_ACCESS'})).ok);
 const privateReply=await send(options,{type:'GET_PRIVATE_DATA'});check('worker rejects private reads while locked',!privateReply.ok&&privateReply.error.code==='access_locked');
 status=(await send(options,{type:'GET_STATUS'})).status;
 check('locked status redacts configuration',!status.settings&&!status.config&&status.lock.active);
 check('password recovery succeeds',(await send(options,{type:'RECOVER_PASSWORD',recoveryCode:secured.recoveryCode,password:'Tabsira-new-test-987'})).ok);
 status=(await send(options,{type:'GET_STATUS'})).status;check('recovery preserves commitment',status.lock.active);
 const data=await send(options,{type:'GET_PRIVATE_DATA'});check('recovery preserves encrypted private data',data.ok&&data.data.notes==='private-e2e-marker');
 const blocked=await openExtPage(browser.context,browser.extensionId,'blocked.html');
 const denied=await send(blocked,{type:'GET_PRIVATE_DATA'}).catch(()=>undefined);check('blocked page cannot read private vault',!denied?.ok);
 check('no personal text logged',!browser.evidence.logs.some(x=>x.includes('private-e2e-marker')||x.includes(password)));
 check('extension has no console errors',!browser.evidence.logs.some(x=>/^error:/u.test(x)));
} catch(error) {
 if(!browser)report.skip('installed-extension acceptance',error.message.slice(0,2000));
 else report.check('suite completed',false,error.stack);
 process.exitCode=1;
} finally {
 await browser?.context.close().catch(()=>{});await site?.close();
 const summary=report.save(path.join(evidence,'final-features-chromium.json'));
 if(summary.FAIL||summary.NOT_RUN)process.exitCode=1;
}
