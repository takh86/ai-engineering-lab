import fs from 'node:fs';
import os from 'node:os';

export function createReport({ browserName, version, extra = {} }) {
    const results = []; const notes = [];
    const meta = { browser: browserName, version, os: `${os.type()} ${os.release()} (${os.arch()})`, node: process.version, date: new Date().toISOString(), ...extra };
    return {
        meta, results, notes,
        check(id, ok, detail = '') { results.push({ id, status: ok ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 300) }); process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${id}${ok || !detail ? '' : `  -> ${String(detail).slice(0, 160)}`}\n`); },
        skip(id, reason) { results.push({ id, status: 'NOT_RUN', detail: reason }); process.stdout.write(`SKIP  ${id}  (${reason})\n`); },
        note(id, text) { notes.push({ id, text }); },
        save(file) {
            const summary = results.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
            fs.writeFileSync(file, `${JSON.stringify({ meta, summary, results, notes }, null, 2)}\n`);
            return summary;
        }
    };
}
