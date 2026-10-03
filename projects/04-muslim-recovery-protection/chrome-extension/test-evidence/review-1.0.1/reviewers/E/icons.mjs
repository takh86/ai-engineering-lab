import { chromium } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/node_modules/playwright-core/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:760,height:330}});await p.goto('file://'+process.cwd()+'/icons.html');await p.screenshot({path:process.cwd()+'/shots/icons.png'});await b.close();
