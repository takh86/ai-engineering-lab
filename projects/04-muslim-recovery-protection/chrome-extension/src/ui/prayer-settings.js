import { defaultPrayer, PRAYERS, PRAYER_METHODS, validatePrayer } from './core/prayer.js';
import { prayerCopy } from './core/prayer-copy.js';

/** Mount in settings, or after Muslim + faith selection in onboarding. Does not enable on mount.
 * Returns cleanup; owns no intervals. Permission request is only in the explicit enable click.
 */
export async function installPrayerSettings(container, { send, language = 'en', onSaved } = {}) {
    const copy = prayerCopy(language), ext = globalThis.browser ?? globalThis.chrome;
    let disposed = false;
    const node = (tag, text) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; };
    const root = node('section');
    root.append(node('h2', copy.title), node('p', copy.intro), node('p', copy.limitations));
    const controls = {};
    function field(name, label, type = 'text', choices = null) {
        const wrap = node('label', label), input = node(choices ? 'select' : 'input');
        if (choices) for (const [value, text] of choices) { const opt = node('option', text); opt.value = value; input.append(opt); }
        else input.type = type;
        if (type === 'number') input.step = name === 'adjustment' ? '1' : 'any';
        if (name === 'latitude') { input.min = '-90'; input.max = '90'; }
        if (name === 'longitude') { input.min = '-180'; input.max = '180'; }
        if (name === 'adjustment') { input.min = '-120'; input.max = '120'; }
        if (name === 'city') input.maxLength = 100;
        if (name === 'timeZone') input.maxLength = 80;
        wrap.append(input); root.append(wrap); controls[name] = input;
    }
    field('city', copy.city); field('latitude', copy.latitude, 'number'); field('longitude', copy.longitude, 'number'); field('timeZone', copy.timeZone);
    field('method', copy.method, 'text', Object.keys(PRAYER_METHODS).map(key => [key, copy[key]]));
    field('asr', copy.asrLabel, 'text', [['standard', copy.standard], ['hanafi', copy.hanafi]]);
    field('adjustment', copy.adjustment, 'number');
    const selection = node('fieldset'); selection.append(node('legend', copy.selection));
    const selected = {};
    for (const name of PRAYERS) { const label = node('label'), box = node('input'); box.type = 'checkbox'; selected[name] = box; label.append(box, document.createTextNode(copy[name])); selection.append(label); }
    root.append(selection, node('p', copy.estimate));
    const state = node('p'), times = node('p'), feedback = node('p'); feedback.setAttribute('role', 'status');
    const save = node('button', copy.save), enable = node('button', copy.enable), disable = node('button', copy.disable);
    for (const button of [save, enable, disable]) button.type = 'button';
    root.append(state, times, save, enable, disable, feedback); container.replaceChildren(root);
    function report(reply) {
        const code = reply?.error?.code;
        feedback.textContent = code === 'prayer_permission' ? copy.permission : code === 'prayer_invalid' ? copy.invalid : ['access_locked', 'locked', 'password_locked'].includes(code) ? copy.locked : copy.error;
    }
    function render(reply) {
        if (disposed) return;
        state.textContent = reply.enabled ? copy.on : copy.off;
        enable.hidden = !!reply.enabled; disable.hidden = !reply.enabled;
        const calculation = reply.calculation;
        times.textContent = calculation ? `${copy.calculated}: ${PRAYERS.map(name => `${copy[name]} ${calculation.times[name] === null ? '—' : new Intl.DateTimeFormat(language, { timeZone: calculation.timeZone, hour: '2-digit', minute: '2-digit' }).format(calculation.times[name])}`).join(' · ')}${calculation.unavailable.length ? ` ${copy.unavailable} ${calculation.unavailable.map(name => copy[name]).join(', ')}` : ''}` : copy.none;
    }
    function draft() {
        const p = defaultPrayer();
        for (const name of ['city', 'timeZone', 'method', 'asr']) p[name] = controls[name].value.trim();
        for (const name of ['latitude', 'longitude']) p[name] = controls[name].value === '' ? null : Number(controls[name].value);
        p.adjustment = controls.adjustment.value === '' ? NaN : Number(controls.adjustment.value);
        p.prayers = PRAYERS.filter(name => selected[name].checked);
        return validatePrayer(p);
    }
    let busy = false;
    async function perform(type, prayer) {
        if (busy || disposed) return;
        busy = true; save.disabled = enable.disabled = disable.disabled = true;
        try { const reply = await send({ type, prayer }); if (reply?.ok) { render(reply); feedback.textContent = copy.saved; onSaved?.(reply); } else { if (reply?.error?.code === 'prayer_permission') render(reply); report(reply); } }
        catch { feedback.textContent = copy.error; }
        finally { busy = false; save.disabled = enable.disabled = disable.disabled = false; }
    }
    save.addEventListener('click', () => { try { void perform('PRAYER_SAVE', draft()); } catch { feedback.textContent = copy.invalid; } });
    disable.addEventListener('click', () => { void perform('PRAYER_DISABLE'); });
    enable.addEventListener('click', () => {
        if (busy || disposed) return;
        let p; try { p = validatePrayer({ ...draft(), enabled: true }); } catch { feedback.textContent = copy.invalid; return; }
        // No await precedes this request: it must remain within the trusted activation gesture.
        let request; try { request = ext.permissions.request({ permissions: ['notifications'] }); } catch { request = Promise.resolve(false); }
        busy = true; save.disabled = enable.disabled = disable.disabled = true;
        Promise.resolve(request).catch(() => false).then(granted => {
            busy = false;
            if (disposed) return;
            if (!granted) {
                save.disabled = enable.disabled = disable.disabled = false;
                feedback.textContent = copy.permission;
                return;
            }
            // Worker independently checks actual permission again; permission can be removed after this gesture.
            return perform('PRAYER_ENABLE', p);
        });
    });
    try {
        const reply = await send({ type: 'PRAYER_GET_STATUS' });
        if (!disposed && reply?.ok) {
            const p = reply.prayer;
            for (const [name, input] of Object.entries(controls)) input.value = p[name] ?? '';
            for (const name of PRAYERS) selected[name].checked = p.prayers.includes(name);
            render(reply);
        } else if (!disposed) report(reply);
    } catch { if (!disposed) feedback.textContent = copy.error; }
    return () => { disposed = true; root.remove(); };
}
