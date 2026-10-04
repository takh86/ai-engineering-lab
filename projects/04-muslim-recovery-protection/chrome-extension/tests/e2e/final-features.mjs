// Installed release ZIP acceptance. No mocked browser APIs or protection clock.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {preparePackage} from './package.mjs';
import {launch,openExtPage,send,visit,startSite,root,sleep} from './lib.mjs';
import {createReport} from './report.mjs';
import {copy} from '../../src/ui/recovery-copy.js';
const pkg=preparePackage('chromium');
const report=createReport({browserName:'Chromium',version:'not started',extra:pkg.info});
const evidence=path.join(root,'test-evidence');fs.mkdirSync(evidence,{recursive:true});
let browser,site;
const check=(name,reply)=>report.check(name,!!reply,typeof reply==='object'?JSON.stringify(reply):'');
// Real wall-clock waits: no protection clock replacement or runtime status polling.
const waitUntil=async deadline=>{
 while(Date.now()<deadline) {
  await sleep(Math.min(30000,deadline-Date.now()));
  if(Date.now()<deadline)process.stdout.write('WAIT  real schedule boundary\n');
 }
};

async function scheduleBoundaryAcceptance(options) {
 const boundary=await options.evaluate(()=>{
  const now=Date.now();
  // Leave at least ten seconds to install the schedule before its minute boundary.
  const start=Math.floor(now/60000)*60000+(now%60000<50000?60000:120000);
  const time=ms=>{const date=new Date(ms);return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;};
  return {start,end:start+60000,startText:time(start),endText:time(start+60000)};
 });
 check('real-time boundary schedule saves',(await send(options,{type:'SAVE_SCHEDULES',schedules:[{id:'real-boundary',days:[0,1,2,3,4,5,6],start:boundary.startText,end:boundary.endText,enabled:true}]})).ok);
 // Options polls GET_STATUS every 15 s, which repairs DNR and would mask this bug.
 // Blocked only reads the public profile during boot; native APIs below never call the controller.
 await options.goto(`chrome-extension://${browser.extensionId}/blocked.html`);
 await options.waitForSelector('#content section');
 report.note('schedule-boundary-isolation','Real installed DNR, real minute boundaries. Native watchdog tabsira-verify intentionally cleared during this case; no GET_STATUS/REPAIR or options polling. Watchdog restored afterwards.');
 try {
  await options.evaluate(()=>chrome.alarms.clear('tabsira-verify'));
  check('schedule start case disables native watchdog fallback',!(await options.evaluate(()=>chrome.alarms.get('tabsira-verify'))));
  const alarm=await options.evaluate(()=>chrome.alarms.get('tabsira-schedule-boundary'));
  check('native schedule alarm targets exact nextChange',alarm?.scheduledTime===boundary.start);
  const inactiveRules=await options.evaluate(()=>chrome.declarativeNetRequest.getDynamicRules());
  check('scheduled extra domain is available before start',(await visit(browser.context,`http://blocked-user.test:${site.port}/`)).real);
  await waitUntil(boundary.start+3000);
  const activeRules=await options.evaluate(()=>chrome.declarativeNetRequest.getDynamicRules());
  check('start alarm applies real dynamic DNR without watchdog',activeRules.length>inactiveRules.length);
  check('start alarm really redirects scheduled extra domain',(await visit(browser.context,`http://blocked-user.test:${site.port}/`)).blocked);
  const endAlarm=await options.evaluate(()=>chrome.alarms.get('tabsira-schedule-boundary'));
  check('native schedule alarm advances to real end boundary',endAlarm?.scheduledTime===boundary.end);
  // A genuine worker restart at the start boundary can recreate its watchdog.
  await options.evaluate(()=>chrome.alarms.clear('tabsira-verify'));
  check('schedule end case disables native watchdog fallback',!(await options.evaluate(()=>chrome.alarms.get('tabsira-verify'))));
  await waitUntil(boundary.end+3000);
  const afterRules=await options.evaluate(()=>chrome.declarativeNetRequest.getDynamicRules());
  check('end alarm removes scheduled extra DNR without watchdog',afterRules.length===inactiveRules.length);
  check('end alarm really releases scheduled extra domain',(await visit(browser.context,`http://blocked-user.test:${site.port}/`)).real);
  check('core DNR stays active outside extra schedule',(await visit(browser.context,`http://tabsira-selftest.test:${site.port}/`)).blocked);
 } finally {
  await options.evaluate(()=>chrome.alarms.create('tabsira-verify',{delayInMinutes:1,periodInMinutes:1}));
  await options.goto(`chrome-extension://${browser.extensionId}/options.html`);
  await options.waitForSelector('#commitForm',{state:'attached'});
  check('boundary case restores continuous extras',(await send(options,{type:'SAVE_SCHEDULES',schedules:[]})).ok);
 }
}

