// Conservative starter search terms, matched as whole words only. They are deliberately explicit,
// adult-content-seeking terms. Words that people also use when looking for recovery help or health
// information (for example "porn addiction" or "sexual health") are NOT included, so the extension
// does not block someone's search for help. Owner review of this list is required before release.
// Every entry must be accepted by the browser's regex engine; tests/e2e verifies that in a real browser.
export const STARTER_TERMS = Object.freeze([
    'hentai', 'xvideos', 'xnxx', 'pornhub', 'redtube',
    'free porn', 'porn videos', 'porn movies', 'sex videos', 'sex tube',
    'nude videos', 'naked girls', 'onlyfans leaks', 'erotic videos',
    'سكس', 'بورن', 'افلام سكس', 'افلام اباحية', 'افلام اباحيه', 'افلام جنسية',
    'مقاطع جنسية', 'صور عارية', 'قصص جنسية', 'سكس مترجم', 'سكس عربي'
]);
