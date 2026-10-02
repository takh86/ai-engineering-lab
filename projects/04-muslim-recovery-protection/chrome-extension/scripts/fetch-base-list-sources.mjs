// Downloads the PINNED upstream files that scripts/update-base-list.mjs needs (default folder: ./.base-list-inputs).
// Owner decision (2026-10-02): the built-in list uses ONLY sources with an explicit licence that allows use, modification and
// redistribution (including commercial use). Availability of a file on the internet is not permission, and a collecting project's licence
// is not proof of the rights of the sources it collected from. Every input is therefore pinned to a commit and verified against its git blob
// id, its SHA-256 and the committed licence text; the script refuses to continue on any mismatch.
//   node scripts/fetch-base-list-sources.mjs [outDir]
// Only list FILES are fetched; no listed domain is ever contacted. The inputs are NOT committed (only hashes and the licence texts are).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SOURCES = [
    {
        file: 'shadowwhisperer-adult.txt', format: 'plain',
        name: 'ShadowWhisperer BlockLists - Lists/Adult', repository: 'https://github.com/ShadowWhisperer/BlockLists',
        owner: 'ShadowWhisperer', repo: 'BlockLists', commit: '1404d49b73d3c986da869b33c03a9e617437e0df', commitDate: '2026-10-01T17:47:57-05:00', path: 'Lists/Adult',
        blob: 'fbbf471b33009efa2d812730032a89a85ccbfba9', sha256: 'de136908d2b12b31ece5d5bee9e74748b364977a27840fab9a616f2e4b70b3d7',
        licence: { name: 'The Unlicense', path: 'LICENSE', blob: 'fdddb29aa445bf3d6a5d843d6dd77e10a9f99657', sha256: '6b0382b16279f26ff69014300541967a356a666eb0b91b422f6862f6b7dad17e', committedCopy: 'data/base-list/licenses/LICENSE-ShadowWhisperer-Unlicense.txt' }
    },
    {
        file: 'sinfonietta-pornography-hosts.txt', format: 'hosts',
        name: 'Sinfonietta hostfiles - pornography-hosts', repository: 'https://github.com/Sinfonietta/hostfiles',
        owner: 'Sinfonietta', repo: 'hostfiles', commit: '46f3097d7bcfc9eea323fe365074dfd771d0d17c', commitDate: '2026-09-08T22:09:06-04:00', path: 'pornography-hosts',
        blob: '198ab532a3bd3f3114c4dc36483cfa33b6425fb5', sha256: 'd5c31a7ee9f1920df47044270449ad42a1b09ad4f3b608410383abaabb27fa1d',
        licence: { name: 'MIT, Copyright (c) 2016 Sinfonietta', path: 'LICENSE', blob: '514145afc3039857bf41fb81f4d590dc6b210b94', sha256: 'b32ce488900c449c858b636ac18aab77ae483586508e3aa2e6a916d7a6ace1ae', committedCopy: 'data/base-list/licenses/LICENSE-Sinfonietta-MIT.txt' }
    }
];

export const rawUrl = (source, file) => `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.commit}/${file}`;
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
/** The id git gives a file: sha1("blob <size>\0" + bytes). */
export const gitBlobId = bytes => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');

/** Throws unless `bytes` is exactly the pinned file. */
export function verifyPinned(label, bytes, blob, digest) {
    if (gitBlobId(bytes) !== blob) throw new Error(`${label}: git blob id ${gitBlobId(bytes)} != pinned ${blob}`);
    if (sha256(bytes) !== digest) throw new Error(`${label}: sha256 ${sha256(bytes)} != pinned ${digest}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const out = path.resolve(process.argv[2] ?? '.base-list-inputs');
    fs.mkdirSync(out, { recursive: true });
    for (const source of SOURCES) {
        for (const [label, file, blob, digest, target] of [[source.path, source.path, source.blob, source.sha256, source.file], [`${source.repo}/${source.licence.path}`, source.licence.path, source.licence.blob, source.licence.sha256, `${source.file}.LICENSE`]]) {
            const response = await fetch(rawUrl(source, file), { redirect: 'follow' });
            if (!response.ok) throw new Error(`${source.repo}/${label} @ ${source.commit}: HTTP ${response.status}`);
            const bytes = Buffer.from(await response.arrayBuffer());
            verifyPinned(`${source.repo}/${label}`, bytes, blob, digest);
            fs.writeFileSync(path.join(out, target), bytes);
            process.stdout.write(`${target}  ${bytes.length} bytes  blob ${blob.slice(0, 12)}  sha256 ${digest.slice(0, 16)}…  (verified)\n`);
        }
        const committed = fs.readFileSync(path.join(root, source.licence.committedCopy));
        if (sha256(committed) !== source.licence.sha256) throw new Error(`${source.licence.committedCopy} differs from the licence at the pinned commit`);
    }
}
