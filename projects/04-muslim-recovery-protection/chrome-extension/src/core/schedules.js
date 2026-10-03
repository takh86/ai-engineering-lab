import { TabsiraError } from './errors.js';

export const SCHEDULE_LIMIT = 24;
const DAY = 1440;
const WEEK = 7 * DAY;
const minute = value => {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/u.test(value)) throw new TabsiraError('schedule_invalid');
    return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
};
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Half-open intervals; overnight Sunday wraps back to Monday/Sunday index 0. */
export function weeklyIntervals(schedules) {
    const intervals = [];
    for (const schedule of schedules.filter(item => item.enabled)) {
        const start = minute(schedule.start), end = minute(schedule.end);
        for (const day of schedule.days) {
            const from = day * DAY + start;
            const to = day * DAY + end + (end <= start ? DAY : 0);
            if (to > WEEK) intervals.push([from, WEEK], [0, to - WEEK]);
            else intervals.push([from, to]);
        }
    }
    return intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function parseSchedules(raw) {
    if (!Array.isArray(raw) || raw.length > SCHEDULE_LIMIT) throw new TabsiraError('schedule_invalid');
    const ids = new Set();
    const schedules = raw.map(item => {
        if (!exact(item, ['id', 'days', 'start', 'end', 'enabled']) || typeof item.id !== 'string'
            || !/^[A-Za-z0-9_-]{1,64}$/u.test(item.id) || ids.has(item.id) || typeof item.enabled !== 'boolean'
            || !Array.isArray(item.days) || !item.days.length || item.days.length > 7
            || item.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)
            || new Set(item.days).size !== item.days.length) throw new TabsiraError('schedule_invalid');
        ids.add(item.id);
        if (minute(item.start) === minute(item.end)) throw new TabsiraError('schedule_invalid');
        return { id: item.id, days: [...item.days].sort(), start: item.start, end: item.end, enabled: item.enabled };
    });
    const intervals = weeklyIntervals(schedules);
    for (let i = 1; i < intervals.length; i++) if (intervals[i][0] < intervals[i - 1][1]) throw new TabsiraError('schedule_conflict');
    return schedules;
}

export function scheduleState(schedules, now) {
    const date = new Date(now);
    const position = date.getDay() * DAY + date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 + date.getMilliseconds() / 60000;
    const intervals = weeklyIntervals(schedules);
    const active = intervals.some(([start, end]) => position >= start && position < end);
    const boundaries = intervals.flat();
    const minutes = boundaries.length ? Math.min(...boundaries.map(boundary => (boundary - position + WEEK) % WEEK || WEEK)) : null;
    return { active, configured: schedules.some(item => item.enabled), nextChange: minutes === null ? null : now + minutes * 60000 };
}

/** No schedules means continuous extras; a changed schedule must cover every previously protected minute. */
export function schedulesWeaken(previous, next) {
    const continuous = items => !items.some(item => item.enabled);
    if (continuous(next)) return false;
    if (continuous(previous)) return true;
    const after = weeklyIntervals(next);
    return weeklyIntervals(previous).some(([start, end]) => {
        let covered = start;
        for (const [from, to] of after) {
            if (from > covered) break;
            if (to > covered) covered = to;
            if (covered >= end) return false;
        }
        return covered < end;
    });
}