async function forcedWorkerRestartAcceptance() {
 // The DevTools session is attached to a benign tab, never to the extension worker.
 // Playwright itself can inspect workers, so this is explicitly forced-stop coverage.
 const observer=await browser.context.newPage();
 await observer.goto(`http://ordinary.test:${site.port}/`);
 const cdp=await browser.context.newCDPSession(observer);
 const versions=new Map();
 cdp.on('ServiceWorker.workerVersionUpdated',event=>{for(const version of event.versions)versions.set(version.versionId,version);});
 const waitVersion=async predicate=>{
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){const found=[...versions.values()].find(predicate);if(found)return found;await sleep(100);}
  throw new Error('Native ServiceWorker lifecycle event did not arrive within 30 seconds');
 };
 try {
  await cdp.send('ServiceWorker.enable');
  const version=await waitVersion(item=>item.scriptURL.startsWith(`chrome-extension://${browser.extensionId}/`)&&item.runningStatus==='running');
  for(const page of browser.context.pages())if(page.url().startsWith(`chrome-extension://${browser.extensionId}/`))await page.close();
  await cdp.send('ServiceWorker.stopWorker',{versionId:version.versionId});
  await waitVersion(item=>item.versionId===version.versionId&&item.runningStatus==='stopped');
  check('native CDP forced worker stop observed',true);
  const restarted=await openExtPage(browser.context,browser.extensionId,'options.html');
  const denied=await send(restarted,{type:'GET_PRIVATE_DATA'});
  check('forced worker restart clears memory unlock',!denied.ok&&denied.error.code==='access_locked');
  const status=(await send(restarted,{type:'GET_STATUS'})).status;
  check('forced worker restart preserves commitment and core',status?.lock.active&&status.base.enabled);
  await restarted.close();
  report.note('worker-idle-termination','NOT_RUN: this test invokes native ServiceWorker.stopWorker. It verifies forced restart only. Genuine idle termination remains unverified because Playwright worker inspection can alter lifetime.');
 } finally {await cdp.detach();await observer.close();}
}
try {
 browser=await launch({executablePath:process.env.CHROMIUM??chromium.executablePath(),extensionDir:pkg.dirs.release});
 report.meta.version=browser.version();
 site=await startSite();
 const options=await openExtPage(browser.context,browser.extensionId,'options.html');
 const initial=await send(options,{type:'GET_PUBLIC_PROFILE'});
 check('fresh install: prayer notifications disabled',initial.ok&&initial.profile.prayer.enabled===false);
 check('faith choice independent of language', (await send(options,{type:'SAVE_PUBLIC_PROFILE',profile:{language:'ar',religion:'muslim',faith:true,theme:'light'}})).ok);
 const onboarding=await openExtPage(browser.context,browser.extensionId,'onboarding.html');
 await onboarding.click('#next');
 await onboarding.selectOption('#religion','non-muslim');
 check('setup non-Muslim choice leaves faith off',!(await onboarding.isChecked('#faith')));
 await onboarding.selectOption('#religion','muslim');
 check('setup Muslim choice preselects optional faith',await onboarding.isChecked('#faith'));
 await onboarding.click('#next');
 await onboarding.click('#next');
 await onboarding.waitForSelector('#prayerPrompt', {state:'visible'});
 check('eligible setup exposes separate prayer controls',await onboarding.isVisible('#prayerPrompt'));
 await onboarding.click('#next');
 await onboarding.click('#finish');
 await onboarding.waitForSelector('#completed:not([hidden])');
 const setup=await send(options,{type:'GET_STATUS'});
 check('onboarding UI activates core protection',setup.ok&&setup.status.base.enabled);
 check('setup does not enable prayer automatically',!(await send(options,{type:'GET_PUBLIC_PROFILE'})).profile.prayer.enabled);
 await onboarding.close();
 const settings={baseList:true,starterTerms:false,domains:['blocked-user.test'],allow:['tabsira-selftest.test'],words:[],contains:[]};
 let status=(await send(options,{type:'GET_STATUS'})).status;
 check('additional domain can be added',(await send(options,{type:'SAVE_SETTINGS',baseRevision:status.revision,settings})).ok);
 check('exception cannot bypass core',(await visit(browser.context,`http://tabsira-selftest.test:${site.port}/`)).blocked);
 check('additional domain really redirects',(await visit(browser.context,`http://blocked-user.test:${site.port}/`)).blocked);
 const safe=await visit(browser.context,`http://ordinary.test:${site.port}/`);check('benign page remains available',safe.real);
 await scheduleBoundaryAcceptance(options);
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
   if(file==='options.html') {
    const locale=JSON.parse(fs.readFileSync(path.join(root,`src/_locales/${language}/messages.json`),'utf8'));
    const warning=locale.set_exit_password_required.message;
    await page.evaluate(()=>{location.hash='myplan';});
    await page.waitForSelector('#commitForm',{state:'visible'});
    check(`${language}: password-free commitment warning visible`,await page.locator('#exitPasswordWarning').isVisible() && (await page.locator('#exitPasswordWarning').textContent())===warning);
    await page.locator('#commitForm button[type="submit"]').click();
    await page.waitForSelector('#commitConfirm',{state:'visible'});
    check(`${language}: commitment confirmation includes password requirement`,(await page.locator('#commitConfirmText').textContent()).includes(warning));
    await page.locator('#commitNo').click();
   }
   if(language==='ar'&&file==='recovery.html')await page.screenshot({path:path.join(evidence,'final-features-recovery.png'),fullPage:true});
   await page.close();
  }
 }
 // Exercise the actual help/recovery/covenant UI, not just its message interfaces.
 const label=key=>copy(key,'de');
 const help=await openExtPage(browser.context,browser.extensionId,'help.html');
 await help.waitForSelector('.proposal-card h3');
 const firstIdea=await help.locator('.proposal-card h3').textContent();
 await help.getByRole('button',{name:label('nextIdea'),exact:true}).click();
 check('help Next shows another idea',(await help.locator('.proposal-card h3').textContent())!==firstIdea);
 await help.locator('.proposal-card').getByRole('button',{name:label('previous'),exact:true}).click();
 check('help Previous restores previous idea',(await help.locator('.proposal-card h3').textContent())===firstIdea);
 await help.getByLabel(label('customText'),{exact:true}).fill('private-custom-ui-marker');
 await help.getByRole('button',{name:label('add'),exact:true}).click();
 check('custom help step appears',await help.getByText('private-custom-ui-marker',{exact:true}).count()>=1);
 await help.getByRole('button',{name:label('saveLibrary'),exact:true}).click();
 await help.waitForFunction(async()=> (await chrome.runtime.sendMessage({type:'GET_PRIVATE_DATA'})).data?.customSteps.some(item=>item.text==='private-custom-ui-marker'));
 check('custom help library explicitly persists',(await send(options,{type:'GET_PRIVATE_DATA'})).data.customSteps.length===1);
 await help.close();
 const recovery=await openExtPage(browser.context,browser.extensionId,'recovery.html');
 await recovery.waitForSelector('.recovery-stages');
 const recoveryUrl=recovery.url();
 await recovery.locator('.recovery-stages button').nth(1).click();
 await recovery.getByRole('button',{name:label('forgive'),exact:true}).click();
 check('stage-two faith stays in recovery journey',recovery.url()===recoveryUrl && await recovery.locator('.recovery-stages button').nth(1).getAttribute('aria-current')==='step');
 await recovery.locator('.recovery-stages button').nth(3).click();
 check('care stage has no prayer action',await recovery.getByRole('button',{name:label('prayNow'),exact:true}).count()===0);
 await recovery.locator('.recovery-stages button').nth(4).click();
 await recovery.getByLabel(label('ifText'),{exact:true}).fill('private-skipped-ui-marker');
 await recovery.getByLabel(label('thenText'),{exact:true}).fill('take a short break');
 await recovery.getByRole('button',{name:label('later'),exact:true}).click();
 check('postponed recovery does not save review',(await send(options,{type:'GET_PRIVATE_DATA'})).data.reviews.length===0);
 check('postponed recovery clears draft',await recovery.locator('textarea').count()===0);
 await recovery.close();
 const covenant=await openExtPage(browser.context,browser.extensionId,'covenant.html');
 await covenant.getByLabel(label('purpose'),{exact:true}).fill('private-covenant-ui-marker');
 await covenant.getByLabel(label('ifText'),{exact:true}).fill('I notice boredom');
 await covenant.getByLabel(label('thenText'),{exact:true}).fill('I choose a small helpful step');
 await covenant.getByRole('button',{name:label('saveCovenant'),exact:true}).click();
 await covenant.waitForFunction(async()=> (await chrome.runtime.sendMessage({type:'GET_PRIVATE_DATA'})).data?.covenant?.purpose==='private-covenant-ui-marker');
 check('covenant explicitly persists',(await send(options,{type:'GET_PRIVATE_DATA'})).data.covenant.plan.includes('dann werde ich'));
 await covenant.close();
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
 await forcedWorkerRestartAcceptance();
} catch(error) {
 if(!browser)report.skip('installed-extension acceptance',error.message.split('\n').filter(line=>/EPERM|Operation not permitted|FATAL|Error|browserType|closed|Singleton|socket/u.test(line)).join('\n').slice(0,3000));
 else report.check('suite completed',false,error.stack);
 process.exitCode=1;
} finally {
 await browser?.context.close().catch(()=>{});await site?.close();
 const summary=report.save(path.join(evidence,'final-features-chromium.json'));
 if(summary.FAIL||summary.NOT_RUN)process.exitCode=1;
}
