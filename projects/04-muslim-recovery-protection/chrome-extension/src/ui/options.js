import { initPage, t, send, errorText, renderStatus, formatDate, extensionVersion } from './common.js';
import { STARTER_TERMS } from './core/starter-terms.js';

initPage();
const $ = selector => document.querySelector(selector);
const FIELDS = ['domains', 'allow', 'words', 'contains'];
const SESSION_MINUTES = [60, 90, 120];
let revision = 0;
let pendingMinutes = null;

const lines = value => value.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
const say = (text, kind = '') => { const box = $('#message'); box.textContent = text; box.className = `msg ${kind}`.trim(); };
const clearFieldErrors = () => { for (const name of FIELDS) $(`#${name}-err`).textContent = ''; };

function fill(status) {
    if (!status?.settings) return;
    revision = status.revision;
    $('#baseList').checked = status.settings.baseList;
    $('#starterTerms').checked = status.settings.starterTerms;
    for (const name of FIELDS) $(`#${name}`).value = status.settings[name].join('\n');
}

function render(status) {
    renderStatus(status, { box: $('#status'), reasonList: $('#reasons'), lock: $('#lock'), incognito: $('#incognito') });
    $('#repair').hidden = !(status?.reasons ?? []).some(reason => ['rules_mismatch', 'api_error'].includes(reason));
    if (status?.base) $('#baseInfo').textContent = t('opt_base_info', status.base.domainCount.toLocaleString(document.documentElement.lang), formatDate(status.base.date));
    $('#reset').disabled = false;
}

function showError(error) {
    const text = errorText(error);
    const field = error?.params?.list && FIELDS.includes(error.params.list) ? error.params.list : null;
    if (field) { $(`#${field}-err`).textContent = text; $(`#${field}`).focus(); }
    else say(text, 'error');
}

async function refresh() {
    const reply = await send({ type: 'GET_STATUS' });
    render(reply.status);
    fill(reply.status);
}

function collect() {
    return {
        baseList: $('#baseList').checked, starterTerms: $('#starterTerms').checked,
        domains: lines($('#domains').value), allow: lines($('#allow').value),
        words: lines($('#words').value), contains: lines($('#contains').value)
    };
}

async function act(message, successText) {
    say(''); clearFieldErrors();
    const reply = await send(message);
    if (reply.status) render(reply.status);
    if (reply.ok) { fill(reply.status); say(successText, 'ok'); return reply; }
    showError(reply.error);
    if (reply.error?.code === 'stale') fill(reply.status);
    return reply;
}

for (const term of STARTER_TERMS) $('#starterList').append(Object.assign(document.createElement('li'), { textContent: term }));
$('#version').textContent = t('common_version', extensionVersion());

$('#form').addEventListener('submit', event => {
    event.preventDefault();
    act({ type: 'SAVE_SETTINGS', baseRevision: revision, settings: collect() }, t('opt_saved'));
});
$('#repair').addEventListener('click', async () => { const reply = await send({ type: 'REPAIR' }); render(reply.status); });

// ---- commitment session (explicit confirmation step) ----
for (const minutes of SESSION_MINUTES) {
    const button = Object.assign(document.createElement('button'), { type: 'button', textContent: t('opt_session_start', minutes) });
    button.addEventListener('click', () => {
        pendingMinutes = minutes;
        $('#sessionConfirmText').textContent = t('opt_session_confirm', minutes);
        $('#sessionConfirm').hidden = false;
        $('#sessionYes').focus();
    });
    $('#sessionButtons').append(button);
}
$('#sessionNo').addEventListener('click', () => { $('#sessionConfirm').hidden = true; pendingMinutes = null; });
$('#sessionYes').addEventListener('click', async () => {
    const minutes = pendingMinutes;
    $('#sessionConfirm').hidden = true; pendingMinutes = null;
    if (minutes) await act({ type: 'START_SESSION', minutes }, t('opt_session_started'));
});

// ---- backup ----
$('#export').addEventListener('click', async () => {
    const reply = await send({ type: 'GET_EXPORT' });
    if (!reply.ok) return showError(reply.error);
    const url = URL.createObjectURL(new Blob([reply.text], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'tabsira-settings.json' });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#importButton').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    if (file.size > 262144) return say(errorText({ code: 'import_too_large' }), 'error');
    await act({ type: 'IMPORT_SETTINGS', baseRevision: revision, text: await file.text() }, t('opt_imported'));
});

// ---- reset (confirmed) ----
$('#reset').addEventListener('click', () => { $('#resetConfirm').hidden = false; $('#resetYes').focus(); });
$('#resetNo').addEventListener('click', () => { $('#resetConfirm').hidden = true; });
$('#resetYes').addEventListener('click', async () => { $('#resetConfirm').hidden = true; await act({ type: 'RESET', baseRevision: revision }, t('opt_reset_done')); });

await refresh();
