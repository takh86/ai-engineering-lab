// Regenerates data/base-list/{adult-domains.txt.gz,PROVENANCE.json} from downloaded upstream files.
//   node scripts/fetch-base-list-sources.mjs .base-list-inputs
//   node scripts/update-base-list.mjs --inputs .base-list-inputs --retrieved YYYY-MM-DD
// Never visits listed domains. Output is deterministic for given inputs.
//
// Composition rule (decision recorded in data/base-list/README.md):
//   KEEP   every ShadowWhisperer "Adult" entry                                   (Unlicense, verified LICENSE)
//   KEEP   Block List Project entries that ShadowWhisperer or Sinfonietta also list (both permissive, attribution kept)
//   KEEP   Block List Project entries found in NO other source we can trace        (the maintainers' own curation, Unlicense)
//   DROP   Block List Project entries traceable only to Hagezi (GPL-3.0), to zachlagden (no licence), or to Clefspeare13
//          (licence not independently verifiable) when no permissive source also lists them.
//   NOT ADDED  Sinfonietta-only entries (no evidence of freshness) - counted in PROVENANCE.json as a candidate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './fetch-base-list-sources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'base-list');
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const inputsDir = arg('inputs'); const retrieved = arg('retrieved');
if (!inputsDir || !retrieved) { process.stderr.write('usage: update-base-list.mjs --inputs <dir> --retrieved YYYY-MM-DD\n'); process.exit(2); }

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const valid = host => { const labels = host.split('.'); return host.length <= 253 && labels.length >= 2 && labels.every(l => LABEL.test(l)) && !/^[0-9]+$/u.test(labels.at(-1)); };
const parsers = {
    hosts: line => { const [address, host] = line.trim().split(/\s+/u); return ['0.0.0.0', '127.0.0.1'].includes(address) ? host : null; },
    plain: line => line.trim().split(/\s+/u)[0],
    adblock: line => /^\|\|([a-z0-9._-]+)\^/iu.exec(line.trim())?.[1]
};
const FORMAT = { 'blp-porn.txt': 'hosts', 'shadowwhisperer-adult.txt': 'plain', 'sinfonietta-pornography-hosts.txt': 'hosts', 'hagezi-nsfw.txt': 'adblock', 'zachlagden-nsfw.txt': 'hosts', 'clefspeare13-porn-hosts.txt': 'hosts' };

