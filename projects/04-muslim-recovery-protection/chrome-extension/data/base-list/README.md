# Built-in adult-sites list — sources, licences and composition

**Owner decision (2026-10-02, final):** use only sources that carry an **explicit licence allowing use, modification and redistribution inside the
extension, commercial use included**, and comply with their conditions. Being available on the internet is not permission, and the licence of a
collecting project is not proof of the rights of the sources it collected from. Anything whose permission cannot be shown is excluded.
Earlier versions of this file described a larger composite list; that list and its reasoning are gone.

## What is shipped

`adult-domains.txt.gz` — a gzip of **242,750** sorted domain names, one per line (SHA-256 of the normalised text in `PROVENANCE.json`, re-checked on every
build). At build time it becomes one static declarativeNetRequest ruleset (`rulesets/base_adult.json`): a single redirect rule whose `requestDomains`
holds the whole list (a list counts as **one** rule; measured in real browsers, see `TESTING.md`). The extension never fetches a list; the list changes
only with a new extension version. The package contains `THIRD_PARTY_NOTICES.txt` with both licence texts and the required notices.

## Sources (exactly two) — pinned

| | ShadowWhisperer BlockLists | Sinfonietta hostfiles |
|---|---|---|
| File used | `Lists/Adult` | `pornography-hosts` |
| Repository | https://github.com/ShadowWhisperer/BlockLists | https://github.com/Sinfonietta/hostfiles |
| Pinned commit | `1404d49b73d3c986da869b33c03a9e617437e0df` (2026-10-01) | `46f3097d7bcfc9eea323fe365074dfd771d0d17c` (2026-09-08) |
| File git blob / SHA-256 | `fbbf471b33009efa2d812730032a89a85ccbfba9` / `de136908…70b3d7` | `198ab532a3bd3f3114c4dc36483cfa33b6425fb5` / `d5c31a7e…7fa1d` |
| Licence | **The Unlicense** (root `LICENSE`, blob `fdddb29aa445…`, SHA-256 `6b0382b1…ad17e`) | **MIT**, Copyright (c) 2016 Sinfonietta (root `LICENSE`, blob `514145afc303…`, SHA-256 `b32ce488…e1ae`) |
| Entries (valid host names) | 222,623 | 61,154 (19,392 are also in the first file) |
| Condition | none (public-domain dedication); notice shipped anyway | **copyright and permission notice must accompany copies or substantial portions** — shipped in `THIRD_PARTY_NOTICES.txt` |
| Permalink of the file | `https://raw.githubusercontent.com/ShadowWhisperer/BlockLists/1404d49b73d3c986da869b33c03a9e617437e0df/Lists/Adult` | `https://raw.githubusercontent.com/Sinfonietta/hostfiles/46f3097d7bcfc9eea323fe365074dfd771d0d17c/pornography-hosts` |

Full pins, header lines, entry counts and permalinks: `PROVENANCE.json`. Licence texts: `licenses/` (byte-identical to the licence at the pinned commit — checked by
`scripts/fetch-base-list-sources.mjs`, which refuses to continue on any mismatch of commit permalink, git blob id, SHA-256 or licence text, and by a unit test).
**Upstream may rewrite history** (ShadowWhisperer says it occasionally compresses its repository), so a permalink can stop resolving; the hashes and the committed
snapshot remain the evidence.

## Does the licence cover the files actually used? What we verified — and what we could not

Verified for **both** files: each sits in a repository with **one root `LICENSE`** and no other licence file; there is no file-level or directory-level exception;
the files carry no header or comment that restricts use (Sinfonietta's file has no comment lines at all); each README adds no terms. Both licences allow use,
modification, redistribution and commercial use; the MIT condition (notice) is met by the shipped notices.

- **ShadowWhisperer / Unlicense.** The README states that the lists are made from a custom script and manual additions, that the maintainer does not merge other lists, and
  that contributions arrive as issues. The Unlicense text speaks of "software"; we treat the list file, which is part of the licensed repository, as covered — **a legal
  interpretation, not a separate grant.** The inputs of the maintainer's script are not stated.
- **Sinfonietta / MIT.** The file has **49 contributing authors** (pull requests). Contributions made on GitHub to a repository that carries a licence are licensed under that
  licence (GitHub Terms of Service, section D.6). The project describes the files only as a "collection" and does not document where entries came from; the history
  shows some entries added from issues in the MIT-licensed StevenBlack/hosts project. **We have not verified, and cannot verify, the origin of each entry.**

This is the extent of what can be shown from public material. If counsel decides that the unstated origin of Sinfonietta's entries is not acceptable, the fallback is
ShadowWhisperer alone (222,623 entries before parent-domain removal): one line in `scripts/update-base-list.mjs`.

## Composition (implemented in `scripts/update-base-list.mjs`)

union of the two files → lowercase, valid host names only → drop entries covered by a listed parent domain (21,635) → sort →
refuse to write if any of the 140 known-benign canary sites (`known-benign-canaries.txt`) is covered.

| | Count |
|---|---|
| ShadowWhisperer only | 203,231 |
| Sinfonietta only | 41,762 |
| In both | 19,392 |
| Union | 264,385 |
| Covered by a listed parent (removed) | 21,635 |
| **Shipped** | **242,750** |

## Examined and excluded

| Source | Why it is not used |
|---|---|
| The Block List Project `porn.txt` (previously the main source) | A collecting project: its licence alone does not prove the rights of the sources it collected from. **492,511 of its entries could not be attributed to any examined source**, and the absence from the other sources does not show they are its original work. Removed entirely. |
| HaGeZi `dns-blocklists` `nsfw` | GNU GPL-3.0 (copyleft). |
| zachlagden `Pi-hole-Optimized-Blocklists` `nsfw` | No licence file. |
| Clefspeare13 `pornhosts` | Licence not verifiable from the upstream repository. |

The previous snapshot (714,093 domains, composite) had 483,988 entries that this rule removes. **The drop in the number of entries is not a measurement of the drop in
protection:** nobody measured coverage of real adult sites, and overlap, staleness and parent-domain structure make counts a poor proxy. Sinfonietta's most recent
change was 2026-09-08 and ShadowWhisperer's 2026-10-01; neither is guaranteed current.

## Quality

Classification is automated and community-made: **false positives exist** (an earlier sample contained a name that looked non-adult). That is why Exceptions exist, why the
list is opt-in, and why the stop page points to the Exceptions workflow. The 140-site canary check and the real-browser tests (blocking, subdomains, look-alikes, exceptions,
canaries, membership samples for each source, names removed from the previous snapshot) run against the built package; no listed domain is ever requested
(`testMatchOutcome` sends nothing). No additional list was added; adding one later needs a verified explicit licence and the evidence in `../../UPDATING.md`.

## Update

See `../../UPDATING.md`.
