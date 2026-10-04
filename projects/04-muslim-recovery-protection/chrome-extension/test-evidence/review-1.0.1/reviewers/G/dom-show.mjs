import { launch, openExtPage, executableFor } from '/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/e2e/lib.mjs';
const b = await launch({ executablePath: executableFor('chromium'), extensionDir: process.cwd() + '/ext' });
const page = await openExtPage(b.context, b.extensionId, 'options.html');
const inputs = ['ex​ample.test','ex‮ample.test','ex­ample.test','ex‎ample.test','ex‍ample.test','ex⁠ample.test','﻿example.test','example.test​','faß.test','ΐ.test','ǆ.test','İ.test','ａｂｃ.test','abc。test','abc%E3%80%82test','abc%2etest','ab%00c.test','%e2%80%8bexample.test','example.test:80','example.test:','xn--80ak6aa92e.test','XN--80AK6AA92E.test','пример.test','مثال.test','mañana.test','a.b.c.d.test','0.0.0.0','1.2.3.4','1.2.3','0x1.test','1.test','test.1','١.test','http://example.test:0/','https://example.test./','//example.test','example.test/#x','example.test?','example.test#','HTTPS://Example.TEST/','https://example.test/ ','a..test','.test','example.test.'];
const res = await page.evaluate(async (inputs) => { const { normalizeDomain } = await import('./core/domains.js'); return inputs.map(i => { try { return [i, normalizeDomain(i)]; } catch (e) { return [i, 'ERR ' + e.code]; } }); }, inputs);
for (const [i, o] of res) console.log(JSON.stringify(i).padEnd(36), o);
await b.context.close();
