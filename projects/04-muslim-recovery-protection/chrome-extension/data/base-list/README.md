# Built-in adult-sites list — sources, licences and composition

**Status:** Owner decision (2026-10-02): keep the current list, but verify source/licence/notices, pin versions, replace what
cannot be documented, keep the compressed snapshot in the repository, add other lists only if they prove extra coverage,
no remote updates, no browsing data sent. This file records what was done. Residual legal risk is listed at the end.

## What is shipped

`adult-domains.txt.gz` — a gzip of **714,093** sorted domain names, one per line (SHA-256 of the normalised text:
`ebeda727…ff44`, re-checked on every build). At build time it becomes one static declarativeNetRequest ruleset
(`rulesets/base_adult.json`): a single redirect rule whose `requestDomains` holds the whole list (a list counts as **one** rule;
measured in real browsers, see `TESTING.md`). The extension never fetches a list; the list changes only with a new extension version.
The package also contains `THIRD_PARTY_NOTICES.txt` (this directory's `THIRD_PARTY_NOTICES.md`) with the full licence texts.

## Which of the "14 upstream sources" feed the adult list

The Block List Project (BLP) states that it syncs 14 upstream lists across 8 categories. Its own `config/lists.yml` shows that the
**`porn` category has exactly three upstream sources** (the other eleven feed other categories and play no part here):

| Upstream feeding BLP `porn` | Licence (verified from the upstream `LICENSE` file) | Used here |
|---|---|---|
| ShadowWhisperer BlockLists — `Lists/Adult` (222,623 domains) | The Unlicense | **Yes — included in full** (4,262 domains that BLP does not list were added) |
| HaGeZi `dns-blocklists` — `nsfw` (83,972 domains) | **GNU GPL-3.0** (copyleft) | **No** — used only to *trace*; entries that exist only there were removed |
| zachlagden `Pi-hole-Optimized-Blocklists` — `nsfw` (555,840 domains) | **none found** (no licence file) | **No** — used only to *trace*; entries that exist only there were removed |

Additional lists examined: Sinfonietta `pornography-hosts` (MIT, LICENSE verified, 61,154 domains) — used for attribution of
entries BLP also lists, its 33,778 *Sinfonietta-only* entries were **not** added (no evidence that they are current, and no
measured gain); Clefspeare13 `pornhosts` (header says MIT, the upstream licence file could not be retrieved; reachable only through
a StevenBlack copy dated 2021) — trace only.

## Composition rule (implemented in `scripts/update-base-list.mjs`)

| Rule | Entries (2026-10-02 inputs) |
|---|---|
| KEEP every ShadowWhisperer Adult entry (Unlicense) | all, incl. 4,262 not in BLP |
| KEEP BLP entries that ShadowWhisperer or Sinfonietta also list (both permissive) | 226,345 |
| KEEP BLP entries that **none of the sources we examined lists** ("unattributed": their origin is **unknown**) | 492,511 |
| **DROP** BLP entries traceable only to HaGeZi (GPL-3.0), zachlagden (no licence) or Clefspeare13 (unverifiable) | **234,341 removed** |
| Remove entries covered by a listed parent domain | 9,025 |

The previous snapshot had 936,979 entries; about a quarter of that could not be documented and was removed. Result: 714,093.
Before writing, the script refuses to proceed if any of the 140 known-benign canary sites (`known-benign-canaries.txt`) is covered.

## Pinned inputs (`PROVENANCE.json`)

Every input is identified by exact bytes (SHA-256), byte size, URL, retrieval date (2026-10-02) and the header lines the file carries
(for example `Last modified: 2026-07-18` for BLP, `Updated: 9/24/2026` for ShadowWhisperer). **Git commit hashes could not be pinned**:
`api.github.com` and `github.com` were not reachable from the build environment, only `raw.githubusercontent.com`. The inputs
themselves are not committed (`.base-list-inputs/` is git-ignored); re-download with `scripts/fetch-base-list-sources.mjs` and compare the hashes.
`provenance-samples.json` lists name-only samples used by the real-browser tests (domains removed for unclear licence must **not** match;
ShadowWhisperer-only domains must match). No listed domain was ever contacted; tests use `testMatchOutcome`, which sends nothing.

## Licences and notices

`licenses/` holds the verbatim licence files of the three sources that contribute; `THIRD_PARTY_NOTICES.md` is copied into the
package as `THIRD_PARTY_NOTICES.txt` and linked from the settings page. HaGeZi (GPL-3.0), zachlagden and Clefspeare13 are named there
as examined-and-excluded, so nobody reads the notice as a licence grant for them.

## Quality

Classification is automated and community-made: **false positives exist** (an earlier 60-name sample contained a name that looked
non-adult). This is why Exceptions exist, why the list is opt-in, and why the stop page points to the Exceptions workflow.
No additional list was added: none was shown to add coverage that survives de-duplication, the false-positive canary check and the
performance measurement. Adding one later needs that evidence plus a licence check.

## Residual risk — Owner/legal decision

1. **The 492,511 unattributed entries.** They appear in the Block List Project file and in none of the six sources we examined. **That does not show
   they are the BLP maintainers' original work** — they may come from a source we did not examine, or from an earlier version of one we did. We could
   not determine their origin. The only licence basis we have for them is the BLP repository's own Unlicense declaration (its file header says MIT);
   we cannot verify that every contributor could license every entry. This is a documented, unresolved risk, not a verified licence.
   *Strict alternative:* keep only ShadowWhisperer ∪ Sinfonietta (every entry attributable to a verified permissive licence). That list has fewer
   entries (≈ 276 k), but **the difference in entry count is not a measure of the difference in protection**: we did not measure coverage of real
   adult sites, and overlap, staleness and duplicate/parent-domain structure make counts a poor proxy. If you want the strict list, the change is
   one rule in `scripts/update-base-list.mjs` plus a re-run of the tests; measuring coverage first would need a reviewed, labelled sample.
2. **Pinned commits:** hashes and dates identify the inputs; commit hashes need GitHub access at the next refresh.
3. **Repository size:** the snapshot is 3.7 MB gzip (was 4.8 MB), kept in git as decided.

## Update

See `../../UPDATING.md`.
