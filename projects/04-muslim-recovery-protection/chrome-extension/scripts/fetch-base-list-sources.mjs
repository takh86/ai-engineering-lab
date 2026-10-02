// Downloads the upstream files that scripts/update-base-list.mjs needs into a folder (default: ./.base-list-inputs).
// Only list FILES are fetched; no listed domain is ever contacted. The inputs are NOT committed (only hashes are).
//   node scripts/fetch-base-list-sources.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const SOURCES = [
    { file: 'blp-porn.txt', url: 'https://raw.githubusercontent.com/blocklistproject/Lists/master/porn.txt' },
    { file: 'shadowwhisperer-adult.txt', url: 'https://raw.githubusercontent.com/ShadowWhisperer/BlockLists/refs/heads/master/Lists/Adult' },
    { file: 'sinfonietta-pornography-hosts.txt', url: 'https://raw.githubusercontent.com/Sinfonietta/hostfiles/master/pornography-hosts' },
    // Trace-only inputs: used to EXCLUDE entries whose redistribution right is not documented. Never shipped.
    { file: 'hagezi-nsfw.txt', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/nsfw.txt' },
    { file: 'zachlagden-nsfw.txt', url: 'https://media.githubusercontent.com/media/zachlagden/Pi-hole-Optimized-Blocklists/main/lists/nsfw.txt' },
    { file: 'clefspeare13-porn-hosts.txt', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/porn/clefspeare13/hosts' }
];

if (import.meta.url === `file://${process.argv[1]}`) {
    const out = path.resolve(process.argv[2] ?? '.base-list-inputs');
    fs.mkdirSync(out, { recursive: true });
    for (const source of SOURCES) {
        const response = await fetch(source.url, { redirect: 'follow' });
        if (!response.ok) throw new Error(`${source.file}: HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(path.join(out, source.file), bytes);
        process.stdout.write(`${source.file}  ${bytes.length} bytes  sha256 ${crypto.createHash('sha256').update(bytes).digest('hex')}\n`);
    }
}
