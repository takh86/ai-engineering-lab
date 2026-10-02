#!/usr/bin/env python3
"""Single source for the UI strings: writes src/_locales/{ar,en,de}/messages.json from the table below.
Edit THIS file, run `python3 scripts/locales-source.py`, commit both. tests/unit/static.test.mjs keeps the generated
JSON in parity (same keys and placeholders, every key used by pages/code exists, store length limits).
Placeholders are written {1}, {2}. Arabic is the default locale. Copy in all three languages needs native-speaker
review before release (see store/SUBMISSION-CHECKLIST.md)."""
import json, re, pathlib

M = {}
def add(key, ar, en, de): M[key] = {'ar': ar, 'en': en, 'de': de}

# ---- manifest ----
add('extName', 'تبصرة Tabsira', 'تبصرة Tabsira', 'تبصرة Tabsira')
add('extShortName', 'تبصرة', 'Tabsira', 'Tabsira')
add('extDescription',
    'حجب مواقع وعبارات بحث تختارها بنفسك، ومساعدة قصيرة وقت الرغبة. محلي بالكامل: بلا حسابات ولا تتبع.',
    'Block sites and search phrases you choose, with short, respectful help in the moment. Fully local: no accounts, no tracking.',
    'Blockiere Websites und Suchbegriffe, die du wählst – mit kurzer, respektvoller Hilfe im Moment. Komplett lokal, ohne Konto.')

# ---- common ----
add('common_back', 'رجوع', 'Back', 'Zurück')
add('common_next', 'التالي', 'Next', 'Weiter')
add('common_cancel', 'إلغاء', 'Cancel', 'Abbrechen')
add('common_confirm', 'تأكيد', 'Confirm', 'Bestätigen')
add('common_help_now', 'ساعدني الآن', 'Help me now', 'Hilf mir jetzt')
add('common_settings', 'الإعدادات', 'Settings', 'Einstellungen')
add('common_repair', 'إصلاح', 'Repair', 'Reparieren')
add('common_loading', 'جارٍ التحقق…', 'Checking…', 'Wird geprüft …')
add('common_back_to_tabsira', 'العودة إلى تبصرة', 'Back to Tabsira', 'Zurück zu Tabsira')
add('common_version', 'الإصدار {1}', 'Version {1}', 'Version {1}')

# ---- status ----
add('state_not_configured', 'لم يُضبط الحجب بعد — لا شيء محجوب الآن.', 'Blocking is not set up yet — nothing is blocked right now.', 'Das Blockieren ist noch nicht eingerichtet – aktuell wird nichts blockiert.')
add('state_active', 'القواعد مثبتة وصلاحياتها متاحة. اختبرها بالاختبار الآمن.', 'Rules are installed and the required permission is available. Try the safe test to confirm.', 'Regeln sind installiert und die nötige Berechtigung ist vorhanden. Bestätige es mit dem sicheren Test.')
add('state_partial', 'الإعداد ناقص أو غير متطابق — قد لا يعمل الحجب كاملًا.', 'Setup is incomplete or does not match — blocking may not fully work.', 'Die Einrichtung ist unvollständig oder passt nicht – das Blockieren funktioniert eventuell nicht vollständig.')
add('state_unknown', 'تعذّر التأكد من حالة الحجب. أعد المحاولة أو افتح الإعدادات.', 'Could not confirm the blocking state. Try again or open Settings.', 'Der Blockier-Status konnte nicht bestätigt werden. Versuche es erneut oder öffne die Einstellungen.')
add('reason_host_permission_missing', 'صلاحية الوصول إلى المواقع غير ممنوحة، فلن تُحوَّل الصفحات المحجوبة.', 'Website access permission is not granted, so blocked pages will not be redirected.', 'Die Berechtigung für Websites fehlt, daher werden blockierte Seiten nicht umgeleitet.')
add('reason_rules_mismatch', 'القواعد في المتصفح لا تطابق إعداداتك. اضغط «إصلاح».', 'The rules in the browser do not match your settings. Press “Repair”.', 'Die Regeln im Browser passen nicht zu deinen Einstellungen. Drücke „Reparieren“.')
add('reason_phrases_unsupported', 'بعض العبارات أطول مما يسمح به المتصفح في بعض محركات البحث، فلا تُطبَّق هناك. قصّرها.', 'Some phrases are longer than the browser allows on some search engines, so they are not applied there. Shorten them.', 'Einige Begriffe sind länger, als der Browser bei manchen Suchmaschinen erlaubt, und werden dort nicht angewendet. Kürze sie.')
add('reason_config_corrupt', 'ملف الإعدادات تالف. لم نغيّر القواعد الحالية.', 'The saved settings are damaged. Existing rules were left untouched.', 'Die gespeicherten Einstellungen sind beschädigt. Bestehende Regeln blieben unverändert.')
add('reason_storage_error', 'تعذّرت قراءة الإعدادات المحفوظة.', 'The saved settings could not be read.', 'Die gespeicherten Einstellungen konnten nicht gelesen werden.')
add('reason_api_error', 'تعذّر الاتصال بواجهة الحجب في المتصفح.', 'Could not reach the browser’s blocking interface.', 'Die Blockier-Schnittstelle des Browsers ist nicht erreichbar.')
add('reason_config_missing_rules_present', 'الإعدادات المحفوظة مفقودة لكن توجد قواعد حجب في المتصفح. لم نغيّرها.', 'Saved settings are missing but blocking rules exist in the browser. They were left untouched.', 'Gespeicherte Einstellungen fehlen, aber im Browser existieren Blockier-Regeln. Sie blieben unverändert.')
add('reason_onboarding_pending', 'أكمل الإعداد الأولي لتفعيل الحجب.', 'Finish the first-time setup to turn blocking on.', 'Schließe die Ersteinrichtung ab, um das Blockieren zu aktivieren.')
add('reason_nothing_enabled', 'كل خيارات الحجب مطفأة.', 'Every blocking option is switched off.', 'Alle Blockier-Optionen sind ausgeschaltet.')
add('incog_on', 'التصفح الخفي: مسموح للإضافة.', 'Private browsing: allowed for the extension.', 'Privates Surfen: für die Erweiterung erlaubt.')
add('incog_off', 'التصفح الخفي: غير مفعّل للإضافة. فعّله من صفحة الإضافات في المتصفح إن أردت.', 'Private browsing: not enabled for the extension. Turn it on in the browser’s extensions page if you want it.', 'Privates Surfen: für die Erweiterung nicht aktiviert. Aktiviere es bei Bedarf auf der Erweiterungsseite des Browsers.')
add('incog_unknown', 'التصفح الخفي: لا يمكن التحقق.', 'Private browsing: cannot be verified.', 'Privates Surfen: nicht überprüfbar.')
add('lock_none', 'لا توجد جلسة التزام نشطة.', 'No commitment session is active.', 'Keine Selbstverpflichtung aktiv.')
add('lock_active', 'جلسة التزام نشطة حتى {1}. يمكنك إضافة حماية أقوى فقط.', 'Commitment session active until {1}. You can only add stronger protection.', 'Selbstverpflichtung aktiv bis {1}. Du kannst nur stärkeren Schutz hinzufügen.')

