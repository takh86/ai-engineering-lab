const result = await chrome.runtime.sendMessage({ type: 'STATUS' }).catch(() => null);
const status = document.querySelector('#status');
status.textContent = !result?.ok || !result.healthy ? 'تعذّر تأكيد تشغيل القواعد. افتح الإعدادات.' : result.count ? `قواعد مثبتة في كروم: ${result.count}` : 'لم تضف قواعد بعد — الحجب غير معدّ.';
if (result?.config.lockedUntil > Date.now()) document.querySelector('#lock').textContent = `جلسة الالتزام حتى ${new Date(result.config.lockedUntil).toLocaleTimeString('ar')}`;
document.querySelector('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
