import fs from 'node:fs'; import zlib from 'node:zlib'; import crypto from 'node:crypto';
const R='/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/';
const raw=zlib.gunzipSync(fs.readFileSync(R+'data/base-list/adult-domains.txt.gz')).toString();
const d=raw.split('\n').filter(Boolean);
console.log(d.length, crypto.createHash('sha256').update(d.join('\n')+'\n').digest('hex'));
const set=new Set(d);
const ruleset=JSON.parse(fs.readFileSync(S2()+'z/rulesets/base_adult.json'));
function S2(){return '/tmp/claude-0/-home-user-ai-engineering-lab/76910e72-6eb0-5df8-a0a7-f9c1d34aa315/scratchpad/review/B/'}
const rd=ruleset[0].condition.requestDomains.slice(1);
console.log('ruleset==snapshot', JSON.stringify(rd)===JSON.stringify(d));
const { ENGINES } = await import(R+'src/core/engines.js'); const {ALL_ENGINE_DOMAINS}=await import(R+'src/core/engines.js');
const sus=['google.com','bing.com','youtube.com','duckduckgo.com','github.io','blogspot.com','wordpress.com','tumblr.com','reddit.com','twitter.com','x.com','facebook.com','wikipedia.org','amazonaws.com','cloudfront.net','pages.dev','netlify.app','vercel.app','medium.com','archive.org','telegram.org','t.me','bit.ly','imgur.com','blogspot.com.eg','weebly.com','wixsite.com','live.com','yahoo.com','brave.com','ecosia.org','qwant.com','yandex.com','yandex.ru','claude.ai','anthropic.com','ai','com'];
console.log('suspicious present:', sus.filter(s=>set.has(s)));
console.log('single label', d.filter(x=>!x.includes('.')).slice(0,5));
const parents=new Set(); let cov=0; for(const x of d){const p=x.split('.'); for(let i=1;i<p.length;i++) if(set.has(p.slice(i).join('.'))){cov++;break;}} console.log('covered by parent still present',cov);
const eng=ALL_ENGINE_DOMAINS.filter(e=>d.some(x=>e===x||e.endsWith('.'+x))); console.log('engine overlap',eng);
const known=fs.readFileSync(R+'data/base-list/known-benign-canaries.txt','utf8').split('\n').filter(l=>l&&!l.startsWith('#'));
console.log('canaries',known.length,'hit',known.filter(k=>d.some(x=>k===x||k.endsWith('.'+x))).slice(0,10));
console.log('tlds', Object.entries(d.reduce((a,x)=>{const t=x.split('.').pop();a[t]=(a[t]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,8));
// shared suffix hosts
const hosts=['github.io','gitlab.io','pages.dev','netlify.app','vercel.app','herokuapp.com','blogspot.com','wordpress.com','tumblr.com','weebly.com','wixsite.com','web.app','firebaseapp.com','azurewebsites.net','appspot.com','cloudfront.net','amazonaws.com','workers.dev','onrender.com','fly.dev','glitch.me','repl.co','myshopify.com','co.uk','com.au'];
console.log('shared suffix subdomain entries', hosts.map(h=>[h,d.filter(x=>x.endsWith('.'+h)).length]).filter(a=>a[1]));
