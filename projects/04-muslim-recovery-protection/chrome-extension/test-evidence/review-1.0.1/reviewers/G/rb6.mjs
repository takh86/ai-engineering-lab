import { launch, startSite, visit, openExtPage, send, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const site = await startSite();
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: true });
const P = site.port;
const cases = [['plain','xvideos'],['one letter %-encoded (%78)','%78videos'],['middle letter %69','xv%69deos'],['all letters %-encoded','%78%76%69%64%65%6F%73'],['lower-hex ok?','xv%69deos'.toLowerCase()],['space as %2b? (word break)','free%2Bporn'],['plus-encoded','free+porn'],['space %20 w/ one letter enc','fr%65e%20porn'],['arabic w/ ordinary','%D8%B3%D9%83%D8%B3'],['arabic encoded in lower hex','%d8%b3%d9%83%d8%b3'], ['plain query via POST-like path /search/xvideos', null]];
for (const [n, q] of cases) { if (!q) continue; const v = await visit(b.context, `http://www.bing.com:${P}/search?q=${q}`); console.log(v.blocked ? 'BLOCKED ' : 'BYPASS  ', n, q); }
await b.context.close(); await site.close();
