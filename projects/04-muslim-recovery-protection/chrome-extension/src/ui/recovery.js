import { SUGGESTIONS, rankSuggestions, ifThen, makeReview } from './help-data.js';
import { QURAN_39_53, QURAN_11_114 } from './recovery-copy.js';
import { boot, c, lang, node, button, section, paragraph, field, needTiles, faithChoices, timerControl, privateRead, privateSave, statusNode, link, footer } from './recovery-ui.js';
const profile=await boot('recoveryTitle');
const root=document.querySelector('#content');
const needs=new Set();
let stage=0, suggestion=0, faithStep=null, task='notes', care='careRest', good='', minutes=25, timer, saving=false;
const draft={trigger:'',ifText:'',thenText:''};
const message=statusNode();
const stageNames=['stage1','stage2','stage3','stage4','stage5'];
const nav=node('nav',undefined,'journey-nav recovery-stages');nav.setAttribute('aria-label',c('stages'));
const body=node('div',undefined,'stack');
const count=node('p',undefined,'tag');
root.append(count,nav,body,message,footer());
function changeStage(next) {if(saving)return;timer?.stop();stage=next;message.textContent='';render();body.querySelector('h2')?.focus();}
function verse(text,label){const quote=node('blockquote',text);quote.lang='ar';quote.dir='rtl';return section(label,quote);}
function renderNavigation(){
    nav.replaceChildren();
    stageNames.forEach((key,index)=>{const step=button(key,()=>changeStage(index));step.setAttribute('aria-current',index===stage ? 'step':'false');nav.append(step);});
    count.textContent=c('stageCount',{n:stage+1});
}
function finish(){if(saving)return;timer?.stop();Object.keys(draft).forEach(key=>draft[key]='');needs.clear();body.replaceChildren(paragraph('doneWithoutSave'),link('home','popup.html'),link('helpTitle','help.html'));nav.hidden=true;count.hidden=true;message.textContent='';}
function render(){
    timer?.stop();
    renderNavigation();body.replaceChildren();
    const heading=node('h2',c(stageNames[stage]));heading.tabIndex=-1;body.append(heading);
    [renderSupport,renderNeeds,renderTask,renderCare,renderReview][stage]();
    if(stage<4){const actions=node('div',undefined,'actions');if(stage)actions.append(button('previous',()=>changeStage(stage-1)));actions.append(button('next',()=>changeStage(stage+1),'primary'));body.append(actions,button('exit',finish));}
}
function renderSupport(){
    body.append(paragraph('stopSupport'),section('proposal',paragraph('grounding')));
    const support=node('details');support.append(node('summary',c('supportSource')),paragraph('supportBody'));
    const source=link('whoLink','https://www.who.int/publications/i/item/9789240003927');source.target='_blank';source.rel='noopener noreferrer';support.append(source);body.append(support);
    if(profile.profile?.faith){
        const choices=node('div',undefined,'actions');
        for(const key of ['helpDeed','kindWord','charity']){const choice=button(key,()=>{good=key;render();message.textContent=c('picked');});choice.setAttribute('aria-pressed',String(good===key));choices.append(choice);}
        const faith=section('faith',verse(QURAN_39_53,'hopeLabel'),paragraph('repentance'),section('purification',paragraph('purificationBody')),
            section('rakahs',paragraph('rakahsBody'),button('prayNow',()=>{message.textContent=c('prayerSelected');})),verse(QURAN_11_114,'goodLabel'),section('goodDeed',paragraph('goodBody'),choices));faith.classList.add('faith-surface');body.append(faith);
    }
}
function supportCandidates(){return rankSuggestions(SUGGESTIONS,[...needs]);}
function renderNeeds(){
    body.append(section('needs',needTiles(needs,()=>{suggestion=0;faithStep=null;render();}),button('skip',()=>{needs.clear();faithStep=null;suggestion=0;changeStage(2);})));
    const choices=supportCandidates();const selected=faithStep ?? choices[suggestion % choices.length];
    const title=selected.title ?? selected.copy[lang()]?.[0] ?? selected.copy.ar[0];
    const instruction=selected.body ?? selected.copy[lang()]?.[1] ?? selected.copy.ar[1];
    timer=timerControl(selected.seconds);
    const previous=button('previous',()=>{faithStep=null;suggestion=Math.max(0,suggestion-1);timer?.stop();render();});previous.disabled=suggestion===0 && !faithStep;
    body.append(section('proposal',node('h3',title),node('p',instruction),timer.element,button('nextIdea',()=>{faithStep=null;suggestion++;timer?.stop();render();}),previous));
    // Faith choices stay inside stage two and never navigate to help.html.
    if(profile.profile?.faith)body.append(paragraph('faithContinue'),faithChoices(value=>{faithStep=value;timer?.stop();render();}));
}
function renderTask(){
    body.append(paragraph('smallTask'));
    const choices=node('div',undefined,'task-grid');
    const tasks=['desk','notes','read','task'];
    if(profile.profile?.faith)tasks.push('faith-quran');
    for(const id of tasks){
        const selected=SUGGESTIONS.find(value=>value.id===id);
        const title=selected ? selected.copy[lang()]?.[0] ?? selected.copy.ar[0]:c('quran');
        const choice=button('start',()=>{task=id;timer?.stop();render();},'need-tile');choice.textContent=title;choice.setAttribute('aria-pressed',String(task===id));choices.append(choice);
    }
    body.append(choices);
    const selected=SUGGESTIONS.find(value=>value.id===task);
    body.append(node('p',selected ? selected.copy[lang()]?.[1] ?? selected.copy.ar[1]:c('quranBody')));
    const duration=field('duration',String(minutes),false);duration.input.type='number';duration.input.min='1';duration.input.max='60';duration.input.step='1';
    timer=timerControl(minutes*60);
    duration.input.addEventListener('input',()=>{
        const value=Number(duration.input.value);
        if(!Number.isInteger(value)||value<1||value>60){message.textContent=c('invalidDuration');duration.input.setAttribute('aria-invalid','true');return;}
        duration.input.removeAttribute('aria-invalid');message.textContent='';minutes=value;timer.setSeconds(minutes*60);
    });
    body.append(duration.label,timer.element);
}
function renderCare(){
    body.append(paragraph('careIntro'));
    const choices=node('div',undefined,'actions');
    // Deliberately no prayer or prayer reminder choice in care stage.
    for(const key of ['careRest','careFood','careContact','careWash']){const choice=button(key,()=>{care=key;render();});choice.setAttribute('aria-pressed',String(care===key));choices.append(choice);}
    body.append(choices,node('h3',c(care)),button('now',()=>{message.textContent=c('careSelected');}),button('next',()=>changeStage(4)));
}
function renderReview(){
    body.append(paragraph('learn'),paragraph('draftHint'));
    for(const key of ['trigger','ifText','thenText']){const entry=field(key,draft[key]);entry.input.addEventListener('input',()=>{draft[key]=entry.input.value;updatePreview();});body.append(entry.label);}
    const preview=node('p');preview.setAttribute('aria-live','polite');body.append(section('ifThenLabel',preview));
    function updatePreview(){const plan=ifThen(draft.ifText,draft.thenText,lang());preview.textContent=plan ?? c('invalidPlan');}updatePreview();
    body.append(button('saveReview',async()=>{
        if(ifThen(draft.ifText,draft.thenText,lang())===null){message.textContent=c('invalidPlan');return;}
        if(saving)return;
        saving=true;
        const controls=[...body.querySelectorAll('button'),...nav.querySelectorAll('button')];
        for(const control of controls)control.disabled=true;
        try {
        // Only this explicit gesture reads private records; finishing never depends on unlocking.
        const data=await privateRead(message);if(!data)return;
        if((data.reviews ?? []).length>=100){message.textContent=c('maximum');return;}
        const review=makeReview(draft,{needs,task,care});
        if(!review){message.textContent=c('invalidPlan');return;}
        if(await privateSave({reviews:[...(data.reviews ?? []),review]},message)){Object.keys(draft).forEach(key=>draft[key]='');body.replaceChildren(paragraph('saved'),link('home','popup.html'),link('helpTitle','help.html'));nav.hidden=true;count.hidden=true;}
        } finally {saving=false;for(const control of controls)control.disabled=false;}
    },'primary'),button('noSave',finish),button('later',finish),button('previous',()=>changeStage(3)),link('settings','options.html'));
}
render();window.addEventListener('pagehide',()=>timer?.stop());
