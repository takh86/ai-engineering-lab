import { TabsiraError } from './errors.js';
import { LONGEST_PARAM } from './engines.js';

export const PHRASE_MIN = 2;
export const PHRASE_MAX = 60;

const ARABIC_MARKS = /[ـً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/gu;

/**
 * Canonical stored form of a search phrase:
 * NFKC (folds Arabic presentation forms and full-width Latin), invisible/bidi format characters
 * removed, Arabic diacritics and tatweel removed, lower-cased, whitespace collapsed.
 * Letter variants (alef forms, ya/alef-maqsura, ta-marbuta) are intentionally NOT folded: the URL
 * side cannot be folded the same way, so folding only one side would create false confidence.
 */
export function normalizePhrase(raw) {
    if (typeof raw !== 'string') throw new TabsiraError('phrase_invalid');
    const text = raw.normalize('NFKC')
        .replace(/\p{Cf}/gu, '')
        .replace(ARABIC_MARKS, '')
        .toLowerCase()
        .replace(/\s+/gu, ' ')
        .trim();
    const length = [...text].length;
    if (length < PHRASE_MIN || length > PHRASE_MAX) throw new TabsiraError('phrase_length', { min: PHRASE_MIN, max: PHRASE_MAX });
    if (/\p{Cc}/u.test(text)) throw new TabsiraError('phrase_control_chars');
    if (/[\ud800-\udfff]/u.test(text.replace(/[\ud800-\udbff][\udc00-\udfff]/gu, ''))) throw new TabsiraError('phrase_invalid');   // lone surrogate: not encodable
    if (([...text.matchAll(/[\p{L}\p{N}]/gu)]).length < 2) throw new TabsiraError('phrase_no_letters');
    return text;
}

export function normalizePhraseList(list, { max }) {
    if (!Array.isArray(list)) throw new TabsiraError('config_invalid');
    if (list.length > max) throw new TabsiraError('too_many_phrases', { max });
    const seen = new Set();
    list.forEach((raw, index) => {
        try { seen.add(normalizePhrase(raw)); }
        catch (error) {
            if (error instanceof TabsiraError) throw new TabsiraError(error.code, { ...error.params, line: index + 1 });
            throw error;
        }
    });
    return [...seen];
}

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const hex = char => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`;
// encodeURIComponent leaves these unescaped, but search engines are free to escape them.
const OPTIONALLY_ESCAPED = new Set(["!", "'", '(', ')', '*', '~']);
const SPACE = '(?:\\+|%20)+';
// Whole-word boundaries. Browser regex memory is tight (a few Arabic letters per rule), so there are two forms:
//  * wide   - a space, `. , _ - : ; ?` (raw), any `%2x`/`%3x` escape (space, quote, comma, dot, dash, slash, colon, semicolon, question
//             mark, parentheses ...) or the parameter edge. So "xvideos.com", "\"xvideos\"", "hentai-xvideos", `site:xvideos.com` match as the
//             word `xvideos`. NOT edges (each costs regex memory that long Arabic phrases need): raw ( ) [ ] | and the Arabic marks ؟ ، ؛;
//  * narrow - only a space (+ or %20) or the parameter edge (the 1.0.0 behaviour). Used only for a phrase that does not fit the wide
//             form for some search parameter (long Arabic phrases on YouTube/Yandex), so such a phrase is still protected, just
//             less broadly. It is never dropped.
const WORD_EDGE = { wide: '[+.,_:;?-]|%[23][0-9A-F]', narrow: '\\+|%20' };
const BEFORE = { wide: `(?:${WORD_EDGE.wide})`, narrow: `(?:${WORD_EDGE.narrow})` };
const AFTER = { wide: `(?:${WORD_EDGE.wide}|&|#|$)`, narrow: `(?:${WORD_EDGE.narrow}|&|#|$)` };

function encodedToken(token) {
    const encoded = encodeURIComponent(token);
    let out = '';
    for (let i = 0; i < encoded.length; i++) {
        const char = encoded[i];
        if (char === '%') { out += encoded.slice(i, i + 3); i += 2; }
        else if (OPTIONALLY_ESCAPED.has(char)) out += `(?:${escapeRegex(char)}|${hex(char)})`;
        else out += escapeRegex(char);
    }
    return out;
}

/** Regex fragment matching the percent-encoded form of one normalized phrase (+ or %20 for spaces). */
export function phraseFragment(phrase) {
    return phrase.split(' ').map(encodedToken).join(SPACE);
}

/**
 * Builds the regexFilter for one search parameter.
 * "word": phrase must start/end at a separator inside that parameter (whole words, wide boundary);
 * "word_narrow": the same with the narrow boundary (fallback for phrases that do not fit the wide form).
 * "contains": phrase may appear anywhere inside the parameter value (broader, more false blocks).
 * The match is confined to `[?&]param=...` up to the next `&` or `#`.
 */
export function buildPhraseRegex(mode, param, fragments) {
    const alternatives = fragments.join('|');
    if (mode === 'contains') return `[?&]${param}=[^&#]*(?:${alternatives})`;
    const form = mode === 'word_narrow' ? 'narrow' : 'wide';
    return `[?&]${param}=(?:[^&#]*${BEFORE[form]})?(?:${alternatives})${AFTER[form]}`;
}

/**
 * Greedy packing of phrases into as few regex rules as the browser accepts for one query parameter.
 * `supports(regex)` -> Promise<boolean> (declarativeNetRequest.isRegexSupported).
 * Returns { chunks: string[][], unsupported: string[] } deterministically for a given browser.
 */
export async function packPhrases(phrases, mode, supports, param = LONGEST_PARAM) {
    const chunks = [];
    const unsupported = [];
    let current = [];
    for (const phrase of phrases) {
        const trial = [...current, phrase];
        const regex = buildPhraseRegex(mode, param, trial.map(phraseFragment));
        if (await supports(regex)) { current = trial; continue; }
        if (current.length) {
            chunks.push(current);
            current = [];
        }
        const alone = buildPhraseRegex(mode, param, [phraseFragment(phrase)]);
        if (await supports(alone)) current = [phrase];
        else unsupported.push(phrase);
    }
    if (current.length) chunks.push(current);
    return { chunks, unsupported };
}

/**
 * Whole-word phrases for one parameter: wide-boundary rules where they fit, the narrow boundary for the rest.
 * Returns { chunks, narrow, unsupported } (chunks/narrow: arrays of phrase groups, one rule each).
 */
export async function packWord(phrases, supports, param = LONGEST_PARAM) {
    const wide = await packPhrases(phrases, 'word', supports, param);
    const fallback = await packPhrases(wide.unsupported, 'word_narrow', supports, param);
    return { chunks: wide.chunks, narrow: fallback.chunks, unsupported: fallback.unsupported };
}

/**
 * 1-based positions of phrases the browser cannot express as a rule on their own, for at least one of `params`
 * (every search parameter that planRules uses). For whole words the narrow fallback counts as expressible.
 */
export async function findUnsupported(phrases, mode, supports, params = ['q']) {
    const bad = [];
    for (let i = 0; i < phrases.length; i++) {
        const fragment = phraseFragment(phrases[i]);
        const forms = mode === 'word' ? ['word', 'word_narrow'] : [mode];
        let ok = true;
        for (const param of params) {
            let any = false;
            for (const form of forms) if (await supports(buildPhraseRegex(form, param, [fragment]))) { any = true; break; }
            if (!any) { ok = false; break; }
        }
        if (!ok) bad.push(i + 1);
    }
    return bad;
}
