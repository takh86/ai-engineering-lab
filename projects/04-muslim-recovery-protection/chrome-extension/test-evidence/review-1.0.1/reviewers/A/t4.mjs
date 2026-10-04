import {boot, lib} from './h.mjs';
const b = await boot();
await b.onboard(false,false);
const ar = n => 'ب'.repeat(n);
for (const mode of ['words','contains']) for (let n=8;n<=20;n++){
  const r = await b.save({[mode]:[ar(n)]});
  const st = r.status ?? await b.status();
  console.log(mode,'n='+n,'save', r.ok?'ok':r.error.code, 'state', st.state, JSON.stringify(st.reasons), 'dyn', st.counts?.dynamicRules);
}
// with a space: two 5-letter words
for (let n=3;n<=9;n++){ const p=ar(n)+' '+ar(n); const r=await b.save({words:[p]}); const st=r.status??await b.status(); console.log('2words n='+n, r.ok?'ok':r.error.code, st.state, JSON.stringify(st.reasons)); }
// english
for (const n of [60]) { const r = await b.save({words:['a'.repeat(n)]}); const st=r.status??await b.status(); console.log('eng '+n, r.ok?'ok':r.error.code, st.state, JSON.stringify(st.reasons)); }
for (const n of [70,75,80,85,90]) { const p='ab'.repeat(30); }
await b.context.close();
