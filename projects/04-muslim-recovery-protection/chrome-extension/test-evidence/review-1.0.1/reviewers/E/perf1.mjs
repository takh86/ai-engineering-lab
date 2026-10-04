import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {execFileSync} from 'node:child_process';
import { launch, openExtPage, send, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const S='/tmp/claude-0/-home-user-ai-engineering-lab/76910e72-6eb0-5df8-a0a7-f9c1d34aa315/scratchpad/review/E';
const exe='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const stats=a=>{const s=[...a].sort((x,y)=>x-y);return {n:s.length,min:Math.round(s[0]),median:Math.round(s[Math.floor(s.length/2)]),max:Math.round(s[s.length-1])}};
const rss=marker=>{const lines=execFileSync('ps',['-eo','rss,args']).toString().split('\n').filter(l=>l.includes(marker));return Math.round(lines.reduce((s,l)=>s+Number(l.trim().split(/\s+/)[0]||0),0)/1024)};
const res={};
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tabsira-perfE-'));
const call=(p,m)=>p.evaluate(async m=>{const t=performance.now();const r=await chrome.runtime.sendMessage(m);return {ms:performance.now()-t,r}},m);
const status=async p=>(await call(p,{type:'GET_STATUS'})).r.status;
// Phase A: fresh profile
let t0=Date.now();
let b=await launch({executablePath:exe,extensionDir:S+'/ext',profileDir:profile,lang:'en'});
res.firstLaunchReadyMs=Date.now()-t0;
let o=await openExtPage(b.context,b.extensionId,'options.html');
await sleep(2000);
res.rssOff_MB=rss(profile);
// activation w/ base list + starter
let r=await call(o,{type:'COMPLETE_ONBOARDING',baseList:true,starterTerms:true}); res.activationMs=Math.round(r.ms); res.activationState=r.r.status?.state;
await sleep(3000); res.rssOn_MB=rss(profile);
// save latency w/ base on: add/remove a domain, N=15
let st=await status(o); const times=[];
for(let i=0;i<15;i++){const s=await status(o);const settings={...s.settings,domains:i%2?[]:['perf'+i+'.test']};const x=await call(o,{type:'SAVE_SETTINGS',baseRevision:s.revision,settings});if(!x.r.ok)console.log('save fail',JSON.stringify(x.r.error));times.push(x.ms);}
res.saveWithBaseOn=stats(times);
// toggle base off/on N=8
const off=[],on=[];
for(let i=0;i<8;i++){let s=await status(o);let x=await call(o,{type:'SAVE_SETTINGS',baseRevision:s.revision,settings:{...s.settings,baseList:false}});off.push(x.ms);s=await status(o);x=await call(o,{type:'SAVE_SETTINGS',baseRevision:s.revision,settings:{...s.settings,baseList:true}});on.push(x.ms);}
res.disableBase=stats(off); res.enableBase=stats(on);
// warm GET_STATUS N=20
const w=[];for(let i=0;i<20;i++)w.push((await call(o,{type:'GET_STATUS'})).ms); res.getStatusWarm=stats(w);
// save with large user data: 5000 domains
const big=[];for(let i=0;i<5000;i++)big.push('bulk'+i+'.test');
{const s=await status(o);const x=await call(o,{type:'SAVE_SETTINGS',baseRevision:s.revision,settings:{...s.settings,domains:big}});res.save5000domains={ok:x.r.ok,ms:Math.round(x.ms),err:x.r.error?.code};}
{const s=await status(o);const x=await call(o,{type:'SAVE_SETTINGS',baseRevision:s.revision,settings:{...s.settings,domains:[]}});}
await sleep(500);
// cold worker: CDP stop all workers then GET_STATUS from page
const cdp=await b.context.newCDPSession(o); await cdp.send('ServiceWorker.enable');
const cold=[],coldRtt=[];
for(let i=0;i<8;i++){
  await cdp.send('ServiceWorker.stopAllWorkers'); await sleep(1500);
  const t=Date.now(); const x=await call(o,{type:'GET_STATUS'}); cold.push(Date.now()-t); coldRtt.push(x.ms);
}
res.getStatusColdAfterWorkerStop=stats(cold);
// storage growth
res.storage=await o.evaluate(async()=>{const all=await chrome.storage.local.get(null);const keys=Object.keys(all);const by={};for(const k of keys){const p=k.split(':')[0];by[p]=(by[p]||0)+1}return {keys:keys.length,by,bytes:await chrome.storage.local.getBytesInUse(null)}});
await b.context.close();
// Phase B: browser restart with persisted 242k list, N=5: worker ready time and first status
const ready=[],first=[],rssRe=[];
for(let i=0;i<5;i++){
  const t=Date.now(); const bb=await launch({executablePath:exe,extensionDir:S+'/ext',profileDir:profile,lang:'en'}); ready.push(Date.now()-t);
  const pp=await openExtPage(bb.context,bb.extensionId,'options.html'); const x=await call(pp,{type:'GET_STATUS'}); first.push(x.ms);
  if(i===0) res.stateAfterRestart={state:x.r.status.state,reasons:x.r.status.reasons,base:x.r.status.base.enabled};
  await sleep(2500); rssRe.push(rss(profile));
  await bb.context.close();
}
res.restartReadyMs=stats(ready); res.firstStatusAfterRestartMs=stats(first); res.rssAfterRestart_MB=stats(rssRe);
res.env={chromium:'141.0.7390.37 (Playwright chromium-1194, headless=new)',node:process.version,cpus:os.cpus().length+'x '+os.cpus()[0].model,memGB:Math.round(os.totalmem()/2**30),baseDomains:242750};
fs.writeFileSync(S+'/perf1.json',JSON.stringify(res,null,1)); console.log(JSON.stringify(res,null,1));
