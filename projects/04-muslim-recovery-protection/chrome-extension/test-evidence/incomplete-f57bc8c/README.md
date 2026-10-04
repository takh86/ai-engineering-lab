# INCOMPLETE runs — not PASS evidence

Full real-browser runs of `tests/e2e/run.mjs` on the package built from commit `f57bc8c` (`tabsira-chromium-1.0.1.zip`, SHA-256
`673276c4c883cb21ca6493d8c120fb56705fede8da29c4eb7cca23e05955ce04`), Linux x64, Chromium 141.0.7390.37, Chrome for Testing 154.0.8037.97, Edge 154.0.4258.53.

All three runs **crashed** in section S16c (the suite threw `TypeError: globalThis.__gate.release is not a function`) before writing a summary, so no
evidence JSON exists for them and they are **not** PASS. Cause: a test premise, not a product failure — S16c froze the cleanup of an *expired* session entry,
and 1.0.1 intentionally no longer deletes the newest session entry, so the cleanup it waited for never happened. S16c was rewritten for the new design.
Additionally R1.8 failed on Chrome for Testing and Edge because the test required the YouTube test page to load (Chromium-family browsers reset http
connections to youtube.com in this setup); the check was corrected to assert only "not redirected".
The logs list every check that ran before the crash; they are kept for transparency only.
