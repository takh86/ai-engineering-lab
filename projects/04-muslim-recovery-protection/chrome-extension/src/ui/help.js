import { initPage, t } from './common.js';

initPage();
const start = document.querySelector('#start');
const timer = document.querySelector('#timer');
const step = document.querySelector('#step');
const SECONDS = 60;
// UI-only countdown. It never touches blocking, never opens a site and stores nothing.
start.addEventListener('click', () => {
    start.disabled = true;
    const end = Date.now() + SECONDS * 1000;
    const tick = setInterval(() => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        timer.textContent = left.toLocaleString(document.documentElement.lang);
        if (left === 0) {
            clearInterval(tick);
            step.textContent = t('help_after');
            start.textContent = t('help_again');
            start.disabled = false;
        }
    }, 250);
});