# ---- popup ----
add('popup_limits', 'الحجب للمواقع والعبارات التي تضيفها فقط. لا يفحص الصور ولا محتوى الصفحات.', 'Blocks only the sites and phrases you set. It does not scan images or page content.', 'Blockiert nur die Websites und Begriffe, die du festlegst. Bilder und Seiteninhalte werden nicht geprüft.')
add('popup_tagline', 'مساحة تختار فيها', 'A space to choose', 'Ein Raum für deine Entscheidung')

# ---- blocked ----
add('blocked_title', 'لنأخذ لحظة', 'Let’s take a moment', 'Nehmen wir uns einen Moment')
add('blocked_body', 'طابق هذا الطلب قاعدة في قائمة الحجب التي اخترتها.', 'This request matched a rule in the blocking list you chose.', 'Diese Anfrage entsprach einer Regel in der von dir gewählten Blockliste.')
add('blocked_note', 'لن يُفتح الموقع من هنا. يمكنك أخذ دقيقة واختيار خطوة تناسبك.', 'The site will not open from here. You can take a minute and pick a step that suits you.', 'Die Seite wird von hier aus nicht geöffnet. Du kannst dir eine Minute nehmen und einen passenden nächsten Schritt wählen.')
add('blocked_privacy', 'لا نحفظ عنوان الصفحة ولا نص البحث الذي أدى إلى الحجب.', 'We do not store the page address or the search text that led here.', 'Wir speichern weder die Seitenadresse noch den Suchtext, der hierher geführt hat.')
add('blocked_wrong', 'هل هذا حجب خاطئ؟ أضف الموقع إلى الاستثناءات من الإعدادات (غير متاح أثناء جلسة التزام).', 'A wrong block? Add the site to Exceptions in Settings (not possible during a commitment session).', 'Falsch blockiert? Füge die Seite in den Einstellungen zu den Ausnahmen hinzu (während einer Selbstverpflichtung nicht möglich).')

