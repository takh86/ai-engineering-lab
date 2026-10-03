import {boot, lib} from './h.mjs';
const b = await boot();
await b.onboard(false,false);
let r=await b.save({baseList:false,domains:['mysite.test']});
console.log('state',r.status.state);
let o=await b.match('https://tabsira-selftest.test/'); console.log('selftest with baseList OFF + active user rules: matched=',o.matchedRules.length);
// real navigation
const page = await b.context.newPage();
let err=null; try{ await page.goto('https://tabsira-selftest.test/',{timeout:8000}); }catch(e){err=e.message.split('\n')[0];}
console.log('real nav selftest url=',page.url(),'err=',err);
r=await b.save({baseList:true,domains:['mysite.test']});
err=null; try{ await page.goto('https://tabsira-selftest.test/',{timeout:8000}); }catch(e){err=e.message.split('\n')[0];}
console.log('baseList ON -> url=',page.url(),'err=',err);
await page.screenshot({path:'a-selftest-blocked.png'});
await b.context.close();
