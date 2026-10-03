import {boot, lib} from './h.mjs';
const b = await boot();
console.log('version', b.version());
await lib.sleep(1500);
const pages = b.context.pages().map(p=>p.url());
console.log('pages', pages);
console.log('initial status', JSON.stringify(await b.status()));
await b.context.close();
