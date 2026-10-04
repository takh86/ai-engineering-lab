import { initPage, t, send, errorText, renderStatus, formatDate, extensionVersion, setPageLanguage, uiLanguage, getPublicProfile } from './common.js';
import { mergeImport } from './core/config.js';
import { STARTER_TERMS } from './core/starter-terms.js';
import { durationToMinutes, domainPreviewPage, mergeSelectedDomains } from './settings-copy.js';
import { installPrayerSettings } from './prayer-settings.js';

const initial = await initPage();
const $ = selector => document.querySelector(selector);
const FIELDS = ['domains', 'allow', 'words', 'contains'];
const lines = value => value.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
let revision = 0, scheduleRevision = 0, status = null, schedules = [], editingSchedule = null, profile = initial.profile;
let security = initial.security, privateLoaded = false, notesDirty = false, filterDirty = false, pendingCommit = null;
let bundledDomains = null, previewPage = 0, previewLoading = false;
const selectedDomains = new Set();
let prayerCleanup = null, pendingImport = null;
let current = null;
async function mountPrayer() {
    prayerCleanup?.(); prayerCleanup = null;
    const eligible = profile?.religion === 'muslim' && profile?.faith;
    $('#prayerSettings').hidden = !eligible;
    if (eligible && !security?.locked) prayerCleanup = await installPrayerSettings($('#prayerSettings'), { send, language: uiLanguage() });
}
function clearPrivateView() {
    for (const field of FIELDS) $(`#${field}`).value = '';
    $('#notes').value = ''; $('#oneTimeCode').value = '';
    current = null; pendingImport = null; $('#importConfirm').hidden = true;
    selectedDomains.clear(); $('#domainPreview').replaceChildren(); $('#domainSearch').value = '';
    schedules = []; renderSchedules();
    privateLoaded = false; notesDirty = false; filterDirty = false;
    prayerCleanup?.(); prayerCleanup = null; $('#prayerSettings').replaceChildren();
}
const say = (text, kind = '') => { $('#message').textContent = text; $('#message').className = `msg ${kind}`.trim(); };
const showError = (error, { fromFile = false } = {}) => {
    if (error?.code === 'access_locked') { security = { ...security, locked: true }; clearPrivateView(); renderSecurity(); }
    if (fromFile && /^(import_|domain_|phrase_|allow_|conflict_|too_many_|config_invalid)/u.test(error?.code ?? '')) return say(errorText(error) + t('err_in_file'), 'error');
    if (fromFile) return say(errorText(error), 'error');
    const text = errorText(error);
    const field = FIELDS.includes(error?.params?.list) ? error.params.list : null;
    if (field) { $(`#${field}-err`).textContent = text; $(`#${field}`).focus(); }
    say(text, 'error');
};
function navigate() {
    const name = ['home', 'myplan', 'filter', 'more'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.id !== name;
    for (const link of document.querySelectorAll('.bottom-nav a')) {
        if (link.hash === `#${name}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
}
window.addEventListener('hashchange', navigate); navigate();
function renderSecurity() {
    const locked = Boolean(security?.locked);
    $('#privateSettings').hidden = locked;
    $('#unlockControls').hidden = !locked;
    $('#newPasswordControls').hidden = locked;
    $('#lockAccess').hidden = locked || !security?.enabled;
    $('#exitPasswordWarning').hidden = Boolean(security?.enabled);
    $('#securityStatus').textContent = t(locked ? 'set_locked' : security?.enabled ? 'set_unlocked' : 'set_no_password');
    if (locked) { clearPrivateView(); $('#recoveryResult').hidden = true; }
}
function fillProfile() {
    if (!profile) return;
    for (const key of ['language', 'religion', 'theme']) if (profile[key]) $(`#${key}`).value = profile[key];
    $('#faith').checked = Boolean(profile.faith);
}
function fillRules(value) {
    if (!value?.settings || filterDirty) return;
    revision = value.revision; current = value.settings;
    $('#starterTerms').checked = value.settings.starterTerms;
    for (const field of FIELDS) $(`#${field}`).value = value.settings[field].join('\n');
}
function render(value) {
    if (!value) return;
    status = value;
    if (value.security) security = value.security;
    renderStatus(value, { box: $('#status'), reasonList: $('#reasons'), lock: $('#lock'), incognito: $('#incognito') });
    $('#repair').hidden = !(value.reasons ?? []).some(reason => ['rules_mismatch', 'api_error'].includes(reason));
    if (value.base) $('#baseInfo').textContent = t('opt_base_info', value.base.domainCount.toLocaleString(uiLanguage()), formatDate(value.base.date));
    const commitment = value.commitment ?? { active: value.lock?.active, until: value.lock?.until };
    const request = commitment.request;
    $('#requestExit').disabled = !commitment.active || Boolean(request);
    $('#cancelExit').hidden = !request;
    $('#confirmExitControls').hidden = !request;
    $('#confirmExit').disabled = !request || Date.now() < request.readyAt;
    $('#exitState').textContent = request ? t('set_wait_until', new Date(request.readyAt).toLocaleString(uiLanguage())) : '';
    if (commitment.limits?.maxMinutes) $('#duration').max = commitment.limits.maxMinutes;
    if (commitment.exitDelay) $('#exitDelay').value = Math.max(Number($('#exitDelay').value), commitment.exitDelay);
    renderSecurity(); updateCountdown();
}
function updateCountdown() {
    const until = status?.commitment?.until ?? status?.lock?.until;
    const active = status?.commitment?.active ?? status?.lock?.active;
    if (!active || !until) { $('#countdown').textContent = ''; return; }
    const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    $('#countdown').textContent = `${Math.floor(seconds / 86400)} ${t('set_days')} · ${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if (status?.commitment?.request) $('#confirmExit').disabled = Date.now() < status.commitment.request.readyAt;
}
setInterval(updateCountdown, 1000);
async function refresh({ refill = true } = {}) {
    const reply = await send({ type: 'GET_STATUS' });
    if (!reply.ok) showError(reply.error);
    if (reply.status) { render(reply.status); if (refill) fillRules(reply.status); }
    const publicReply = await getPublicProfile();
    if (publicReply.ok) { profile = publicReply.profile; security = publicReply.security; renderSecurity(); }
    if (!security?.locked) {
        if (!privateLoaded) {
            const data = await send({ type: 'GET_PRIVATE_DATA' });
            if (data.ok) { if (!notesDirty) $('#notes').value = data.data.notes ?? ''; privateLoaded = true; }
            else showError(data.error);
            const scheduleReply = await send({ type: 'GET_SCHEDULES' });
            if (scheduleReply.ok) { schedules = scheduleReply.schedules; scheduleRevision = scheduleReply.revision; renderSchedules(); }
            else showError(scheduleReply.error);
        }
    }
}
async function act(message, success = 'set_saved', { refill = false, fromFile = false } = {}) {
    say('');
    for (const field of FIELDS) $(`#${field}-err`).textContent = '';
    const reply = await send(message);
    if (reply.status) render(reply.status);
    if (!reply.ok) {
        showError(reply.error, { fromFile });
        if (reply.error?.code === 'stale') { filterDirty = false; fillRules(reply.status); }
        return reply;
    }
    if (refill) { filterDirty = false; fillRules(reply.status); }
    if (reply.status?.revision !== undefined) scheduleRevision = reply.status.revision;
    if (reply.status && ['partial', 'unknown'].includes(reply.status.state)) say(t('opt_saved_partial'), 'error');
    else say(t(success), 'ok');
    return reply;
}
for (const term of STARTER_TERMS) $('#starterList').append(Object.assign(document.createElement('li'), { textContent: term }));
$('#version').textContent = t('common_version', extensionVersion());
for (const field of FIELDS) $(`#${field}`).addEventListener('input', () => { filterDirty = true; });
$('#starterTerms').addEventListener('change', () => { filterDirty = true; });
$('#notes').addEventListener('input', () => { notesDirty = true; });
$('#form').addEventListener('submit', async event => {
    event.preventDefault();
    for (const field of FIELDS) $(`#${field}-err`).textContent = '';
    const settings = { baseList: true, starterTerms: $('#starterTerms').checked };
    for (const field of FIELDS) settings[field] = lines($(`#${field}`).value);
    await act({ type: 'SAVE_SETTINGS', baseRevision: revision, settings }, 'opt_saved', { refill: true });
});
$('#saveNotes').addEventListener('click', async () => {
    const reply = await act({ type: 'SAVE_PRIVATE_DATA', data: { notes: $('#notes').value } });
    if (reply.ok) notesDirty = false;
});
$('#profileForm').addEventListener('submit', async event => {
    event.preventDefault();
    const patch = { language: $('#language').value, religion: $('#religion').value, faith: $('#faith').checked, theme: $('#theme').value };
    if (patch.religion !== 'muslim' || !patch.faith) {
        const disabled = await send({ type: 'PRAYER_DISABLE' });
        if (!disabled.ok) return showError(disabled.error);
    }
    const reply = await act({ type: 'SAVE_PUBLIC_PROFILE', profile: patch });
    if (reply.ok) {
        profile = reply.profile ?? { ...profile, ...patch }; document.documentElement.dataset.theme = profile.theme;
        await setPageLanguage(profile.language); say(t('set_saved'), 'ok'); renderSecurity(); render(status); renderSchedules();
        $('#version').textContent = t('common_version', extensionVersion());
        await mountPrayer();
    }
});
$('#language').addEventListener('change', () => setPageLanguage($('#language').value));
function showCode(reply) {
    if (reply.recoveryCode) { $('#oneTimeCode').value = reply.recoveryCode; $('#recoveryResult').hidden = false; }
}
$('#setPassword').addEventListener('click', async () => {
    if ($('#newPassword').value !== $('#repeatPassword').value) return say(t('set_mismatch'), 'error');
    const reply = await act({ type: 'SET_PASSWORD', password: $('#newPassword').value });
    if (reply.ok) { $('#newPassword').value = ''; $('#repeatPassword').value = ''; await refresh(); showCode(reply); }
});
$('#unlock').addEventListener('click', async () => {
    const reply = await act({ type: 'UNLOCK', password: $('#unlockPassword').value });
    if (reply.ok) { $('#unlockPassword').value = ''; privateLoaded = false; await refresh(); fillProfile(); await mountPrayer(); }
});
$('#lockAccess').addEventListener('click', async () => {
    const reply = await act({ type: 'LOCK_ACCESS' });
    if (reply.ok) { security = reply.security ?? { ...security, locked: true }; $('#oneTimeCode').value = ''; renderSecurity(); }
});
$('#recover').addEventListener('click', async () => {
    const reply = await act({ type: 'RECOVER_PASSWORD', recoveryCode: $('#recoveryCode').value, password: $('#recoveryPassword').value });
    if (reply.ok) { $('#recoveryCode').value = ''; $('#recoveryPassword').value = ''; privateLoaded = false; await refresh(); fillProfile(); await mountPrayer(); showCode(reply); }
});
$('#repair').addEventListener('click', () => act({ type: 'REPAIR' }));
$('#commitForm').addEventListener('submit', event => {
    event.preventDefault();
    const maximum = status?.commitment?.limits?.maxMinutes ?? 525600;
    const minutes = durationToMinutes($('#duration').value, $('#durationUnit').value, maximum);
    const exitDelay = Number($('#exitDelay').value);
    if (minutes === null || !Number.isSafeInteger(exitDelay) || exitDelay < 60 || exitDelay > maximum) return say(t('set_invalid_duration'), 'error');
    pendingCommit = { type: 'START_SESSION', minutes, exitDelay };
    $('#commitConfirmText').textContent = [t('opt_session_confirm', minutes), !security?.enabled ? t('set_exit_password_required') : ''].filter(Boolean).join(' ');
    $('#commitConfirm').hidden = false; $('#commitYes').focus();
});
$('#commitNo').addEventListener('click', () => { pendingCommit = null; $('#commitConfirm').hidden = true; $('#commitForm button[type=submit]').focus(); });
$('#commitYes').addEventListener('click', async () => {
    if (!pendingCommit) return;
    const reply = await act(pendingCommit, 'opt_session_started');
    if (reply.ok) { pendingCommit = null; $('#commitConfirm').hidden = true; }
});
$('#requestExit').addEventListener('click', () => act({ type: 'REQUEST_EARLY_EXIT' }));
$('#cancelExit').addEventListener('click', () => act({ type: 'CANCEL_EARLY_EXIT' }));
$('#confirmExit').addEventListener('click', async () => {
    const reply = await act({ type: 'CONFIRM_EARLY_EXIT', password: $('#exitPassword').value });
    if (reply.ok) $('#exitPassword').value = '';
});
for (let day = 0; day < 7; day++) {
    const label = document.createElement('label'); label.className = 'inline';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = day; input.name = 'scheduleDay';
    const span = document.createElement('span'); span.dataset.i18n = `set_day_${day}`; span.textContent = t(`set_day_${day}`);
    label.append(input, span); $('#scheduleDays').append(label);
}
function renderSchedules() {
    $('#scheduleList').replaceChildren(...schedules.map(item => {
        const li = document.createElement('li');
        const label = document.createElement('span'); label.textContent = `${item.days.map(day => t(`set_day_${day}`)).join(', ')} · ${item.start}–${item.end}`;
        const edit = Object.assign(document.createElement('button'), { type: 'button', textContent: t('set_edit') });
        edit.addEventListener('click', () => {
            editingSchedule = item.id; $('#scheduleStart').value = item.start; $('#scheduleEnd').value = item.end;
            for (const input of document.querySelectorAll('[name="scheduleDay"]')) input.checked = item.days.includes(Number(input.value));
            $('#scheduleSubmit').textContent = t('set_edit'); $('#scheduleCancel').hidden = false; $('#scheduleStart').focus();
        });
        const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: t('set_delete') });
        remove.addEventListener('click', () => saveSchedules(schedules.filter(schedule => schedule.id !== item.id)));
        li.append(label, edit, remove); return li;
    }));
}
function clearScheduleEditor() {
    editingSchedule = null; $('#scheduleSubmit').textContent = t('set_add'); $('#scheduleCancel').hidden = true;
}
async function saveSchedules(next) {
    const reply = await act({ type: 'SAVE_SCHEDULES', schedules: next, baseRevision: scheduleRevision });
    if (reply.ok) {
        scheduleRevision = reply.status?.revision ?? scheduleRevision;
        schedules = reply.schedules ?? reply.status?.schedules?.items ?? next; renderSchedules(); clearScheduleEditor();
    } else if (['stale', 'stale_revision'].includes(reply.error?.code)) {
        // Refresh the authoritative rows, never replay the stale write or overwrite the editor draft.
        const latest = await send({ type: 'GET_SCHEDULES' });
        if (latest.ok) {
            schedules = latest.schedules; scheduleRevision = latest.revision; renderSchedules();
            if (latest.status) render(latest.status);
            // If another tab removed the edited row, keep the entered days/times as a new draft.
            if (editingSchedule && !schedules.some(item => item.id === editingSchedule)) clearScheduleEditor();
        } else showError(latest.error);
    }
    return reply;
}
$('#scheduleCancel').addEventListener('click', clearScheduleEditor);
$('#scheduleForm').addEventListener('submit', async event => {
    event.preventDefault();
    const item = { id: editingSchedule ?? crypto.randomUUID(), days: [...document.querySelectorAll('[name="scheduleDay"]:checked')].map(input => Number(input.value)), start: $('#scheduleStart').value, end: $('#scheduleEnd').value, enabled: true };
    const next = editingSchedule ? schedules.map(schedule => schedule.id === editingSchedule ? item : schedule) : [...schedules, item];
    await saveSchedules(next);
});
for (const name of ['sites', 'phrases']) $(`#${name}Tab`).addEventListener('click', () => {
    for (const tab of ['sites', 'phrases']) { $(`#${tab}Fields`).hidden = tab !== name; $(`#${tab}Tab`).setAttribute('aria-selected', String(tab === name)); }
});
async function loadPreview() {
    if (bundledDomains || previewLoading) return;
    previewLoading = true;
    try {
        const response = await fetch('rulesets/base_adult.json');
        if (!response.ok) throw new Error('unavailable');
        const rules = await response.json();
        bundledDomains = rules[0].condition.requestDomains.filter(domain => domain !== 'tabsira-selftest.test');
        renderPreview();
    } catch { $('#previewCount').textContent = t('set_preview_error'); }
    finally { previewLoading = false; }
}
function renderPreview() {
    if (!bundledDomains) return;
    const result = domainPreviewPage(bundledDomains, $('#domainSearch').value, previewPage);
    previewPage = result.page;
    $('#previewCount').textContent = t('set_preview_count', result.total.toLocaleString(uiLanguage()), result.page + 1, result.pages);
    $('#previewPrevious').disabled = result.page === 0; $('#previewNext').disabled = result.page + 1 >= result.pages;
    $('#domainPreview').replaceChildren(...result.items.map(domain => {
        const li = document.createElement('li'), label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.checked = selectedDomains.has(domain);
        input.addEventListener('change', () => {
            if (input.checked && selectedDomains.size >= 1000) { input.checked = false; return say(t('set_selection_limit'), 'error'); }
            if (input.checked) selectedDomains.add(domain); else selectedDomains.delete(domain);
        });
        label.append(input, document.createTextNode(domain)); li.append(label); return li;
    }));
}
$('#basePreview').addEventListener('toggle', () => { if ($('#basePreview').open) loadPreview(); });
$('#domainSearch').addEventListener('input', () => { previewPage = 0; renderPreview(); });
$('#previewPrevious').addEventListener('click', () => { previewPage--; renderPreview(); });
$('#previewNext').addEventListener('click', () => { previewPage++; renderPreview(); });
$('#addSelected').addEventListener('click', () => {
    const merged = mergeSelectedDomains(lines($('#domains').value), selectedDomains);
    if (!merged) return say(t('set_selection_limit'), 'error');
    $('#domains').value = merged.join('\n'); filterDirty = true; selectedDomains.clear(); renderPreview();
});
$('#export').addEventListener('click', async () => {
    const reply = await send({ type: 'GET_EXPORT' }); if (!reply.ok) return showError(reply.error);
    const url = URL.createObjectURL(new Blob([reply.text], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'tabsira-settings.json' });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#importButton').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    if (file.size > 262144) return say(errorText({ code: 'import_too_large' }), 'error');
    const text = await file.text();
    // Preview what the file would ADD (sites, phrases, exceptions) and ask first: a file from someone else must not silently exempt sites.
    let merged = null;
    try { merged = mergeImport(current ?? { baseList: false, starterTerms: false, domains: [], allow: [], words: [], contains: [] }, text); } catch { /* the worker reports the precise error below */ }
    if (!merged) return act({ type: 'IMPORT_SETTINGS', baseRevision: revision, text }, 'opt_imported', { fromFile: true, refill: true });
    const before = current ?? { domains: [], allow: [], words: [], contains: [] };
    const added = key => merged[key].filter(item => !before[key].includes(item));
    const phrases = [...added('words'), ...added('contains')].length;
    const exceptions = added('allow');
    pendingImport = text;
    $('#importConfirmText').textContent = t('opt_import_confirm', added('domains').length, phrases, exceptions.length);
    $('#importExceptions').replaceChildren(...exceptions.map(item => Object.assign(document.createElement('li'), { textContent: item })));
    $('#importExceptions').hidden = $('#importExceptionsTitle').hidden = !exceptions.length;
    // During a commitment session an exception cannot be added: say so now instead of after Confirm.
    const blocked = !!(status?.commitment?.active ?? status?.lock?.active) && exceptions.length > 0;
    if (blocked) $('#importConfirmText').textContent += ` ${t('opt_import_locked')}`;
    $('#importYes').hidden = blocked;
    $('#importConfirm').hidden = false;
    (blocked ? $('#importNo') : $('#importYes')).focus();
});
$('#importNo').addEventListener('click', () => { $('#importConfirm').hidden = true; pendingImport = null; $('#importButton').focus(); });
$('#importYes').addEventListener('click', async () => {
    const text = pendingImport;
    $('#importConfirm').hidden = true; pendingImport = null;
    $('#importButton').focus();
    if (text) await act({ type: 'IMPORT_SETTINGS', baseRevision: revision, text }, 'opt_imported', { fromFile: true, refill: true });
});

$('#reset').addEventListener('click', () => { $('#resetConfirm').hidden = false; $('#resetYes').focus(); });
$('#resetNo').addEventListener('click', () => { $('#resetConfirm').hidden = true; $('#reset').focus(); });
$('#resetYes').addEventListener('click', async () => { const reply = await act({ type: 'RESET', baseRevision: revision }, 'opt_reset_done', { refill: true }); if (reply.ok) $('#resetConfirm').hidden = true; });
fillProfile(); renderSecurity();
await refresh();
await mountPrayer();

// A restarted worker closes the private session. Check while this view is visible.
setInterval(() => { if (!document.hidden) void refresh({ refill: false }); }, 15000);
