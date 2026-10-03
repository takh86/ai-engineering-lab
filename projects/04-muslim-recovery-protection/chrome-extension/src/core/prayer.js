import { TabsiraError } from './errors.js';

export const PRAYERS = Object.freeze(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
export const PRAYER_METHODS = Object.freeze({ MWL: [18, 17], ISNA: [15, 15], Egypt: [19.5, 17.5], Karachi: [18, 18] });
export const defaultPrayer = () => ({ enabled: false, latitude: null, longitude: null, city: '', timeZone: '', method: 'MWL', asr: 'standard', adjustment: 0, prayers: [...PRAYERS] });
const invalid = () => { throw new TabsiraError('prayer_invalid'); };

export function resolveTimeZone(timeZone = '') {
    if (typeof timeZone !== 'string' || timeZone.length > 80) invalid();
    const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(0); } catch { invalid(); }
    return zone;
}

/** Strict whole-config validation; coordinates may remain empty while disabled. */
export function validatePrayer(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    const p = { ...defaultPrayer(), ...value };
    if (Object.keys(p).some(key => !(key in defaultPrayer())) || typeof p.enabled !== 'boolean') invalid();
    for (const [key, limit] of [['latitude', 90], ['longitude', 180]]) {
        if (p[key] !== null && (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || Math.abs(p[key]) > limit)) invalid();
        if (p.enabled && p[key] === null) invalid();
    }
    if (typeof p.city !== 'string' || p.city.length > 100 || /[\u0000-\u001f\u007f]/u.test(p.city)) invalid();
    resolveTimeZone(p.timeZone);
    if (!Object.hasOwn(PRAYER_METHODS, p.method) || !['standard', 'hanafi'].includes(p.asr)) invalid();
    if (!Number.isInteger(p.adjustment) || Math.abs(p.adjustment) > 120) invalid();
    if (!Array.isArray(p.prayers) || !p.prayers.length || p.prayers.length > 5 || new Set(p.prayers).size !== p.prayers.length || p.prayers.some(name => !PRAYERS.includes(name))) invalid();
    return { ...p, prayers: [...p.prayers] };
}

const DAY = 86400000;
const DEG = Math.PI / 180;
const sin = angle => Math.sin(angle * DEG);
const cos = angle => Math.cos(angle * DEG);
const mod = (value, base) => ((value % base) + base) % base;

// Independent implementation of USNO's approximate solar-coordinate equations:
// https://aa.usno.navy.mil/faq/sun_approx (valid roughly 1800–2200).
export function solarCoordinates(epoch) {
    const d = epoch / DAY + 2440587.5 - 2451545;
    const g = mod(357.529 + 0.98560028 * d, 360);
    const q = mod(280.459 + 0.98564736 * d, 360);
    const longitude = q + 1.915 * sin(g) + 0.020 * sin(2 * g);
    const obliquity = 23.439 - 0.00000036 * d;
    const rightAscension = mod(Math.atan2(cos(obliquity) * sin(longitude), cos(longitude)) / DEG / 15, 24);
    return { declination: Math.asin(sin(obliquity) * sin(longitude)) / DEG,
        equationOfTime: mod(q / 15 - rightAscension + 12, 24) - 12 };
}

const formatter = zone => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const parts = (epoch, zone) => Object.fromEntries(formatter(zone).formatToParts(epoch).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
export function prayerDate(epoch, zone = '') {
    const p = parts(epoch, resolveTimeZone(zone));
    return `${p.year}-${p.month}-${p.day}`;
}
export function addPrayerDays(date, count) { return new Date(dateEpoch(date) + count * DAY).toISOString().slice(0, 10); }
function dateEpoch(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid();
    const epoch = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(epoch) || new Date(epoch).toISOString().slice(0, 10) !== date || +date.slice(0, 4) < 1800 || +date.slice(0, 4) >= 2200) invalid();
    return epoch;
}
function civilNoon(date, zone) {
    const target = dateEpoch(date) + DAY / 2;
    let epoch = target;
    for (let n = 0; n < 4; n++) {
        const p = parts(epoch, zone);
        const observed = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
        epoch += target - observed;
    }
    if (prayerDate(epoch, zone) !== date) invalid(); // skipped civil dates are not invented
    return epoch;
}
function hourAngle(altitude, latitude, declination) {
    const ratio = (sin(altitude) - sin(latitude) * sin(declination)) / (cos(latitude) * cos(declination));
    return ratio >= -1 && ratio <= 1 ? Math.acos(ratio) / DEG / 15 : null;
}

/** Absolute UTC instants, never wall-clock offsets. DST is only used to identify the civil date.
 * Prayer definitions/conventions: https://praytimes.org/docs/calculation . No high-latitude substitution.
 * Sea-level horizon, standard refraction; these estimates cannot replace a local mosque timetable.
 */
export function calculatePrayerTimes(date, input) {
    const p = validatePrayer(input);
    if (p.latitude === null || p.longitude === null) invalid();
    const zone = resolveTimeZone(p.timeZone);
    const anchor = civilNoon(date, zone);
    let base = dateEpoch(date);
    const nominalNoon = base + (12 - p.longitude / 15) * 3600000;
    base += Math.round((anchor - nominalNoon) / DAY) * DAY;
    let noon = base + (12 - p.longitude / 15) * 3600000;
    for (let n = 0; n < 3; n++) noon = base + (12 - p.longitude / 15 - solarCoordinates(noon).equationOfTime) * 3600000;
    function crossing(altitudeAt, direction) {
        let epoch = noon;
        for (let n = 0; n < 4; n++) {
            const solar = solarCoordinates(epoch);
            const angle = hourAngle(altitudeAt(solar.declination), p.latitude, solar.declination);
            if (angle === null) return null;
            epoch = base + (12 - p.longitude / 15 - solar.equationOfTime + direction * angle) * 3600000;
        }
        return Math.round((epoch + p.adjustment * 60000) / 60000) * 60000;
    }
    const [fajr, isha] = PRAYER_METHODS[p.method];
    const times = {
        fajr: crossing(() => -fajr, -1),
        dhuhr: Math.round((noon + (1 + p.adjustment) * 60000) / 60000) * 60000,
        asr: crossing(dec => Math.atan(1 / ((p.asr === 'hanafi' ? 2 : 1) + Math.abs(Math.tan((p.latitude - dec) * DEG)))) / DEG, 1),
        maghrib: crossing(() => -0.833, 1),
        isha: crossing(() => -isha, 1)
    };
    // An event falling outside the requested civil date is not represented as that day's prayer.
    for (const name of PRAYERS) if (times[name] !== null && prayerDate(times[name], zone) !== date) times[name] = null;
    return { date, timeZone: zone, times, unavailable: p.prayers.filter(name => times[name] === null) };
}
