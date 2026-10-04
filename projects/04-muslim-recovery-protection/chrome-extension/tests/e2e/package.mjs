// Prepares the PACKAGES UNDER TEST: the release ZIPs are extracted with the system `unzip` (not with our own zip code), and
// the browser tests run on the extracted files. Variants differ from the release package in manifest.json only:
//   release  - exactly what the store receives (the permission-free subset of the suite runs on this)
//   test     - + "declarativeNetRequestFeedback" (needed only by testMatchOutcome: base-list sampling and match timing)
//   optional - + that permission, and website access requested at run time (to test the "permission missing" state)
//   live     - a copy of release at a fixed path whose manifest version can be raised in place (extension-update test; the
//              extension ID of an unpacked extension depends on its path, so the path must not change)
// The preparation proves this claim by comparing every file with the release package and failing on any other difference.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root } from './lib.mjs';

const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))]).sort();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readManifest = dir => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const writeManifest = (dir, manifest) => fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

export function packageZip(target, distDir = path.join(root, 'dist')) {
    if (process.env.TABSIRA_ZIP && target === 'chromium') return path.resolve(process.env.TABSIRA_ZIP);   // e.g. an older build, for negative controls
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const file = path.join(distDir, `tabsira-${target}-${manifest.version}.zip`);
    if (!fs.existsSync(file)) throw new Error(`package not found: ${file} (run: node scripts/build.mjs)`);
    return file;
}

export function preparePackage(target, { zip = packageZip(target), work = path.join(root, '.pkg-under-test', target) } = {}) {
    fs.rmSync(work, { recursive: true, force: true });
    const dirs = Object.fromEntries(['release', 'test', 'optional', 'live'].map(name => [name, path.join(work, name)]));
    for (const dir of Object.values(dirs)) fs.mkdirSync(dir, { recursive: true });
    for (const dir of Object.values(dirs)) execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
    const release = readManifest(dirs.release);
    // test: + feedback permission only
    writeManifest(dirs.test, { ...release, permissions: [...release.permissions, 'declarativeNetRequestFeedback'] });
    // optional: website access at run time
    const { host_permissions: hosts, ...rest } = release;
    writeManifest(dirs.optional, { ...rest, permissions: [...release.permissions, 'declarativeNetRequestFeedback'], optional_host_permissions: hosts });
    // Every non-manifest file in every variant must be byte-identical to the release package.
    const files = walk(dirs.release);
    for (const [name, dir] of Object.entries(dirs)) {
        if (name === 'release') continue;
        const other = walk(dir);
        if (JSON.stringify(other) !== JSON.stringify(files)) throw new Error(`${name}: file list differs from the release package`);
        for (const f of files) if (f !== 'manifest.json' && sha(path.join(dir, f)) !== sha(path.join(dirs.release, f))) throw new Error(`${name}: ${f} differs from the release package`);
    }
    const info = { target, zip: path.relative(root, zip), zipSha256: sha(zip), files: files.length, manifestVersion: release.version, variants: {
        release: 'unmodified extraction of the ZIP',
        test: `manifest + declarativeNetRequestFeedback only`,
        optional: 'manifest: host access optional + declarativeNetRequestFeedback',
        live: 'copy of release; manifest version raised in place for the update test' } };
    return {
        dirs, info,
        bumpLive(version) { writeManifest(dirs.live, { ...readManifest(dirs.live), version }); },
        resetLive() { writeManifest(dirs.live, release); }
    };
}
