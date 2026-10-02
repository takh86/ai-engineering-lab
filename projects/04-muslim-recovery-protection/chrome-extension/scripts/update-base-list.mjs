// Regenerates data/base-list/{adult-domains.txt.gz,PROVENANCE.json,provenance-samples.json} from the PINNED upstream files.
//   node scripts/fetch-base-list-sources.mjs .base-list-inputs
//   node scripts/update-base-list.mjs --inputs .base-list-inputs --retrieved YYYY-MM-DD
// Never visits listed domains. Output is deterministic for given inputs.
//
// Owner decision (2026-10-02): only sources with an EXPLICIT licence that allows use, modification and redistribution inside the extension
// (commercial use included) are used, and their conditions are met. The list is therefore exactly
//     ShadowWhisperer "Lists/Adult"  (The Unlicense)   UNION   Sinfonietta "pornography-hosts"  (MIT, Copyright (c) 2016 Sinfonietta)
// minus entries covered by a listed parent domain. Nothing from The Block List Project, HaGeZi, zachlagden or Clefspeare13 is used, and no entry
// whose origin is unknown is kept: being present on the internet is not permission, and a collecting project's licence alone is not proof of the
// rights of the sources it collected from.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SOURCES, rawUrl, sha256, gitBlobId, verifyPinned } from './fetch-base-list-sources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'base-list');
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const inputsDir = arg('inputs'); const retrieved = arg('retrieved');
if (!inputsDir || !retrieved) { process.stderr.write('usage: update-base-list.mjs --inputs <dir> --retrieved YYYY-MM-DD\n'); process.exit(2); }

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const valid = host => { const labels = host.split('.'); return host.length <= 253 && labels.length >= 2 && labels.every(l => LABEL.test(l)) && !/^[0-9]+$/u.test(labels.at(-1)); };
const parsers = {
    hosts: line => { const [address, host] = line.trim().split(/\s+/u); return ['0.0.0.0', '127.0.0.1'].includes(address) ? host : null; },
    plain: line => line.trim().split(/\s+/u)[0]
};

