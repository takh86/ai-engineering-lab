// C-5: commit() = dynamic rules -> base ruleset -> storage. A failing static-ruleset enable (e.g. the shared global static-rule pool is used up
// by other extensions after a browser restart; MAX_NUMBER_OF_ENABLED_STATIC_RULESETS) makes the whole transaction roll back, INCLUDING the dynamic
// user rules, so (a) REPAIR cannot restore the user's own sites/phrases while the base list cannot be enabled, (b) SAVE of any list change is refused.
import { createController, createFakeBrowser, noList, send, status, configured } from './h.mjs';
const fake = createFakeBrowser(); const a = createController(fake.api);
await send(a, { type: 'COMPLETE_ONBOARDING', baseList: true, starterTerms: false });
let s = (await send(a, { type: 'GET_STATUS' })).status;
await send(a, { type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { ...noList, baseList: true, domains: ['example.com'] } });
console.log('healthy: rules =', fake.state.rules.length, 'baseEnabled =', fake.state.baseEnabled);
// browser restart with the global static pool exhausted: dynamic rules gone AND static ruleset not enabled; enabling keeps failing
fake.state.rules = []; fake.state.baseEnabled = false; fake.state.fail['rulesets.update'] = 1000;
const r = await send(a, { type: 'REPAIR' });
console.log('REPAIR: ok =', r.ok, '| state =', r.status.state, r.status.reasons, '| dynamic user rules restored =', fake.state.rules.length > 0);
s = (await send(a, { type: 'GET_STATUS' })).status;
const save = await send(a, { type: 'SAVE_SETTINGS', baseRevision: s.revision, settings: { ...noList, baseList: true, domains: ['example.com', 'added.org'] } });
console.log('adding a site while base cannot be enabled: ok =', save.ok, save.error?.code, '| stored sites =', JSON.stringify((await a.statusNow()).settings.domains));
