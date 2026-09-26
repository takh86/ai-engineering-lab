# Recovery support — product content brief (draft)

> **Status:** DRAFT for product and qualified clinical review. This is not an approved M3/M4
> implementation task, a diagnosis protocol, or evidence that this app improves clinical outcomes.
>
> **Source of truth:** [problem.md](problem.md), [M2-01 H4–H12](m2-01-approved-threat-model.md),
> and the [M2-02 architecture baseline](m2-02-architecture-options.md). Protection validation
> remains separate from support-content validation. Any contradiction is resolved in favor of the
> approved documents.
>
> **Audience:** consenting adults using a device they own, who voluntarily want help avoiding
> pornography. Recovery tools remain usable when optional filtering is absent (H6/H12).

## 1. Product promise and boundaries

Proposed claim for review: "The app helps you act on your chosen goal with practical coping tools
and optional filtering for tested configurations." The filter is not an unbreakable block.
No intervention here is described as treatment delivered by a clinician, or as a cure.

The user may choose abstinence for personal or religious reasons. The app does not infer a mental
disorder from use, desire, a lapse, or guilt alone. Clinically significant loss of control and
functional impact require assessment by a qualified professional; distress based only on moral
disapproval is not sufficient for a compulsive sexual behaviour disorder diagnosis [S1].

The evidence base supports exploring CBT and ACT skills but does not validate this app. A group CBT
trial concerned selected men with hypersexual disorder [S2]; a small ACT trial concerned 28 adult
men and used clinician-delivered sessions [S3]. An online self-help trial reported promising
complete-case results with substantial differential dropout [S4]. These populations, formats,
endpoints and limits must accompany any later evidence summary.

## 2. Minimum support interactions to validate

| User need | Proposed interaction | Boundary and outcome to inspect |
|---|---|---|
| Decide why to change | Optional private statement of the user's own goal and reasons; values language can be chosen by the user | No diagnosis or rating of faith. Can skip or erase the statement. |
| Notice a pattern | Optional manual note: broad trigger category, feeling, urge intensity if desired, chosen response | No browser history, URLs, DNS names, inferred activity, or automatic event detection. Check whether entry is understandable and feels safe. |
| Handle an urge | User opens a prominent help action; observe the urge, change setting, choose a preselected alternative action, reassess | No promise that an urge vanishes in a fixed time. The A8 app cannot detect blocked DNS events and cannot launch this flow from a block. |
| Prepare for a predictable trigger | User defines one concrete if–then response for a time/place/situation they recognize | No OS-level lock or hidden delay. Check whether users can recall and use the plan in a realistic scenario. |
| Recover from a lapse | A neutral prompt to identify what happened and one adjustment for next time | Avoid shame, punishment, "all progress lost" messaging, or resetting the user's overall progress to zero. |
| See progress and ask for help | Optional reflection on perceived control and effects on sleep, work, or relationships; route persistent impairment or distress to qualified care | Streaks, if offered, are optional and never the sole success measure. The app does not assess severity or prescribe treatment. |

Content would be written and reviewed with a qualified mental-health professional familiar with
compulsive sexual behaviour and the distinction between clinical impairment and moral distress.
The table is a bounded design hypothesis, not a copied treatment manual or a released feature list.
Faith-oriented material, if later proposed, needs a separate explicit product choice and user opt-in;
it must not replace clinical assessment or increase shame.

## 3. Privacy and trust constraints

- Keep support data optional and local for the MVP under H9. Collect no URLs, viewed content,
  DNS query names, account identifiers, ads, analytics, or backend event streams.
- A8's external DNS provider must receive no recovery notes or sensitive user-entered content.
  Technical filter status and a user's private reflection are different data flows.
- Do not infer a lapse from a filter event or equate a blocked lookup with a person's behaviour.
- Design deletion, storage protection, any export, and retention in a later privacy specification
  before implementation. Do not silently add sync or accountability sharing.
- Explain that a filter failure never removes access to the support tools. Do not claim offline
  recovery as an approved requirement unless H20 is decided.

## 4. Separate evidence gates

**Filter gate:** M2-02's pre-registered browser and T2 matrix determines which technical claims are
permitted. A synthetic test domain checks the DNS path or browser path being tested; it does not
measure classification accuracy on real adult material or psychological benefit. Do not test against
actual pornography (requirements.md D3).

**Content usability gate (future product task):** a qualified reviewer checks the wording and
escalation guidance; consenting adult pilot participants can find and finish the urge-help flow,
understand its limits, and report any confusion or increased shame. Establish privacy and consent
for that pilot before recruiting. Record dropouts as well as positive feedback.

**Benefit gate (future study):** pre-register user-selected and functional outcomes, such as
self-reported loss-of-control episodes, perceived ability to choose an alternative response, and
impact on sleep, work or relationships, plus adverse effects. Decide an observation period and a
meaningful success threshold with clinical and product reviewers before seeing data. An uncontrolled
pilot can support feasibility and usability, but cannot establish therapeutic efficacy.

No numeric cure rate, guaranteed abstinence period, "dopamine reset," or clinical treatment claim
follows from the cited studies or the filter's technical PASS. Production wording must reflect what
the specific released app has actually demonstrated.

## 5. Open product decisions before implementation

1. Which support interactions constitute the smallest usable recovery experience, independent of
   the filter? What is the clinical-review owner and the wording review record?
2. Which optional local fields are worth retaining? What deletion and device-data protection rules
   apply? Do users need no-account transfer, and if so, how will it be privacy-reviewed?
3. What qualifies as a referral prompt, how is it worded without diagnosis, and how are regional
   support resources maintained?
4. Are faith-oriented prompts in scope at all? If yes, who reviews them, and how is opt-in shown?
5. What feasibility and benefit outcomes are registered for a consented pilot? How will withdrawal,
   missing responses and potential shame be reported?

## Sources and evidence limits

- [S1: Kraus et al., *Compulsive sexual behaviour disorder in the ICD-11*, 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5775124/): diagnostic distinctions; not an assessment tool for this app.
- [S2: Hallberg et al., randomized group CBT study, 2019](https://pubmed.ncbi.nlm.nih.gov/30956109/): selected clinical sample; not app efficacy.
- [S3: Crosby and Twohig, ACT randomized trial, 2016](https://pubmed.ncbi.nlm.nih.gov/27157029/): small clinician-delivered trial; not a validated app script.
- [S4: Bőthe et al., *Hands-off* web self-help feasibility trial, 2021](https://researchnow.flinders.edu.au/en/publications/hands-off-feasibility-and-preliminary-results-of-a-two-armed-rand/): preliminary self-help evidence with high attrition.
