import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import * as core from '../rules.js';
const source = await fs.readFile(new URL('../background.js', import.meta.url), 'utf8');
async function harness() {
    let config, rules = [], listener, failStorage = false;
    const context = vm.createContext({ chrome: {
        storage: { local: {
            get: async () => ({ config: structuredClone(config) }),
            set: async data => { if (failStorage) { failStorage = false; throw new Error('disk failure'); } config = structuredClone(data.config); },
            setAccessLevel: async () => {}
        } },
        declarativeNetRequest: {
            // Chrome may reorder object fields; status must not depend on JSON insertion order.
            getDynamicRules: async () => rules.map(r => ({ condition:r.condition, action:r.action, priority:r.priority, id:r.id })),
            updateDynamicRules: async ({ addRules }) => { rules = structuredClone(addRules); },
            isRegexSupported: async () => ({ isSupported:true })
        },
        runtime: { id:'test-extension', getURL: path => `chrome-extension://test-extension/${path}`,
            onMessage:{ addListener:fn => { listener = fn; } }, onInstalled:{ addListener:()=>{} }, onStartup:{ addListener:()=>{} } }
    }});
    const module = new vm.SourceTextModule(source, { context });
    const imported = new vm.SyntheticModule(Object.keys(core), function() { for (const [name,value] of Object.entries(core)) this.setExport(name,value); }, { context });
    await module.link(async () => imported); await module.evaluate();
    return {
        send: message => new Promise(resolve => listener(message, { id:'test-extension',url:'chrome-extension://test-extension/options.html' }, resolve)),
        external: message => listener(message, {id:'test-extension',url:'https://example.org/'},()=>{throw new Error('should not reply');}),
        failNextStorage: () => {failStorage=true;},
        inspect: () => ({config,rules})
    };
}
test('save installs rules, persists config, status verifies rules regardless of property ordering', async () => {
    const h = await harness();
    assert.equal((await h.send({type:'STATUS'})).count,0);
    assert.equal((await h.send({type:'SAVE',config:{domains:['example.com'],keywords:['عبارة اختبار']}})).ok,true);
    const state = await h.send({type:'STATUS'});
    assert.equal(state.healthy,true); assert.equal(state.count,2);
    assert.deepEqual(Object.keys(h.inspect().config).sort(), ['domains','keywords','lockedUntil']);
});
test('empty configuration cannot start commitment; active commitment refuses removal', async () => {
    const h = await harness();
    assert.equal((await h.send({type:'LOCK',minutes:60})).ok,false);
    await h.send({type:'SAVE',config:{domains:['example.com'],keywords:[]}});
    assert.equal((await h.send({type:'LOCK',minutes:60})).ok,true);
    assert.equal((await h.send({type:'SAVE',config:{domains:[],keywords:[]}})).ok,false);
    assert.equal(h.inspect().rules.length,1);
    assert.equal((await h.send({type:'SAVE',config:{domains:['example.com','example.org'],keywords:[]}})).ok,true);
});
test('storage failure rolls back installed rules', async () => {
    const h = await harness();
    await h.send({type:'SAVE',config:{domains:['example.com'],keywords:[]}});
    h.failNextStorage();
    assert.equal((await h.send({type:'SAVE',config:{domains:['example.org'],keywords:[]}})).ok,false);
    assert.equal(h.inspect().rules[0].condition.requestDomains[0],'example.com');
    assert.equal((await h.send({type:'STATUS'})).healthy,true);
});
test('concurrent saves and commitment are serialized; external page cannot invoke worker', async () => {
    const h = await harness();
    const results = await Promise.all([
        h.send({type:'SAVE',config:{domains:['example.com'],keywords:[]}}),
        h.send({type:'LOCK',minutes:90}),
        h.send({type:'SAVE',config:{domains:[],keywords:[]}})
    ]);
    assert.deepEqual(results.map(x=>x.ok),[true,true,false]);
    assert.equal(h.external({type:'SAVE',config:{domains:[],keywords:[]}}),false);
});
