import {boot, lib} from './h.mjs';
const b = await boot('release',{extraArgs:['--no-proxy-server'], lang:'en'});
const ob = b.context.pages().find(p=>p.url().includes('onboarding.html'));
for (let i=0;i<4;i++) await ob.click('#next');
await ob.dblclick('#finish'); await lib.sleep(1500);
console.log('after dblclick finish msg:', (await ob.textContent('#message')).trim(), '| class', await ob.getAttribute('#message','class'));
console.log('status', (await b.status()).state);
await ob.screenshot({path:'a-onboarding-dblclick-en.png',fullPage:true});
// popup first view in each state
const pop = await lib.openExtPage(b.context,b.extensionId,'popup.html'); await lib.sleep(500);
console.log('popup active text:', (await pop.textContent('#status')).replace(/\s+/g,' ').trim());
await pop.screenshot({path:'a-popup-active-en.png'});
const opt = await lib.openExtPage(b.context,b.extensionId,'options.html'); await lib.sleep(500);
await opt.screenshot({path:'a-options-en.png',fullPage:true});
console.log('incognito line:', (await opt.textContent('#incognito')).trim());
// reopen onboarding after done
const ob2 = await lib.openExtPage(b.context,b.extensionId,'onboarding.html'); await lib.sleep(500);
console.log('reopen onboarding message:', (await ob2.textContent('#message')).trim());
await b.context.close();
