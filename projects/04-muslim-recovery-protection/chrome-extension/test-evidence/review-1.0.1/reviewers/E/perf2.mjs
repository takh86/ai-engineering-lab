import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {execFileSync} from 'node:child_process';
import { launch, openExtPage, send, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const S='/tmp/claude-0/-home-user-ai-engineering-lab/76910e72-6eb0-5df8-a0a7-f9c1d34aa315/scratchpad/review/E';
const exe='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const stats=a=>{const s=[...a].sort((x,y)=>x-y);return {n:s.length,min:Math.round(s[0]),median:Math.round(s[Math.floor(s.length/2)]),max:Math.round(s[s.length-1])}};
const call=(p,m)=>p.evaluate(async m=>{const t=performance.now();const r=await chrome.runtime.sendMessage(m);return {ms:performance.now()-t,r}},m);
const status=async p=>(await call(p,{type:'GET_STATUS'})).r.status;
const res={};
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tabsira-perfE2-'));
const b=await launch({executablePath:exe,extensionDir:S+'/ext',profileDir:profile,lang:'en'});
const o=await openExtPage(b.context,b.extensionId,'options.html');
await call(o,{type:'COMPLETE_ONBOARDING',baseList:true,starterTerms:true});
// max config
const rnd=n=>Array.from({length:n},()=>Math.random().toString(36).slice(2,9));
const domains=rnd(1000).map((x,i)=>`mx${i}${x}.test`), allow=rnd(300).map((x,i)=>`al${i}${x}.example`);
const words=[...Array.from({length:30},(_,i)=>`latin phrase number ${i} abcdefgh`),...Array.from({length:30},(_,i)=>`كلمة ${['ا','ب','ت','ث','ج'][i%5]}${i}`)].slice(0,60);
const contains=Array.from({length:40},(_,i)=>`contain ${i} term xyz`);
let s=await status(o);
let x=await call(o,{type:'SAVE_SETTINGS',baseRevision:s.revision,settings:{...s.settings,domains,allow:[],words,contains}});
res.maxSave={ok:x.r.ok,ms:Math.round(x.ms),err:x.r.error};
s=await status(o); res.maxCounts=s.counts; res.maxState={state:s.state,reasons:s.reasons};
const cdp=await b.context.newCDPSession(o); await cdp.send('ServiceWorker.enable');
const warm=[],cold=[];
for(let i=0;i<10;i++)warm.push((await call(o,{type:'GET_STATUS'})).ms);
for(let i=0;i<8;i++){await cdp.send('ServiceWorker.stopAllWorkers');await sleep(1500);const t=Date.now();await call(o,{type:'GET_STATUS'});cold.push(Date.now()-t);}
res.maxGetStatusWarm=stats(warm);res.maxGetStatusColdWorker=stats(cold);
// cold save too
const coldSave=[];
for(let i=0;i<5;i++){await cdp.send('ServiceWorker.stopAllWorkers');await sleep(1500);s=await status(o);const t=Date.now();const r=await call(o,{type:'SAVE_SETTINGS',baseRevision:s.revision,settings:{...s.settings,domains:i%2?domains:domains.slice(0,999)}});coldSave.push(r.ms);}
res.maxSaveVariants=stats(coldSave);
// growth: 300 saves + sessions? (no sessions: irreversible within test profile OK but skip)
const before=await o.evaluate(async()=>{const a=await chrome.storage.local.get(null);return {keys:Object.keys(a).length,bytes:await chrome.storage.local.getBytesInUse(null)}});
const t0=Date.now();
for(let i=0;i<300;i++){s=await status(o);const r=await call(o,{type:'SAVE_SETTINGS',baseRevision:s.revision,settings:{...s.settings,domains:i%2?['g.test']:[]}});if(!r.r.ok){res.growthFail=r.r.error;break;}}
res.growth300Saves={ms:Date.now()-t0,before,after:await o.evaluate(async()=>{const a=await chrome.storage.local.get(null);const by={};for(const k of Object.keys(a)){const p=k.split(':')[0];by[p]=(by[p]||0)+1}return {keys:Object.keys(a).length,by,bytes:await chrome.storage.local.getBytesInUse(null)}})};
// worker JS heap via CDP of the service worker target
res.workerHeapMB=null;
await b.context.close();
fs.writeFileSync(S+'/perf2.json',JSON.stringify(res,null,1));console.log(JSON.stringify(res,null,1));
