import {boot, lib} from './h.mjs';
const b = await boot('optional',{extraArgs:['--no-proxy-server'], lang:'en'});
const ob = b.context.pages().find(p=>p.url().includes('onboarding.html')) ?? await lib.openExtPage(b.context,b.extensionId,'onboarding.html');
await lib.sleep(500);
console.log('lang', await ob.evaluate(()=>document.documentElement.lang+' '+document.documentElement.dir));
console.log('title', await ob.title());
for (let i=0;i<4;i++){ console.log('step',(await ob.textContent('#progress')).trim(), '|', (await ob.textContent('section:not([hidden]) h2')).trim()); await ob.click('#next'); }
console.log('step5 permission:', (await ob.textContent('#permission')).trim(), 'grant visible', await ob.isVisible('#grant'));
console.log('status before finish:', JSON.stringify((await b.status()).state));
await ob.click('#finish'); await lib.sleep(1200);
console.log('after finish msg:', (await ob.textContent('#message')).trim(), '| class', await ob.getAttribute('#message','class'));
await ob.screenshot({path:'a-onboarding-nohost-en.png',fullPage:true});
const s=await b.status(); console.log('status', s.state, s.reasons, s.permissions);
const r = await b.send({type:'START_SESSION',minutes:60}); console.log('session without host perm:', r.ok, r.error?.code);
const o = await b.match('https://tabsira-selftest.test/'); console.log('selftest rule matched (DNR only; redirect would not run w/o host perm)?',o.matchedRules.length);
// real navigation: does redirect happen without host permission?
const site = await lib.startSite();
await b.save({domains:['nohost.test']});
const v = await lib.visit(b.context,`http://nohost.test:${site.port}/`); console.log('real visit w/o host permission: blocked=',v.blocked,'real=',v.real,'err=',v.error, v.url);
await site.close();
const pop = await lib.openExtPage(b.context,b.extensionId,'popup.html'); await lib.sleep(500);
console.log('popup:', (await pop.textContent('#status')).replace(/\s+/g,' ').trim());
await pop.screenshot({path:'a-popup-partial-en.png'});
await b.context.close();
