import {boot, lib} from './h.mjs';
const site = await lib.startSite();
const b = await boot('release',{extraArgs:['--no-proxy-server']});
await b.onboard(false,false);
await b.save({domains:['blocked.test'],allow:['ok.blocked.test'], words:['badword'], contains:['xyzz']});
const P=site.port;
const tests = [
 ['blocked domain',`http://blocked.test:${P}/`],
 ['subdomain',`http://a.blocked.test:${P}/page`],
 ['lookalike',`http://xblocked.test:${P}/`],
 ['exception sub of blocked? (conflict-free: ok.blocked.test is under blocked parent)',`http://ok.blocked.test:${P}/`],
 ['search phrase google',`http://www.google.com:${P}/search?q=badword`],
 ['search benign google',`http://www.google.com:${P}/search?q=goodword`],
 ['search contains',`http://www.bing.com:${P}/search?q=aaxyzzbb`],
 ['phrase in non-search site param',`http://other.test:${P}/?q=badword`],
];
for (const [n,u] of tests){ const r=await lib.visit(b.context,u); console.log(n.padEnd(60),'blocked='+r.blocked,'real='+r.real,'err='+r.error); }
console.log('server hits:', JSON.stringify(site.hits));
// blocked page + help now
const page = await b.context.newPage();
await page.goto(`http://blocked.test:${P}/secret?x=1`).catch(()=>{});
await lib.sleep(300);
console.log('url', page.url());
const txt = await page.textContent('body'); console.log('blocked page text:', txt.replace(/\s+/g,' ').slice(0,400));
console.log('page contains blocked URL?', txt.includes('secret')||txt.includes('blocked.test'));
await page.screenshot({path:'a-blocked-ar.png'});
await page.click('a[href="help.html"]'); await lib.sleep(300);
console.log('help url', page.url());
await page.click('#start'); await lib.sleep(1200); console.log('timer', await page.textContent('#timer'));
await page.screenshot({path:'a-help-ar.png'});
console.log('history length', await page.evaluate(()=>history.length));
await page.goBack().catch(()=>{}); await lib.sleep(500); console.log('after back:', page.url());
await page.goBack().catch(()=>{}); await lib.sleep(500); console.log('after back2:', page.url());
console.log('server hits end:', JSON.stringify(site.hits));
// storage scan: do rules/ storage hold history?
const store = await b.page.evaluate(()=>chrome.storage.local.get(null)); console.log('storage keys', Object.keys(store).join(','));
console.log('json contains blocked url?', JSON.stringify(store).includes('secret'));
await b.context.close(); await site.close();
