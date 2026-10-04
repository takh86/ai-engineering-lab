import { calculatePrayerTimes, prayerDate, addPrayerDays, validatePrayer, defaultPrayer } from '../core/prayer.js';
import { createWriteMutex } from './coordination.js';
import { toErrorPayload } from '../core/errors.js';
import { prayerCopy } from '../core/prayer-copy.js';

export const PRAYER_ALARM_PREFIX = 'tabsira-prayer:';
const REFRESH = `${PRAYER_ALARM_PREFIX}refresh`;
const SENT = 'prayer-sent:';
const LATE_LIMIT = 5 * 60000;
const permission = { permissions: ['notifications'] };
const eligible = profile => profile.religion === 'muslim' && profile.faith === true;

/** Browser derived state only; public preferences are written through the password-gated feature controller. */
export function createPrayerController(api, featureController) {
    const mutex = createWriteMutex({ ...api, instanceId: `${api.instanceId}-prayer` });
    let queue = Promise.resolve();
    const serial = task => { const next = queue.then(task, task); queue = next.catch(() => {}); return next; };
    const getProfile = async () => {
        const reply = await featureController.handle({ type: 'GET_PUBLIC_PROFILE' });
        if (!reply?.ok) throw new Error('profile unavailable');
        return reply.profile;
    };
    // Internal validated read: no second bakery participant may be acquired while this controller holds it.
    const snapshot = () => featureController.readPublicProfileSnapshot();
    const hasPermission = async () => { try { return await api.permissions.contains(permission); } catch { return false; } };
    async function clearAlarms() {
        for (const alarm of await api.alarms.getAll()) if (alarm.name.startsWith(PRAYER_ALARM_PREFIX)) await api.alarms.clear(alarm.name);
    }
    async function status(profile = null) {
        profile ??= await getProfile();
        const p = validatePrayer(profile.prayer ?? defaultPrayer());
        const granted = await hasPermission();
        const now = api.now();
        const calculation = p.latitude === null || p.longitude === null ? null : calculatePrayerTimes(prayerDate(now, p.timeZone), p);
        return { ok: true, enabled: p.enabled && eligible(profile) && granted, permission: granted, prayer: p, calculation };
    }
    async function reconcileInternal() {
        let profile = await getProfile();
        let p = validatePrayer(profile.prayer ?? defaultPrayer());
        if (p.enabled && (!eligible(profile) || !(await hasPermission()))) {
            await featureController.setPrayerEnabled(false);
            profile = await getProfile(); p = validatePrayer(profile.prayer);
        }
        return mutex.run(async () => {
            await mutex.assertOwner();
            // A profile write may have won while this participant was waiting. Never schedule from the stale snapshot.
            profile = await snapshot(); p = validatePrayer(profile.prayer ?? defaultPrayer());
            if (!p.enabled || !eligible(profile) || !(await hasPermission())) { await clearAlarms(); return status(profile); }
            const now = api.now();
            const today = prayerDate(now, p.timeZone);
            const desired = new Map([[REFRESH, { when: now + 3600000, periodInMinutes: 60 }]]);
            const all = await api.storage.getAll();
            for (const date of [today, addPrayerDays(today, 1)]) {
                const result = calculatePrayerTimes(date, p);
                for (const name of p.prayers) {
                    const when = result.times[name];
                    if (when !== null && when > now && !all[`${SENT}${date}:${name}`]) desired.set(`${PRAYER_ALARM_PREFIX}${date}:${name}:${when}`, { when });
                }
            }
            const alarms = await api.alarms.getAll();
            for (const alarm of alarms) if (alarm.name.startsWith(PRAYER_ALARM_PREFIX) && !desired.has(alarm.name)) { await mutex.assertOwner(); await api.alarms.clear(alarm.name); }
            for (const [name, info] of desired) if (!alarms.some(alarm => alarm.name === name)) { await mutex.assertOwner(); await api.alarms.create(name, info); }
            // Only event identities and timestamps are retained, for at most three days; no location or activity log.
            const expired = Object.keys(all).filter(key => key.startsWith(SENT) && /^\d{4}-\d{2}-\d{2}:/u.test(key.slice(SENT.length)) && key.slice(SENT.length, SENT.length + 10) < addPrayerDays(today, -3));
            if (expired.length) { await mutex.assertOwner(); await api.storage.remove(expired); }
            return status(profile);
        });
    }
    const reconcile = () => serial(reconcileInternal);
    async function handle(message) {
        if (!['PRAYER_GET_STATUS', 'PRAYER_SAVE', 'PRAYER_ENABLE', 'PRAYER_DISABLE'].includes(message?.type)) return undefined;
        return serial(async () => {
            try {
                if (message.type === 'PRAYER_GET_STATUS') return await status();
                let p;
                const profile = await getProfile();
                if (message.type === 'PRAYER_DISABLE') p = { ...(profile.prayer ?? defaultPrayer()), enabled: false };
                else { validatePrayer(message.prayer); p = validatePrayer({ ...message.prayer, enabled: message.type === 'PRAYER_ENABLE' ? true : !!profile.prayer?.enabled }); }
                const granted = await hasPermission();
                if (p.enabled && (!eligible(profile) || !granted)) p.enabled = false;
                const saved = await featureController.handle({ type: 'SAVE_PUBLIC_PROFILE', profile: { prayer: p } });
                if (!saved?.ok) return saved;
                const result = await reconcileInternal();
                return message.type === 'PRAYER_ENABLE' && !granted ? { ...result, ok: false, error: { code: 'prayer_permission', params: {} } } : result;
            } catch (error) { return { ok: false, error: toErrorPayload(error) }; }
        });
    }
    async function onAlarm(alarm) {
        if (!alarm?.name?.startsWith(PRAYER_ALARM_PREFIX)) return false;
        await serial(async () => {
            // Fetch through the serialized feature API before taking our write mutex.
            // Revalidation inside uses the read-only snapshot API, so notification delivery cannot deadlock itself.
            await getProfile();
            if (alarm.name !== REFRESH) await mutex.run(async () => {
                const match = /^tabsira-prayer:(\d{4}-\d{2}-\d{2}):(fajr|dhuhr|asr|maghrib|isha):(\d+)$/u.exec(alarm.name);
                if (!match) return;
                const [, date, name, stamp] = match;
                const now = api.now(), when = +stamp;
                if (when > now || now - when > LATE_LIMIT) return;
                const profile = await snapshot(), p = validatePrayer(profile.prayer ?? defaultPrayer());
                if (!p.enabled || !eligible(profile) || !p.prayers.includes(name) || !(await hasPermission()) || prayerDate(now, p.timeZone) !== date) return;
                if (calculatePrayerTimes(date, p).times[name] !== when) return; // stale location/method/time-zone alarms
                const key = `${SENT}${date}:${name}`;
                if ((await api.storage.get([key]))[key]) return;
                await mutex.assertOwner();
                // Claim before notification: a crash may miss one reminder, but cannot flood old reminders on restart.
                await api.storage.set({ [key]: when });
                await mutex.assertOwner();
                const copy = prayerCopy(profile.language);
                await api.notifications.create(`tabsira-prayer-${date}-${name}`, { type: 'basic', iconUrl: `${api.baseUrl}icons/icon-128.png`, title: copy.title, message: copy.notification.replace('{prayer}', copy[name]) });
            });
            await reconcileInternal();
        });
        return true;
    }
    async function onPermissionsRemoved(removed) {
        if (removed?.permissions && !removed.permissions.includes('notifications')) return;
        return serial(async () => { if (!(await hasPermission())) await featureController.setPrayerEnabled(false); return reconcileInternal(); });
    }
    return { handle, reconcile, onAlarm, onPermissionsRemoved };
}
