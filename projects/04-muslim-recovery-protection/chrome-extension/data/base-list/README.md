# Built-in adult-sites list — source evaluation and provenance

**Decision status:** proposed by the engineer, **needs Owner/legal confirmation** (see "Open questions").

## What is shipped

A single snapshot of **The Block List Project — `porn.txt`** (hosts format), normalized to one domain per line
(`adult-domains.txt.gz`, 936,979 domains). At build time it becomes one static declarativeNetRequest ruleset
(`rulesets/base_adult.json`): one redirect rule whose `requestDomains` holds the whole list (a list counts as **one**
rule, so it is far below the 330,000-rule global limit; measured on real Chromium, see `TESTING.md`).
The extension never fetches lists remotely; the list changes only when a new extension version is released.

## Why this source

| Criterion | Finding |
|---|---|
| Redistributable | Repository `LICENSE` is **The Unlicense** (public-domain dedication; copy in `LICENSE-blocklistproject.txt`). The file header of `porn.txt` says `# License: MIT`. Both permit redistribution; the discrepancy is recorded rather than ignored. |
| Compatible with an open-source project | Yes for both licences. No copyleft/share-alike obligation. (Rejected alternative: UT1/Toulouse blacklist is CC BY-SA — share-alike would constrain the project.) |
| Freshness | Upstream header: last modified 2026-07-18; retrieved 2026-10-02. |
| Provenance | Community-maintained; upstream README says it syncs 14 upstream lists and runs automated dead-domain scans. **Upstream commit not pinned** (GitHub API for that repository was not reachable in the build session); the file is identified by SHA-256 in `PROVENANCE.json`. |
| Format | Plain hostnames — no scripts or code; trivially validated. |
| Classification quality | **Automated and unverified.** A 60-name random sample (names only; no listed site was visited) contained at least one name that looks like a non-adult site (a religious-studies-sounding domain), i.e. false positives exist. This is why Exceptions exist, why the list is opt-in at onboarding, and why the stop page links to the Exceptions workflow. |
| Not scraped | Only the published list file was downloaded. No listed domain was ever contacted. Tests use reserved `.test` names and DNR `testMatchOutcome` (which never makes a request). |

## Processing (`scripts/update-base-list.mjs`)

lowercase → keep only valid hostnames (196 entries dropped) → drop entries already covered by a listed parent
(16,218) → sort → **refuse to write if any of 140 known-benign canary sites** (`known-benign-canaries.txt`) is covered.
Result: 936,979 domains; SHA-256 of the normalized text is recorded and re-checked on every build.

## Open questions for the Owner

1. Is the "Unlicense (repository) + MIT (file header)" position acceptable, and do you want a legal check of the
   **14 upstream lists** the project aggregates (their individual licences are not independently verified)?
2. Repository size: the snapshot is 4.8 MB gzip (≈ 20 MB text). Keep it in git, or store it as a release asset and
   fetch it at build time (build would then need network and a pinned hash)?
3. Do you accept an opt-in list with known false positives, or want a smaller curated subset?
4. Pin an upstream commit at the next refresh (needs GitHub access to the upstream repository).

## Update

See `../../UPDATING.md`.
