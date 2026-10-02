import { DEFAULTS, normalizeConfig, buildRules, assertNoWeakening } from './rules.js';
let queue = Promise.resolve();
const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
async function readConfig() {
    return { ...DEFAULTS, ...(await chrome.storage.local.get('config')).config };
}
async function replaceRules(config) {
    const rules = buildRules(config);
    for (const rule of rules.filter(x => x.condition.regexFilter)) {
        const result = await chrome.declarativeNetRequest.isRegexSupported({ regex: rule.condition.regexFilter, isCaseSensitive: false });
        if (!result.isSupported) throw new Error('عبارة البحث طويلة أو غير مدعومة. قصّرها وحاول تاني.');
    }
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map(x => x.id), addRules: rules });
}
async function handle(message) {
    const previous = await readConfig();
    if (message.type === 'STATUS') {
        const actual = await chrome.declarativeNetRequest.getDynamicRules();
        const expected = buildRules(previous);
        return { config: previous, count: actual.length, healthy: canonical(actual.sort((a,b) => a.id-b.id)) === canonical(expected) };
    }
    let next;
    if (message.type === 'SAVE') {
        next = { ...normalizeConfig(message.config), lockedUntil: previous.lockedUntil };
        assertNoWeakening(previous, next);
    } else if (message.type === 'LOCK') {
        if (![60,90,120].includes(message.minutes)) throw new Error('مدة غير صالحة.');
        if (!previous.domains.length && !previous.keywords.length) throw new Error('أضف مواقع أو عبارات أولًا، ثم ابدأ جلسة الالتزام.');
        next = { ...previous, lockedUntil: Math.max(previous.lockedUntil, Date.now() + message.minutes * 60000) };
    } else throw new Error('طلب غير معروف.');
    // If storage fails after rule installation, restore the old rules and report failure.
    await replaceRules(next);
    try { await chrome.storage.local.set({ config: next }); }
    catch (error) { await replaceRules(previous); throw error; }
    return { config: next, count: buildRules(next).length, healthy: true };
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
    const operation = queue.then(() => handle(message));
    queue = operation.catch(() => {});
    operation.then(data => reply({ ok: true, ...data }), () => reply({ ok: false, error: 'تعذّر تنفيذ الطلب. تحقق من القواعد أو مدة الالتزام وأعد المحاولة.' }));
    return true;
});
const initialize = () => {
    queue = queue.then(async () => {
        await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
        await replaceRules(await readConfig());
    }).catch(() => {});
};
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
