import { domainFromTabUrl } from './popup-model.js';

// Called synchronously by the button gesture so the optional permission request
// retains user activation. Current-tab access is never performed at page startup.
export async function blockCurrentSite(api, send) {
    try {
        if (!(await api.permissions.request({ permissions: ['activeTab'] }))) return 'permissionDenied';
        const tabs = await api.tabs.query({ active: true, currentWindow: true });
        const domain = tabs.length === 1 ? domainFromTabUrl(tabs[0].url) : null;
        if (!domain) return 'unavailable';
        const reply = await send({ type: 'BLOCK_CURRENT_SITE', domain });
        return reply.ok ? 'blocked' : 'blockFailed';
    } catch { return 'unavailable'; }
}
