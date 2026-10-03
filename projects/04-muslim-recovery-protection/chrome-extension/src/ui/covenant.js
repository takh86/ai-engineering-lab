import { ifThen } from './help-data.js';
import { boot, c, lang, node, button, section, paragraph, field, needTiles, privateRead, privateSave, statusNode, link, footer } from './recovery-ui.js';
await boot('covenantTitle');
const root=document.querySelector('#content'), needs=new Set();
const draft={purpose:'',harms:'',values:'',ifText:'',thenText:'',plan:''};
const message=statusNode();
const inputs={};
root.append(paragraph('covenantIntro'),paragraph('draftHint'));
for(const key of ['purpose','harms','values']){const entry=field(key);inputs[key]=entry.input;entry.input.addEventListener('input',()=>draft[key]=entry.input.value);root.append(entry.label);}
const needsSection=section('needs',needTiles(needs,()=>{}));root.append(needsSection);
for(const key of ['ifText','thenText']){const entry=field(key);inputs[key]=entry.input;entry.input.addEventListener('input',()=>{draft[key]=entry.input.value;draft.plan='';updatePreview();});root.append(entry.label);}
const preview=node('p');preview.setAttribute('aria-live','polite');root.append(section('ifThenLabel',preview));
function updatePreview(){preview.textContent=draft.plan || ifThen(draft.ifText,draft.thenText,lang()) || '';}
root.append(button('loadCovenant',async()=>{
    const data=await privateRead(message);if(!data)return;
    const saved=data.covenant;if(!saved){message.textContent=c('loaded');return;}
    // Worker-approved structured data is still rendered only as plain text.
    for(const key of ['purpose','harms','values']){draft[key]=saved[key] ?? '';inputs[key].value=draft[key];}
    draft.ifText='';draft.thenText='';inputs.ifText.value='';inputs.thenText.value='';draft.plan=saved.plan ?? '';
    needs.clear();for(const need of saved.needs ?? [])needs.add(need);
    needsSection.querySelector('.need-grid').replaceWith(needTiles(needs,()=>{}));updatePreview();message.textContent=c('loaded');
}),button('saveCovenant',async()=>{
    const plan=draft.plan || ifThen(draft.ifText,draft.thenText,lang());
    if(plan===null){message.textContent=c('invalidPlan');return;}
    await privateSave({covenant:{purpose:draft.purpose.trim(),harms:draft.harms.trim(),values:draft.values.trim(),needs:[...needs],plan:plan ?? ''}},message);
},'primary'),button('later',()=>{Object.keys(draft).forEach(key=>draft[key]='');for(const input of Object.values(inputs))input.value='';needs.clear();root.replaceChildren(paragraph('doneWithoutSave'),link('home','popup.html'),link('helpTitle','help.html'));}),message,footer());
