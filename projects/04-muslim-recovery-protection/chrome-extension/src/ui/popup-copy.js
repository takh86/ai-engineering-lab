// Popup-specific copy follows the saved interface language resolved by common.js.
export const POPUP_COPY = {
    ar: {
        home: 'الرئيسية', tagline: 'خطوة صغيرة نحو اختيار واعٍ', commitment: 'الوقت المتبقي للالتزام', noCommitment: 'لا يوجد التزام نشط', commitmentUnavailable: 'تعذّر التحقق من حالة الالتزام.', deadline: 'ينتهي الالتزام في', expired: 'انتهى وقت الالتزام. جارٍ التحقق…',
        blockSite: 'حجب الموقع الحالي', siteHint: 'تُقرأ علامة التبويب الحالية فقط عند الضغط؛ يُضاف نطاقها إلى المواقع الإضافية المحجوبة.', blocked: 'أُضيف نطاق الموقع إلى الحجب.', permissionDenied: 'لم يُمنح إذن علامة التبويب الحالية. لم يُضف أي موقع.', unavailable: 'افتح موقعًا عاديًا عبر HTTP أو HTTPS ثم افتح تبصرة مجددًا.', blockFailed: 'تعذّر حجب الموقع. راجع الإعدادات ثم حاول مجددًا.',
        blocking: 'جارٍ إضافة الموقع…', recovery: 'رحلة التعافي', covenant: 'ميثاقي', preferences: 'الإعدادات', limits: 'الحالة تخص قواعد المتصفح؛ لا تثبت سلامة كل محتوى أو الحماية في تطبيقات أخرى.'
    },
    en: {
        home: 'Home', tagline: 'A small step toward a mindful choice', commitment: 'Commitment time remaining', noCommitment: 'No active commitment', commitmentUnavailable: 'Commitment status could not be verified.', deadline: 'Commitment ends at', expired: 'Commitment time ended. Checking…',
        blockSite: 'Block current site', siteHint: 'The current tab is read only when you press this button; its domain is added to extra blocked sites.', blocked: 'The site domain was added to blocking.', permissionDenied: 'Current-tab access was not granted. No site was added.', unavailable: 'Open a regular HTTP or HTTPS website, then reopen Tabsira.', blockFailed: 'Could not block the site. Review settings and try again.',
        blocking: 'Adding the site…', recovery: 'Recovery journey', covenant: 'My covenant', preferences: 'Settings', limits: 'Status describes browser rules; it does not establish that all content is safe or that other apps are protected.'
    },
    de: {
        home: 'Startseite', tagline: 'Ein kleiner Schritt zu einer bewussten Wahl', commitment: 'Verbleibende Verpflichtungszeit', noCommitment: 'Keine aktive Verpflichtung', commitmentUnavailable: 'Der Verpflichtungsstatus konnte nicht geprüft werden.', deadline: 'Verpflichtung endet am', expired: 'Verpflichtungszeit beendet. Wird geprüft…',
        blockSite: 'Aktuelle Website sperren', siteHint: 'Der aktuelle Tab wird erst beim Drücken gelesen; seine Domain wird zu den zusätzlich gesperrten Websites hinzugefügt.', blocked: 'Die Domain wurde zur Sperrliste hinzugefügt.', permissionDenied: 'Der Zugriff auf den aktuellen Tab wurde nicht gewährt. Keine Website wurde hinzugefügt.', unavailable: 'Öffne eine normale HTTP- oder HTTPS-Website und danach Tabsira erneut.', blockFailed: 'Die Website konnte nicht gesperrt werden. Prüfe die Einstellungen und versuche es erneut.',
        blocking: 'Website wird hinzugefügt…', recovery: 'Erholungsweg', covenant: 'Meine Vereinbarung', preferences: 'Einstellungen', limits: 'Der Status beschreibt Browserregeln; er bestätigt weder die Sicherheit aller Inhalte noch den Schutz anderer Apps.'
    }
};
export function popupText(key, language = 'ar') {
    return (POPUP_COPY[language.split('-')[0]] ?? POPUP_COPY.ar)[key] ?? key;
}
