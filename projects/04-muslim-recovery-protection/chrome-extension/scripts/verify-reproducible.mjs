// Builds the release packages twice into temporary folders and compares SHA-256 of every ZIP.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const build = () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tabsira-repro-'));
    execFileSync('node', ['scripts/build.mjs'], { cwd: root, env: { ...process.env, TABSIRA_OUT: out }, stdio: 'pipe' });
    return Object.fromEntries(fs.readdirSync(out).filter(f => f.endsWith('.zip')).map(f => [f, sha(path.join(out, f))]));
};
const first = build(); const second = build();
let ok = true;
for (const [name, hash] of Object.entries(first)) {
    const same = second[name] === hash;
    ok &&= same;
    process.stdout.write(`${same ? 'REPRODUCIBLE' : 'DIFFERENT'}  ${name}  ${hash}\n`);
}
process.exit(ok && Object.keys(first).length ? 0 : 1);
