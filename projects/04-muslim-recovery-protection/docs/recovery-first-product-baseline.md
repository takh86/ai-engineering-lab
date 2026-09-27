# Recovery-first product baseline

> **Decision state (updated 2026-09-27):** The Owner approved the recovery-first direction in
> conversation on 2026-09-27. **D14 itself is still PROPOSED, not approved.** The Owner's Red-Team
> review on this PR ([comment](https://github.com/takh86/ai-engineering-lab/pull/69#issuecomment-5853232456))
> found three blocking design/process gaps and required a revision plus a second review before
> D14 can be approved; this revision addresses them (§8, §9, §11). Separately, the Owner has
> **already decided** several open items (OD1–OD9, OD11, OD13) and approved a specific MVP
> product-scope expansion (Web Guard, secure notes, modes, a monitoring boundary, screen reading
> and uninstall-prevention for self-protection) via GitHub comments on
> [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68) — those decisions are
> recorded below as **DECIDED**, distinct from D14's own pending status. OD10, OD12 and OD14 stay
> open.
>
> **What this changes:** the product thesis, the layer structure, the feature boundaries and the
> order of work: discovery before build, and the recovery core before protection layers.
>
> **What it does not change:** H4–H12 ([M2-01](m2-01-approved-threat-model.md)), the
> [M2-02 baseline](m2-02-architecture-options.md), A8's AC/RJ criteria, the frozen V0–V13
> runbook (PR #59), AB1–AB7 ([PR #60](app-blocking-architecture-decision.md), pending), D1–D13,
> or any Android code. It approves no production architecture, permission, DNS provider,
> backend or release claim. The newly-approved MVP-scope items (§5) are product intent only —
> none of them approves a specific Android mechanism, and none silently widens PR #60.

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
Optional Web Guard and DNS layers state truthfully when they work. Everything stays on the
device, with no account and no third-party surveillance.

This puts M2-01 H6 ("recovery-first with a self-protection/filter layer"), H12 (recovery without
filtering) and the M2-01 §4 thesis into practice. Category: **private recovery companion**, not a
pornography blocker.

**First user (hypothesis, tested in M2-04):** adults (18+) of any gender who decided for
themselves to stop or reduce pornography use, for personal or religious reasons. Most competitors
assume a male user [Inference].

**First market (DECIDED, OD11):** Muslim adults in **Germany**, in **German and Arabic**, on
Android. Egypt is supplementary validation only and is never pooled into the Germany GO
criterion (§8). Reasons: ability to pay, a GDPR fit for a product that holds no data by default,
and no German-language offer found for this audience in the 2026-09-26 search [Inference].

**Product name (DECIDED, OD1+OD2):** the canonical, public product name/positioning may be
**explicit** about the recovery/Islamic purpose (OD1 = B). Separately, the user may choose an
**explicit or discreet/neutral on-device presentation** (OD2 = C) — name, icon and notification
text — without impersonating another app or using deceptive fake-crash/calculator behavior. These
two decisions sit next to each other deliberately (§12): if a platform constraint makes both
impossible together, that returns to the Owner.

## 3. Principles

| ID | Principle | Consequence |
|---|---|---|
| P1 | **The product is the urge moment, not the filter.** | Each layer is judged by whether it helps turn a risky moment into a short, private act of help. |
| P2 | **Trust is the moat.** | Privacy that can be checked (OD7), truthful status per layer (H7, H10, AB4), and a named review board (OD8). No claim is broader than its evidence. |
| P3 | **Respect without shame.** | No "addict" label, no streak reset. Faith content is optional and opt-in (OD9). Guilt is not treated as a diagnosis. |
| P4 | **Independent layers with declared limits.** | Recovery works without any protection layer. Layers never promote each other. Each layer names what it does not cover. |
| P5 | **A bridge to people, not an in-app community.** | Referral to existing programs and qualified care, and a trusted-person shortcut that sends no data (OD3). |
| P6 | **Language and culture.** | German first for Muslims in Germany, and Arabic in a human, non-preaching voice. |
| P7 | **A business model that matches the values.** | A free core, supporters who fund others, no ads and no data sale (§7). |
| P8 | **Self-protection, not surveillance (added 2026-09-27, Owner decision).** | A layer may observe signals about the device it runs on **only** to power its own protective feature. Sending activity, screen content or browsing data to another person, a partner, a developer dashboard, or any server stays prohibited (H9). See §5 for what this permits. |

## 4. Product architecture baseline

| Layer | What it does | Current state | Gate before build |
|---|---|---|---|
| **L0 Recovery core** (on-device) | Help now (60–120 s), if–then plans, non-shaming lapse reflection without reset, weekly review. A mode choice — **Recovery Mode** or **Recovery + Faith Mode** (opt-in, OD9) — and **optional secure free-text notes** (B2, local-first; sensitive-data handling, biometric protection and backup behavior specified before implementation). "I'm at risk now" (OD5, user-configurable duration). | Not built. The content brief is a DRAFT. | M2-04 GO, clinical review of the content, M3-01 contract |
| **L1 App interruption** ([PR #60](app-blocking-architecture-decision.md)) | A selected app opens in a risk window → interruption → Help now, Home or trusted person. Normal mode: pause → Help now → continue may be available. "At risk now" mode: hard block during the active window (OD6 = HYBRID). Commitment delay inside the app only (AB3). | Proposed. Mechanism UNKNOWN. | Owner's GitHub record on PR #60, AB-01 (#61), task contract, Play review |
| **L2 DNS filter guidance** (A8) | Private DNS setup guidance, "check now" and a truthful Filter Active state | Verification candidate. #40 is in execution, paused at V1-CELL. | #40, #41 and #42 PASS for the claimed configuration |
| **L2b Web Guard — domain & keyword blocking** (new, Owner-approved product scope, [#68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853562123)) | Custom domain/website blocking, and keyword blocking in Arabic and English where technically feasible, with a truthful coverage state distinct from L2's | Product scope approved. **Mechanism UNKNOWN and not DNS** — a new architecture/security/Play-policy decision, separate from AB1–AB7 (§5). | That new decision, a technical spike on Arabic/English matching, and its own task contract |
| **L3 Complementary guidance** (content only, DECIDED IN MVP, OD13) | How to use SafeSearch, HaramBlur in Firefox and router DNS, with third-party disclaimers | Idea, now in-scope for MVP | Content review before release |
| **L4 Human bridge** | Regional referral directory (DE/AR), partner programs, trusted-person shortcut supporting **call and message** (OD3 = C) | Idea | A named content owner |
| **Cross-cutting** | Status and claims per layer, local data only, user-selectable explicit/discreet on-device presentation (OD2), **whole-app biometric lock** (OD4 = B, device-supported biometrics only) | Partly specified (H7, H9, AB4, AB5) | Per item |

**Dependency rules**

- L0 depends on no protection layer, special permission or network connection (H12). If any
  other layer is absent, revoked or failing, L0 keeps working.
- L1, L2 and L2b keep separate statuses. No undifferentiated "Protected" state exists (D8, AB4).
- No layer stores URLs, hostnames, screen content or per-attempt histories beyond what a specific
  approved self-protection feature needs (H9, AB5, P8).
- **Open tension, not resolved here (Owner decision, [#68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853686614)):**
  a whole-app biometric lock (OD4) can conflict with fast access to Help Now or an active
  interruption. The M3/M4 task contract must define this explicitly and bring it back to the
  Owner; it is not decided by this document.

**Core flows**

1. **Setup in a calm state:** the user writes their reasons in their own words, chooses Recovery
   Mode or Recovery + Faith Mode, then chooses risk windows, apps, a preferred alternative action
   and, optionally, a trusted person.
2. **User-initiated urge:** home-screen entry → Help now.
3. **Interruption (L1, only if approved):** a selected app opens in a risk window → interruption
   → Help now, Home, or call/message a trusted person.
4. **"I'm at risk now":** a user-configurable temporary hard block across selected apps (OD5, OD6).
5. **Help now:** name the feeling (hungry, angry, lonely, tired?), a short delay with breathing,
   the user's own reasons, the chosen alternative, then reassess.
6. **After a lapse:** what happened, what triggered it, and the next if–then plan. No reset and
   no blame.
7. **Weekly review:** what helped and how to adjust the plan. When distress persists, suggest
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
| AppBlock Strict Mode blocks Settings, Recents and split screen, unlocking by PIN, timer, cooldown, charger, schedule or approval [Vendor docs]. Uninstall-prevention is a separate, now-approved item below. | A commitment delay inside the app only (timer, cooldown, or no edits during a schedule), set in a calm state (H8, AB3). Android Settings always stays available (H5). |
| BlockerX partner code | A "call or message someone I trust" shortcut that sends no data (OD3 = C) |
| AppLock disguises its icon as a calculator or clock [Store listing] | A user-selectable explicit or discreet/neutral name, icon and notification text (OD2 = C), without impersonating another app or using fake-crash deception |
| AppLock fingerprint or PIN lock [Store listing] | Device-biometric lock for the **whole app** (OD4 = B), using device-supported authentication only |
| Prayer-time features (Kahf Guard, Nafs) | User-defined risk windows. Linking them to prayer times is optional and needs no precise location. |
| Religious programs (Purify, Lower Your Gaze) | Recovery + Faith Mode: optional content with religious and clinical review (OD8, OD9), never used to shame |
| Gamification (Purify's garden, Lower Your Gaze levels) | Progress that is not lost after a lapse. A streak counter is optional and off by default. |
| Communities and groups (Pure Path, Purify, Relay, Abyad) | Referral to and partnership with existing programs (L4) instead of an in-app community |

**Approved product scope, mechanism deferred (Owner decision, 2026-09-27 —
[issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853562123))**

> Product-scope approval only. None of the rows below approves a specific Android permission,
> AccessibilityService, Device Admin/Owner, root, Settings-blocking, or any Play-policy-sensitive
> mechanism. Any conflict with AB1–AB7 ([PR #60](app-blocking-architecture-decision.md)) or D13
> is resolved by a **new**, explicit architecture/security/Play-policy decision — PR #60 is not
> silently widened. No implementation begins until the Tech Lead approves a task contract for the
> specific mechanism chosen.

| Capability | What's approved | What's NOT approved | Gate |
|---|---|---|---|
| Web Guard — domain/website blocking | A custom domain/website blocklist, in Arabic and English where feasible (distinct from L2/A8's DNS mechanism) | A specific implementation mechanism | A new architecture decision (mechanism TBD) |
| Web Guard — keyword blocking | Detecting configured keywords/phrases in web content the user is viewing, in Arabic and English where feasible | Any specific text-access mechanism; storing matched content | Same new decision; a spike must show Arabic diacritics/normalization and English variants can be matched reliably before any coverage claim |
| Screen reading for self-protection | Reading on-screen content **only** when a specific approved self-protection feature (e.g., keyword detection above) technically requires it | Reading for analytics, unrelated monitoring, or reporting to any third party; storing raw screen content | A new architecture/security/Play-policy decision. AB6's "no window-content retrieval" boundary in PR #60 is **not** overridden by this — if keyword detection needs window content, that is exactly the conflict the Owner's decision says must be reconciled explicitly, not assumed |
| Uninstall-prevention investigation | Investigating whether a compliant way exists to make uninstalling harder, as a product requirement to pursue *if* viable | Device Owner, Device Admin, root, deceptive UI, or Settings-blocking as the mechanism; any claim that uninstall is prevented before the investigation concludes | A new architecture/security/Play-policy decision. **Known tension:** H5 (M2-01, APPROVED) lists uninstall as explicitly outside any protection guarantee, and Play restricts apps from preventing ordinary users from disabling/uninstalling via the Accessibility API. No mechanism satisfying "prevent uninstall" without Device Admin/Owner/root/Accessibility-abuse is currently known; this investigation is expected to report that finding unless a genuinely new approach surfaces |

**Reject (unaffected by the above — still rejected)**

| Feature | Seen in | Reason |
|---|---|---|
| Reporting activity, screenshots or screen/keyword-match content to a partner, developer dashboard or any third party | Covenant Eyes, Ever Accountable, A2Y, Truple | P8 / H9: self-protection monitoring is allowed, third-party surveillance is not. Play suspended accountability apps in 2022 [Secondary source]. |
| Device Owner, Device Admin, root, or Settings-blocking, **as mechanisms**, for any purpose including uninstall-prevention | AppBlock Strict Mode, Kahf Guard, BlockerX | H5. Explicitly still excluded even though investigating uninstall-prevention's product intent is approved (above). |
| Media vault, "intruder selfie", fake crash screen | AppLock apps [Store listings] | Outside the purpose. The selfie is camera surveillance of family members, and the crash screen is deception (H8 forbids fake errors). |
| "Earn screen time through worship" | Nafs | It turns worship into an in-game currency [Inference]. Any faith-based mechanic goes through OD8/OD9 review. |
| AI coach or AI "therapist" | Common in the market | Owner rule and clinical risk |
| "Dopamine reset", cure rates, fear statistics | QUITTR, Brainbuddy, Purify and others | H10 and recovery brief §4 |
| In-app community in the MVP | Pure Path, Purify, QUITTR | Needs a backend and moderation, and is a sensitive social feature. L4 replaces it. |

## 6. Measurement without surveillance

- **North Star (revised 2026-09-27, Medium-severity fix):** a **local, per-user, on-device**
  count by default — the app can show an individual their own weekly count of reaching Help now,
  with nothing transmitted automatically. A product-wide aggregate weekly count is **not**
  observable under the current privacy architecture (H9: no backend required, no analytics SDK)
  and is not implied by this document. Reporting it product-wide requires a **separate, explicit,
  opt-in research decision** (for example, a periodic anonymous survey like E1, or an opt-in
  telemetry feature with its own privacy review) before it can be reported as a metric.
- **No-harm guardrails:** shame and distress do not rise. Also track false-positive
  interruptions, uninstall and drop-out reasons, and complaints.
- **Never measured or claimed:** a "block rate", what the user viewed, or efficacy before a
  controlled study with ethics approval.

## 7. Business model and go-to-market (hypotheses)

- **Free forever:** Help now, plans, interruption and filter/Web Guard guidance.
- **Supporter plan (OD10, open):** an optional plan, assumed at 3–5 € per month [Assumption]. It
  unlocks extra programs and languages and funds a seat for someone else.
- **Institutional sponsorship:** an association or counseling center funds seats for its members
  and receives no data about them.
- **Donations:** only through a registered nonprofit. Google Play allows in-app donations only for
  validated nonprofits [Platform policy].
- **Subscription willingness-to-pay and donation/supporter intent are two different signals**
  (High-severity fix, §8): a person willing to donate to a mission is not necessarily willing to
  buy a subscription. E1 and E2 report both separately; OD10 is decided from both readings
  together, not from a single blended number.
- **Channels:** mosque associations, Muslim student groups, imams and counselors with a referral
  kit, and educational content in German and Arabic. No ad targeting based on religion (DSA
  Art. 26(3)), and no shame- or fear-based marketing.
- **Realistic ceiling:** tens of thousands of euros a year in the best scenario of the 2026-09-26
  evaluation. This is a sustainable project, not a large company [Scenario].

## 8. Sequencing: discovery before build

> **Revised 2026-09-27** in response to the Owner's Red-Team review
> ([comment](https://github.com/takh86/ai-engineering-lab/pull/69#issuecomment-5853232456)),
> which found E2 experimentally confounded (Blocker 3), E3's "anonymous" design incompatible with
> its own longitudinal/safety requirements (Blocker 2), undefined gray zones between success and
> failure (High 4), an unquotaed language sample (High 5), and conflated payment/donation signals
> (High 6). All five are fixed below.

Order of learning, cheapest first:

1. No-code concierge (M2-04): Help-now cards, an if–then sheet, Digital Wellbeing Focus Mode as a
   stand-in blocker, and Private DNS instructions.
2. L0 recovery core, on-device.
3. L1 app interruption through Usage Access, after AB-01.
4. L2 filter guidance and check, after #40–#42. L2b Web Guard, after its own architecture decision.
5. Faith Mode content, after OD8/OD9 review.
6. Referral directory and partnerships (L4).
7. iOS later. Apple's Screen Time frameworks allow self-directed app shielding without telling the
   app which apps were chosen, and need an Apple entitlement [General knowledge; verify before
   planning] (OD12).

**General rule for every step below:** define **SUCCESS / FAILURE / INCONCLUSIVE**, not just
success/failure. An INCONCLUSIVE result gets **one** pre-registered, capped extension (stated per
step); after that extension the Owner decides directly from the full evidence — the step does not
auto-resolve a second time. Thresholds may be changed by the Owner **before** execution, never
after seeing results.

### E1 — Interviews and anonymous survey (#64)

- **Design:** 15–20 semi-structured interviews (DE/AR). An anonymous survey with **minimum
  language quotas inside the Germany sample** (High-5 fix): n ≥ 150 in Germany overall, including
  **≥ 60 completed in German and ≥ 60 completed in Arabic**; each language's results reported
  separately as well as combined. An optional, separate Egypt-AR sample (n ≥ 100) is reported on
  its own and **never pooled into the Germany GO criterion**. No browsing history or content
  details.
- **Measures:** tools tried and left; exposure routes by broad category; reaction to the privacy
  text and the "Filter/Web Guard Active" status text; **subscription willingness-to-pay and
  donation/supporter intent, asked and reported as two separate figures** (High-6 fix), not one
  blended number; how important iOS is.
- **Success:** ≥ 40% (Germany, combined DE+AR) tried and left a tool or are dissatisfied with
  alternatives, **and** ≥ 30% rank "privacy, no monitoring" or "no shame" in their top three
  reasons, **and** ≥ 70% interpret the status text correctly, **and** ≥ 25% show either
  subscription willingness ≥ 3 €/month or donation intent ≥ 20 €/year (each figure reported on
  its own for OD10, not merged).
- **Failure:** < 20% dissatisfied, **or** < 50% correct interpretation, **or** > 50% reject the
  data flow after explanation.
- **Inconclusive** (any result strictly between success and failure on any criterion): one
  extension of up to +50% more respondents or +1 week, whichever comes first; then the Owner
  decides directly.
- **Caveat:** stated preference overstates willingness to pay. E2 measures behaviour.

### E2 — Landing pages, run as two sequential single-variable phases (#65)

> **Redesigned to fix Blocker 3.** The previous single test varied name, language and positioning
> at once, so a conversion difference could not be attributed to any one of them.

**Phase 2a — Positioning (name and language held constant).** One neutral placeholder name; a
language toggle on the page itself (not by channel) so language is the visitor's own choice, not
a hidden confound. Visitors are **randomly assigned** (not by channel or time period) to
positioning A ("private, honest, non-shaming") or B ("Islamic recovery program"). Freeze before
launch: the randomization method, a minimum of ≥ 300 valid visits per arm before comparing,
duplicate/bot exclusion (reject repeat sign-ups from the same contact within a short window;
exclude sub-5-second sessions), and traffic-source logging (reported per source, to catch channel
effects). Community traffic and partner referrals only — no ad targeting based on religion (DSA
Art. 26(3)). A minimal waitlist; an honest "not available yet" pay-intent button.

- **Success:** the winning arm converts ≥ 8% from community traffic **and** ≥ 1.2× the other arm.
- If the losing arm is "Islamic recovery program" and it converts ≥ 1.5× the other, that itself is
  a signal that explicit religious demand is stronger than assumed — a positioning decision for
  the Owner, not an automatic override of OD9's opt-in Faith Mode framing.
- **Failure:** combined arms < 50 sign-ups with ≥ 1,000 total visits, **or** > 5 €/sign-up if paid
  promotion is used.
- **Inconclusive:** one extension of up to 2 more weeks or 50% more traffic, whichever first; then
  the Owner decides directly. If Phase 2a is inconclusive-after-extension or fails, skip Phase 2b
  and feed the result into the M2-04 synthesis as-is.

**Phase 2b — Presentation (runs only if Phase 2a = success; the winning positioning held
constant).** Visitors are randomly assigned to an explicit-presentation vs a discreet/neutral
variant of the *same* winning page. Same freeze rules as 2a (allocation, minimum visits,
exclusion). **Note:** OD1 already decided the product's canonical name is explicit; this phase
measures a landing-page/marketing-copy effect, not a re-litigation of OD1 — its result informs
copy strategy and OD2's on-device default, not the product's public identity.

- **Success/failure/inconclusive:** same ratio logic as Phase 2a, applied to the presentation
  variants.

**Safeguards (both phases):** honest disclosure, a GDPR privacy notice, no payment data
collected, waitlist deleted if the project stops. **Cost/time:** tens of euros; up to 8 weeks
combined if both phases run.

### E3 — Four-week pseudonymous concierge test (#66)

> **Redesigned to fix Blocker 2.** "Anonymous" could not support its own retention, within-person
> shame/distress change, dropout tracking, or adverse-event handling. This version is
> **pseudonymous**, not anonymous.

- **Design:** 15–25 consenting adults from the E2 waitlist. Each is assigned a **random
  pseudonymous ID** at enrollment. A contact/identity list (name/phone/email ↔ pseudonymous ID) is
  stored **separately** from weekly response data, used only for safety follow-up and for
  matching a participant's own sequential responses. The kit: a Help-now card, an if–then sheet,
  non-shaming lapse-reflection prompts, a Focus Mode schedule (standing in for L1) and Private DNS
  instructions (standing in for L2). A clinical reviewer (OD8) checks all materials first.
- **Retention denominator, defined:** week-4 retention = (participants submitting a week-4
  check-in) ÷ (participants who completed the baseline check-in). Not divided by whoever happens
  to respond that week.
- **Missing-response / withdrawal rule:** two consecutive missed check-ins = presumed withdrawn
  for that point's retention count, unless they respond again later (then counted as retained
  again). An explicit "I want to stop" is logged as an active withdrawal with its stated reason,
  distinct from silent non-response.
- **Data handling:** the identity/contact list is deleted no later than 4 weeks after the
  synthesis (#67), unless a participant is in active safety follow-up. De-identified pseudonymous
  responses may be retained longer under the general local-data policy (H9) but can no longer be
  linked to a name once the identity list is gone.
- **Pre-defined serious-adverse-event (SAE) definition and escalation:** an SAE is any self-report
  of suicidal ideation/intent, self-harm, or an acute crisis. On any SAE flag: crisis resources
  display immediately; the clinical reviewer is notified within 24 hours via the identity list
  (not the weekly synthesis cycle); the study makes no attempt at crisis counseling itself; the
  event is logged by pseudonymous ID, date and action taken, never by name in the response data.
- **Small-n handling (Medium-8 fix):** report exact counts alongside percentages (e.g., "9 of 20,
  45%"). A single-participant swing in shame/distress is a prompt for qualitative review, not
  proof of harm or benefit. These thresholds are feasibility signals, not a statistical test.
- **Success:** ≥ 40% still active weekly in week 4, **and** ≥ 50% say the urge tool helped at
  least once, **and** ≥ 50% of those who enabled a schedule/filter kept it, **and** mean shame
  does not rise and no SAE occurs.
- **Failure:** < 20% active week 4, **or** shame rises for ≥ 25%, **or** < 30% report any benefit.
- **Inconclusive:** one extension of up to 2 more weeks or 10 more participants, whichever first;
  then the Owner decides directly.
- **Explicit limit:** uncontrolled, self-selected. Shows feasibility and use only, **never**
  therapeutic efficacy (recovery brief §4).

### Decision (#67)

Synthesis of E1–E3 and AB-01. The Owner records **GO / PIVOT / STOP** and the MVP scope.
PIVOT: an open resource or a partnership with existing programs. STOP: end the commercial
ambition and keep the portfolio value.

AB-01's voluntary product check (#61) can run inside E1 and E3 so participants are recruited only
once. The Owner decides.

**90-day planning outline** (intent, not a commitment; the roadmap commits no dates):

- Weeks 1–4: E1 and E2 Phase 2a in parallel.
- Weeks 3–4: E2 Phase 2b, if 2a succeeded.
- Weeks 3–8: E3. In parallel, the AB-01 technical spike (at most two working days, after its
  product check) and the #40/#41 A8 verification.
- Weeks 9–12: the M2-04 decision. If GO, write the M3-01 contract for L0, plus L1 if AB-01 passed.

## 9. Red-team register

| # | Attack | Response | Decisive test |
|---|---|---|---|
| R1 | "Winning the whole market is a fantasy": free incumbents, built-in Digital Wellbeing, a near-zero reference price | Win one segment and one category: the private, honest companion for Muslims in Germany | E2 thresholds |
| R2 | "An interruption without a lock is bypassed in seconds" | The goal is friction and a moment of awareness, not prevention. one sec reduced opening even though users could continue [Study, other domain]. | E3: ≥ 50% keep their schedule to week 4; AB-01 |
| R3 | "Sensitive permissions repel a privacy-sensitive audience" | Usage Access first, an explanation before the system screen, nothing stored beyond what an approved feature needs | E1 permission question, setup completion in E3, AB-01 |
| R4 | "No account and no server means no retention" | Retention comes from repeated value at real moments. The interruption brings the user in without relying on recall. | E3 week-4 thresholds |
| R5 | "Honesty sells less than promises" | The market is full of "complete protection" promises and complaints about blockers that fail [Reviews] | E2 Phase 2a: A ≥ 1.2× B |
| R6 | "Religious framing can deepen shame" | Faith Mode is optional, guilt is kept separate from diagnosis, and a clinician plus a religious reviewer check the content (OD8/OD9). Moral incongruence predicts perceived addiction independently of use [Study]. | E3 shame measure |
| R7 | "Without efficacy evidence, you cannot promise that people will overcome pornography" | Correct. Promise tools and measure feasibility. A controlled study with a university and ethics approval must come before any larger claim. | A study plan after E3 |
| R8 | "There are too many bypass paths": the website, alternative clients, Secure Folder, DoH, content inside allowed apps | Disclose them in claims, keep the layers independent, and offer complementary guidance | Bypass registers per layer (B1–B12; AB-01 coverage boundaries) |
| R9 | "Google Play may reject it" | No uninstall prevention via disallowed mechanisms, no deception, accurate declarations. The service type is evaluated, not assumed. | A closed-testing track before release (M5) |
| R10 | "Competitors will copy it" | Features copy fast. Trust, partnerships and a named review board copy slowly. The moat stays thin. | Partner referrals within six months of launch |
| R11 | "Who pays?" | Supporters, institutional sponsorship, a nonprofit — now measured as two separate signals | E1 WTP/donation split, E2 price door |
| R12 | "One developer, two technical tracks, heavy documentation" | Concierge first, one technical track at a time, timeboxes | E1–E3 finish in about eight weeks |
| R13 | "Most of the demand comes from teenagers" | Adults only at first. Minors need different safeguards and a different design. | Age gate and store wording |
| R14 | **"PR #69 mutated live GitHub trackers to reflect D14 before Owner approval"** (Blocker 1, found 2026-09-27 by the Owner) | All 16 affected trackers (#19, #22, #23, #24, #25, #26, #42, #43–#48, #50–#52) restored to their pre-D14 gate text with a "proposed, not yet in effect" note; logged in AI contribution below | Still unresolved: whether the next sync waits for an explicit "D14 = APPROVE" before editing gate semantics. Test: the PR that eventually performs that sync |
| R15 | "E3's anonymous design can't compute its own retention or shame-change" (Blocker 2) | Redesigned as pseudonymous, with a separated identity list, an explicit retention denominator, a withdrawal rule, a deletion schedule and a pre-defined SAE/escalation path (§8) | Still unresolved: whether participants find the pseudonymous-ID flow usable in practice. Test: E3's first week of enrollment |
| R16 | "E2 confounds name, language and positioning" (Blocker 3) | Split into two sequential randomized phases — positioning first, presentation second — with frozen allocation, minimum visits and exclusion rules (§8) | Still unresolved: whether real community traffic clears the per-arm minimum. Test: Phase 2a's first two weeks |
| R17 | "Success/failure rules leave gray zones open to post-hoc interpretation" (High 4) | INCONCLUSIVE zones plus one bounded, pre-capped extension defined for E1, E2 and E3 | Still unresolved: whether the Owner accepts a forced call after one extension. Test: the first INCONCLUSIVE result, whichever step hits it first |
| R18 | "The Germany sample may not actually test the DE+AR hypothesis" (High 5) | Minimum per-language quotas (≥60/≥60) inside the Germany n≥150 sample; Egypt reported separately, never pooled in (§8) | Still unresolved: whether the quotas are reachable through community channels alone. Test: E1 recruitment tracking by language |
| R19 | "Paying and donating are conflated into one threshold" (High 6) | E1 and E2 report subscription-WTP and donation/supporter-intent as two separate figures (§7, §8) | Still unresolved: which signal actually predicts OD10's pricing decision. Test: E1's two figures, read together in #67 |
| R20 | "The North Star metric isn't observable under the stated privacy architecture" (Medium 7) | Redefined as a local per-user metric by default; a product-wide aggregate needs its own separate opt-in research decision (§6) | Still unresolved: whether periodic surveys are an acceptable substitute for a live metric. Test: the Owner's read of E1's first wave |
| R21 | "Small-n E3 thresholds sound precise but are statistically fragile" (Medium 8) | Report exact counts beside percentages; treat single-participant swings as a qualitative flag, not proof; E3 stays a feasibility check (§8) | Still unresolved: whether this framing survives an actually ambiguous E3 result. Test: E3's week-4 synthesis |

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

> **Note, 2026-09-27:** An earlier revision of this PR had already edited the live GitHub
> milestone/issue trackers (#23–#26, #43–#48, #50–#52) to reflect the change described below,
> before the Owner approved it. That was a human-gate violation (§9, R14) and has been corrected:
> those 16 trackers are restored to their pre-D14 text with an explicit "proposed, not yet in
> effect" note. Everything in this section remains a **proposal** — it takes effect only after the
> Owner records D14 = APPROVE and requests the sync step.

- M2 would gain M2-04, the discovery gate (#63), and AB-01 (#61). #40–#42 would continue unchanged
  as the DNS-layer (L2) track; L2b Web Guard would need its own new architecture decision (§5).
- **M3 would become "Recovery Core V1."** It would start after the M2-04 GO decision and an
  approved M3-01 contract, not after the L2 ADR. L1 would join M3 only after PR #60's GitHub
  record, AB-01 and its own task contract. L2 would join only after #42 PASS. L2b would join only
  after its own new architecture/security/Play-policy decision.
- M4 would add German and Arabic copy, the referral directory, the user-selectable presentation
  (OD2) and Faith Mode (OD9).
- M5 would add Play declarations for whichever permissions the included layers actually select,
  and the open-source-core boundary (OD7).
- M6 would become a controlled pilot in Germany (DE/AR) with the pseudonymous, pre-registered
  feasibility and no-harm criteria from §8 — not E3's criteria copied as-is, since a pilot at
  scale needs its own review of the same design questions.

## 12. Open Owner decisions

Decided items are recorded below with their approval and a citation. Two carry an explicit,
deliberately unresolved reconciliation note — these are **not** resolved by AI. Still-open items
remain in #68.

### Decided (2026-09-27)

| ID | Decision | Approved | Source |
|---|---|---|---|
| OD1 | Product-name strategy | **B — Explicit.** Canonical/public name/positioning may be explicit; do not default to discreet. Final name is a separate naming/copy task. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853648678) |
| OD2 | On-device presentation | **C — user chooses.** Explicit or discreet/neutral, user-selectable on-device; no impersonation or fake-crash/calculator deception. Does not change OD1. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853686614) |
| OD3 | Trusted-person shortcut | **C — Call + Message.** Shortcut only; no reports, screenshots, monitoring feed or accountability dashboard. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853686614) |
| OD4 | Biometric lock | **B — whole app.** Device-supported biometrics only. Fallback TBD. **Open tension with Help Now — see below.** | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853686614) |
| OD5 | "I'm at risk now" duration | **C — user-configurable.** Exact options/default TBD in the task contract/UX; subject to L1 feasibility. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853648678) |
| OD6 | Interruption mode | **HYBRID.** Normal: pause → Help Now → continue possible. Emergency ("at risk now"): hard block during the active window. Exact timing/escape/failure semantics require AB-01/E3. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853648678) |
| OD7 | Open source | **A — core only.** Exact "core" boundary TBD before M5. Not the whole app/UI/content/business layer. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853686614) |
| OD8 | Review structure | **A — clinical + religious, separate roles.** Faith-mode material needs both; one does not substitute for the other. Named reviewers TBD. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853648678) |
| OD9 | Faith Mode | **A — optional, opt-in.** Recovery Mode stays independent and available without religious content. Reviewed per OD8. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853686614) |
| OD11 | First market | **A — Germany, German + Arabic.** Egypt is supplementary validation only, never pooled into the Germany GO criterion. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853648678) |
| OD13 | Complementary guidance | **A — in MVP.** SafeSearch/HaramBlur/router-DNS guidance, with third-party disclaimers. | [issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853686614) |

Plus the MVP product-scope approval (Web Guard, secure notes, modes, self-protection monitoring,
screen reading for self-protection, uninstall-prevention investigation): recorded in
[issue #68](https://github.com/takh86/ai-engineering-lab/issues/68#issuecomment-5853562123) and
detailed in §5.

### Deliberately unresolved — for the M3/M4 task contract, not this document

1. **OD1 + OD2.** The canonical/public name stays explicit (OD1), while the user may choose a
   discreet local presentation (OD2). If an Android/Play constraint makes that combination
   impossible, this returns to the Owner; it is not silently dropped either way.
2. **OD4 + Help Now.** A whole-app biometric lock (OD4) can conflict with fast emergency access to
   Help Now or an active interruption. This must be presented to the Owner before implementation,
   not resolved here.

### Still open

| ID | Decision | Recommendation |
|---|---|---|
| OD10 | Pricing, supporter plan and nonprofit vehicle | Decide after E1 and E2, reading subscription-WTP and donation/supporter-intent as two separate signals (§7, §8) |
| OD12 | iOS timing | After Android MVP evidence |
| OD14 | DNS provider choice and allowlist needs | Desk research first, then extra V rows if pursued, after #42 |

## 13. Evidence and sources

Labels: [Study], [Platform policy], [Vendor claim], [Vendor docs], [Store listing], [Reviews],
[Secondary source], [Inference], [Assumption], [Scenario]. Vendor pages describe what the vendor
says. No app was installed or audited, and nothing was tested against real adult content (D3).
This revision's governance and scope changes come from the Owner's own GitHub comments (cited
inline and in §12), not new external research.

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
  [Google Play sensitive API policy (disabling/uninstalling)](https://support.google.com/googleplay/android-developer/answer/16909972?hl=en-GB);
  [Digital Services Act](https://eur-lex.europa.eu/eli/reg/2022/2065/oj);
  [Accountable2You on the 2022 Play suspension](https://accountable2you.com/android/play-store/);
  [Cloudflare 1.1.1.1 setup](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/1.1.1.1/setup/index.mdx).

## AI contribution

Claude drafted this baseline from its 2026-09-26 market evaluation and the 2026-09-27 design and
red-team answer the Owner approved in conversation. It records the Owner's direction and, in
this revision, the Owner's own GitHub decisions verbatim; it does not select an architecture,
permission or provider, and it does not resolve the two flagged reconciliation conflicts (§12).

**Process mistake and correction (2026-09-27):** the previous revision of this PR edited 16 live
GitHub tracker issues (#19, #22, #23, #24, #25, #26, #42, #43, #44, #45, #46, #47, #48, #50, #51,
#52) to state the D14 restructuring as already in effect, while this PR still said D14 was
pending approval. The Owner's Red-Team review identified this as a human-gate violation (§9, R14):
AI must not change a live tracker's operative gate before the Owner approves the change it
describes. All 16 issues were restored to their pre-D14 text with an explicit "proposed, not yet
in effect" note on 2026-09-27, in the same session that produced this revision. No device test,
user research or competitor app installation was performed for this document.
