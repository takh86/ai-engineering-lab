import { normalizeConfig } from './rules.js';
const $ = selector => document.querySelector(selector);
const lines = value => value.split(/\r?\n/u).map(x => x.trim()).filter(Boolean);
function show(result, fill = false) {
    if (!result?.ok) throw new Error(result?.error || 'تعذّر الاتصال بالإضافة.');
    if (fill) { $('#domains').value = result.config.domains.join('\n'); $('#keywords').value = result.config.keywords.join('\n'); }
    $('#status').textContent = !result.healthy ? 'القواعد لا تطابق الإعدادات. أعد الحفظ قبل الاعتماد عليها.' : result.count ? `قواعد مثبتة في كروم: ${result.count}. اختبرها على جهازك.` : 'لا توجد قواعد: الحجب غير معدّ بعد.';
    $('#lock').textContent = result.config.lockedUntil > Date.now() ? `الالتزام مستمر حتى ${new Date(result.config.lockedUntil).toLocaleString('ar')}` : 'لا توجد جلسة التزام نشطة.';
}
async function run(fn) {
    $('#message').textContent = ''; $('#message').className = '';
    try { await fn(); } catch (error) { $('#message').textContent = error.message; $('#message').className = 'error'; }
}
await run(async () => show(await chrome.runtime.sendMessage({ type: 'STATUS' }), true));
$('#form').addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
        const config = normalizeConfig({ domains: lines($('#domains').value), keywords: lines($('#keywords').value) });
        show(await chrome.runtime.sendMessage({ type: 'SAVE', config }), true);
        $('#message').textContent = 'تم تثبيت القواعد. جرّب فتح الموقع في تبويب جديد.';
    });
});
$('#test').addEventListener('click', () => {
    $('#domains').value = [...new Set([...lines($('#domains').value), 'example.com'])].join('\n');
    $('#message').textContent = 'أُضيف نطاق الاختبار إلى المسودة. اضغط حفظ، ثم افتح https://example.com.';
});
for (const button of document.querySelectorAll('[data-minutes]')) button.addEventListener('click', () => run(async () => show(await chrome.runtime.sendMessage({ type: 'LOCK', minutes: Number(button.dataset.minutes) }))));
