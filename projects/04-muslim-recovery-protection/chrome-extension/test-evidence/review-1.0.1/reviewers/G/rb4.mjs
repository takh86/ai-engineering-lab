import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const site = await startSite();
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
let r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: true });
const mk = i => `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${String(i).padStart(4,'0')}${'d'.repeat(52)}.example`; // len?
console.log(mk(1).length);
const domains = Array.from({length:1000}, (_,i)=>mk(i)).map(d=>d.slice(-253).replace(/^[.]/,'x'));
const t0 = Date.now();
let s = await send(page, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { baseList:false, starterTerms:true, domains, allow:[], words:[], contains:[] } });
console.log('save big', s.ok, JSON.stringify(s.error??{}), s.status?.state, JSON.stringify(s.status?.reasons), Date.now()-t0,'ms');
const v = await visit(b.context, `http://${domains[999]}:${site.port}/`);
console.log('visit last domain blocked?', v.blocked, v.error);
const st = await b.getWorker().evaluate(async()=>{ const a = await chrome.storage.local.get(null); return Object.fromEntries(Object.entries(a).map(([k,v])=>[k, JSON.stringify(v).length])); });
console.log(JSON.stringify(st));
const bytes = await b.getWorker().evaluate(()=>chrome.storage.local.getBytesInUse(null));
console.log('bytes in use', bytes, 'quota', chrome.storage?.local?.QUOTA_BYTES);
// IMPORT near max: also 300 allow
await b.context.close(); await site.close();
