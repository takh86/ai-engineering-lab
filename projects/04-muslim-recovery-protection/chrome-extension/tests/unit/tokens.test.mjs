import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(fileURLToPath(new URL('../../src/ui/tokens.css', import.meta.url)), 'utf8');
const blocks = [...css.matchAll(/:root\s*\{([^}]*)\}/gu)].map(match => match[1]);
const parse = block => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gu)].map(m => [m[1], m[2].trim()]));
const light = parse(blocks[0]); const dark = { ...light, ...parse(blocks[1]) };
const resolve = (scheme, name, depth = 0) => { const value = scheme[name]; if (value === undefined) throw new Error(`token ${name} missing`); const m = /^var\(--([a-z0-9-]+)\)$/u.exec(value); return m && depth < 5 ? resolve(scheme, m[1], depth + 1) : value; };
const rgb = hex => { const h = hex.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const lum = hex => { const [r, g, b] = rgb(hex).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum ratio]: 4.5 for text, 3 for meaningful UI shapes (WCAG 2.2 AA)
const PAIRS = [
    ['ink', 'bg', 4.5], ['ink', 'card', 4.5], ['ink-muted', 'bg', 4.5], ['ink-muted', 'card', 4.5], ['heading', 'bg', 4.5], ['heading', 'card', 4.5],
    ['link', 'bg', 4.5], ['link', 'card', 4.5],
    ['primary-ink', 'primary-bg', 4.5], ['primary-ink', 'primary-hover', 4.5],
    ['secondary-ink', 'secondary-bg', 4.5], ['secondary-ink', 'secondary-hover', 4.5], ['secondary-ink', 'card', 4.5],
    ['info-ink', 'info-bg', 4.5], ['warn-ink', 'warn-bg', 4.5], ['danger-ink', 'danger-bg', 4.5], ['neutral-ink', 'neutral-bg', 4.5],
    ['danger-ink', 'card', 4.5], ['info-ink', 'card', 4.5], ['ink', 'warn-bg', 4.5],
    ['field-border', 'card', 3], ['secondary-border', 'bg', 3], ['secondary-border', 'card', 3],
    ['info-border', 'info-bg', 3], ['warn-border', 'warn-bg', 3], ['danger-border', 'danger-bg', 3], ['neutral-border', 'neutral-bg', 3],
    ['focus', 'bg', 3], ['focus', 'card', 3], ['link', 'line', 3], ['neutral-border', 'card', 3]
];

for (const [name, scheme] of [['light', light], ['dark', dark]]) {
    test(`design tokens (${name}): every text/UI colour pair meets WCAG AA contrast`, () => {
        const failures = [];
        for (const [fg, bg, min] of PAIRS) {
            const value = ratio(resolve(scheme, fg), resolve(scheme, bg));
            if (value < min) failures.push(`${fg} on ${bg}: ${value.toFixed(2)} < ${min}`);
        }
        assert.deepEqual(failures, []);
    });
}

test('design tokens: the approved brand palette is unchanged', () => {
    assert.deepEqual([light['brand-navy'], light['brand-royal'], light['brand-lime'], light['brand-sky'], light['brand-surface']].map(v => v.toUpperCase()),
        ['#0B3B8F', '#1456C5', '#B7E445', '#5F8FD9', '#F3F6FB']);
    assert.equal(resolve(light, 'primary-bg').toUpperCase(), '#B7E445');       // primary action is lime
    assert.equal(resolve(light, 'primary-ink').toUpperCase(), '#0B3B8F');      // with dark text
    assert.match(light['font-heading'], /^Cairo/u); assert.match(light['font-body'], /^Tajawal/u);
});

test('design tokens: states are never conveyed by colour alone (each has an icon glyph and text)', () => {
    const common = fs.readFileSync(fileURLToPath(new URL('../../src/ui/common.js', import.meta.url)), 'utf8');
    for (const state of ['active', 'partial', 'unknown', 'not_configured']) assert.ok(new RegExp(`${state}\\s*:\\s*\\[`, 'u').test(common), state);
});
