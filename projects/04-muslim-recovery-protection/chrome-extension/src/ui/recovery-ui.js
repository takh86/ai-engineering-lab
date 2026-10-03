import { initPage, send } from './common.js';
import { copy } from './recovery-copy.js';
import { NEEDS, remainingSeconds } from './help-data.js';
export { send };
let language = 'ar';
export const c = (key, params) => copy(key, language, params);
export async function boot(titleKey) {
    const initial = await initPage();
    language = document.documentElement.lang.split('-')[0];
    const reply = initial?.profile ? initial : await send({type:'GET_PUBLIC_PROFILE'});
    document.title = c(titleKey);
    document.querySelector('h1').textContent = c(titleKey);
    return reply.ok === false ? {profile:{faith:false},security:{locked:true}} : reply;
}
export const lang = () => language;
export function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}
export function button(key, action, className = 'secondary') {
    const element = node('button', c(key), className);
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
}
export function link(key, href, className = 'button secondary') {
    const element = node('a', c(key), className);
    element.href = href;
    return element;
}
export function section(key, ...children) {
    const element = node('section', undefined, 'card');
    if (key) element.append(node('h2', c(key)));
    element.append(...children);
    return element;
}
export const paragraph = key => node('p', c(key));
export function field(key, value = '', multiline = true) {
    const label = node('label', c(key), 'field');
    const input = node(multiline ? 'textarea' : 'input');
    input.maxLength = 4000;
    input.value = value;
    input.autocomplete = 'off';
    label.append(input);
    return {label, input};
}
const PATHS = {
    hunger:'M4 4v7m3-7v7m3-7v7M4 8h6M7 11v10M17 3c-4 4-4 8 0 9v9M17 3v9',
    fatigue:'M5 5a8 8 0 0 0 14 12A9 9 0 0 1 5 5z',
    loneliness:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a7 7 0 0 1 14 0v3M17 5a4 4 0 0 1 0 7M19 15a6 6 0 0 1 3 6',
    anger:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M6 8l4 2m4 0 4-2M8 17a5 5 0 0 1 8 0',
    boredom:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M7 9h2m6 0h2M8 16h8',
    stress:'M3 12h4l2-7 5 14 3-7h4'
};
export function needTiles(selected, onChange) {
    const grid = node('div', undefined, 'need-grid help-need-grid');
    for (const key of NEEDS) {
        const tile = button(key, () => {
            selected.has(key) ? selected.delete(key) : selected.add(key);
            sync(); onChange();
        }, 'need-tile');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('feature-icon');
        const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d',PATHS[key]); svg.append(path); tile.prepend(svg);
        function sync() { tile.setAttribute('aria-pressed', String(selected.has(key))); tile.classList.toggle('chosen',selected.has(key)); }
        sync(); grid.append(tile);
    }
    return grid;
}
export function faithChoices(onSelect) {
    const choices = node('div',undefined,'actions');
    for (const key of ['forgive','dua','quran']) choices.append(button(key,() => onSelect({id:`faith-${key}`,title:c(key),body:c(`${key}Body`),seconds:key === 'quran' ? 120 : 60})));
    return section('faith', choices);
}
export function timerControl(seconds = 60) {
    const wrapper = node('div',undefined,'task-timer');
    const output = node('output'); output.setAttribute('role','timer'); output.setAttribute('aria-label',c('timer'));
    let deadline = 0, interval;
    const render = value => { output.textContent = `${Math.floor(value / 60)}:${String(value % 60).padStart(2,'0')}`; };
    render(seconds);
    const toggle = button('start', () => {
        if (interval) { stop(); return; }
        deadline = Date.now() + seconds * 1000; toggle.textContent = c('stop');
        interval = setInterval(() => {
            const remaining = remainingSeconds(deadline); render(remaining);
            if (!remaining) { stop(false); status.textContent = c('finished'); }
        },250);
    },'primary');
    const status = node('p'); status.setAttribute('role','status');
    function stop(reset = true) { clearInterval(interval); interval = null; toggle.textContent = c('start'); if (reset) render(seconds); }
    wrapper.append(output,toggle,status);
    return {element:wrapper,stop,setSeconds(value) { stop(); seconds=value; render(value); }};
}
export async function privateRead(status) {
    const reply = await send({type:'GET_PRIVATE_DATA'});
    if (!reply.ok) { status.textContent = c(reply.error?.code === 'access_locked' || reply.error?.code === 'locked' ? 'locked':'unavailable'); return null; }
    return reply.data;
}
export async function privateSave(data, status) {
    const reply = await send({type:'SAVE_PRIVATE_DATA',data});
    status.textContent = c(reply.ok ? 'saved' : ['access_locked','locked'].includes(reply.error?.code) ? 'locked':'unavailable');
    return reply.ok;
}
export function statusNode() { const element=node('p'); element.setAttribute('role','status'); return element; }
export function footer() {
    const element=node('footer'); element.append(paragraph('protectionNote'),link('home','popup.html'),link('settings','options.html')); return element;
}
