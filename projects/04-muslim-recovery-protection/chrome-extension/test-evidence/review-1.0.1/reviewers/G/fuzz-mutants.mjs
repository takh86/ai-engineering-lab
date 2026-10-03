import fs from 'node:fs'; import { spawn } from 'node:child_process';
const G = process.cwd();
const mutants = {
 M01: ['background/controller.js', "await mutex.assertOwner();\n            if (!(await storedMatches(expected))) throw new TabsiraError('stale');", "if (!(await storedMatches(expected))) throw new TabsiraError('stale');"],
 M02: ['background/controller.js', "if (!(await storedMatches(expected))) throw new TabsiraError('stale');\n            if (persist) {", "if (persist) {"],
 M03: ['background/controller.js', "if ((effective?.key ?? null) !== (persist ? myKey : expected.key)) throw new TabsiraError('stale');", ""],
 M20: ['background/coordination.js', "if (rivals.some(entry => entry.choosing || (entry.ticket > 0 && before(entry, { id: me, ticket: mine.ticket })))) { held = false; throw new TabsiraError('busy'); }", ""],
 M21: ['background/coordination.js', "const blocked = rivals.some(entry => entry.choosing || (entry.ticket > 0 && before(entry, mine)));", "const blocked = rivals.some(entry => (entry.ticket > 0 && before(entry, mine)));"],
 M04: ['background/controller.js', "await pinConfig(state);", ""],
};
const src = fs.readFileSync(G + '/interleave.mjs', 'utf8');
for (const [name, [file, from, to]] of Object.entries(mutants)) {
  const dir = `${G}/mut-${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir + '/tests', { recursive: true });
  fs.cpSync('/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src', dir + '/src', { recursive: true });
  fs.cpSync('/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/tests/unit', dir + '/tests/unit', { recursive: true });
  const p = `${dir}/src/${file}`; const o = fs.readFileSync(p, 'utf8'); if (!o.includes(from)) throw new Error('no pattern ' + name); fs.writeFileSync(p, o.replace(from, to));
  fs.writeFileSync(`${dir}/interleave.mjs`, src.replaceAll('/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/', dir + '/'));
  const child = spawn('timeout', ['200', 'node', `${dir}/interleave.mjs`, '7000', '300', '--clock'], { stdio: ['ignore', fs.openSync(`${G}/mutout_${name}.txt`, 'w'), 'inherit'] });
}
