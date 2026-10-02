// Minimal deterministic ZIP writer (no dependencies): fixed timestamps, sorted names, UTF-8 names,
// deflate level 9. The same input directory always yields byte-identical output.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
    return table;
})();
export function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

export function listFiles(root, dir = root) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? listFiles(root, full) : [path.relative(root, full).split(path.sep).join('/')];
    }).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function zipDirectory(root, output) {
    const DOS_TIME = 0; const DOS_DATE = (0 << 9) | (1 << 5) | 1;   // 1980-01-01 00:00:00
    const locals = []; const centrals = []; let offset = 0;
    for (const name of listFiles(root)) {
        const data = fs.readFileSync(path.join(root, name));
        const packed = zlib.deflateRawSync(data, { level: 9 });
        const useDeflate = packed.length < data.length;
        const body = useDeflate ? packed : data;
        const nameBuffer = Buffer.from(name, 'utf8');
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(useDeflate ? 8 : 0, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuffer.length, 26); local.writeUInt16LE(0, 28);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x031e, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(useDeflate ? 8 : 0, 10); central.writeUInt16LE(DOS_TIME, 12); central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(0o100644 << 16 >>> 0, 38); central.writeUInt32LE(offset, 42);
        locals.push(local, nameBuffer, body); centrals.push(central, nameBuffer);
        offset += local.length + nameBuffer.length + body.length;
    }
    const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(centrals.length / 2, 8); end.writeUInt16LE(centrals.length / 2, 10);
    end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
    fs.writeFileSync(output, Buffer.concat([...locals, ...centrals, end]));
}
