# Prayer review follow-up (12 and 13)

## 12 — Explicit supported scope and delivery limits

The existing engine supports four angular methods: MWL, ISNA, Egypt and Karachi, with standard/Hanafi Asr and a manual minute adjustment. Umm al-Qura's interval-based Isha method is **unsupported**. No high-latitude replacement rule is implemented; events without a crossing are `null`, shown as — with the unavailable prayer names, and never get an alarm. A blanket minute adjustment is not equivalent to an interval-based or high-latitude method.

The AR/EN/DE opt-in UI now states these limits before the enable button. It also states that the browser must be running, reminders can be delayed by sleep/OS notification settings, and reminders more than five minutes late are skipped. There is no external/native scheduler to notify with the browser fully closed. These are scope limitations, not newly added method or delivery support. Supporting Umm al-Qura or high-latitude substitutions needs a separately agreed prayer convention and validation; owner review remains open if either is a release requirement.

Local tests cover the explicit method set, rejection of unknown methods/substitution fields, unavailable Fajr/Isha in Berlin on the summer solstice, no alarm for those unavailable events, and the visibility/order of the limitations in all three languages. Browser/OS delivery remains unverified by these tests.

## 13 — Offline primary-source solar fixture

Replaced the rolling NWS bulletin reference with an unmodified, committed USNO API response for fixed coordinates/date/UTC offset. The response, retrieval date, parameter documentation and SHA-256 are in `tests/fixtures/prayer/README.md`. The test reads the frozen response offline, checks its date/offset, and compares its 18:52 (22:52 UTC) sunset with the production estimate. No runtime network or geolocation has been introduced.

Verification: `node --test tests/unit/prayer.test.mjs` — 17 passed. These are unit/controller/DOM-fixture tests, not a real-browser or OS-delivery run.