# ---- help ----
add('help_title', 'خذ مساحة قبل القرار', 'Make room before deciding', 'Schaffe Raum vor der Entscheidung')
add('help_intro', 'لا يُطلب منك حل كل شيء الآن. فقط لنغيّر هذه اللحظة.', 'You do not have to solve everything right now. Let’s just change this moment.', 'Du musst nicht alles jetzt lösen. Lass uns nur diesen Moment verändern.')
add('help_timer_title', 'دقيقة بعيدًا عن الشاشة', 'One minute away from the screen', 'Eine Minute Abstand vom Bildschirm')
add('help_timer_body', 'ارفع يدك عن الفأرة، خذ نفسًا هادئًا، وقم من مكانك إن استطعت.', 'Take your hand off the mouse, breathe slowly, and stand up if you can.', 'Nimm die Hand von der Maus, atme ruhig und steh auf, wenn du kannst.')
add('help_timer_label', 'الوقت المتبقي بالثواني', 'Seconds remaining', 'Verbleibende Sekunden')
add('help_start', 'ابدأ دقيقة', 'Start one minute', 'Eine Minute starten')
add('help_again', 'دقيقة أخرى', 'Another minute', 'Noch eine Minute')
add('help_note', 'الدقيقة لا تفتح أي موقع ولا توقف الحجب.', 'The minute never opens a site and never turns blocking off.', 'Die Minute öffnet keine Seite und schaltet das Blockieren nicht ab.')
add('help_after', 'الآن اختر خطوة واحدة: ابعد الجهاز، غيّر مكانك، أو تحدّث مع شخص تثق به.', 'Now pick one step: put the device away, change where you are, or talk to someone you trust.', 'Wähle jetzt einen Schritt: Leg das Gerät weg, wechsle den Ort oder sprich mit einer Person, der du vertraust.')
add('help_next_title', 'اختر الخطوة التالية', 'Choose your next step', 'Wähle deinen nächsten Schritt')
add('help_next_body', 'ضع الجهاز بعيدًا، اخرج إلى مكان مشترك، أو تواصل مع شخص تثق به.', 'Put the device down, go somewhere shared, or reach out to someone you trust.', 'Leg das Gerät weg, geh an einen gemeinsamen Ort oder melde dich bei jemandem, dem du vertraust.')
add('help_disclaimer', 'هذه المساعدة ليست علاجًا ولا ضمانًا للتعافي. إذا احتجت دعمًا متخصصًا فتواصل مع مختص أو جهة موثوقة في بلدك.', 'This help is not treatment and not a guarantee of recovery. If you need professional support, contact a qualified professional or a trusted service in your country.', 'Diese Hilfe ist keine Behandlung und keine Garantie für Genesung. Wenn du fachliche Unterstützung brauchst, wende dich an Fachleute oder eine vertrauenswürdige Stelle in deinem Land.')

