import { initPage, send, renderStatus, openOptions } from './common.js';
import { popupText } from './popup-copy.js';
import { commitmentCountdown, honestStatus } from './core/popup-model.js';
import { blockCurrentSite } from './core/popup-actions.js';

const ext = globalThis.browser ?? globalThis.chrome;
await initPage();
const copy = key => popupText(key, document.documentElement.lang);
for (const node of document.querySelectorAll('[data-popup]')) node.textContent = copy(node.dataset.popup);
document.querySelector('#popup-nav').setAttribute('aria-label', copy('home'));

const box = document.querySelector('#status');
const repair = document.querySelector('#repair');
const ring = document.querySelector('#commitment-ring');
const lockText = document.querySelector('#lock');
const output = document.querySelector('#countdown');
const progress = document.querySelector('#countdown-progress');
let status = honestStatus(null);
let observedUntil = 0;
let observedDuration = 0;
let refreshing = false;

function tick() {
    const countdown = commitmentCountdown(status.lock, Date.now(), observedDuration);
    ring.hidden = !(countdown.active || countdown.expired);
    output.textContent = countdown.text;
    progress.setAttribute('stroke-dashoffset', String(100 * (1 - countdown.fraction)));
    if (countdown.expired) {
        lockText.textContent = copy('expired');
        void refresh();
    } else if (countdown.active) {
        const deadline = new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'short', timeStyle: 'short' }).format(status.lock.until);
        lockText.textContent = `${copy('deadline')} \u2066${deadline}\u2069`;
    } else lockText.textContent = copy(status.lock && typeof status.lock.active === 'boolean' ? 'noCommitment' : 'commitmentUnavailable');
}
function show(next) {
    status = honestStatus(next);
    renderStatus(status, { box, reasonList: document.querySelector('#reasons') });
    repair.hidden = !status.reasons.some(reason => ['rules_mismatch', 'api_error'].includes(reason));
    if (status.lock?.until !== observedUntil) {
        observedUntil = status.lock?.until ?? 0;
        observedDuration = Math.max(0, observedUntil - Date.now());
    }
    tick();
}
async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try { show((await send({ type: 'GET_STATUS' })).status); }
    finally { refreshing = false; }
}
await refresh();
const tickTimer = setInterval(tick, 1000);
const statusTimer = setInterval(refresh, 5000);
window.addEventListener('pagehide', () => { clearInterval(tickTimer); clearInterval(statusTimer); });
document.querySelector('#settings').addEventListener('click', () => { openOptions(); window.close(); });
repair.addEventListener('click', async () => {
    repair.disabled = true;
    try { show((await send({ type: 'REPAIR' })).status); }
    finally { repair.disabled = false; }
});

const blockButton = document.querySelector('#block-site');
const feedback = document.querySelector('#site-message');
blockButton.addEventListener('click', async () => {
    const operation = blockCurrentSite(ext, send);
    blockButton.disabled = true;
    feedback.textContent = copy('blocking');
    try {
        const result = await operation;
        feedback.textContent = copy(result);
        if (result === 'blocked') await refresh();
    } finally { blockButton.disabled = false; }
});
