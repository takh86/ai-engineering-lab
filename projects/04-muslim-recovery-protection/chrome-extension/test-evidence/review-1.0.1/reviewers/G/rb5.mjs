import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const site = await startSite();
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
let r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: true });
r = await send(page, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { baseList: true, starterTerms: true, domains: ['blocked.example', 'xn--d-toa.example'], allow: [], words: [], contains: [] } });
console.log('save', r.ok, r.status.state, JSON.stringify(r.status.reasons));
const P = site.port;
const urls = [
 ['control blocked.example', `http://blocked.example:${P}/`],
 ['subdomain', `http://a.blocked.example:${P}/`],
 ['UPPERCASE host', `http://BLOCKED.EXAMPLE:${P}/`],
 ['trailing dot', `http://blocked.example.:${P}/`],
 ['trailing dot+sub', `http://a.blocked.example.:${P}/`],
 ['userinfo', `http://user:pw@blocked.example:${P}/`],
 ['fullwidth dot', `http://blocked%E3%80%82example:${P}/`],
 ['percent-encoded host char', `http://block%65d.example:${P}/`],
 ['idn punycode form', `http://xn--d-toa.example:${P}/`],
 ['idn unicode form', `http://ǆ.example:${P}/`],
 ['search engine control (starter)', `http://www.google.com:${P}/search?q=xvideos`],
 ['engine trailing dot', `http://www.google.com.:${P}/search?q=xvideos`],
 ['engine trailing dot bare', `http://google.com.:${P}/search?q=xvideos`],
 ['engine uppercase', `http://WWW.GOOGLE.COM:${P}/search?q=xvideos`],
 ['engine w/ userinfo', `http://u@www.google.com:${P}/search?q=xvideos`],
 ['engine subdomain not listed (e.g. us.search.yahoo?)', `http://search.yahoo.com:${P}/search?p=xvideos`],
 ['selftest domain (base list)', `http://tabsira-selftest.test:${P}/`],
 ['selftest trailing dot', `http://tabsira-selftest.test.:${P}/`],
 ['selftest UPPER', `http://TABSIRA-SELFTEST.TEST:${P}/`],
];
for (const [n, u] of urls) { const v = await visit(b.context, u); console.log((v.blocked ? 'BLOCKED ' : v.real ? 'LOADED  ' : 'NOT-BLOCKED(err) ') + n, v.blocked ? '' : (v.error ?? '').slice(0, 60)); }
await b.context.close(); await site.close();
