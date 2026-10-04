import { boot, paragraph, section, link, footer, node } from './recovery-ui.js';
// Intentionally never reads URL, query, referrer, navigation history or private records.
const profile=await boot('blockedTitle');
import {QURAN_39_53} from './recovery-copy.js';
const root = document.querySelector('#content');
root.append(paragraph('blockedBody'), paragraph('blockedReason'),
    section(null,link('helpTitle','help.html','button primary'),link('recoveryTitle','recovery.html'),link('covenantTitle','covenant.html')),
    paragraph('blockedPrivacy'));
if(profile.profile?.faith){
    const verse=node('blockquote',QURAN_39_53);verse.lang='ar';verse.dir='rtl';
    const faith=section('hopeLabel',verse,link('recoveryTitle','recovery.html'));faith.classList.add('faith-surface');root.append(faith);
}
root.append(footer());
