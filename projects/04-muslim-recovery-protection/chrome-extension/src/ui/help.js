import { SUGGESTIONS, rankSuggestions, makeCustomStep, createSuggestionHistory } from './help-data.js';
import { boot, c, lang, node, button, section, paragraph, field, needTiles, faithChoices, timerControl, privateRead, privateSave, statusNode, link, footer } from './recovery-ui.js';
const profile = await boot('helpTitle');
const root = document.querySelector('#content');
const needs = new Set(), favorites = new Set(), unsuitable = new Set();
let customSteps = [], timer, faithStep;
const history = createSuggestionHistory();
const proposal = section('proposal'); proposal.classList.add('proposal-card');
const message = statusNode();
function allSteps() {
    return [...SUGGESTIONS.map(step => ({...step,title:step.copy[lang()]?.[0] ?? step.copy.ar[0],body:step.copy[lang()]?.[1] ?? step.copy.ar[1]})),
        ...customSteps.map(step => ({...step,title:c('personalStep'),body:step.text,seconds:60}))];
}
function candidates() { return rankSuggestions(allSteps(),[...needs],[...favorites],[...unsuitable]); }
function restart() { timer?.stop(); faithStep=null; history.reset(); nextIdea(); }
function nextIdea() {
    timer?.stop(); faithStep=null;
    if (!history.next(candidates())) message.textContent=c('noIdeas');
    renderProposal();
}
function renderProposal() {
    timer?.stop();
    const step=faithStep ?? allSteps().find(item => item.id === history.current());
    proposal.replaceChildren(node('h2',c('proposal')));
    if (!step) { proposal.append(paragraph('noIdeas'),button('resetIdeas',()=>{unsuitable.clear();restart();})); return; }
    timer=timerControl(step.seconds);
    const previous=button('previous',()=>{faithStep=null; history.previous([...unsuitable]);renderProposal();}); previous.disabled=!history.canGoBack([...unsuitable]);
    proposal.append(node('h3',step.title),node('p',step.body),timer.element,button('nextIdea',nextIdea),previous);
    if (!faithStep) {
        const favorite=button(favorites.has(step.id) ? 'unfavorite':'favorite',()=>{favorites.has(step.id) ? favorites.delete(step.id):favorites.add(step.id);renderProposal();});
        favorite.setAttribute('aria-pressed',String(favorites.has(step.id)));
        proposal.append(favorite,button('unsuitable',()=>{unsuitable.add(step.id);nextIdea();}));
    }
}
const library=node('details'); library.append(node('summary',c('library')));
const libraryList=node('div',undefined,'stack'); library.append(libraryList);
const customList=node('div',undefined,'stack');
function renderLibrary() {
    libraryList.replaceChildren(); customList.replaceChildren();
    for (const step of allSteps()) {
        const item=button('start',()=>{faithStep=null;unsuitable.delete(step.id);history.select(step.id);renderProposal();}); item.textContent=step.title;
        if (!step.text) libraryList.append(item);
        else {
            const row=node('div',undefined,'actions'); item.textContent=step.text;
            row.append(item,button('delete',()=>{customSteps=customSteps.filter(value=>value.id!==step.id);favorites.delete(step.id);unsuitable.delete(step.id);renderLibrary();restart();}));customList.append(row);
        }
    }
}
const entry=field('customText');
const add=button('add',()=>{
    if(customSteps.length >=100){message.textContent=c('maximum');return;}
    const step=makeCustomStep(entry.input.value,[...needs],`custom-${crypto.randomUUID()}`);
    if(!step){message.textContent=c('invalidText');return;}
    customSteps.push(step);entry.input.value='';renderLibrary();history.select(step.id);faithStep=null;renderProposal();
});
root.append(paragraph('helpIntro'),section('needs',needTiles(needs,restart),button('skip',()=>{needs.clear();renderNeeds();restart();})),proposal);
function renderNeeds() { const grid=root.querySelector('.need-grid');grid.replaceWith(needTiles(needs,restart)); }
if(profile.profile?.faith) root.append(faithChoices(step=>{timer?.stop();faithStep=step;renderProposal();}));
root.append(library,section('custom',customList,entry.label,add),paragraph('sessionOnly'),
    button('loadLibrary',async()=>{
        const data=await privateRead(message);if(!data)return;
        // Explicit load replaces the local library; never needed for the help journey.
        customSteps=data.customSteps ?? [];favorites.clear();unsuitable.clear();
        for(const id of data.favorites ?? [])favorites.add(id);
        for(const id of data.unsuitable ?? [])unsuitable.add(id);
        message.textContent=c('loaded');renderLibrary();restart();
    }),button('saveLibrary',async()=>{await privateSave({customSteps,favorites:[...favorites],unsuitable:[...unsuitable]},message);}),message,
    link('recoveryTitle','recovery.html'),footer());
renderLibrary();restart();
window.addEventListener('pagehide',()=>timer?.stop());
