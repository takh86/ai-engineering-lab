import fs from 'node:fs';
import { launch, openExtPage, send, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const S='/tmp/claude-0/-home-user-ai-engineering-lab/76910e72-6eb0-5df8-a0a7-f9c1d34aa315/scratchpad/review/E';
const exe='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out={};
for (const lang of ['ar','en','de']) {
  const b = await launch({ executablePath: exe, extensionDir: S+'/ext', lang });
  out.version = b.version();
  const opt = await openExtPage(b.context, b.extensionId, 'options.html');
  // pre-onboarding screenshots of onboarding
  const ob = await openExtPage(b.context, b.extensionId, 'onboarding.html');
  for (const scheme of ['light','dark']) {
    await ob.emulateMedia({colorScheme:scheme});
    for (let step=0; step<5; step++) { await ob.setViewportSize({width:900,height:800}); await ob.screenshot({path:`${S}/shots/onboarding-${lang}-${scheme}-step${step+1}.png`, fullPage:true}); if (step<4) await ob.click('#next'); }
    await ob.reload(); 
  }
  const r = await send(opt, {type:'COMPLETE_ONBOARDING', baseList:true, starterTerms:true});
  out[lang+'-onboard'] = r.ok ? r.status.state : JSON.stringify(r);
  await sleep(1500);
  await opt.evaluate(async()=>{const s=(await chrome.runtime.sendMessage({type:'GET_STATUS'})).status; await chrome.runtime.sendMessage({type:'SAVE_SETTINGS',baseRevision:s.revision,settings:{...s.settings,domains:['example-block.test'],allow:['ok.test'],words:['testword'],contains:['testphrase']}});});
  for (const page of ['popup','options','blocked','help']) {
    for (const scheme of ['light','dark']) {
      const p = await openExtPage(b.context, b.extensionId, page+'.html');
      await p.emulateMedia({colorScheme:scheme});
      await p.setViewportSize({width: page==='popup'?380:900, height: 800});
      await sleep(400);
      await p.screenshot({path:`${S}/shots/${page}-${lang}-${scheme}.png`, fullPage:true});
      await p.close();
    }
  }
  await b.context.close();
}
fs.writeFileSync(S+'/ui1.json', JSON.stringify(out,null,1)); console.log(out);
