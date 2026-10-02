# Chrome personal prototype v0 — bounded task record

Date: 2026-10-02. Owner instruction: create a Tabsira Chrome extension alongside Project 04. Desktop Chrome is the declared initial target; actual target-device acceptance is pending. This record does not contain private motivations or history.

Scope: a separate `chrome-extension/` folder, Manifest V3, user-supplied domain and search-URL rules, local stop/help pages, local settings and commitment friction. Read no screen/page content and store no browsing activity. No Android modifications, server, accounts, telemetry, remote rule feeds, clinical claims or store release.

Implementation choices are proposed in this review branch: DNR redirects with HTTP/HTTPS host permission, storage.local settings, Arabic prototype UI, 60/90/120-minute editing friction, and a 60-second supportive pause. They require human code/permission review before merge or public distribution. The current request authorizes a reviewable prototype, not a rewrite of existing Android gates.

Acceptance: input validation, domain-boundary matching, narrow search-parameter matching, no weakening during commitment, truthful empty/error status, persistent rules, no sensitive logs. Nine pure/worker-mock tests passed. Native Chrome DNR, visual and incognito acceptance remain pending because a browser could not be installed in the execution environment. See `../chrome-extension/README.md` for exact checks and limits.

No discovery decision, DNS PASS, architecture production approval, Android protection claim, release or efficacy claim is inferred from this prototype.