const sets = {}; const inputs = {};
for (const source of SOURCES) {
    const bytes = fs.readFileSync(path.join(inputsDir, source.file));
    const text = bytes.toString('utf8');
    const lines = text.split(/\r?\n/u);
    const set = new Set(); let rejected = 0;
    for (const line of lines) {
        if (!line || /^[#!\[]/u.test(line.trim())) continue;
        const host = parsers[FORMAT[source.file]](line)?.toLowerCase().replace(/\.$/u, '');
        if (host && valid(host)) set.add(host); else rejected++;
    }
    sets[source.file] = set;
    inputs[source.file] = { url: source.url, bytes: bytes.length, sha256: sha256(bytes), validHostnames: set.size, rejectedLines: rejected,
        headerLines: lines.filter(l => /^[#!]/u.test(l)).slice(0, 12).filter(l => /updated|modified|domains|title|version|licen/iu.test(l)) };
}
const B = sets['blp-porn.txt']; const SW = sets['shadowwhisperer-adult.txt']; const SIN = sets['sinfonietta-pornography-hosts.txt'];
const traceOnly = new Set([...sets['hagezi-nsfw.txt'], ...sets['zachlagden-nsfw.txt'], ...sets['clefspeare13-porn-hosts.txt']]);
const permissive = new Set([...SW, ...SIN]);

const keep = new Set(SW);
const counts = { blpTotal: B.size, blpAlsoInPermissive: 0, blpOwnUntraced: 0, blpDroppedTraceableOnlyToUnclear: 0, shadowWhispererAddedBeyondBlp: 0, sinfoniettaOnlyNotAdded: 0 };
for (const d of B) {
    if (permissive.has(d)) { keep.add(d); counts.blpAlsoInPermissive++; }
    else if (!traceOnly.has(d)) { keep.add(d); counts.blpOwnUntraced++; }
    else counts.blpDroppedTraceableOnlyToUnclear++;
}
for (const d of SW) if (!B.has(d)) counts.shadowWhispererAddedBeyondBlp++;
for (const d of SIN) if (!B.has(d) && !SW.has(d)) counts.sinfoniettaOnlyNotAdded++;

const covered = domain => { const p = domain.split('.'); for (let i = 1; i < p.length - 1; i++) if (keep.has(p.slice(i).join('.'))) return true; return false; };
const kept = [...keep].filter(d => !covered(d)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const canaries = fs.readFileSync(path.join(dir, 'known-benign-canaries.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
const keptSet = new Set(kept);
const collisions = canaries.filter(c => { const p = c.split('.'); return p.some((_, i) => i < p.length - 1 && keptSet.has(p.slice(i).join('.'))); });
if (collisions.length) { process.stderr.write(`REFUSED: ${collisions.length} benign canary domain(s) are covered by the list: ${collisions.join(', ')}\n`); process.exit(1); }

// A few deterministic sample names per category so tests can prove removed entries stay out and added entries are in.
const pick = (list, n) => [...list].sort((a, b) => sha256(Buffer.from(a)) < sha256(Buffer.from(b)) ? -1 : 1).slice(0, n);
const droppedAll = [...B].filter(d => !permissive.has(d) && traceOnly.has(d) && !keptSet.has(d) && !covered(d));
const samples = { removedUnclearLicence: pick(droppedAll, 12), addedFromShadowWhisperer: pick([...SW].filter(d => !B.has(d) && keptSet.has(d)), 12), alsoInPermissiveSource: pick([...B].filter(d => permissive.has(d) && keptSet.has(d)), 12) };
fs.writeFileSync(path.join(dir, 'provenance-samples.json'), `${JSON.stringify(samples, null, 2)}\n`);
const text = `${kept.join('\n')}\n`;
const gz = zlib.gzipSync(Buffer.from(text), { level: 9 });
fs.writeFileSync(path.join(dir, 'adult-domains.txt.gz'), gz);
const tlds = {};
for (const domain of kept) { const tld = domain.slice(domain.lastIndexOf('.') + 1); tlds[tld] = (tlds[tld] ?? 0) + 1; }
const LICENSES = {
    'blp-porn.txt': { name: 'The Block List Project - porn.txt', repository: 'https://github.com/blocklistproject/Lists', licence: 'The Unlicense (LICENSE in repository root; file header says MIT)', use: 'primary container; maintainers\' own curation' },
    'shadowwhisperer-adult.txt': { name: 'ShadowWhisperer BlockLists - Lists/Adult', repository: 'https://github.com/ShadowWhisperer/BlockLists', licence: 'The Unlicense (LICENSE verified)', use: 'included in full' },
    'sinfonietta-pornography-hosts.txt': { name: 'Sinfonietta hostfiles - pornography-hosts', repository: 'https://github.com/Sinfonietta/hostfiles', licence: 'MIT, Copyright (c) 2016 Sinfonietta (LICENSE verified)', use: 'attribution for entries that Block List Project also lists; Sinfonietta-only entries NOT added (no freshness evidence)' },
    'hagezi-nsfw.txt': { name: 'HaGeZi - dns-blocklists nsfw', repository: 'https://github.com/hagezi/dns-blocklists', licence: 'GNU GPL-3.0 (LICENSE verified)', use: 'TRACE ONLY - entries traceable only to this source are removed; nothing is copied from it' },
    'zachlagden-nsfw.txt': { name: 'zachlagden - Pi-hole-Optimized-Blocklists nsfw', repository: 'https://github.com/zachlagden/Pi-hole-Optimized-Blocklists', licence: 'none found (no LICENSE file in the repository)', use: 'TRACE ONLY - entries traceable only to this source are removed; nothing is copied from it' },
    'clefspeare13-porn-hosts.txt': { name: 'Clefspeare13 pornhosts (via StevenBlack/hosts extension copy)', repository: 'https://github.com/Clefspeare13/pornhosts', licence: 'header says MIT but the upstream LICENSE could not be retrieved', use: 'TRACE ONLY - not independently verifiable; nothing is copied from it' }
};
const provenance = {
    name: 'Tabsira built-in adult-sites list (composite snapshot)',
    retrievedAt: retrieved,
    composition: 'ShadowWhisperer Adult (all) + Block List Project entries that a permissive source also lists + Block List Project entries not traceable to any other source; minus entries traceable only to GPL-3.0 / unlicensed / unverifiable sources.',
    snapshotFile: 'adult-domains.txt.gz (gzip of sorted, one domain per line)',
    snapshotEntries: kept.length,
    snapshotSha256: sha256(Buffer.from(text)),
    removedAsCoveredByParent: keep.size - kept.length,
    counts,
    upstreamCommit: null,
    upstreamCommitNote: 'Commit hashes could not be read (GitHub API access to these repositories was not available in the build session); every input is identified by its exact bytes (SHA-256) and retrieval date.',
    inputs: Object.fromEntries(Object.entries(inputs).map(([file, info]) => [file, { ...LICENSES[file], ...info }])),
    topTlds: Object.fromEntries(Object.entries(tlds).sort((a, b) => b[1] - a[1]).slice(0, 10)),
    benignCanariesChecked: canaries.length,
    transform: ['lowercase', 'drop entries that are not valid hostnames', 'apply the composition rule above', 'drop entries covered by a listed parent domain', 'sort', 'refuse to write if any known-benign canary is covered']
};
fs.writeFileSync(path.join(dir, 'PROVENANCE.json'), `${JSON.stringify(provenance, null, 2)}\n`);
process.stdout.write(`snapshot: ${kept.length} domains; ${JSON.stringify(counts)}; gz ${gz.length} bytes\n`);
