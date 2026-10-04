import {boot, lib} from './h.mjs';
const b = await boot('test',{extraArgs:['--no-proxy-server']});
const stt = async(l)=>{const s=await b.status(); console.log(l.padEnd(46),'state='+s.state,JSON.stringify(s.reasons),'dyn='+s.counts?.dynamicRules,'base='+s.base?.enabled); return s;};
await stt('fresh install');
const badge = async()=> b.page.evaluate(()=>chrome.action.getBadgeText({}));
console.log('badge fresh:', JSON.stringify(await badge()));
await b.onboard(true,true); await stt('after onboarding');
console.log('badge active:', JSON.stringify(await badge()));
await b.save({baseList:true,starterTerms:true,domains:['mine.test'],words:['myword']});
await stt('saved');
// S2 delete dynamic rules behind back
await b.page.evaluate(async()=>{const r=await chrome.declarativeNetRequest.getDynamicRules(); await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:r.map(x=>x.id)});});
let o=await b.match('https://mine.test/'); console.log('after wipe, mine.test matched?',o.matchedRules.length);
await stt('after rules wiped (GET_STATUS repairs)');
o=await b.match('https://mine.test/'); console.log('after repair, mine.test matched?',o.matchedRules.length);
// S3 disable base
await b.page.evaluate(()=>chrome.declarativeNetRequest.updateEnabledRulesets({disableRulesetIds:['base_adult']}));
await stt('after base ruleset disabled behind back');
// S1 corrupt
const keys = await b.page.evaluate(async()=>Object.keys(await chrome.storage.local.get(null)));
console.log(keys.join(' | '));
const cfgKey = keys.filter(k=>k.startsWith('cfg:')).sort((a,c)=>Number(c.split(':')[1])-Number(a.split(':')[1]))[0];
await b.page.evaluate(async k=>{await chrome.storage.local.set({[k]:{v:2,garbage:true}});},cfgKey);
const s1=await stt('corrupt newest config record');
console.log('settings null?',s1.settings===null,'badge:',JSON.stringify(await badge()));
o=await b.match('https://mine.test/'); console.log('rules left in place -> mine.test matched?',o.matchedRules.length);
console.log('save in corrupt:', JSON.stringify((await b.send({type:'SAVE_SETTINGS',baseRevision:0,settings:{baseList:false,starterTerms:false,domains:[],allow:[],words:[],contains:[]}})).error));
console.log('export in corrupt:', JSON.stringify((await b.send({type:'GET_EXPORT'})).error));
console.log('session in corrupt:', JSON.stringify((await b.send({type:'START_SESSION',minutes:60})).error));
console.log('onboarding in corrupt:', JSON.stringify((await b.send({type:'COMPLETE_ONBOARDING',baseList:true,starterTerms:true})).error));
// UI in corrupt
const pop = await lib.openExtPage(b.context,b.extensionId,'popup.html'); await lib.sleep(500);
console.log('popup status text:', (await pop.textContent('#status')).replace(/\s+/g,' ').trim(), '| repair visible?', await pop.isVisible('#repair'));
await pop.screenshot({path:'a-popup-corrupt.png'});
const opt = await lib.openExtPage(b.context,b.extensionId,'options.html'); await lib.sleep(500);
console.log('options: baseList checkbox checked?', await opt.isChecked('#baseList'), 'domains textarea:', JSON.stringify(await opt.inputValue('#domains')));
await opt.click('button[type=submit]'); await lib.sleep(600);
console.log('options save in corrupt msg:', (await opt.textContent('#message')).trim());
await opt.screenshot({path:'a-options-corrupt.png',fullPage:true});
// reset
await opt.click('#reset'); await opt.click('#resetYes'); await lib.sleep(1000);
console.log('reset msg:', (await opt.textContent('#message')).trim());
const s2=await stt('after reset from corrupt');
// S6 settings missing but rules present
await b.save({baseList:true,domains:['again.test']});
await b.page.evaluate(async()=>{const all=await chrome.storage.local.get(null); await chrome.storage.local.remove(Object.keys(all).filter(k=>k.startsWith('cfg:')||k=='config'));});
await stt('config records removed, rules remain');
await b.context.close();
