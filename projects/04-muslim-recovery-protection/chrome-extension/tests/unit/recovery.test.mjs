import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NEEDS,SUGGESTIONS,rankSuggestions,ifThen,remainingSeconds,makeCustomStep,createSuggestionHistory,makeReview} from '../../src/ui/help-data.js';
import {COPY,copy,QURAN_39_53,QURAN_11_114} from '../../src/ui/recovery-copy.js';

test('help library supplies thirty distinct complete choices for all six needs and languages',()=>{
    assert.equal(SUGGESTIONS.length,30);
    assert.equal(new Set(SUGGESTIONS.map(step=>step.id)).size,30);
    for(const need of NEEDS)assert.ok(SUGGESTIONS.some(step=>step.needs.includes(need)),need);
    for(const step of SUGGESTIONS){
        assert.ok(step.needs.length>0 && step.needs.every(need=>NEEDS.includes(need)));
        assert.ok(Number.isInteger(step.seconds)&&step.seconds>0);
        for(const language of ['ar','en','de']){
            assert.equal(step.copy[language].length,2);
            assert.ok(step.copy[language].every(text=>typeof text==='string'&&text.length>0));
        }
    }
    const keys=Object.keys(COPY.ar).sort();
    for(const language of ['ar','en','de']){
        assert.deepEqual(Object.keys(COPY[language]).sort(),keys);
        for(const key of keys)assert.ok(copy(key,language).trim());
        assert.ok(!copy('stageCount',language,{n:2}).includes('{n}'));
    }
});

test('multiple needs outrank an unrelated favorite, and unsuitable choices remain excluded',()=>{
    const choices=[{id:'unrelated',needs:['hunger']},{id:'both',needs:['anger','stress']},{id:'one',needs:['stress']}];
    assert.deepEqual(rankSuggestions(choices,['anger','stress'],['unrelated']).map(step=>step.id),['both','one','unrelated']);
    assert.deepEqual(rankSuggestions(choices,['anger','stress'],['both'],['both']).map(step=>step.id),['one','unrelated']);
    assert.deepEqual(choices.map(step=>step.id),['unrelated','both','one']);
});

test('next/back retraces real choices; rejected choices never reappear, including at exhaustion',()=>{
    const history=createSuggestionHistory();
    const steps=['a','b','c'].map(id=>({id}));
    assert.equal(history.next(steps),'a');assert.equal(history.next(steps),'b');
    assert.equal(history.previous(),'a');assert.equal(history.next(steps),'b');
    assert.equal(history.next(steps.filter(step=>step.id!=='b')),'c');
    assert.equal(history.previous(['b']),'a');
    assert.equal(history.next(steps.filter(step=>step.id!=='b')),'c');
    assert.equal(history.next(steps),null);assert.equal(history.current(),null);
    assert.equal(history.previous(['b']),'c');
    history.reset();assert.equal(history.current(),null);assert.equal(history.next([]),null);
    history.select('custom');assert.equal(history.current(),'custom');assert.equal(history.canGoBack(),false);
});

test('personal text stays plain text and bounded; a two-sided if/then plan is required',()=>{
    assert.deepEqual(makeCustomStep('  <img onerror=alert(1)>  ',['stress','invalid'],'custom-1'),{id:'custom-1',text:'<img onerror=alert(1)>',needs:['stress']});
    assert.equal(makeCustomStep('   ',[],'x'),null);assert.equal(makeCustomStep('x'.repeat(4001),[],'x'),null);
    assert.equal(ifThen('alone','move'),'لو alone، فسوف move.');
    assert.equal(ifThen('alone','move','en'),'If alone, then I will move.');
    assert.equal(ifThen('alone','move','de'),'Wenn alone, dann werde ich move.');
    assert.equal(ifThen('alone',''),null);assert.equal(ifThen('','move'),null);assert.equal(ifThen('',''),'');
});

test('review builds only explicit bounded fields without the rest of the private vault',()=>{
    const draft={trigger:' noticed ',ifText:' alone ',thenText:' move ',notes:'private unneeded text'};
    assert.deepEqual(makeReview(draft,{needs:new Set(['stress']),task:'desk',care:'careRest'},42),{
        stageNeeds:['stress'],task:'desk',care:'careRest',trigger:'noticed',ifText:'alone',thenText:'move',createdAt:42
    });
    assert.equal(makeReview({...draft,thenText:''},{needs:[],task:'',care:''}),null);
    assert.equal(makeReview({...draft,trigger:'x'.repeat(4001)},{needs:[],task:'',care:''}),null);
});

test('step timer follows a real deadline and never goes below zero',()=>{
    assert.equal(remainingSeconds(2000,1),2);assert.equal(remainingSeconds(2000,1001),1);
    assert.equal(remainingSeconds(2000,2000),0);assert.equal(remainingSeconds(2000,9999),0);
});

test('hope and good-deed verses remain complete; no mandatory monetary amount or repentance condition',()=>{
    const normalize=text=>text.normalize('NFD').replace(/[\u064b-\u065f\u0670]/gu,'').replace(/[^\u0621-\u064a ]/gu,'').replace(/\s+/gu,' ').trim();
    assert.equal(normalize(QURAN_39_53),'قل يا عبادي الذين اسرفوا على انفسهم لا تقنطوا من رحمة الله ان الله يغفر الذنوب جميعا انه هو الغفور الرحيم');
    assert.equal(normalize(QURAN_11_114),'واقم الصلاة طرفي النهار وزلفا من الليل ان الحسنات يذهبن السييات ذلك ذكرى للذاكرين');
    assert.match(COPY.ar.rakahsBody,/مستحبة وليست شرطا|مستحبة وليست شرطًا/u);
    assert.match(COPY.ar.goodBody,/لا مبلغ إلزامي/u);
    assert.ok(!Object.values(COPY.ar).some(text=>/١٠٠ جنيه|100 جنيه/u.test(text)));
});
