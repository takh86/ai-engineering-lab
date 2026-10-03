import { TabsiraError } from './errors.js';

// Multi-label public suffixes people commonly mistake for a site. Blocking one of these would
// block every site under it, and during a commitment session it could not be undone. This is a
// guard, not a full Public Suffix List: unlisted suffixes are the user's responsibility.
const SHARED_SUFFIXES = new Set([
    'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk', 'net.uk',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'co.nz', 'org.nz', 'net.nz',
    'co.za', 'org.za', 'co.in', 'net.in', 'org.in', 'ac.in', 'gov.in', 'co.jp', 'ne.jp', 'or.jp', 'ac.jp',
    'co.kr', 'or.kr', 'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'com.hk', 'com.tw', 'com.sg', 'com.my',
    'com.br', 'net.br', 'org.br', 'com.mx', 'com.ar', 'com.co', 'com.pe', 'com.ve', 'com.tr', 'com.ua',
    'co.il', 'org.il', 'ac.il', 'com.eg', 'edu.eg', 'gov.eg', 'org.eg', 'com.sa', 'edu.sa', 'gov.sa',
    'com.ae', 'co.ae', 'gov.ae', 'com.qa', 'com.kw', 'com.bh', 'com.om', 'com.jo', 'com.lb', 'com.sy',
    'com.iq', 'com.ly', 'com.tn', 'com.dz', 'co.ma', 'com.ma', 'com.pk', 'com.bd', 'com.ng', 'co.ke',
    'com.gh', 'co.tz', 'co.ug', 'com.ph', 'com.vn', 'co.id', 'co.th', 'in.th', 'com.pl', 'com.ru',
    'co.at', 'or.at', 'com.de', 'com.fr', 'com.es', 'com.pt', 'com.gr', 'com.cy', 'com.mt',
    'org.sa', 'net.sa', 'net.eg', 'net.ae', 'org.ae', 'ac.ae', 'net.pk', 'org.pk', 'edu.pk', 'org.bd', 'net.my', 'org.my', 'ac.id', 'web.id',
    'uk.com', 'co.com',
    // Hosts where every customer gets a subdomain: blocking the suffix blocks unrelated sites.
    'github.io', 'gitlab.io', 'pages.dev', 'netlify.app', 'vercel.app', 'herokuapp.com',
    'blogspot.com', 'wordpress.com', 'tumblr.com', 'weebly.com', 'wixsite.com', 'web.app',
    'firebaseapp.com', 'azurewebsites.net', 'appspot.com', 'cloudfront.net', 'amazonaws.com',
    'workers.dev', 'onrender.com', 'fly.dev', 'glitch.me', 'repl.co', 'myshopify.com'
]);

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

/**
 * Normalizes a user-entered site into a bare ASCII/punycode hostname.
 * Accepts "example.com" or "https://example.com/". A leading "www." is removed so a rule for
 * "www.example.com" covers the whole site. Throws TabsiraError with a code, never with the input.
 */
export function normalizeDomain(raw) {
    if (typeof raw !== 'string') throw new TabsiraError('domain_invalid');
    const input = raw.trim();
    if (!input) throw new TabsiraError('domain_empty');
    if (/[\s*]/u.test(input)) throw new TabsiraError('domain_wildcard_or_space');
    // An explicit port or credentials must be rejected even when the URL parser would drop them (e.g. :443).
    if (/[:@]/u.test(input.replace(/^[a-z][a-z0-9+.-]*:\/\//iu, '').split(/[/?#]/u)[0])) throw new TabsiraError('domain_has_path');
    let url;
    try { url = new URL(input.includes('://') ? input : `https://${input}`); }
    catch { throw new TabsiraError('domain_invalid'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new TabsiraError('domain_invalid');
    if (url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') {
        throw new TabsiraError('domain_has_path');
    }
    let host = url.hostname.toLowerCase().replace(/\.$/u, '');
    while (host.startsWith('www.')) host = host.slice(4);
    const labels = host.split('.');
    if (host.length > 253 || labels.length < 2 || !labels.every(label => LABEL.test(label))) {
        throw new TabsiraError('domain_invalid');
    }
    if (/^[0-9]+$/u.test(labels[labels.length - 1]) || /^\d+\.\d+\.\d+\.\d+$/u.test(host)) {
        throw new TabsiraError('domain_is_ip');
    }
    if (SHARED_SUFFIXES.has(host)) throw new TabsiraError('domain_is_shared_suffix');
    return host;
}

/** True when `child` is `parent` or a subdomain of it (DNS label boundary, never a substring). */
export function isSameOrSubdomain(child, parent) {
    return child === parent || child.endsWith(`.${parent}`);
}

/** Normalizes a list, keeping first-occurrence order; errors carry the 1-based line, never the text. */
export function normalizeDomainList(list, { max, errorCode = 'domain_invalid' } = {}) {
    if (!Array.isArray(list)) throw new TabsiraError('config_invalid');
    if (max !== undefined && list.length > max) throw new TabsiraError('too_many_domains', { max });
    const seen = new Set();
    list.forEach((raw, index) => {
        try { seen.add(normalizeDomain(raw)); }
        catch (error) {
            if (error instanceof TabsiraError) throw new TabsiraError(error.code === 'domain_invalid' ? errorCode : error.code, { line: index + 1 });
            throw error;
        }
    });
    return [...seen];
}
