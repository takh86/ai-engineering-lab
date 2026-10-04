import fs from 'node:fs';
import { launch, openExtPage, send, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const S='/tmp/claude-0/-home-user-ai-engineering-lab/76910e72-6eb0-5df8-a0a7-f9c1d34aa315/scratchpad/review/E';
const b = await launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', extensionDir: S+'/ext', lang:'en' });
const act = p=>p.evaluate(()=>{const e=document.activeElement;return e?e.tagName+(e.id?'#'+e.id:''):'null'});
// onboarding focus
const ob = await openExtPage(b.context,b.extensionId,'onboarding.html'); await ob.bringToFront();
await ob.focus('#next');
for (let i=1;i<=4;i++){ await ob.keyboard.press('Enter'); await sleep(100); console.log('onb after Next#'+i, await act(ob), 'progress:', await ob.textContent('#progress')); }
await ob.focus('#back'); console.log('titles', await ob.title());
await ob.keyboard.press('Enter'); console.log('back->',await act(ob));
await ob.keyboard.press('Enter');await ob.keyboard.press('Enter');await ob.keyboard.press('Enter'); 
await ob.focus('#next'); for(let i=0;i<4;i++) await ob.keyboard.press('Enter'); // may lose focus
await sleep(100);
// go to step 1 via back repeatedly using DOM clicks w/ focus
await ob.evaluate(()=>{for(let i=0;i<5;i++)document.querySelector('#back').click()});
await ob.focus('#next'); await ob.evaluate(()=>{});
await ob.focus('#back').catch(()=>{});
console.log('step1 back hidden?', await ob.evaluate(()=>document.querySelector('#back').hidden));
await ob.evaluate(()=>{document.querySelector('#next').click();}); await ob.focus('#back'); await ob.keyboard.press('Enter'); console.log('Back at step2 -> step1, active:', await act(ob));
// finish
await ob.evaluate(()=>{for(let i=0;i<4;i++)document.querySelector('#next').click()});
await ob.focus('#finish'); await ob.keyboard.press('Enter'); await sleep(1500); console.log('after finish active:', await act(ob), await ob.textContent('#message'));
// help timer
const h = await openExtPage(b.context,b.extensionId,'help.html'); await h.bringToFront(); await h.focus('#start'); await h.keyboard.press('Enter'); await sleep(300);
console.log('help after start active:', await act(h), 'disabled', await h.evaluate(()=>document.querySelector('#start').disabled));
console.log('timer role snapshot', await h.locator('.timer').ariaSnapshot());
await h.close();
// options confirm
const o = await openExtPage(b.context,b.extensionId,'options.html'); await o.bringToFront();
await o.focus('#reset'); await o.keyboard.press('Enter'); console.log('reset confirm focus', await act(o));
await o.keyboard.press('Escape'); console.log('after Escape confirm hidden?', await o.evaluate(()=>document.querySelector('#resetConfirm').hidden));
await o.keyboard.press('Tab'); console.log('tab from yes->',await act(o)); await o.keyboard.press('Enter'); console.log('after cancel active:', await act(o));
await o.focus('#sessionButtons button'); await o.keyboard.press('Enter'); console.log('session confirm focus', await act(o), await o.textContent('#sessionConfirmText'));
await o.keyboard.press('Tab'); await o.keyboard.press('Enter'); console.log('after session cancel active', await act(o));
console.log(await o.locator('body').ariaSnapshot().then(s=>s.slice(0,2500)));
// titles
for (const pg of ['popup','options','onboarding','blocked','help']){const p=await openExtPage(b.context,b.extensionId,pg+'.html');console.log('title',pg,await p.title());await p.close();}
await b.context.close();
