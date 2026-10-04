// Search engines whose result URLs carry the query in a known parameter. Only the named
// parameter is inspected, so a phrase in an unrelated parameter never matches.
// "domains" matches the host and its subdomains (images.search.yahoo.com, www.bing.com, ...).
// Limits that remain by design: queries submitted without a new main-frame navigation
// (in-page suggestions, XHR/fetch result updates) are invisible to URL rules.

const GOOGLE_SUFFIXES = [
    'com', 'ad', 'ae', 'com.af', 'com.ag', 'al', 'am', 'co.ao', 'com.ar', 'as', 'at', 'com.au', 'az', 'ba', 'com.bd',
    'be', 'bf', 'bg', 'com.bh', 'bi', 'bj', 'com.bn', 'com.bo', 'com.br', 'bs', 'bt', 'co.bw', 'by', 'com.bz', 'ca',
    'cd', 'cf', 'cg', 'ch', 'ci', 'co.ck', 'cl', 'cm', 'cn', 'com.co', 'co.cr', 'com.cu', 'cv', 'com.cy', 'cz', 'de',
    'dj', 'dk', 'dm', 'com.do', 'dz', 'com.ec', 'ee', 'com.eg', 'es', 'com.et', 'fi', 'com.fj', 'fm', 'fr', 'ga', 'ge',
    'gg', 'com.gh', 'com.gi', 'gl', 'gm', 'gr', 'com.gt', 'gy', 'com.hk', 'hn', 'hr', 'ht', 'hu', 'co.id', 'ie', 'co.il',
    'im', 'co.in', 'iq', 'is', 'it', 'je', 'com.jm', 'jo', 'co.jp', 'co.ke', 'com.kh', 'ki', 'kg', 'co.kr', 'com.kw',
    'kz', 'la', 'com.lb', 'li', 'lk', 'co.ls', 'lt', 'lu', 'lv', 'com.ly', 'co.ma', 'md', 'me', 'mg', 'mk', 'ml',
    'com.mm', 'mn', 'com.mt', 'mu', 'mv', 'mw', 'com.mx', 'com.my', 'co.mz', 'com.na', 'com.ng', 'com.ni', 'ne', 'nl',
    'no', 'com.np', 'nr', 'nu', 'co.nz', 'com.om', 'com.pa', 'com.pe', 'com.pg', 'com.ph', 'com.pk', 'pl', 'pn',
    'com.pr', 'ps', 'pt', 'com.py', 'com.qa', 'ro', 'ru', 'rw', 'com.sa', 'com.sb', 'sc', 'se', 'com.sg', 'sh', 'si',
    'sk', 'com.sl', 'sn', 'so', 'sm', 'sr', 'st', 'com.sv', 'td', 'tg', 'co.th', 'com.tj', 'tl', 'tm', 'tn', 'to',
    'com.tr', 'tt', 'com.tw', 'co.tz', 'com.ua', 'co.ug', 'co.uk', 'com.uy', 'co.uz', 'com.vc', 'co.ve', 'co.vi',
    'com.vn', 'vu', 'ws', 'rs', 'co.za', 'co.zm', 'co.zw'
];

export const ENGINES = Object.freeze([
    { id: 'google', param: 'q', domains: GOOGLE_SUFFIXES.map(suffix => `google.${suffix}`) },
    { id: 'bing', param: 'q', domains: ['bing.com'] },
    { id: 'duckduckgo', param: 'q', domains: ['duckduckgo.com'] },
    { id: 'yahoo', param: 'p', domains: ['search.yahoo.com'] },
    { id: 'youtube', param: 'search_query', domains: ['youtube.com'] },
    { id: 'yandex', param: 'text', domains: ['yandex.com', 'yandex.ru'] },
    { id: 'brave', param: 'q', domains: ['search.brave.com'] },
    { id: 'ecosia', param: 'q', domains: ['ecosia.org'] },
    { id: 'qwant', param: 'q', domains: ['qwant.com'] }
]);

export const LONGEST_PARAM = ENGINES.reduce((a, e) => (e.param.length > a.length ? e.param : a), '');

export const ALL_ENGINE_DOMAINS = Object.freeze(ENGINES.flatMap(engine => engine.domains));
