export const DEFAULTS = { domains: [], keywords: [], lockedUntil: 0 };
export const SEARCH_DOMAINS = ['google.com','google.de','google.com.eg','bing.com','duckduckgo.com','search.yahoo.com','youtube.com'];
export function normalizeDomain(raw) {
    const input = raw.trim();
    if (!input || /[\s*]/u.test(input)) throw new Error('اكتب نطاقًا صحيحًا، من غير مسافات أو نجمة.');
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') throw new Error('اكتب اسم الموقع فقط، مثل example.com.');
    const host = url.hostname.toLowerCase().replace(/\.$/u,'');
    if (host.length > 253 || !host.includes('.') || !host.split('.').every(x => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(x))) throw new Error('اسم الموقع غير صالح.');
    return host;
}
export function normalizeConfig(raw) {
    if (!Array.isArray(raw.domains) || !Array.isArray(raw.keywords)) throw new Error('إعدادات غير صالحة.');
    if (raw.domains.length > 200 || raw.keywords.length > 50) throw new Error('الحد ٢٠٠ موقع و٥٠ عبارة.');
    const domains = [...new Set(raw.domains.map(normalizeDomain))];
    const keywords = [...new Set(raw.keywords.map(x => {
        if (typeof x !== 'string') throw new Error('عبارة غير صالحة.');
        const word = x.normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase();
        if (word.length < 2 || word.length > 60 || /[\p{Cc}\p{Cf}]/u.test(word)) throw new Error('كل عبارة بين حرفين و٦٠ حرفًا، من غير رموز تحكم.');
        return word;
    }))];
    return { domains, keywords };
}
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function buildRules(config) {
    let id = 1;
    const action = { type: 'redirect', redirect: { extensionPath: '/blocked.html' } };
    const rules = config.domains.map(domain => ({ id: id++, priority: 1, action,
        condition: { requestDomains: [domain], resourceTypes: ['main_frame'] } }));
    for (const keyword of config.keywords) {
        // Match a substring within the selected search parameter only; never inspect page content.
        const encoded = keyword.split(' ').map(x => escapeRegex(encodeURIComponent(x))).join('(\\+|%20)');
        rules.push({ id: id++, priority: 1, action, condition: {
            requestDomains: SEARCH_DOMAINS, resourceTypes: ['main_frame'], isUrlFilterCaseSensitive: false,
            regexFilter: `[?&](q|p|search_query)=[^&#]*${encoded}[^&#]*(&|#|$)`
        }});
    }
    return rules;
}
export function assertNoWeakening(previous, next, now = Date.now()) {
    if (previous.lockedUntil > now && (
        previous.domains.some(x => !next.domains.includes(x)) ||
        previous.keywords.some(x => !next.keywords.includes(x)))) {
        throw new Error('جلسة الالتزام مستمرة. تقدر تضيف قواعد، لكن الحذف ينتظر انتهاءها.');
    }
}
