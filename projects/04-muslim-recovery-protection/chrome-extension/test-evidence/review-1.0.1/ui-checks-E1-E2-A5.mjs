import { launch, openExtPage, send, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const exe='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const res={};
{ const b=await launch({executablePath:exe, extensionDir:process.cwd()+'/finalpkg', lang:'de'});
  for (const page of ['popup','options','onboarding']) for (const w of [360,320]) {
    const p=await openExtPage(b.context,b.extensionId,page+'.html'); await p.setViewportSize({width:w,height:800}); await sleep(300);
    res[`E1 de ${page} ${w}px wordmark height / line`]=await p.evaluate(()=>{const e=document.querySelector('.wordmark');const lh=parseFloat(getComputedStyle(e).lineHeight)||parseFloat(getComputedStyle(e).fontSize)*1.35;return [Math.round(e.getBoundingClientRect().height),Math.round(lh), e.getBoundingClientRect().height<=lh*1.5];});
    await p.close(); }
  // E-2 onboarding focus
  const ob=await openExtPage(b.context,b.extensionId,'onboarding.html');
  const act=()=>ob.evaluate(()=>document.activeElement?.id||document.activeElement?.tagName);
  await ob.focus('#next'); for (let i=0;i<3;i++){ await ob.keyboard.press('Enter'); } 
  res['E2 after Next x3 (step 4), active']=await act();
  await ob.keyboard.press('Enter'); res['E2 after Next on step 4 (hides Next), active']=await act();
  await ob.focus('#back'); for (let i=0;i<4;i++){ await ob.keyboard.press('Enter'); if(i<3) await ob.focus('#back').catch(()=>{});} res['E2 after Back to step 1, active']=await act();
  for (let i=0;i<4;i++){ await ob.focus('#next'); await ob.keyboard.press('Enter'); }
  await ob.focus('#finish'); await ob.keyboard.press('Enter'); await sleep(800);
  res['E2 after Finish, active']=await act();
  const help=await openExtPage(b.context,b.extensionId,'help.html'); await help.focus('#start'); await help.keyboard.press('Enter'); await sleep(300);
  res['E2 help after Start, active']=await help.evaluate(()=>document.activeElement?.id);
  // A-5 double click finish on a fresh profile
  await b.context.close(); }
{ const b=await launch({executablePath:exe, extensionDir:process.cwd()+'/finalpkg', lang:'en'});
  const ob=await openExtPage(b.context,b.extensionId,'onboarding.html');
  for (let i=0;i<4;i++) await ob.click('#next');
  await ob.dblclick('#finish'); await sleep(1200);
  res['A5 double click Finish: message class / text']=await ob.evaluate(()=>[document.querySelector('#message').className, document.querySelector('#message').textContent.slice(0,60), !document.querySelector('#selftest').hidden]);
  await b.context.close(); }
console.log(JSON.stringify(res,null,1));
