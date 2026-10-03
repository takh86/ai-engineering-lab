import { initPage, t, send, errorText, hasHostPermission, requestHostPermission, setPageLanguage, uiLanguage } from './common.js';
import { initialFaith } from './settings-copy.js';
import { installPrayerSettings } from './prayer-settings.js';

const initial = await initPage();
const $ = selector => document.querySelector(selector);
const steps = [...document.querySelectorAll('[data-step]')];
let current = 0, busy = false, passwordSet = Boolean(initial.security?.enabled), completed = false, prayerCleanup = null;
const say = (text, failed = false) => { $('#message').textContent = text; $('#message').className = failed ? 'msg error' : 'msg'; };
function draftProfile() { return { language: $('#language').value, religion: $('#religion').value, faith: $('#faith').checked, theme: $('#theme').value }; }
async function mountPrayer() {
    prayerCleanup?.(); prayerCleanup = null;
    const eligible = $('#religion').value === 'muslim' && $('#faith').checked;
    $('#prayerPrompt').hidden = !eligible;
    if (eligible) prayerCleanup = await installPrayerSettings($('#prayerSettings'), { send, language: uiLanguage() });
}
function showStep(index) {
    current = Math.min(Math.max(index, 0), steps.length - 1);
    steps.forEach((section, i) => { section.hidden = i !== current; });
    [...$('#dots').children].forEach((dot, i) => i === current ? dot.setAttribute('aria-current', 'step') : dot.removeAttribute('aria-current'));
    $('#progress').textContent = t('ob_progress', current + 1, steps.length);
    $('#back').hidden = current === 0 || completed;
    $('#next').hidden = current === steps.length - 1 || completed;
    if (current === 2) void refreshPermission();
}
async function refreshPermission() {
    const granted = await hasHostPermission();
    $('#permission').textContent = t(granted ? 'ob5_permission_ok' : 'ob5_permission_missing');
    $('#grant').hidden = granted;
}
$('#language').value = initial.profile?.language ?? uiLanguage();
if (initial.profile?.religion) $('#religion').value = initial.profile.religion;
$('#faith').checked = Boolean(initial.profile?.faith);
$('#theme').value = initial.profile?.theme ?? 'light';
$('#language').addEventListener('change', async () => { await setPageLanguage($('#language').value); showStep(current); });
$('#theme').addEventListener('change', () => { document.documentElement.dataset.theme = $('#theme').value; });
$('#religion').addEventListener('change', () => { $('#faith').checked = initialFaith($('#religion').value); });
$('#back').addEventListener('click', () => { if (!busy) showStep(current - 1); });
$('#next').addEventListener('click', async () => {
    if (busy) return;
    if (current === 3 && !$('#recoveryResult').hidden && !$('#codeSaved').checked) return say(t('set_code_required'), true);
    if (current === 3 && !passwordSet && ($('#newPassword').value || $('#repeatPassword').value)) return say(t('set_password_pending'), true);
    busy = true; $('#next').disabled = true;
    try {
        if (current === 1) {
            if (!['muslim', 'non-muslim'].includes($('#religion').value)) { say(t('set_choose_required'), true); return; }
            const patch = draftProfile();
            if (patch.religion !== 'muslim' || !patch.faith) {
                const disabled = await send({ type: 'PRAYER_DISABLE' });
                if (!disabled.ok) { say(errorText(disabled.error), true); return; }
            }
            const reply = await send({ type: 'SAVE_PUBLIC_PROFILE', profile: patch });
            if (!reply.ok) { say(errorText(reply.error), true); return; }
        }
        if (current === 2) await mountPrayer();
        say(''); showStep(current + 1);
    } finally { busy = false; $('#next').disabled = false; }
});
$('#grant').addEventListener('click', async () => {
    const granted = await requestHostPermission();
    await refreshPermission(); say(granted ? '' : t('ob5_grant_denied'), !granted);
});
$('#setPassword').addEventListener('click', async () => {
    if (busy) return;
    if ($('#newPassword').value !== $('#repeatPassword').value) return say(t('set_mismatch'), true);
    busy = true; $('#setPassword').disabled = true;
    try {
        const reply = await send({ type: 'SET_PASSWORD', password: $('#newPassword').value });
        if (!reply.ok) { say(errorText(reply.error), true); return; }
        passwordSet = true; $('#newPassword').value = ''; $('#repeatPassword').value = '';
        $('#passwordControls').hidden = true; $('#passwordState').textContent = t('set_unlocked');
        $('#oneTimeCode').value = reply.recoveryCode ?? ''; $('#recoveryResult').hidden = !reply.recoveryCode; say('');
    } finally { busy = false; $('#setPassword').disabled = false; }
});
$('#passwordControls').hidden = passwordSet;
if (passwordSet) $('#passwordState').textContent = t(initial.security?.locked ? 'set_locked' : 'set_unlocked');
$('#finish').addEventListener('click', async () => {
    if (busy || completed) return;
    busy = true; $('#finish').disabled = true;
    try {
        const reply = await send({ type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: $('#starterTerms').checked });
        if (!reply.ok) { say(errorText(reply.error), true); return; }
        completed = true; $('#finish').hidden = true; $('#completed').hidden = false;
        $('#toCovenant').hidden = !$('#covenantNow').checked; $('#oneTimeCode').value = ''; $('#recoveryResult').hidden = true;
        prayerCleanup?.(); prayerCleanup = null;
        const state = reply.status?.state ?? 'unknown';
        say(state === 'active' ? t('ob5_done') : [t(`state_${state}`), ...(reply.status?.reasons ?? []).map(reason => t(`reason_${reason}`))].join(' '), state !== 'active');
        showStep(4);
    } finally { busy = false; $('#finish').disabled = false; }
});
const existing = (await send({ type: 'GET_STATUS' })).status;
if (existing?.onboarded) {
    completed = true; $('#finish').hidden = true; $('#completed').hidden = false; say(t('ob_already_done')); showStep(4);
} else showStep(0);
