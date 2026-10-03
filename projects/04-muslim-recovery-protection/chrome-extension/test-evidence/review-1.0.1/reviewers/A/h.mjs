import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const P='/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension';
export const lib = await import(P+'/tests/e2e/lib.mjs');
export const S='/tmp/claude-0/-home-user-ai-engineering-lab/76910e72-6eb0-5df8-a0a7-f9c1d34aa315/scratchpad/review/A';
export const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export async function boot(variant='test', opts={}) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'revA-'));
  const b = await lib.launch({ executablePath: CHROME, extensionDir: path.join(S,'pkg',variant), profileDir, ...opts });
  b.profileDir = profileDir;
  b.page = await lib.openExtPage(b.context, b.extensionId, 'options.html');
  b.send = m => lib.send(b.page, m);
  b.status = async () => (await b.send({type:'GET_STATUS'})).status;
  b.onboard = async (baseList=true, starterTerms=true) => b.send({type:'COMPLETE_ONBOARDING', baseList, starterTerms});
  b.save = async (settings) => { const st = await b.status(); return b.send({type:'SAVE_SETTINGS', baseRevision: st.revision, settings: {baseList:false,starterTerms:false,domains:[],allow:[],words:[],contains:[],...settings}}); };
  b.match = url => b.page.evaluate(u => chrome.declarativeNetRequest.testMatchOutcome({url:u,type:'main_frame'}), url);
  return b;
}
