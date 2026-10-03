// Strict owner-approved palette boundary for every shipped extension stylesheet.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const APPROVED_COLORS = new Set(['#0B3B8F', '#1456C5', '#B7E445', '#5F8FD9', '#F3F6FB', '#FFFFFF']);
export function auditStyles(css, label = 'stylesheet') {
    const text = css.replace(/\/\*[\s\S]*?\*\//gu, '');
    const errors = [];
    for (const match of text.matchAll(/#[a-f0-9]{3,8}\b/giu)) {
        if (!APPROVED_COLORS.has(match[0].toUpperCase())) errors.push(`${label}: unapproved ${match[0]}`);
    }
    if (/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/iu.test(text)) errors.push(`${label}: derived color function`);
    if (/(?:linear|radial|conic)-gradient\s*\(/iu.test(text)) errors.push(`${label}: gradient derives secondary hues`);
    if (/(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|fill|stroke|outline(?:-color)?)\s*:\s*(?:black|red|green|blue|gray|grey|yellow|orange|purple)\b/iu.test(text)) errors.push(`${label}: unapproved named color`);
    return errors;
}
export function auditDirectory(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? auditDirectory(file) : entry.name.endsWith('.css') ? auditStyles(fs.readFileSync(file, 'utf8'), entry.name) : [];
    });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const errors = auditDirectory(fileURLToPath(new URL('../src/ui/', import.meta.url)));
    if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; }
    else process.stdout.write('Approved palette boundary: PASS\n');
}
