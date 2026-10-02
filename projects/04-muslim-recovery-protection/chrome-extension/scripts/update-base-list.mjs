// Regenerates data/base-list/{adult-domains.txt.gz,PROVENANCE.json} from a downloaded upstream file.
//   node scripts/update-base-list.mjs --from /path/to/porn.txt --retrieved 2026-10-02
// It never visits listed domains. Output is deterministic for a given input.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'base-list');
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const from = arg('from'); const retrieved = arg('retrieved');
if (!from || !retrieved) { process.stderr.write('usage: update-base-list.mjs --from <upstream porn.txt> --retrieved YYYY-MM-DD\n'); process.exit(2); }

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const raw = fs.readFileSync(from);
const lines = raw.toString('utf8').split(/\r?\n/u);
const header = lines.filter(line => line.startsWith('#')).slice(0, 12);
const lastModified = (header.find(line => /Last modified/iu.test(line)) ?? '').replace(/^#\s*Last modified:\s*/iu, '').trim();
const LABEL = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/u;

const all = new Set(); let rejected = 0;
for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [address, host] = line.trim().split(/\s+/u);
    if (!['0.0.0.0', '127.0.0.1'].includes(address) || !host) { rejected++; continue; }
    const domain = host.toLowerCase().replace(/\.$/u, '');
    const labels = domain.split('.');
    // Underscore labels are not valid hostnames for a browser request; drop them rather than guess.
    if (domain.length > 253 || labels.length < 2 || !labels.every(l => LABEL.test(l) && !l.includes('_')) || /^[0-9]+$/u.test(labels.at(-1))) { rejected++; continue; }
    all.add(domain);
}
const covered = domain => { const p = domain.split('.'); for (let i = 1; i < p.length - 1; i++) if (all.has(p.slice(i).join('.'))) return true; return false; };
const kept = [...all].filter(domain => !covered(domain)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// Regression guard: no known-benign site may be listed or covered by a listed parent.
const canaries = fs.readFileSync(path.join(dir, 'known-benign-canaries.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
const keptSet = new Set(kept);
const collisions = canaries.filter(c => { const p = c.split('.'); return p.some((_, i) => i < p.length - 1 && keptSet.has(p.slice(i).join('.'))); });
if (collisions.length) { process.stderr.write(`REFUSED: ${collisions.length} benign canary domain(s) are covered by the list\n`); process.exit(1); }

const text = `${kept.join('\n')}\n`;
const gz = zlib.gzipSync(Buffer.from(text), { level: 9 });
fs.writeFileSync(path.join(dir, 'adult-domains.txt.gz'), gz);
const tlds = {};
for (const domain of kept) { const tld = domain.slice(domain.lastIndexOf('.') + 1); tlds[tld] = (tlds[tld] ?? 0) + 1; }
const provenance = {
    name: 'The Block List Project — Porn list (porn.txt)',
    sourceUrl: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/porn.txt',
    homepage: 'https://github.com/blocklistproject/Lists',
    licenseOfRepository: 'The Unlicense (public-domain dedication), per LICENSE in the repository root',
    licenseDeclaredInFileHeader: 'MIT (header line "# License: MIT" inside porn.txt)',
    licenseNote: 'Both are permissive and allow redistribution. The upstream README states the list is synced from 14 upstream blocklists; their individual licences are not independently verified here. Owner/legal review is listed as an open decision.',
    upstreamLastModified: lastModified,
    retrievedAt: retrieved,
    upstreamCommit: null,
    upstreamCommitNote: 'Not pinned: GitHub API access to the upstream repository was not available in the build session. Upstream content is identified by SHA-256 below.',
    upstreamFileSha256: sha256(raw),
    upstreamEntries: all.size + rejected,
    rejectedEntries: rejected,
    snapshotEntries: kept.length,
    removedAsCoveredByParent: all.size - kept.length,
    snapshotSha256: sha256(Buffer.from(text)),
    snapshotFile: 'adult-domains.txt.gz (gzip of sorted, one domain per line)',
    topTlds: Object.fromEntries(Object.entries(tlds).sort((a, b) => b[1] - a[1]).slice(0, 10)),
    benignCanariesChecked: canaries.length,
    transform: ['lowercase', 'drop entries that are not valid hostnames', 'drop entries covered by a listed parent domain (requestDomains already matches subdomains)', 'sort', 'refuse to write if any known-benign canary is covered']
};
fs.writeFileSync(path.join(dir, 'PROVENANCE.json'), `${JSON.stringify(provenance, null, 2)}\n`);
process.stdout.write(`snapshot: ${kept.length} domains (${all.size - kept.length} covered by parents, ${rejected} rejected), gz ${gz.length} bytes\n`);