# ---- onboarding ----
add('ob_title', 'مرحبًا بك في تبصرة', 'Welcome to Tabsira', 'Willkommen bei Tabsira')
add('ob_progress', 'الخطوة {1} من {2}', 'Step {1} of {2}', 'Schritt {1} von {2}')
add('ob1_title', 'ما الذي تفعله الإضافة؟', 'What it does', 'Was die Erweiterung tut')
add('ob1_body', 'تحجب المواقع وعبارات البحث التي تختارها أنت، وعند الحجب تعرض صفحة هادئة بمساعدة قصيرة. هي أداة مكمّلة لحمايات أخرى (مثل تطبيق الجوال أو DNS العائلي)، وليست بديلًا عنها ولا علاجًا مثبتًا.', 'It blocks the sites and search phrases you choose, and when something is blocked it shows a calm page with short help. It complements other protections (such as a phone app or family DNS); it is not a replacement and not a proven treatment.', 'Sie blockiert die Websites und Suchbegriffe, die du wählst, und zeigt dann eine ruhige Seite mit kurzer Hilfe. Sie ergänzt andere Schutzmaßnahmen (z. B. eine Handy-App oder Familien-DNS), ersetzt sie nicht und ist keine bewiesene Behandlung.')
add('ob2_title', 'لماذا تطلب صلاحية المواقع؟', 'Why it needs website access', 'Warum Zugriff auf Websites nötig ist')
add('ob2_body', 'لتحويل الصفحة المحجوبة إلى صفحة المساعدة يطلب المتصفح صلاحية «الوصول إلى المواقع». نستخدمها لإعادة التوجيه فقط: لا نقرأ محتوى الصفحات ولا نحفظ ما تتصفحه.', 'To redirect a blocked page to the help page, the browser asks for “access to websites”. We use it for redirecting only: we do not read page content and do not store what you browse.', 'Um eine blockierte Seite auf die Hilfeseite umzuleiten, verlangt der Browser den „Zugriff auf Websites“. Wir nutzen ihn nur für die Umleitung: Wir lesen keine Seiteninhalte und speichern nicht, was du besuchst.')
add('ob3_title', 'الخصوصية', 'Privacy', 'Datenschutz')
add('ob3_body', 'لا حسابات ولا تحليلات ولا خوادم. تبقى قائمتك وإعداداتك على هذا الجهاز فقط، وقد تكون غير مشفّرة. لا نحفظ محاولات الحجب ولا سجل التعثر، ولا نرسل شيئًا لأي أحد.', 'No accounts, no analytics, no servers. Your list and settings stay on this device only and may be unencrypted. We do not record block attempts or slips and send nothing to anyone.', 'Keine Konten, keine Analysen, keine Server. Liste und Einstellungen bleiben nur auf diesem Gerät und sind möglicherweise unverschlüsselt. Wir speichern keine Blockier-Versuche und senden nichts an andere.')
add('ob4_title', 'الحدود', 'Limits', 'Grenzen')
add('ob4_body', 'يمكن حذف الإضافة أو تعطيلها. لا تعمل في متصفحات أخرى أو ملفات محلية، والتصفح الخفي يحتاج تفعيلًا يدويًا. لا تفحص الصور ولا محتوى الصفحات، وقد لا تلتقط بحثًا يتغير داخل الصفحة دون تحميل جديد. القوائم الجاهزة قد تحجب موقعًا بالخطأ — استخدم الاستثناءات.', 'The extension can be removed or disabled. It does not work in other browsers or on local files, and private browsing needs to be enabled manually. It does not scan images or page content and may miss searches that change in-page without a new load. Ready-made lists can block a site by mistake — use Exceptions.', 'Die Erweiterung kann entfernt oder deaktiviert werden. Sie wirkt nicht in anderen Browsern oder bei lokalen Dateien; privates Surfen muss manuell erlaubt werden. Sie prüft keine Bilder oder Seiteninhalte und erkennt Suchen evtl. nicht, die sich ohne neues Laden auf der Seite ändern. Fertige Listen können eine Seite fälschlich blockieren – nutze Ausnahmen.')
add('ob5_title', 'اختر البداية ثم جرّب', 'Choose a start, then test', 'Wähle den Start und teste')
add('ob5_base', 'قائمة المواقع الأساسية للبالغين (مضمّنة في الإضافة، تتحدث مع إصداراتها)', 'Built-in adult-sites list (shipped inside the extension, updated with its releases)', 'Integrierte Liste für Erwachsenen-Websites (in der Erweiterung enthalten, wird mit ihren Versionen aktualisiert)')
add('ob5_starter', 'عبارات بحث مبدئية (كلمات كاملة، عربي وإنجليزي)', 'Starter search phrases (whole words, Arabic and English)', 'Start-Suchbegriffe (ganze Wörter, Arabisch und Englisch)')
add('ob5_permission_ok', 'صلاحية المواقع ممنوحة.', 'Website access is granted.', 'Zugriff auf Websites ist erteilt.')
add('ob5_permission_missing', 'صلاحية المواقع غير ممنوحة بعد.', 'Website access is not granted yet.', 'Zugriff auf Websites ist noch nicht erteilt.')
add('ob5_grant', 'منح صلاحية المواقع', 'Grant website access', 'Zugriff auf Websites erteilen')
add('ob5_grant_denied', 'لم تُمنح الصلاحية. بدونها لن يعمل الحجب.', 'The permission was not granted. Blocking will not work without it.', 'Die Berechtigung wurde nicht erteilt. Ohne sie funktioniert das Blockieren nicht.')
add('ob5_start', 'ابدأ الحجب', 'Start blocking', 'Blockieren starten')
add('ob5_done', 'تم الإعداد. جرّب الاختبار الآمن للتأكد.', 'Setup finished. Run the safe test to confirm.', 'Einrichtung abgeschlossen. Mache den sicheren Test zur Bestätigung.')
add('ob_already_done', 'اكتمل الإعداد الأولي من قبل. يمكنك تعديل كل شيء من الإعدادات.', 'First-time setup is already done. You can change everything in Settings.', 'Die Ersteinrichtung ist bereits abgeschlossen. Du kannst alles in den Einstellungen ändern.')
add('safe_test', 'اختبار آمن', 'Safe test', 'Sicherer Test')
add('safe_test_hint', 'يفتح عنوانًا وهميًا محجوزًا للاختبار. إذا ظهرت صفحة تبصرة فالحجب يعمل في هذا المتصفح.', 'Opens a reserved dummy address. If the Tabsira page appears, blocking works in this browser.', 'Öffnet eine reservierte Test-Adresse. Erscheint die Tabsira-Seite, funktioniert das Blockieren in diesem Browser.')

