// node tests/e2e/run.mjs --browser chromium|edge   (build first: npm run build; the release ZIP is extracted and tested)
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { executableFor, root } from './lib.mjs';
import { createReport } from './report.mjs';
import { runSuite } from './suite.mjs';
import { preparePackage } from './package.mjs';

const browserName = process.argv.includes('--browser') ? process.argv[process.argv.indexOf('--browser') + 1] : 'chromium';
const executablePath = executableFor(browserName);
if (!executablePath) { process.stderr.write(`no executable configured for ${browserName}\n`); process.exit(2); }
const probe = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const version = probe.version(); await probe.close();
const pkg = preparePackage('chromium');
const report = createReport({ browserName, version, extra: { package: pkg.info } });
process.stdout.write(`# ${browserName} ${version} on ${report.meta.os}\n# package ${pkg.info.zip} sha256 ${pkg.info.zipSha256}\n`);
await runSuite({ browserName, executablePath, report, pkg });
fs.mkdirSync(path.join(root, 'test-evidence'), { recursive: true });
const summary = report.save(path.join(root, 'test-evidence', `e2e-${browserName}.json`));
process.stdout.write(`\nSUMMARY ${JSON.stringify(summary)}\n`);
process.exit(summary.FAIL ? 1 : 0);
