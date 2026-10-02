import { initPage, t } from './common.js';

initPage();
const start = document.querySelector('#start');
const timer = document.querySelector('#timer');
const step = document.querySelector('#step');
const ring = document.querySelector('#ring');
const CIRCUMFERENCE = 2 * Math.PI * 45;
ring.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
ring.setAttribute('stroke-dashoffset', '0');
const SECONDS = 60;
// UI-only countdown. It never touches blocking, never opens a site and stores nothing.
start.addEventListener('click', () => {
    start.disabled = true;
    const end = Date.now() + SECONDS * 1000;
    const tick = setInterval(() => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        timer.textContent = left.toLocaleString(document.documentElement.lang);
        ring.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - left / SECONDS)));
        if (left === 0) {
            clearInterval(tick);
            step.textContent = t('help_after');
            start.textContent = t('help_again');
            start.disabled = false;
            ring.setAttribute('stroke-dashoffset', '0');
        }
    }, 250);
});