# ---- options ----
add('opt_title', 'إعداد تبصرة', 'Tabsira settings', 'Tabsira-Einstellungen')
add('opt_status', 'الحالة', 'Status', 'Status')
add('opt_base_title', 'قائمة المواقع الأساسية', 'Built-in sites list', 'Integrierte Website-Liste')
add('opt_base_label', 'حجب المواقع المصنّفة للبالغين', 'Block sites classified as adult', 'Websites blockieren, die als Inhalte für Erwachsene eingestuft sind')
add('opt_base_info', '{1} نطاق · لقطة بتاريخ {2}. التصنيف آلي مجتمعي وقد يخطئ؛ لا يوجد تحقق ذاتي من كل نطاق.', '{1} domains · snapshot of {2}. Classification is automated and community-made and can be wrong; each domain is not individually verified.', '{1} Domains · Stand: {2}. Die Einstufung ist automatisiert und von der Community; sie kann falsch sein, einzelne Domains werden nicht geprüft.')
add('opt_starter_label', 'عبارات البحث المبدئية (كلمات كاملة)', 'Starter search phrases (whole words)', 'Start-Suchbegriffe (ganze Wörter)')
add('opt_starter_show', 'عرض العبارات المبدئية', 'Show the starter phrases', 'Start-Begriffe anzeigen')
add('opt_sites_title', 'مواقعي', 'My sites', 'Meine Websites')
add('opt_sites_label', 'مواقع تُحجب — موقع في كل سطر', 'Sites to block — one per line', 'Zu blockierende Websites – eine pro Zeile')
add('opt_sites_hint', 'يحجب الموقع ونطاقاته الفرعية (مثل example.com يحجب mail.example.com ولا يحجب badexample.com). اكتب النطاق فقط دون مسار.', 'Blocks the site and its subdomains (example.com blocks mail.example.com but not badexample.com). Enter the domain only, no path.', 'Blockiert die Website und ihre Subdomains (example.com blockiert mail.example.com, aber nicht badexample.com). Nur die Domain eingeben, ohne Pfad.')
add('opt_allow_title', 'الاستثناءات', 'Exceptions', 'Ausnahmen')
add('opt_allow_label', 'مواقع مسموحة (حجب خاطئ) — موقع في كل سطر', 'Allowed sites (wrongly blocked) — one per line', 'Erlaubte Websites (fälschlich blockiert) – eine pro Zeile')
add('opt_allow_hint', 'للاستثناء الأولوية على القائمة الأساسية وعلى مواقعك. لا يمكن استثناء محركات البحث. إضافة استثناء تُعد تخفيفًا للحماية فلا تُسمح أثناء جلسة التزام.', 'An exception wins over the built-in list and over your sites. Search engines cannot be excepted. Adding an exception counts as weakening, so it is not allowed during a commitment session.', 'Eine Ausnahme hat Vorrang vor der integrierten Liste und deinen Websites. Suchmaschinen können nicht ausgenommen werden. Eine Ausnahme schwächt den Schutz und ist daher während einer Selbstverpflichtung nicht erlaubt.')
add('opt_phrases_title', 'عبارات البحث', 'Search phrases', 'Suchbegriffe')
add('opt_words_label', 'كلمات كاملة — عبارة في كل سطر (موصى به)', 'Whole words — one phrase per line (recommended)', 'Ganze Wörter – ein Begriff pro Zeile (empfohlen)')
add('opt_contains_label', 'مطابقة جزئية — عبارة في كل سطر (أوسع، وقد تحجب بحثًا سليمًا)', 'Partial match — one phrase per line (broader, may block harmless searches)', 'Teilübereinstimmung – ein Begriff pro Zeile (breiter, kann harmlose Suchen blockieren)')
add('opt_phrases_hint', 'تُطابق العبارة داخل معامل البحث فقط (q أو p أو search_query أو text) في Google وBing وDuckDuckGo وYahoo وYouTube وYandex وBrave وEcosia وQwant، بترميز + أو %20 وبغض النظر عن حالة الأحرف. تُزال التشكيلة والتطويل من العبارة، ولا تُوحَّد صور الألف والياء. العبارة العربية الواحدة محدودة بنحو ١٢–١٤ حرفًا (أقل مع المسافات) بسبب حدود المتصفح. لا يلتقط البحث الذي لا يحمّل صفحة جديدة.', 'Matched inside the search parameter only (q, p, search_query or text) on Google, Bing, DuckDuckGo, Yahoo, YouTube, Yandex, Brave, Ecosia and Qwant, with + or %20 spaces, case-insensitive. Arabic diacritics and tatweel are removed from your phrase; alef/ya variants are not unified. A single Arabic phrase is limited to about 12–14 letters (fewer with spaces) by browser limits. Searches that do not load a new page are not caught.', 'Es wird nur im Suchparameter (q, p, search_query oder text) von Google, Bing, DuckDuckGo, Yahoo, YouTube, Yandex, Brave, Ecosia und Qwant geprüft, mit + oder %20 als Leerzeichen, ohne Beachtung der Groß-/Kleinschreibung. Arabische Diakritika und Tatwil werden entfernt; Alef-/Ya-Varianten werden nicht vereinheitlicht. Ein einzelner arabischer Begriff ist durch Browser-Grenzen auf etwa 12–14 Buchstaben begrenzt (weniger mit Leerzeichen). Suchen ohne neues Laden der Seite werden nicht erfasst.')
add('opt_save', 'حفظ التغييرات', 'Save changes', 'Änderungen speichern')
add('opt_saved', 'تم الحفظ وتثبيت القواعد. جرّب الاختبار الآمن.', 'Saved and rules installed. Try the safe test.', 'Gespeichert und Regeln installiert. Mache den sicheren Test.')
add('opt_session_title', 'أحتاج حدودًا أقوى الآن', 'I need stronger limits right now', 'Ich brauche jetzt stärkere Grenzen')
add('opt_session_body', 'جلسة الالتزام تمنع من داخل الإضافة كل ما يخفّف الحماية: حذف قاعدة، إيقاف القائمة الأساسية، إضافة استثناء، استيراد إعدادات أضعف، أو إعادة الضبط. يمكنك فقط إضافة حماية أقوى. تنتهي في موعدها وتسمح بالتعديل فقط، ولا تزيل أي حجب. تغيير ساعة الجهاز يغيّر موعد الانتهاء، ويمكن حذف الإضافة أو تعطيلها من المتصفح.', 'A commitment session blocks, from inside the extension, everything that weakens protection: deleting a rule, turning off the built-in list, adding an exception, importing weaker settings, or resetting. You can only add stronger protection. It ends on time and then only allows editing; it removes no blocking. Changing the device clock changes the end time, and the extension can still be removed or disabled in the browser.', 'Eine Selbstverpflichtung verhindert innerhalb der Erweiterung alles, was den Schutz schwächt: Regel löschen, integrierte Liste ausschalten, Ausnahme hinzufügen, schwächere Einstellungen importieren oder zurücksetzen. Du kannst nur stärkeren Schutz hinzufügen. Sie endet pünktlich und erlaubt dann nur das Bearbeiten; sie entfernt keine Sperre. Eine Änderung der Geräteuhr verschiebt das Ende, und die Erweiterung kann im Browser weiterhin entfernt oder deaktiviert werden.')
add('opt_session_start', '{1} دقيقة', '{1} minutes', '{1} Minuten')
add('opt_session_confirm', 'بدء جلسة التزام لمدة {1} دقيقة؟ لن تستطيع حذف القواعد أو إيقاف القائمة أو إضافة استثناءات حتى تنتهي.', 'Start a {1}-minute commitment session? You will not be able to delete rules, turn off the list or add exceptions until it ends.', 'Eine Selbstverpflichtung von {1} Minuten starten? Bis zum Ende kannst du keine Regeln löschen, die Liste ausschalten oder Ausnahmen hinzufügen.')
add('opt_session_started', 'بدأت جلسة الالتزام.', 'Commitment session started.', 'Selbstverpflichtung gestartet.')
add('opt_backup_title', 'نسخة احتياطية', 'Backup', 'Sicherung')
add('opt_backup_body', 'التصدير يحفظ إعداداتك (مواقعك وعباراتك واستثناءاتك) في ملف على جهازك. الملف غير مشفّر، فاحفظه بحذر. الاستيراد يدمج الملف مع إعداداتك ولا يضعف الحماية، ولا يُقبل أثناء جلسة الالتزام إن تضمّن استثناءات جديدة.', 'Export saves your settings (sites, phrases, exceptions) to a file on your device. The file is not encrypted, so keep it carefully. Import merges the file with your settings and never weakens protection; it is refused during a commitment session if it adds exceptions.', 'Der Export speichert deine Einstellungen (Websites, Begriffe, Ausnahmen) in einer Datei auf deinem Gerät. Die Datei ist nicht verschlüsselt, bewahre sie sorgfältig auf. Der Import führt die Datei mit deinen Einstellungen zusammen und schwächt den Schutz nie; während einer Selbstverpflichtung wird er abgelehnt, wenn er Ausnahmen hinzufügt.')
add('opt_export', 'تصدير الإعدادات', 'Export settings', 'Einstellungen exportieren')
add('opt_import', 'استيراد إعدادات', 'Import settings', 'Einstellungen importieren')
add('opt_export_hint', 'ملف التصدير يضم المواقع والعبارات التي اخترتها بنص عادي غير مشفّر. احتفظ به لنفسك.', 'The export file lists the sites and phrases you chose as plain, unencrypted text. Keep it private.', 'Die Exportdatei enthält die gewählten Websites und Begriffe als unverschlüsselten Klartext. Bewahre sie privat auf.')
add('opt_imported', 'تم دمج الإعدادات المستوردة.', 'Imported settings were merged.', 'Importierte Einstellungen wurden zusammengeführt.')
add('opt_reset_title', 'مسح كل القواعد', 'Clear all rules', 'Alle Regeln löschen')
add('opt_reset', 'مسح كل القواعد', 'Clear all rules', 'Alle Regeln löschen')
add('opt_reset_confirm', 'سيُحذف كل شيء ويتوقف الحجب. هل أنت متأكد؟', 'This removes everything and stops blocking. Are you sure?', 'Dadurch wird alles gelöscht und das Blockieren beendet. Bist du sicher?')
add('opt_reset_done', 'تم مسح كل القواعد.', 'All rules were cleared.', 'Alle Regeln wurden gelöscht.')
add('opt_privacy_title', 'الخصوصية والحدود', 'Privacy and limits', 'Datenschutz und Grenzen')
add('opt_privacy_body', 'لا حسابات ولا تحليلات ولا سجل تصفح ولا إرسال بيانات لأي خادم أو شخص. تُحفظ إعداداتك محليًا في هذا المتصفح وقد تكون غير مشفّرة. لا نحفظ محاولات الحجب أو كلمات بحثك.', 'No accounts, no analytics, no browsing history, nothing sent to any server or person. Your settings are stored locally in this browser and may be unencrypted. We do not store block attempts or your search words.', 'Keine Konten, keine Analysen, kein Verlauf, nichts wird an Server oder Personen gesendet. Deine Einstellungen werden lokal in diesem Browser gespeichert und sind möglicherweise unverschlüsselt. Wir speichern weder Blockier-Versuche noch deine Suchbegriffe.')
add('opt_limits_body', 'تُحجب الصفحات الرئيسية فقط (لا الإطارات المضمّنة ولا الصور). لا تعمل الإضافة في متصفحات أو ملفات محلية أخرى. يمكن حذفها أو تعطيلها، والتصفح الخفي يحتاج تفعيلًا يدويًا. لا تقرأ الشاشة ولا الصور ولا محتوى الصفحات.', 'Only top-level pages are blocked (not embedded frames or images). It does not work in other browsers or on local files. It can be removed or disabled, and private browsing must be enabled manually. It does not read the screen, images or page content.', 'Nur Hauptseiten werden blockiert (keine eingebetteten Frames oder Bilder). Sie wirkt nicht in anderen Browsern oder bei lokalen Dateien. Sie kann entfernt oder deaktiviert werden, privates Surfen muss manuell erlaubt werden. Sie liest weder Bildschirm noch Bilder noch Seiteninhalte.')

