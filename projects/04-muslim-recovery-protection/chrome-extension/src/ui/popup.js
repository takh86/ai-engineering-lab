import { initPage, send, renderStatus, openOptions } from './common.js';

initPage();
const box = document.querySelector('#status');
const repair = document.querySelector('#repair');
const show = status => {
    renderStatus(status, { box, reasonList: document.querySelector('#reasons'), lock: document.querySelector('#lock') });
    repair.hidden = !(status?.reasons ?? []).some(r => ['rules_mismatch', 'api_error'].includes(r));
};
show((await send({ type: 'GET_STATUS' })).status);
document.querySelector('#settings').addEventListener('click', () => { openOptions(); window.close(); });
repair.addEventListener('click', async () => show((await send({ type: 'REPAIR' })).status));
