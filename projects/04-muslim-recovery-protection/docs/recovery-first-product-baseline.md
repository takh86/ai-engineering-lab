# Recovery-first product baseline

> **Decision state:** The Owner approved this direction in the project conversation on
> 2026-09-27 ("I'm very happy with the conclusion … this will be our work from now on").
> **The GitHub decision record is pending on this PR.** Items marked **OD** are open Owner
> decisions (§12); this document does not approve them.
>
> **What this changes:** the product thesis, the layer structure, the feature boundaries and the
> order of work: discovery before build, and the recovery core before protection layers.
>
> **What it does not change:** H4–H12 ([M2-01](m2-01-approved-threat-model.md)), the
> [M2-02 baseline](m2-02-architecture-options.md), A8's AC/RJ criteria, the frozen V0–V13
> runbook (PR #59), AB1–AB7 ([PR #60](app-blocking-architecture-decision.md), pending), D1–D13,
> or any Android code. It approves no production architecture, permission, DNS provider,
> backend or release claim.

## 1. Why this baseline exists

A market and competitor evaluation (2026-09-26) and a design and red-team session (2026-09-27)
reached five conclusions. Sources are in §13.

1. **Filtering is a free commodity.** At least six providers offer free family DNS that a user
   can set in Android Private DNS without any app [Vendor docs]. Kahf Guard adds an Islamic brand
   and a free core [Vendor claim]. A8 is what a user can configure alone in about a minute
   [Inference].
2. **Muslim recovery apps are crowded,** and many are free or charity-funded [Vendor claims].
   The reference price in this segment is close to zero.
3. **No competitor has published efficacy evidence, and retention is the main risk.** A review
   of apps for problematic pornography use found no published effectiveness evidence [Study]. The
   median 30-day retention of mental-health apps is 3.3% [Study]. Only 4–10% of people with
   problematic use sought treatment, while 21–37% wanted to and did not [Study], so the need for
   private, affordable self-help is real. That is not evidence of willingness to pay.
4. **The weakest link in the M2 design was the urge moment.** A8 cannot see a block, so help
   depended on the user opening the app at the worst moment (recovery brief §2). Automatic
   interruption at app launch has the strongest external evidence among self-directed friction
   tools, although in an adjacent domain [Study]. PR #60 adds it as a bounded candidate.
5. **Differentiation is trust, not technology.** Honest status, privacy by architecture,
   non-shaming design and language fit are hard to copy culturally and organizationally, not
   technically. Users have not yet shown that they value them.

The design therefore treats **the urge moment, not the filter, as the product.**

## 2. Product thesis and positioning

**One sentence:** a private companion for difficult moments. It interrupts apps the user chose,
during the user's own risk windows, and turns that interruption into one or two minutes of help.
An optional DNS filter states truthfully when it works. Everything stays on the device, with no
account, no monitoring and no preaching.

This puts M2-01 H6 ("recovery-first with a self-protection/filter layer"), H12 (recovery without
filtering) and the M2-01 §4 thesis into practice. Category: **private recovery companion**, not a
pornography blocker.

**First user (hypothesis, tested in M2-04):** adults (18+) of any gender who decided for
themselves to stop or reduce pornography use, for personal or religious reasons, and who want a
tool that neither monitors nor preaches. Most competitors assume a male user [Inference].

**First market (hypothesis, OD11):** Muslim adults in Germany, in German and Arabic, on Android.
Egypt is for low-cost usage validation, not revenue. Reasons: ability to pay, a GDPR fit for a
product that holds no data, and no German-language offer found for this audience in the
2026-09-26 search [Inference].

**Why choose this over free alternatives (hypothesis):** Digital Wellbeing blocks but does not
help. Free DNS filters block silently. Recovery apps wait for the user to open them.
Accountability apps monitor. This product joins interruption, help and privacy in one moment.
M2-04 tests whether users notice and value that difference.

## 3. Principles

| ID | Principle | Consequence |
|---|---|---|
| P1 | **The product is the urge moment, not the filter.** | Each layer is judged by whether it helps turn a risky moment into a short, private act of help. |
| P2 | **Trust is the moat.** | Privacy that can be checked (OD7), truthful status per layer (H7, H10, AB4), and a named review board (OD8). No claim is broader than its evidence. |
| P3 | **Respect without shame.** | No "addict" label, no streak reset, no preaching. Faith content is optional and opt-in (OD9). Guilt is not treated as a diagnosis. |
| P4 | **Independent layers with declared limits.** | Recovery works without any protection layer. App interruption and DNS never promote each other. Each layer names what it does not cover. |
| P5 | **A bridge to people, not an in-app community.** | Referral to existing programs and qualified care, and a trusted-person shortcut that sends no data (OD3). |
| P6 | **Language and culture.** | German first for Muslims in Germany, and Arabic in a human, non-preaching voice. |
| P7 | **A business model that matches the values.** | A free core, supporters who fund others, no ads and no data sale (§7). |

## 4. Product architecture baseline

| Layer | What it does | Current state | Gate before build |
|---|---|---|---|
| **L0 Recovery core** (on-device) | Help now (60–120 s), if–then plans, non-shaming lapse reflection without reset, weekly review, optional notes. "I'm at risk now" (OD5). | Not built. The content brief is a DRAFT. | M2-04 GO, clinical review of the content, M3-01 contract |
| **L1 App interruption** ([PR #60](app-blocking-architecture-decision.md)) | A selected app opens in a risk window → opaque interruption → Help now, Home or trusted person. Commitment delay inside the app only (AB3). | Proposed. Mechanism UNKNOWN. | Owner's GitHub record on PR #60, AB-01 (#61), task contract, Play review |
| **L2 DNS filter guidance** (A8) | Private DNS setup guidance, "check now" and a truthful Filter Active state | Verification candidate. #40 is in execution. | #40, #41 and #42 PASS for the claimed configuration |
| **L3 Complementary guidance** (content only) | How to use SafeSearch, HaramBlur in Firefox and router DNS | Idea | OD13 |
| **L4 Human bridge** | Regional referral directory (DE/AR), partner programs, trusted-person shortcut | Idea | A named content owner, OD3 |
| **Cross-cutting** | Status and claims per layer, local data only, discreet presentation (OD2), app lock (OD4) | Partly specified (H7, H9, AB4, AB5) | Per item |

**Dependency rules**

- L0 depends on no protection layer, special permission or network connection (H12). If L1 or
  L2 is absent, revoked or failing, L0 keeps working.
- L1 and L2 keep separate statuses (App Blocking Active, Filter Active). No undifferentiated
  "Protected" state exists (D8, AB4).
- No layer stores URLs, hostnames, screen content or per-attempt histories (H9, AB5).

**Core flows**

1. **Setup in a calm state:** the user writes their reasons in their own words, then chooses risk
   windows, apps, a preferred alternative action and, optionally, a trusted person.
2. **User-initiated urge:** home-screen entry → Help now.
3. **Interruption (L1, only if approved):** a selected app opens in a risk window → opaque
   interruption → Help now, Home, or call a trusted person.
4. **Help now:** name the feeling (hungry, angry, lonely, tired?), a short delay with breathing,
   the user's own reasons, the chosen alternative, then reassess.
5. **After a lapse:** what happened, what triggered it, and the next if–then plan. No reset and
   no blame.
6. **Weekly review:** what helped and how to adjust the plan. When distress persists, suggest
   qualified human help.

## 5. Feature ledger

Competitor features are the vendors' own descriptions. None was installed or audited.

**Adopt, in our wording and within our boundaries**

| Capability | Seen in | Boundary |
|---|---|---|
| Interruption at app launch with a short exercise | one sec, Nafs, AppBlock | L1 under AB1–AB7, Usage Access first. one sec delays an app rather than blocking it, and still reduced opening of target apps by 57% over six weeks [Study, social-media domain]. |
| Schedules by time, usage limit and launch count | AppBlock [Vendor docs] | Location and Wi-Fi conditions need location permission, so they are deferred. |
| Panic or pause button | QUITTR and most recovery apps | Linked to the interruption, not only to the user's recall. |
| If–then plans | Recovery programs generally | d≈0.65 across 94 studies of general goals [Study]. Not specific to pornography. |
| Urge and pattern tracker | Pure Path, Jahada | Local and optional (H9). |
| Short CBT-style lessons | Pure Path, Brainbuddy, Fortify | Two-minute units, clinical review, no outcome promises. |
| DNS guidance with a "check now" page | Kahf Guard, Cloudflare `1.1.1.1/help` | L2 only. The provider is still under verification. |
| Sponsorship ("pay it forward") | Pure Path | A supporter funds another person's seat (§7). |

**Adapt: keep the need, change the mechanism**

| Competitor feature | Our version |
|---|---|
| AppBlock Strict Mode prevents uninstall and blocks Settings, Recents and split screen. It unlocks by PIN, timer, cooldown, charger, schedule or approval [Vendor docs]. | A commitment delay inside the app only (timer, cooldown, or no edits during a schedule), set in a calm state (H8, AB3). Uninstall and Android Settings always stay available (H5). |
| BlockerX partner code | A "call someone I trust" shortcut that sends no data (OD3) |
| AppLock disguises its icon as a calculator or clock [Store listing] | A neutral name, icon and notification text, without impersonating another app or hiding the purpose from the user (OD2) |
| AppLock fingerprint or PIN lock [Store listing] | Device biometrics to lock this app's own private notes (OD4; see closed PR #10) |
| Prayer-time features (Kahf Guard, Nafs) | User-defined risk windows. Linking them to prayer times is optional and needs no precise location. |
| Religious programs (Purify, Lower Your Gaze) | Optional content with religious and clinical review, never used to shame (OD9) |
| Gamification (Purify's garden, Lower Your Gaze levels) | Progress that is not lost after a lapse. A streak counter is optional and off by default. |
| Communities and groups (Pure Path, Purify, Relay, Abyad) | Referral to and partnership with existing programs (L4) instead of an in-app community |
| Image blurring (Canopy, HaramBlur) | Not in the app. Point to HaramBlur for Firefox as complementary guidance (OD13). |

**Reject**

| Feature | Seen in | Reason |
|---|---|---|
| Accountability reports, screenshots, partner monitoring | Covenant Eyes, Ever Accountable, Accountable2You, Truple | H9 and the Owner's rule against monitoring. Play suspended accountability apps in 2022 [Secondary source]. |
| Uninstall prevention, Settings blocking, Device Owner or Admin, root | AppBlock Strict Mode, Kahf Guard, BlockerX | H5, AB3, and Play policy for ordinary users |
| Keyword blocking, URL reading or screen reading | AppBlock | H9, AB5, A7b |
| Media vault, "intruder selfie", fake crash screen | AppLock apps [Store listings] | Outside the purpose. The selfie is camera surveillance of family members, and the crash screen is deception (H8 forbids fake errors). |
| "Earn screen time through worship" | Nafs | It turns worship into an in-game currency [Inference]. Any faith-based mechanic goes to religious review (OD9). |
| AI coach or AI "therapist" | Common in the market | Owner rule and clinical risk |
| "Dopamine reset", cure rates, fear statistics | QUITTR, Brainbuddy, Purify and others | H10 and recovery brief §4 |
| In-app community in the MVP | Pure Path, Purify, QUITTR | Needs a backend and moderation, and is a sensitive social feature. L4 replaces it. |

## 6. Measurement without surveillance

- **North Star:** the weekly number of people who reached Help now, from an interruption or on
  their own, and said it helped. It is measured by an optional on-device question and anonymous
  surveys. Nothing leaves the device automatically.
- **No-harm guardrails:** shame and distress do not rise. Also track false-positive
  interruptions, uninstall and drop-out reasons, and complaints.
- **Never measured or claimed:** a "block rate", what the user viewed, or efficacy before a
  controlled study with ethics approval.

## 7. Business model and go-to-market (hypotheses)

- **Free forever:** Help now, plans, interruption and filter guidance.
- **Supporter plan (OD10):** an optional plan, assumed at 3–5 € per month [Assumption]. It unlocks
  extra programs and languages and funds a seat for someone else.
- **Institutional sponsorship:** an association or counseling center funds seats for its members
  and receives no data about them.
- **Donations:** only through a registered nonprofit. Google Play allows in-app donations only for
  validated nonprofits [Platform policy].
- **Channels:** mosque associations, Muslim student groups, imams and counselors with a referral
  kit, and educational content in German and Arabic. No ad targeting based on religion (DSA
  Art. 26(3)), and no shame- or fear-based marketing.
- **Realistic ceiling:** tens of thousands of euros a year in the best scenario of the 2026-09-26
  evaluation. This is a sustainable project, not a large company [Scenario].

## 8. Sequencing: discovery before build

Order of learning, cheapest first:

1. No-code concierge (M2-04): Help-now cards, an if–then sheet, Digital Wellbeing Focus Mode as a
   stand-in blocker, and Private DNS instructions.
2. L0 recovery core, on-device.
3. L1 app interruption through Usage Access, after AB-01.
4. L2 filter guidance and check, after #40–#42.
5. Optional faith content, after review (OD9).
6. Referral directory and partnerships (L4).
7. iOS later. Apple's Screen Time frameworks allow self-directed app shielding without telling the
   app which apps were chosen, and need an Apple entitlement [General knowledge; verify before
   planning] (OD12).

**M2-04 discovery gate.** The thresholds are pre-registered. The Owner may change them **before**
execution, never after seeing results.

| Step | Design | Success | Failure → consequence |
|---|---|---|---|
| E1 (#64) | 15–20 interviews (DE/AR) and an anonymous survey (n ≥ 150 in Germany; optionally n ≥ 100 in Arabic in Egypt). No browsing history or content details. | ≥ 40% tried and left a tool or are dissatisfied with alternatives, **and** ≥ 30% rank "privacy, no monitoring" or "no shame" in their top three reasons, **and** ≥ 70% interpret the status text correctly, **and** (Germany) ≥ 25% are willing to pay ≥ 3 € per month or donate ≥ 20 € per year | < 20% dissatisfied, **or** < 50% correct interpretation, **or** > 50% reject the DNS data flow after explanation → PIVOT or STOP, rewrite and retest the text, or recovery without a filter (H12) |
| E2 (#65) | Landing pages: two languages × two positionings (A "private, honest, non-shaming"; B "Islamic recovery program") and a discreet vs explicit name. Community traffic only, a minimal waitlist, and an honest "not available yet" pay button. | ≥ 150 sign-ups **and** ≥ 8% conversion **and** A ≥ 1.2× B. If B ≥ 1.5× A, a positioning decision is needed. | < 50 sign-ups with ≥ 1,000 visits, **or** > 5 € per sign-up if paid promotion is used → STOP or PIVOT |
| E3 (#66) | Four weeks with 15–25 consenting adults from E2: a Help-now card, an if–then sheet, lapse-reflection prompts, a Focus Mode schedule and Private DNS instructions. A weekly anonymous check-in, a short shame and distress scale, and crisis resources. A clinical reviewer checks the materials first. | ≥ 40% still use the tools weekly in week 4, **and** ≥ 50% say the urge tool helped at least once, **and** ≥ 50% keep the schedule or filter they enabled, **and** mean shame does not rise and no serious adverse event occurs | < 20% active in week 4, **or** shame rises for ≥ 25%, **or** < 30% report any benefit → STOP the recovery layer in this form, or redesign it |
| Decision (#67) | Synthesis of E1–E3 and AB-01. The Owner records GO, PIVOT or STOP, and the MVP scope. | — | PIVOT: an open resource or a partnership with existing programs. STOP: end the commercial ambition and keep the portfolio value. |

E3 shows feasibility and use only, not therapeutic efficacy (recovery brief §4). AB-01's voluntary
product check (#61) can run inside E1 and E3 so that participants are recruited only once. The
Owner decides.

**90-day planning outline.** This is intent, not a commitment; the roadmap commits no dates.

- Weeks 1–4: E1 and E2 in parallel.
- Weeks 3–8: E3. In parallel, the AB-01 technical spike (at most two working days, after its
  product check) and the #40/#41 A8 verification.
- Weeks 9–12: the M2-04 decision. If GO, write the M3-01 contract for L0, plus L1 if AB-01 passed.

## 9. Red-team register

| # | Attack | Response | Decisive test |
|---|---|---|---|
| R1 | "Winning the whole market is a fantasy": free incumbents, built-in Digital Wellbeing, a near-zero reference price | Win one segment and one category: the private, honest companion for Muslims in Germany | E2 thresholds |
| R2 | "An interruption without a lock is bypassed in seconds" | The goal is friction and a moment of awareness, not prevention. one sec reduced opening even though users could continue [Study, other domain]. | E3: ≥ 50% keep their schedule to week 4; AB-01 |
| R3 | "Sensitive permissions repel a privacy-sensitive audience" | Usage Access first, an explanation before the system screen, nothing stored | E1 permission question, setup completion in E3, AB-01 |
| R4 | "No account and no server means no retention" | Retention comes from repeated value at real moments. The interruption brings the user in without relying on recall. | E3 week-4 thresholds |
| R5 | "Honesty sells less than promises" | The market is full of "complete protection" promises and complaints about blockers that fail [Reviews] | E2: A ≥ 1.2× B |
| R6 | "Religious framing can deepen shame" | Faith content is optional, guilt is kept separate from diagnosis, and a clinician reviews the content. Moral incongruence predicts perceived addiction independently of use [Study]. | E3 shame measure |
| R7 | "Without efficacy evidence, you cannot promise that people will overcome pornography" | Correct. Promise tools and measure feasibility. A controlled study with a university and ethics approval must come before any larger claim. | A study plan after E3 |
| R8 | "There are too many bypass paths": the website, alternative clients, Secure Folder, DoH, content inside allowed apps | Disclose them in claims, keep the layers independent, and offer complementary guidance | Bypass registers per layer (B1–B12; AB-01 coverage boundaries) |
| R9 | "Google Play may reject it" | No uninstall prevention, no deception, accurate declarations. The service type is evaluated, not assumed. | A closed-testing track before release (M5) |
| R10 | "Competitors will copy it" | Features copy fast. Trust, partnerships and a named review board copy slowly. The moat stays thin. | Partner referrals within six months of launch |
| R11 | "Who pays?" | Supporters, institutional sponsorship, a nonprofit | E1 willingness to pay, E2 price door |
| R12 | "One developer, two technical tracks, heavy documentation" | Concierge first, one technical track at a time, timeboxes | E1–E3 finish in about eight weeks |
| R13 | "Most of the demand comes from teenagers" | Adults only at first. Minors need different safeguards and a different design. | Age gate and store wording |

## 10. What success means

Within 12–18 months, the product becomes the default recommendation among German-speaking Muslim
counselors, associations and student groups, with measured retention and no measured harm. It is
not millions of downloads.

No app today can show that it helps people overcome pornography. The first thing to show is that
people use it at the urge moment, say it helped, and feel no more shame. A larger claim needs a
controlled study.

**Stop criteria:** failed demand in E1 or E2 → PIVOT to an open resource or a partnership, or STOP
the commercial ambition. Failed retention or safety in E3 → STOP the recovery layer in this form.

## 11. Effect on the roadmap

- M2 gains M2-04, the discovery gate (#63), and AB-01 (#61). #40–#42 continue unchanged as the
  DNS-layer track, and #42 decides L2 only.
- **M3 becomes "Recovery Core V1".** It starts after the M2-04 GO decision and an approved M3-01
  contract, not after the L2 ADR. L1 joins M3 only after PR #60's GitHub record, AB-01 and its own
  task contract. L2 joins only after #42 PASS.
- M4 adds German and Arabic copy, the referral directory, discreet options if OD2 is approved, and
  optional faith content if OD9 is approved.
- M5 adds Play declarations for whichever permissions L1 actually selects.
- M6 becomes a controlled pilot in Germany (DE/AR) with pre-registered feasibility and no-harm
  criteria.

## 12. Open Owner decisions

Tracked in #68.

| ID | Decision | Recommendation |
|---|---|---|
| OD1 | A product name without "Protection" | Test a discreet vs an explicit name in E2 |
| OD2 | Discreet presentation: neutral name, icon and notifications | Yes, without impersonating another app |
| OD3 | A trusted-person shortcut that sends no data | Yes |
| OD4 | A biometric lock for the app's own notes (see closed PR #10) | Yes, with device biometrics only |
| OD5 | An "I'm at risk now" quick block for one to two hours | Yes, as part of the L1 policy |
| OD6 | Interruption mode: a firm block in risk windows vs pause-then-continue | Test both in E3 and AB-01 |
| OD7 | An open-source blocking and storage core, and an independent data-flow review | Yes, before release |
| OD8 | A named review board (clinical and religious) | Yes, before the E3 materials |
| OD9 | Faith-content policy and reviewers | Optional, opt-in, reviewed |
| OD10 | Pricing, supporter plan and nonprofit vehicle | Decide after E1 and E2 |
| OD11 | First market | Germany (DE/AR); Egypt for validation |
| OD12 | iOS timing | After Android MVP evidence |
| OD13 | Complementary-tool guidance (SafeSearch, HaramBlur, router DNS) | Content only, with a disclaimer about third-party tools |
| OD14 | DNS provider choice and allowlist needs | Desk research first, then extra V rows if pursued |

## 13. Evidence and sources

Labels: [Study], [Platform policy], [Vendor claim], [Vendor docs], [Store listing], [Reviews],
[Secondary source], [Inference], [Assumption], [Scenario]. Vendor pages describe what the vendor
says. No app was installed or audited, and nothing was tested against real adult content (D3).

- **Evidence and retention:** [review of apps for problematic pornography use, 2025](https://pubmed.ncbi.nlm.nih.gov/42491504/);
  [Baumel et al. 2019](https://www.jmir.org/2019/9/e14567/);
  [Hands-off trial, 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8987418/);
  [one sec, PNAS 2023](https://www.pnas.org/doi/10.1073/pnas.2213114120);
  [implementation-intentions meta-analysis](https://www.researchgate.net/publication/37367696_Implementation_Intentions_and_Goal_Achievement_A_Meta-Analysis_of_Effects_and_Processes);
  [Grubbs et al. 2019](https://scispace.com/papers/pornography-problems-due-to-moral-incongruence-an-2yzzn9i1cz);
  [Bőthe et al. 2024](https://onlinelibrary.wiley.com/doi/10.1111/add.16431).
- **Competitors and references:** [AppBlock Strict Mode](https://appblock.app/help/android/strict-mode/);
  [AppLock (DoMobile)](https://play.google.com/store/apps/details?id=com.domobile.applock.ind);
  [Kahf Guard](https://kahfguard.com/); [Pure Path](https://ppath.app/);
  [Purify](https://play.google.com/store/apps/details?id=com.purify.muslimrecovery);
  [Nafs](https://www.getnafs.com/); [QUITTR](https://quittrapp.com/);
  [BlockerX](https://blockerx.net/); [HaramBlur](https://github.com/alganzory/HaramBlur);
  [MuTeS](https://www.mutes.de/).
- **Platform and regulation:** [Google Play payments policy (donations)](https://support.google.com/googleplay/android-developer/answer/9858738);
  [Digital Services Act](https://eur-lex.europa.eu/eli/reg/2022/2065/oj);
  [Accountable2You on the 2022 Play suspension](https://accountable2you.com/android/play-store/);
  [Cloudflare 1.1.1.1 setup](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/1.1.1.1/setup/index.mdx).

## AI contribution

Claude drafted this baseline from its 2026-09-26 market evaluation and from the 2026-09-27 design
and red-team answer that the Owner approved in conversation. It records the Owner's direction. It
does not select an architecture, permission or provider. No device test, user research or
competitor app installation was performed for this document.
