import { initPage, t, send, errorText, hasHostPermission, requestHostPermission } from './common.js';

initPage();
const $ = selector => document.querySelector(selector);
const steps = [...document.querySelectorAll('[data-step]')];
let current = 0;

function showStep(index) {
    current = Math.min(Math.max(index, 0), steps.length - 1);
    steps.forEach((section, i) => { section.hidden = i !== current; });
    [...$('#dots').children].forEach((dot, i) => (i === current ? dot.setAttribute('aria-current', 'step') : dot.removeAttribute('aria-current')));
    $('#progress').textContent = t('ob_progress', current + 1, steps.length);
    $('#back').hidden = current === 0;
    $('#next').hidden = current === steps.length - 1;
    if (current === steps.length - 1) refreshPermission();
}

async function refreshPermission() {
    const granted = await hasHostPermission();
    $('#permission').textContent = t(granted ? 'ob5_permission_ok' : 'ob5_permission_missing');
    $('#grant').hidden = granted;
    return granted;
}

$('#back').addEventListener('click', () => showStep(current - 1));
$('#next').addEventListener('click', () => showStep(current + 1));
$('#grant').addEventListener('click', async () => {
    const granted = await requestHostPermission();
    await refreshPermission();
    $('#message').textContent = granted ? '' : t('ob5_grant_denied');
    $('#message').className = granted ? 'msg' : 'msg error';
});
$('#finish').addEventListener('click', async () => {
    const reply = await send({ type: 'COMPLETE_ONBOARDING', baseList: $('#baseList').checked, starterTerms: $('#starterTerms').checked });
    const message = $('#message');
    if (!reply.ok) { message.textContent = errorText(reply.error); message.className = 'msg error'; return; }
    message.textContent = t('ob5_done'); message.className = 'msg ok';
    $('#finish').hidden = true; $('#selftest').hidden = false; $('#toSettings').hidden = false;
    await refreshPermission();
});

showStep(0);
