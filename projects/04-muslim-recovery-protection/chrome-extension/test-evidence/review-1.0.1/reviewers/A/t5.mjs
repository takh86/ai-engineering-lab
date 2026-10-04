import {boot, lib} from './h.mjs';
const b = await boot();
await b.onboard(false,false);
const p='ب'.repeat(13);
const r=await b.save({words:[p]});
console.log('save',r.ok,r.status.state,r.status.reasons);
for (const [n,u] of [['google','https://www.google.com/search?q='],['bing','https://www.bing.com/search?q='],['yahoo','https://search.yahoo.com/search?p='],['yandex','https://yandex.com/search/?text='],['youtube','https://www.youtube.com/results?search_query=']]) {
  const o=await b.match(u+encodeURIComponent(p)); console.log(n, o.matchedRules.length?'BLOCK':'ALLOWED (not blocked)');
}
// UI message shown on save
await b.page.goto('chrome-extension://'+b.extensionId+'/options.html');
await b.page.fill('#words', p); await b.page.click('button[type=submit]'); await lib.sleep(800);
console.log('UI message:', JSON.stringify(await b.page.textContent('#message')), 'class', await b.page.getAttribute('#message','class'));
console.log('UI status:', JSON.stringify(await b.page.textContent('#status')));
await b.page.screenshot({path:'a5-partial-after-save.png', fullPage:true});
await b.context.close();
