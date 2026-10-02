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
const BEFORE = '(?:\\+|%20|%22|%2C|[-._,])';
const AFTER = '(?:\\+|%20|%22|%2C|[-._,]|&|#|$)';

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
 * "word": phrase must start/end at a separator inside that parameter (whole words).
 * "contains": phrase may appear anywhere inside the parameter value (broader, more false blocks).
 * The match is confined to `[?&]param=...` up to the next `&` or `#`.
 */
export function buildPhraseRegex(mode, param, fragments) {
    const alternatives = fragments.join('|');
    if (mode === 'contains') return `[?&]${param}=[^&#]*(?:${alternatives})`;
    return `[?&]${param}=(?:[^&#]*${BEFORE})?(?:${alternatives})${AFTER}`;
}

/**
 * Greedy packing of phrases into as few regex rules as the browser accepts.
 * `supports(regex)` -> Promise<boolean> (declarativeNetRequest.isRegexSupported). The longest
 * parameter name is used for the probe so the result is valid for every engine.
 * Returns { chunks: string[][], unsupported: string[] } deterministically for a given browser.
 */
export async function packPhrases(phrases, mode, supports) {
    const chunks = [];
    const unsupported = [];
    let current = [];
    for (const phrase of phrases) {
        const trial = [...current, phrase];
        const regex = buildPhraseRegex(mode, LONGEST_PARAM, trial.map(phraseFragment));
        if (await supports(regex)) { current = trial; continue; }
        if (current.length) {
            chunks.push(current);
            current = [];
        }
        const alone = buildPhraseRegex(mode, LONGEST_PARAM, [phraseFragment(phrase)]);
        if (await supports(alone)) current = [phrase];
        else unsupported.push(phrase);
    }
    if (current.length) chunks.push(current);
    return { chunks, unsupported };
}

/** 1-based positions of phrases the browser cannot express as a rule on their own. */
export async function findUnsupported(phrases, mode, supports) {
    const bad = [];
    for (let i = 0; i < phrases.length; i++) {
        const regex = buildPhraseRegex(mode, LONGEST_PARAM, [phraseFragment(phrases[i])]);
        if (!(await supports(regex))) bad.push(i + 1);
    }
    return bad;
}
