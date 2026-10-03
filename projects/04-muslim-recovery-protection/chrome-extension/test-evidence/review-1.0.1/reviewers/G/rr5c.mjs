import fs from 'node:fs';
import { launch, openExtPage, send, executableFor, sleep } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext3', lang: 'en' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const none = { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] };
let r = await send(page, { type: 'COMPLETE_ONBOARDING', baseList: false, starterTerms: false });
r = await send(page, { type: 'SAVE_SETTINGS', baseRevision: r.status.revision, settings: { ...none, domains: ['keep.example'], words: ['keep word'] } });
await page.reload(); await sleep(800);
const imp = async (settings, label, { confirm = true } = {}) => {
  fs.writeFileSync('imp.json', JSON.stringify({ format: 'tabsira-settings', version: 2, settings }));
  await page.setInputFiles('#importFile', 'imp.json'); await sleep(500);
  const shown = await page.evaluate(() => ({ visible: !document.querySelector('#importConfirm').hidden, text: document.querySelector('#importConfirmText').textContent, ex: [...document.querySelectorAll('#importExceptions li')].map(x => x.textContent), msg: document.querySelector('#message').textContent }));
  const before = (await send(page, { type: 'GET_STATUS' })).status.settings;
  if (shown.visible && confirm) { await page.click('#importYes'); await sleep(600); } else if (shown.visible) { await page.click('#importNo'); await sleep(200); }
  const st = (await send(page, { type: 'GET_STATUS' })).status; const after = st.settings;
  const diff = k => after[k].filter(x => !before[k].includes(x));
  console.log(label.padEnd(34), JSON.stringify({ preview: shown.visible ? shown.text : '(none) ' + shown.msg.slice(0, 80), previewEx: shown.ex, actualAdded: { d: diff('domains'), w: diff('words'), c: diff('contains'), a: diff('allow') }, focus: await page.evaluate(() => document.activeElement?.id) }));
};
await imp({ ...none, domains: ['new1.example', 'NEW2.example', 'https://www.new3.example/', 'keep.example'], words: ['Keep  Word', 'other word'], contains: ['probe-x'] }, 'normal: dup/unnormalised entries');
await imp({ ...none, allow: ['exempt.example', 'a.exempt2.example'] }, 'exceptions');
await imp({ ...none, domains: ['x.exempt.example'] , allow: [] }, 'sub of exception? (conflict)');
await imp({ ...none, domains: ['exempt.example'] }, 'domain conflicts with existing allow');
await imp({ ...none, words: ['ab\ud800cd'] }, 'lone surrogate');
fs.writeFileSync('imp.json', 'not json'); await page.setInputFiles('#importFile', 'imp.json'); await sleep(400); console.log('garbage file ->', await page.evaluate(() => document.querySelector('#message').textContent));
await imp({ ...none, domains: ['cancelme.example'] }, 'cancel path', { confirm: false });
// session + exceptions
const st = (await send(page, { type: 'GET_STATUS' })).status; await send(page, { type: 'START_SESSION', minutes: 60 });
await page.reload(); await sleep(800);
await imp({ ...none, allow: ['sess-exempt.example'] }, 'exception during session');
console.log('message after:', await page.evaluate(() => document.querySelector('#message').textContent));
await b.context.close();