# ---- errors (never contain user text) ----
E = {
 'domain_invalid': ('الموقع غير صالح.', 'This site name is not valid.', 'Dieser Website-Name ist ungültig.'),
 'domain_empty': ('سطر فارغ.', 'Empty line.', 'Leere Zeile.'),
 'domain_wildcard_or_space': ('اكتب نطاقًا بلا مسافات أو نجمة.', 'Enter a domain without spaces or asterisks.', 'Gib eine Domain ohne Leerzeichen oder Sternchen ein.'),
 'domain_has_path': ('اكتب اسم الموقع فقط، دون مسار أو منفذ أو بيانات دخول.', 'Enter the site name only, without a path, port or credentials.', 'Gib nur den Website-Namen ein, ohne Pfad, Port oder Zugangsdaten.'),
 'domain_is_ip': ('عناوين IP غير مدعومة.', 'IP addresses are not supported.', 'IP-Adressen werden nicht unterstützt.'),
 'domain_is_shared_suffix': ('هذا النطاق يضم مواقع كثيرة لا علاقة بينها؛ أدخل الموقع المحدد.', 'This domain hosts many unrelated sites; enter the specific site.', 'Diese Domain beherbergt viele unabhängige Websites; gib die konkrete Website ein.'),
 'allow_invalid': ('استثناء غير صالح.', 'This exception is not valid.', 'Diese Ausnahme ist ungültig.'),
 'too_many_domains': ('تجاوزت الحد الأقصى للمواقع ({1}).', 'Too many sites (maximum {1}).', 'Zu viele Websites (maximal {1}).'),
 'too_many_phrases': ('تجاوزت الحد الأقصى للعبارات ({1}).', 'Too many phrases (maximum {1}).', 'Zu viele Begriffe (maximal {1}).'),
 'phrase_invalid': ('عبارة غير صالحة.', 'This phrase is not valid.', 'Dieser Begriff ist ungültig.'),
 'phrase_length': ('كل عبارة بين {1} و{2} حرفًا.', 'Each phrase must be {1}–{2} characters.', 'Jeder Begriff muss {1}–{2} Zeichen lang sein.'),
 'phrase_control_chars': ('العبارة تحوي رموز تحكم.', 'The phrase contains control characters.', 'Der Begriff enthält Steuerzeichen.'),
 'phrase_no_letters': ('العبارة يجب أن تحوي حرفين أو رقمين على الأقل.', 'The phrase needs at least two letters or digits.', 'Der Begriff braucht mindestens zwei Buchstaben oder Ziffern.'),
 'phrase_too_complex': ('هذه العبارة أطول مما يسمح به المتصفح لقاعدة واحدة. قصّرها (العربية ≈ ١٢–١٤ حرفًا).', 'This phrase is longer than the browser allows for one rule. Shorten it (Arabic ≈ 12–14 letters).', 'Dieser Begriff ist länger, als der Browser für eine Regel erlaubt. Kürze ihn (Arabisch ≈ 12–14 Buchstaben).'),
 'conflict_domain_allow': ('أحد المواقع المحجوبة يقع ضمن استثناء. أزل التعارض.', 'A blocked site falls under an exception. Remove the conflict.', 'Eine blockierte Website fällt unter eine Ausnahme. Löse den Konflikt auf.'),
 'allow_search_engine': ('لا يمكن استثناء محرك بحث.', 'A search engine cannot be excepted.', 'Eine Suchmaschine kann nicht ausgenommen werden.'),
 'config_invalid': ('الإعدادات غير صالحة.', 'The settings are not valid.', 'Die Einstellungen sind ungültig.'),
 'config_corrupt': ('الإعدادات المحفوظة تالفة. يمكنك مسحها من الإعدادات (غير متاح أثناء جلسة التزام).', 'The saved settings are damaged. You can clear them in Settings (not possible during a commitment session).', 'Die gespeicherten Einstellungen sind beschädigt. Du kannst sie in den Einstellungen löschen (während einer Selbstverpflichtung nicht möglich).'),
 'import_invalid': ('الملف ليس نسخة تبصرة صالحة.', 'The file is not a valid Tabsira export.', 'Die Datei ist kein gültiger Tabsira-Export.'),
 'import_version': ('إصدار الملف غير مدعوم.', 'The file version is not supported.', 'Die Dateiversion wird nicht unterstützt.'),
 'import_too_large': ('الملف كبير جدًا.', 'The file is too large.', 'Die Datei ist zu groß.'),
 'locked_weakening': ('جلسة الالتزام نشطة: هذا التغيير يخفّف الحماية فلا يُسمح به الآن. يمكنك إضافة حماية أقوى فقط.', 'A commitment session is active: this change would weaken protection, so it is not allowed now. You can only add stronger protection.', 'Eine Selbstverpflichtung ist aktiv: Diese Änderung würde den Schutz schwächen und ist jetzt nicht erlaubt. Du kannst nur stärkeren Schutz hinzufügen.'),
 'stale': ('تغيّرت الإعدادات من نافذة أخرى. أُعيد تحميلها؛ راجع ثم احفظ مجددًا.', 'Settings changed from another window. They were reloaded; review and save again.', 'Die Einstellungen wurden in einem anderen Fenster geändert. Sie wurden neu geladen; prüfe und speichere erneut.'),
 'apply_failed': ('تعذّر تثبيت التغيير، وأُعيدت الحالة السابقة. حاول مجددًا.', 'The change could not be applied and the previous state was restored. Try again.', 'Die Änderung konnte nicht angewendet werden, der vorherige Zustand wurde wiederhergestellt. Versuche es erneut.'),
 'apply_failed_rollback_failed': ('تعذّر تثبيت التغيير وتعذّرت استعادة الحالة السابقة بالكامل. اضغط «إصلاح» للتحقق.', 'The change failed and the previous state could not be fully restored. Press “Repair” to check.', 'Die Änderung ist fehlgeschlagen und der vorherige Zustand konnte nicht vollständig wiederhergestellt werden. Drücke „Reparieren“ zur Prüfung.'),
 'storage_unavailable': ('تعذّر الوصول إلى التخزين المحلي.', 'Local storage is not available.', 'Lokaler Speicher ist nicht verfügbar.'),
 'session_needs_rules': ('أضف مواقع أو عبارات أو فعّل القائمة الأساسية قبل بدء الجلسة.', 'Add sites or phrases, or turn on the built-in list, before starting a session.', 'Füge Websites oder Begriffe hinzu oder aktiviere die integrierte Liste, bevor du eine Sitzung startest.'),
 'session_needs_active_protection': ('لا تبدأ الجلسة قبل أن تصبح الحالة «القواعد مثبتة». أصلح المشكلة الظاهرة أولًا.', 'A session can only start when the status is “rules installed”. Fix the shown problem first.', 'Eine Sitzung kann nur starten, wenn der Status „Regeln installiert“ ist. Behebe zuerst das angezeigte Problem.'),
 'already_onboarded': ('تم الإعداد الأولي من قبل.', 'First-time setup was already completed.', 'Die Ersteinrichtung wurde bereits abgeschlossen.'),
 'busy': ('الإضافة تعالج طلبًا آخر الآن (ربما من نافذة أخرى). أعد المحاولة بعد لحظات.', 'The extension is busy with another request (possibly from another window). Try again in a moment.', 'Die Erweiterung bearbeitet gerade eine andere Anfrage (evtl. aus einem anderen Fenster). Versuche es gleich noch einmal.'),
 'bad_request': ('طلب غير صالح.', 'Invalid request.', 'Ungültige Anfrage.'),
 'unexpected': ('حدث خطأ غير متوقع. أعد المحاولة.', 'An unexpected error occurred. Try again.', 'Ein unerwarteter Fehler ist aufgetreten. Versuche es erneut.'),
 'worker_unreachable': ('تعذّر الاتصال بخلفية الإضافة. أعد المحاولة.', 'Could not reach the extension’s background. Try again.', 'Der Hintergrunddienst der Erweiterung ist nicht erreichbar. Versuche es erneut.'),
}
for code, (ar, en, de) in E.items(): add(f'err_{code}', ar, en, de)
add('err_line', ' (السطر {1})', ' (line {1})', ' (Zeile {1})')

def build(lang):
    out = {}
    for key, texts in M.items():
        text = texts[lang]
        params = sorted(set(re.findall(r'\{(\d)\}', text)))
        entry = {'message': re.sub(r'\{(\d)\}', lambda m: f'$P{m.group(1)}$', text)}
        if params:
            entry['placeholders'] = {f'p{n}': {'content': f'${n}'} for n in params}
        out[key] = entry
    return out

root = pathlib.Path(__file__).resolve().parent.parent / 'src' / '_locales'
for lang in ('ar', 'en', 'de'):
    path = root / lang
    path.mkdir(parents=True, exist_ok=True)
    (path / 'messages.json').write_text(json.dumps(build(lang), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(len(M), 'messages x 3 locales')
