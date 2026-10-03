import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWriteMutex } from '../../src/background/coordination.js';
import { createFakeBrowser } from './fake-browser.mjs';

const busy = error => error.code === 'busy';
test('holder survives a later rival still choosing a ticket', async () => {
    const { api, state } = createFakeBrowser();
    const lock = createWriteMutex(api);
    await lock.run(async () => {
        state.storage['mx:later'] = { choosing: true, ticket: 0, exp: api.clock() + 20000 };
        await lock.assertOwner();
        assert.equal(lock.isHeld(), true);
    });
});
test('holder rejects a rival with an earlier ordered ticket', async () => {
    const { api, state } = createFakeBrowser();
    const lock = createWriteMutex(api);
    await lock.run(async () => {
        const mine = state.storage[lock.ownKey];
        state.storage['mx:!ahead'] = { choosing: false, ticket: mine.ticket, exp: api.clock() + 20000 };
        await assert.rejects(lock.assertOwner(), busy);
        assert.equal(lock.isHeld(), false);
    });
});
test('holder rejects an expired lease', async () => {
    const { api, state } = createFakeBrowser();
    const lock = createWriteMutex(api);
    await lock.run(async () => {
        state.storage[lock.ownKey].exp = api.clock() - 1;
        await assert.rejects(lock.assertOwner(), busy);
    });
});
test('holder rejects a missing entry', async () => {
    const { api, state } = createFakeBrowser();
    const lock = createWriteMutex(api);
    await lock.run(async () => {
        delete state.storage[lock.ownKey];
        await assert.rejects(lock.assertOwner(), busy);
    });
});
