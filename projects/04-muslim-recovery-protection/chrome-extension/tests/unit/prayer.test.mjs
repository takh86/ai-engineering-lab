import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultPrayer, validatePrayer, PRAYER_METHODS, solarCoordinates, calculatePrayerTimes, prayerDate, addPrayerDays } from '../../src/core/prayer.js';
import { prayerCopy } from '../../src/core/prayer-copy.js';
import { createPrayerController, PRAYER_ALARM_PREFIX } from '../../src/background/prayer-controller.js';
import { createFeatureController } from '../../src/background/feature-controller.js';
import { createFakeBrowser } from './fake-browser.mjs';

const berlin = () => ({ ...defaultPrayer(), latitude: 52.52, longitude: 13.405, timeZone: 'Europe/Berlin' });
const close = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} is not within ${tolerance} of ${b}`);

test('solar coordinates match independent NASA RP1349 ephemeris declination at 2000 Jan 1 0 DT', () => {
    // https://eclipse.gsfc.nasa.gov/TYPE/sun1.html : -23° 4′ 16.2″; 0.02° tolerance includes UTC/DT and approximation.
    close(solarCoordinates(Date.parse('2000-01-01T00:00:00Z')).declination, -(23 + 4 / 60 + 16.2 / 3600), 0.02);
});
test('sea-level sunset matches the frozen dated USNO Baltimore API reference offline', async () => {
    // Primary-source response and provenance are frozen in tests/fixtures/prayer; no runtime HTTP request.
    const fixture = JSON.parse(await readFile(new URL('../fixtures/prayer/usno-baltimore-2026-09-29.json', import.meta.url), 'utf8'));
    const [longitude, latitude] = fixture.geometry.coordinates;
    const data = fixture.properties.data;
    assert.deepEqual([data.year, data.month, data.day, data.tz, data.isdst], [2026, 9, 29, -4, false]);
    const sunset = data.sundata.find(event => event.phen === 'Set').time;
    assert.equal(sunset, '18:52');
    const [hours, minutes] = sunset.split(':').map(Number);
    const expected = Date.UTC(data.year, data.month - 1, data.day, hours - data.tz, minutes);
    const result = calculatePrayerTimes('2026-09-29', { ...defaultPrayer(), latitude, longitude, timeZone: 'America/New_York' });
    // Two minutes accounts for the approximate solar coordinates and rounded horizon/refraction convention.
    close(result.times.maghrib, expected, 2 * 60000);
});
test('strict coordinates, method, selection, timezone, adjustment and dates', () => {
    assert.equal(defaultPrayer().enabled, false);
    for (const patch of [{ latitude: NaN }, { latitude: 91 }, { longitude: -181 }, { method: 'toString' }, { timeZone: 'not-a-zone' }, { adjustment: 121 }, { adjustment: 1.5 }, { prayers: [] }, { prayers: ['fajr', 'fajr'] }, { enabled: true }, { extra: 'field' }]) assert.throws(() => validatePrayer({ ...defaultPrayer(), ...patch }), { code: 'prayer_invalid' });
    for (const date of ['2026-02-30', '2200-01-01', '2026-2-1']) assert.throws(() => calculatePrayerTimes(date, berlin()), { code: 'prayer_invalid' });
    assert.equal(addPrayerDays('2024-02-28', 1), '2024-02-29');
});
test('spring and autumn DST use UTC instants and format with the actual per-event offset', () => {
    const format = epoch => new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(epoch);
    const before = calculatePrayerTimes('2026-03-28', berlin()), after = calculatePrayerTimes('2026-03-29', berlin());
    close(after.times.dhuhr - before.times.dhuhr, 86400000, 120000);
    assert.equal(format(before.times.dhuhr), '12:12'); assert.equal(format(after.times.dhuhr), '13:12');
    const autumnBefore = calculatePrayerTimes('2026-10-24', berlin()), autumnAfter = calculatePrayerTimes('2026-10-25', berlin());
    assert.equal(format(autumnBefore.times.dhuhr), '12:52'); assert.equal(format(autumnAfter.times.dhuhr), '11:51');
    for (const epoch of Object.values(after.times)) assert.equal(prayerDate(epoch, 'Europe/Berlin'), '2026-03-29');
});
test('date line, half-hour zone and local polar failures preserve honest civil dates', () => {
    for (const [latitude, longitude, timeZone] of [[1.87, -157.4, 'Pacific/Kiritimati'], [-13.83, -171.75, 'Pacific/Apia'], [28.61, 77.2, 'Asia/Kolkata']]) {
        const result = calculatePrayerTimes('2026-01-02', { ...defaultPrayer(), latitude, longitude, timeZone });
        for (const epoch of Object.values(result.times)) if (epoch !== null) assert.equal(prayerDate(epoch, timeZone), '2026-01-02');
        assert.ok(result.times.dhuhr);
    }
    const polar = calculatePrayerTimes('2026-06-21', { ...defaultPrayer(), latitude: 69.65, longitude: 18.96, timeZone: 'Europe/Oslo' });
    assert.equal(polar.times.fajr, null); assert.equal(polar.times.isha, null); assert.equal(polar.times.maghrib, null);
    assert.throws(() => calculatePrayerTimes('2011-12-30', { ...defaultPrayer(), latitude: -13.83, longitude: -171.75, timeZone: 'Pacific/Apia' }), { code: 'prayer_invalid' });
});
test('method, asr and adjustment remain explicit choices', () => {
    const regular = calculatePrayerTimes('2026-01-02', berlin());
    const adjusted = calculatePrayerTimes('2026-01-02', { ...berlin(), adjustment: 15 });
    for (const name of Object.keys(regular.times)) assert.equal(adjusted.times[name] - regular.times[name], 15 * 60000);
    assert.ok(calculatePrayerTimes('2026-01-02', { ...berlin(), asr: 'hanafi' }).times.asr > regular.times.asr);
    assert.ok(calculatePrayerTimes('2026-01-02', { ...berlin(), method: 'ISNA' }).times.fajr > regular.times.fajr);
});

function fixture() {
    const { api, state } = createFakeBrowser(); state.now = Date.parse('2026-01-02T00:00Z');
    state.granted = false; state.alarms = new Map(); state.notifications = []; state.profile = { language: 'en', religion: 'muslim', faith: true, prayer: defaultPrayer() }; state.locked = false;
    api.permissions.contains = async () => state.granted;
    api.alarms = { getAll: async () => [...state.alarms].map(([name, data]) => ({ name, ...data })), create: async (name, data) => { state.alarms.set(name, data); }, clear: async name => state.alarms.delete(name) };
    api.notifications = { create: async (id, data) => { state.notifications.push({ id, data }); } };
    const feature = { handle: async message => {
        if (message.type === 'GET_PUBLIC_PROFILE') return { ok: true, profile: structuredClone(state.profile) };
        if (state.locked) return { ok: false, error: { code: 'access_locked', params: {} } };
        state.profile.prayer = validatePrayer(message.profile.prayer); return { ok: true, profile: state.profile };
    }, readPublicProfileSnapshot: async () => structuredClone(state.profile),
    setPrayerEnabled: async enabled => { assert.equal(enabled, false); state.profile.prayer.enabled = false; } };
    return { api, state, controller: createPrayerController(api, feature), feature };
}
test('default off and denial never request permission in worker or schedule notifications', async () => {
    const { controller, state } = fixture();
    await controller.reconcile(); assert.equal(state.alarms.size, 0);
    const denial = await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() });
    assert.equal(denial.ok, false); assert.equal(denial.error.code, 'prayer_permission'); assert.equal(state.profile.prayer.enabled, false); assert.equal(state.alarms.size, 0);
    assert.equal(await controller.handle({ type: 'UNRELATED' }), undefined);
});
test('all user edits pass the password gate, activation and deactivation synchronize profile', async () => {
    const { controller, state } = fixture(); state.granted = true; state.locked = true;
    assert.equal((await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() })).ok, false); assert.equal(state.profile.prayer.enabled, false);
    state.locked = false; assert.equal((await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() })).enabled, true);
    assert.ok(state.alarms.size > 1); assert.equal(state.profile.prayer.enabled, true);
    await controller.handle({ type: 'PRAYER_DISABLE' }); assert.equal(state.profile.prayer.enabled, false); assert.equal(state.alarms.size, 0);
});
test('permission loss disables preference even when locked; unrelated removal does nothing', async () => {
    const { controller, state } = fixture(); state.granted = true;
    await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() }); state.locked = true;
    await controller.onPermissionsRemoved({ permissions: ['activeTab'] }); assert.equal(state.profile.prayer.enabled, true);
    state.granted = false; await controller.onPermissionsRemoved({ permissions: ['notifications'] });
    assert.equal(state.profile.prayer.enabled, false); assert.equal(state.alarms.size, 0);
});
test('reconcile is idempotent, creates future alarms only and repeated alarms do not duplicate notifications', async () => {
    const { controller, state, api, feature } = fixture(); state.granted = true;
    await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() }); const original = [...state.alarms.keys()];
    await controller.reconcile(); assert.deepEqual([...state.alarms.keys()], original);
    for (const value of state.alarms.values()) assert.ok(value.when > state.now);
    const [name, info] = [...state.alarms].find(([name]) => name.includes(':fajr:')); state.now = info.when;
    await Promise.all([controller.onAlarm({ name }), controller.onAlarm({ name })]); assert.equal(state.notifications.length, 1);
    const restarted = createPrayerController(api, feature); await restarted.onAlarm({ name }); assert.equal(state.notifications.length, 1);
    assert.ok(state.notifications[0].data.message.includes('Fajr')); assert.ok(!state.notifications[0].data.message.includes('Berlin'));
    assert.equal(await controller.onAlarm({ name: 'other' }), false);
});
test('late, canceled, unselected and stale changed-settings alarms cannot flood or notify', async () => {
    const { controller, state } = fixture(); state.granted = true;
    await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() });
    const [name, info] = [...state.alarms].find(([name]) => name.includes(':fajr:'));
    state.now = info.when + 6 * 60000; await controller.onAlarm({ name }); assert.equal(state.notifications.length, 0);
    state.now = info.when; state.profile.prayer.adjustment = 1; await controller.onAlarm({ name }); assert.equal(state.notifications.length, 0);
    state.profile.prayer.adjustment = 0; state.profile.prayer.prayers = ['dhuhr']; await controller.onAlarm({ name }); assert.equal(state.notifications.length, 0);
    state.profile.prayer.prayers = ['fajr']; state.profile.prayer.enabled = false; await controller.onAlarm({ name }); assert.equal(state.notifications.length, 0);
    assert.ok([...state.alarms.keys()].every(name => !name.startsWith(PRAYER_ALARM_PREFIX)));
});

test('disabling faith or choosing non-Muslim cancels reminders and their enabled preference', async () => {
    for (const patch of [{ faith: false }, { religion: 'non-muslim' }]) {
        const { controller, state } = fixture(); state.granted = true;
        await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() });
        Object.assign(state.profile, patch);
        await controller.reconcile();
        assert.equal(state.profile.prayer.enabled, false); assert.equal(state.alarms.size, 0);
    }
});

test('real feature and prayer controllers deliver while locked without nested mutex deadlock', { timeout: 3000 }, async () => {
    const { api, state } = fixture(); state.granted = true;
    const feature = createFeatureController(api, { mutex: { waitMs: 100, pollMs: 1 } });
    assert.equal((await feature.handle({ type: 'SAVE_PUBLIC_PROFILE', profile: { language: 'en', religion: 'muslim', faith: true } })).ok, true);
    assert.equal((await feature.handle({ type: 'SET_PASSWORD', password: 'a long local password' })).ok, true);
    const controller = createPrayerController(api, feature);
    assert.equal((await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() })).enabled, true);
    await feature.handle({ type: 'LOCK_ACCESS' });
    const [name, info] = [...state.alarms].find(([name]) => name.includes(':fajr:')); state.now = info.when;
    await controller.onAlarm({ name });
    assert.equal(state.notifications.length, 1);
    const secondApi = { ...api, instanceId: `${api.instanceId}-second` };
    const second = createPrayerController(secondApi, createFeatureController(secondApi));
    await Promise.all([controller.onAlarm({ name }), second.onAlarm({ name })]);
    assert.equal(state.notifications.length, 1);
    assert.equal((await feature.handle({ type: 'GET_PUBLIC_PROFILE' })).security.locked, true);
});

test('real profile update winning before alarm mutex cannot send from an obsolete snapshot', { timeout: 3000 }, async () => {
    const { api, state } = fixture(); state.granted = true;
    const feature = createFeatureController(api);
    await feature.handle({ type: 'SAVE_PUBLIC_PROFILE', profile: { language: 'en', religion: 'muslim', faith: true } });
    const controller = createPrayerController(api, feature);
    await controller.handle({ type: 'PRAYER_ENABLE', prayer: berlin() });
    const [name, info] = [...state.alarms].find(([name]) => name.includes(':fajr:')); state.now = info.when;
    const originalSet = api.storage.set;
    let intercepted = false;
    api.storage.set = async items => {
        if (!intercepted && items[`mx:${api.instanceId}-prayer`]?.choosing) {
            intercepted = true;
            const reply = await feature.handle({ type: 'SAVE_PUBLIC_PROFILE', profile: { faith: false } });
            assert.equal(reply.ok, true);
        }
        return originalSet(items);
    };
    await controller.onAlarm({ name });
    assert.equal(intercepted, true); assert.equal(state.notifications.length, 0);
    assert.equal(state.alarms.size, 0);
    assert.equal((await feature.handle({ type: 'GET_PUBLIC_PROFILE' })).profile.prayer.enabled, false);
});

test('prayer UI requests permission only in a valid explicit gesture; cancellation never enables', async () => {
    // Minimal DOM verifies activation ordering and message intent, not browser permission implementation.
    class Element {
        constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; this.disabled = false; this.hidden = false; }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        setAttribute() {}
        addEventListener(name, listener) { this.listeners[name] = listener; }
        remove() {}
        click() { this.listeners.click?.(); }
    }
    const oldDocument = globalThis.document, oldChrome = globalThis.chrome;
    const requests = [], messages = [];
    globalThis.document = { createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text, children: [] }) };
    let granted = false;
    globalThis.chrome = { permissions: { request: options => { requests.push(options); return Promise.resolve(granted); } } };
    try {
        const source = (await readFile(new URL('../../src/ui/prayer-settings.js', import.meta.url), 'utf8'))
            .replace("'./core/prayer.js'", JSON.stringify(new URL('../../src/core/prayer.js', import.meta.url).href))
            .replace("'./core/prayer-copy.js'", JSON.stringify(new URL('../../src/core/prayer-copy.js', import.meta.url).href));
        const { installPrayerSettings } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
        const container = new Element('main');
        const send = async message => {
            messages.push(message);
            return { ok: true, enabled: message.type === 'PRAYER_ENABLE', prayer: berlin(), calculation: null };
        };
        const cleanup = await installPrayerSettings(container, { send });
        const descendants = element => [element, ...element.children.flatMap(descendants)];
        const elements = descendants(container);
        const numbers = elements.filter(element => element.type === 'number');
        const enable = elements.find(element => element.tag === 'button' && element.textContent === 'Enable prayer notifications');
        assert.equal(requests.length, 0); assert.deepEqual(messages.map(message => message.type), ['PRAYER_GET_STATUS']);
        const limitation = elements.find(element => element.tag === 'p' && element.textContent?.includes('Umm al-Qura'));
        assert.ok(limitation, 'limitations are visible before opt-in');
        assert.ok(elements.indexOf(limitation) < elements.indexOf(enable));
        numbers[0].value = '';
        enable.click(); assert.equal(requests.length, 0);
        numbers[0].value = '52.52';
        enable.click(); assert.equal(requests.length, 1); // synchronous, before the permission promise resolves
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(messages.some(message => message.type === 'PRAYER_ENABLE'), false);
        granted = true; enable.click(); assert.equal(requests.length, 2);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(messages.filter(message => message.type === 'PRAYER_ENABLE').length, 1);
        assert.equal(messages.at(-1).prayer.enabled, true);
        cleanup();
        for (const language of ['ar', 'en', 'de']) {
            const localizedContainer = new Element('main');
            const localizedCleanup = await installPrayerSettings(localizedContainer, { send, language });
            const localizedElements = descendants(localizedContainer), copy = prayerCopy(language);
            const limitations = localizedElements.find(element => element.tag === 'p' && element.textContent === copy.limitations);
            const localizedEnable = localizedElements.find(element => element.tag === 'button' && element.textContent === copy.enable);
            assert.ok(limitations && localizedEnable, `${language}: visible limitations and opt-in`);
            assert.ok(localizedElements.indexOf(limitations) < localizedElements.indexOf(localizedEnable));
            localizedCleanup();
        }
    } finally { globalThis.document = oldDocument; globalThis.chrome = oldChrome; }
});

test('supported prayer methods are explicit; Umm al-Qura and high-latitude substitutions are rejected', () => {
    assert.deepEqual(Object.keys(PRAYER_METHODS), ['MWL', 'ISNA', 'Egypt', 'Karachi']);
    for (const method of ['UmmAlQura', 'Umm al-Qura']) assert.throws(() => validatePrayer({ ...berlin(), method }), { code: 'prayer_invalid' });
    assert.throws(() => validatePrayer({ ...berlin(), highLatitudeRule: 'middleOfNight' }), { code: 'prayer_invalid' });
    const summer = calculatePrayerTimes('2026-06-21', berlin());
    assert.equal(summer.times.fajr, null); assert.equal(summer.times.isha, null);
    assert.deepEqual(summer.unavailable, ['fajr', 'isha']);
});

test('unavailable high-latitude events never create prayer alarms', async () => {
    const { controller, state } = fixture(); state.granted = true; state.now = Date.parse('2026-06-21T00:00Z');
    const response = await controller.handle({ type: 'PRAYER_ENABLE', prayer: { ...berlin(), prayers: ['fajr', 'isha'] } });
    assert.equal(response.enabled, true);
    assert.deepEqual(response.calculation.unavailable, ['fajr', 'isha']);
    assert.deepEqual([...state.alarms.keys()], [`${PRAYER_ALARM_PREFIX}refresh`]);
    assert.equal(state.notifications.length, 0);
});