const sets = {}; const inputs = {};
for (const source of SOURCES) {
    const bytes = fs.readFileSync(path.join(inputsDir, source.file));
    const licence = fs.readFileSync(path.join(inputsDir, `${source.file}.LICENSE`));
    verifyPinned(source.path, bytes, source.blob, source.sha256);                   // refuse anything that is not exactly the pinned file
    verifyPinned(`${source.repo}/${source.licence.path}`, licence, source.licence.blob, source.licence.sha256);
    if (!licence.equals(fs.readFileSync(path.join(root, source.licence.committedCopy)))) throw new Error(`${source.licence.committedCopy} differs from the pinned licence text`);
    const lines = bytes.toString('utf8').split(/\r?\n/u);
    const set = new Set(); let rejected = 0;
    for (const line of lines) {
        if (!line || /^#/u.test(line.trim())) continue;
        const host = parsers[source.format](line)?.toLowerCase().replace(/\.$/u, '');
        if (host && valid(host)) set.add(host); else rejected++;
    }
    sets[source.file] = set;
    inputs[source.file] = {
        name: source.name, repository: source.repository, path: source.path, commit: source.commit, commitDate: source.commitDate, permalink: rawUrl(source, source.path),
        gitBlob: source.blob, sha256: source.sha256, bytes: bytes.length, validHostnames: set.size, rejectedLines: rejected,
        headerLines: lines.filter(l => /^#/u.test(l)).slice(0, 12).filter(l => /updated|modified|domains|title|version|licen/iu.test(l)),
        licence: { name: source.licence.name, permalink: rawUrl(source, source.licence.path), gitBlob: source.licence.blob, sha256: source.licence.sha256, committedCopy: source.licence.committedCopy }
    };
}
const SW = sets['shadowwhisperer-adult.txt']; const SIN = sets['sinfonietta-pornography-hosts.txt'];
const keep = new Set([...SW, ...SIN]);
const covered = domain => { const p = domain.split('.'); for (let i = 1; i < p.length - 1; i++) if (keep.has(p.slice(i).join('.'))) return true; return false; };
const kept = [...keep].filter(d => !covered(d)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const keptSet = new Set(kept);
const counts = { shadowWhisperer: SW.size, sinfonietta: SIN.size, inBoth: [...SW].filter(d => SIN.has(d)).length, shadowWhispererOnly: [...SW].filter(d => !SIN.has(d)).length, sinfoniettaOnly: [...SIN].filter(d => !SW.has(d)).length, union: keep.size };

const canaries = fs.readFileSync(path.join(dir, 'known-benign-canaries.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
const collisions = canaries.filter(c => { const p = c.split('.'); return p.some((_, i) => i < p.length - 1 && keptSet.has(p.slice(i).join('.'))); });
if (collisions.length) { process.stderr.write(`REFUSED: ${collisions.length} benign canary domain(s) are covered by the list: ${collisions.join(', ')}\n`); process.exit(1); }

// Deterministic sample names so the real-browser tests can prove what is in and what is out (names only; never requested).
const pick = (list, n) => [...list].sort((a, b) => (sha256(Buffer.from(a)) < sha256(Buffer.from(b)) ? -1 : 1)).slice(0, n);
const snapshotFile = path.join(dir, 'adult-domains.txt.gz');
const previous = fs.existsSync(snapshotFile) ? new Set(zlib.gunzipSync(fs.readFileSync(snapshotFile)).toString('utf8').split('\n').filter(Boolean)) : new Set();
const samplesFile = path.join(dir, 'provenance-samples.json');
const oldSamples = fs.existsSync(samplesFile) ? JSON.parse(fs.readFileSync(samplesFile, 'utf8')) : {};
const droppedNow = [...previous].filter(d => !keptSet.has(d) && !covered(d));
const samples = {
    fromShadowWhispererOnly: pick(kept.filter(d => SW.has(d) && !SIN.has(d)), 12),
    fromSinfoniettaOnly: pick(kept.filter(d => SIN.has(d) && !SW.has(d)), 12),
    inBothSources: pick(kept.filter(d => SW.has(d) && SIN.has(d)), 12),
    // names that an earlier snapshot contained and that this rule removed (sample kept when the snapshot is regenerated unchanged)
    removedFromPreviousSnapshot: droppedNow.length ? pick(droppedNow, 12) : (oldSamples.removedFromPreviousSnapshot ?? [])
};
fs.writeFileSync(samplesFile, `${JSON.stringify(samples, null, 2)}\n`);
const text = `${kept.join('\n')}\n`;
const gz = zlib.gzipSync(Buffer.from(text), { level: 9 });
fs.writeFileSync(snapshotFile, gz);
const tlds = {};
for (const domain of kept) { const tld = domain.slice(domain.lastIndexOf('.') + 1); tlds[tld] = (tlds[tld] ?? 0) + 1; }
const provenance = {
    name: 'Tabsira built-in adult-sites list (ShadowWhisperer Adult UNION Sinfonietta pornography-hosts)',
    retrievedAt: retrieved,
    decision: 'Owner, 2026-10-02: only sources with an explicit licence allowing use, modification and redistribution (commercial use included), with their conditions met.',
    composition: 'ShadowWhisperer Lists/Adult (The Unlicense) UNION Sinfonietta pornography-hosts (MIT), minus entries covered by a listed parent domain. Nothing else.',
    snapshotFile: 'adult-domains.txt.gz (gzip of sorted, one domain per line)',
    snapshotEntries: kept.length,
    snapshotSha256: sha256(Buffer.from(text)),
    removedAsCoveredByParent: keep.size - kept.length,
    counts,
    inputs,
    licenceCoverage: {
        'shadowwhisperer-adult.txt': 'Single root LICENSE (The Unlicense) in the repository that contains the file; no licence, header or README term restricts Lists/Adult; no other licence file exists in the repository; README says lists are made by the maintainer from a custom script and manual additions and that other lists are not merged; contributions arrive as issues, not as merged lists. Note: the Unlicense text speaks of "software"; the list file is part of the licensed repository and is treated as covered - a legal interpretation, not a separate grant.',
        'sinfonietta-pornography-hosts.txt': 'Single root LICENSE (MIT, Copyright (c) 2016 Sinfonietta) in the repository that contains the file; no file-level or directory-level exception; the file has no header or comment lines. Conditions: the copyright and permission notice must accompany copies or substantial portions - they ship in THIRD_PARTY_NOTICES.txt. The file has many contributors (pull requests); contributions made on GitHub to a repository carrying a licence are licensed under that licence (GitHub Terms of Service, section D.6). The project does not document where individual entries came from (README: "collection"); some were added from issues in the MIT-licensed StevenBlack/hosts project. We have not verified and cannot verify the origin of each entry.'
    },
    examinedAndExcluded: {
        'The Block List Project porn.txt': 'Excluded entirely. A collecting project; its licence alone does not prove the rights of the sources it collected from, and 492,511 of its entries could not be attributed to any examined source.',
        'HaGeZi dns-blocklists nsfw': 'Excluded: GNU GPL-3.0 (copyleft), not usable inside this extension under the Owner decision.',
        'zachlagden Pi-hole-Optimized-Blocklists nsfw': 'Excluded: no licence file.',
        'Clefspeare13 pornhosts': 'Excluded: licence not verifiable from the upstream repository.'
    },
    topTlds: Object.fromEntries(Object.entries(tlds).sort((a, b) => b[1] - a[1]).slice(0, 10)),
    benignCanariesChecked: canaries.length,
    transform: ['lowercase', 'drop entries that are not valid hostnames', 'union of the two pinned files', 'drop entries covered by a listed parent domain', 'sort', 'refuse to write if any known-benign canary is covered']
};
fs.writeFileSync(path.join(dir, 'PROVENANCE.json'), `${JSON.stringify(provenance, null, 2)}\n`);
process.stdout.write(`snapshot: ${kept.length} domains; ${JSON.stringify(counts)}; gz ${gz.length} bytes; removed vs previous snapshot ${droppedNow.length}\n`);
