# Voluntary app blocking — product and architecture decision

> **Decision state: D13 / AB1–AB7 APPROVED by the Owner on 2026-09-27.**
> Canonical approval record: PR #60 comment 5855067908, after the reconciled PR #60 was merged.
> This document is the approved L1 architecture boundary. Implementation, mechanism selection and
> Play release remain conditional on the gates below.
> No Android code or device setting was changed by this decision.

## 1. Context and scope

The Owner wants a useful interruption when a personally selected app is opened: block access
quickly and offer immediate, private recovery help. Local storage is acceptable. AppBlock's
Strict Mode is an example of the desired experience, not evidence that Android suspends an app
before launch or that our app may copy all of AppBlock's permissions and controls.

This is **new product scope** alongside the M2-02 A8 Private DNS verification candidate. It does
not change the A8 browser test gate, approve Cloudflare for production, or authorize an M3 build.
The historical M1 requirements, D1 and M2-02 comparisons remain records of their original scope.
App blocking is already available in other products and Android's own Digital Wellbeing. The
product hypothesis worth testing is the **connection between interruption and local Help now**,
with an optional in-app commitment delay. The recovery flow is not implemented or clinically
validated; this decision makes no treatment-outcome claim.

| ID | Approved D13 boundary |
|---|---|
| AB1 | Adults opt in, choose specific installed apps and the active schedule in a calm state. Installation alone blocks nothing. Recovery works if either protection layer is absent. |
| AB2 | App interruption follows the Owner-approved **HYBRID** policy. **Normal protection:** a selected-app foreground transition triggers a prompt interruption with **Help now / Home** and, after the approved pause/help flow, **Continue may remain available**. **Emergency “I'm at risk now” mode:** selected apps are under a temporary hard block for the user-configured active window, with no Continue into those selected apps during that window. Both modes preserve Home, emergency calling and essential/system functions. Exact timing, escape and failure semantics remain evidence-gated by AB-01 and the later task contract. Android can briefly display the target first; no pre-launch or force-stop guarantee is made. |
| AB3 | A local, optional commitment delay applies only to changing the app's own block list, schedule or blocker toggle. It has an explained, bounded escape path and never blocks Android Settings, permission revocation, uninstall, emergency calling or essential system functions. No Device Owner, legacy Device Admin or root. A crash, restart or interruption loop must not trap the owner. This preserves H5 and H8. Any uninstall-resistance investigation is outside L1 and, under the Owner's Conservative Gate, cannot begin until H5 is explicitly reopened/amended and a dedicated security/privacy/Play review is approved. |
| AB4 | The A8 DNS candidate and app blocker are independent. DNS has its own Filter Active evidence and browser coverage. The blocker has a separate App Blocking Active status and a named set of tested apps/launch paths. Neither status promotes the other, and the combined UI cannot imply universal protection. |
| AB5 | For **L1 app interruption**, store selected package IDs and schedule locally. L1 reads or stores no URL, screen text, thumbnails or browsing history. A local attempts count is optional, off by default; no per-attempt package/time trail, analytics, ad SDK or backend. Recovery notes stay separate and optional. This L1 boundary does not reject D14's separate L2b Web Guard product scope; under the Owner's Conservative Gate, any Web Guard keyword/screen-content design or spike first requires the affected H9 boundary to be explicitly reopened/amended plus a dedicated security/privacy/Play review. |
| AB6 | For the bounded **L1 AB-01 spike only**, try Usage Access plus a block-screen overlay first. Compare narrowly configured **package-only** Accessibility events only if the narrower route misses the pre-registered interruption target or cannot satisfy privacy, battery or distribution constraints. No window-content retrieval, text/key filtering or screenshots are authorized. Any production Accessibility use remains a separate task-contract and release decision and requires prominent disclosure, affirmative consent, accurate Play listing/declaration and Play approval. |
| AB7 | Blocking an entire selected app is **L1** scope. D14 separately approves **L2b Web Guard** (domain/website and keyword protection) and self-protection screen reading as **product scope with mechanism deferred**; they are not consequences of AB1–AB6. Under the Owner's Conservative Gate, no Web Guard keyword/screen-content design, spike or task contract starts until the affected H9 boundary is explicitly reopened/amended and a dedicated security/privacy/Play review is approved. Uninstall-resistance is likewise separate and blocked behind an explicit H5 reopening/amendment. Blocking Android Settings is not authorized here. |

H5 and H9 remain the operative approved boundaries for L1. The Owner selected a **Conservative Gate** on 2026-09-27: any D14-sensitive exploration that would touch uninstall resistance (H5) or screen-content inspection (H9) must first reopen/amend the affected boundary and pass a dedicated security/privacy/Play review. The M2-02 H16/A7b exclusion
addresses **Accessibility as a URL detector**; AB6 considers package-only app blocking. D1's
condition requires a new architecture review and explicit human approval. The Owner approved the
direction in conversation; the exact GitHub architecture boundary is now approved as D13 / AB1–AB7.

## 2. Minimal boundaries and interfaces

| Component | Owns | Must not own |
|---|---|---|
| Recovery | Private support flow and optional notes | A dependency on DNS or blocker availability |
| Local block policy | Selected packages, schedule, optional in-app delay | DNS hostnames, app-content inspection, remote configuration |
| Foreground detector | A transient package-change signal and service health | Persisted app-usage history or screen-content tree |
| Interruption UI | Opaque block screen, Home/Back and Help now | System permission dialogs, Android Settings, a hidden unlock trap |
| Status/claims | Independent DNS and blocker states with test-bound coverage | One undifferentiated “Protected” boolean |

The normal-mode event path is: **package transition → check local policy → cover promptly → offer Help now / Home → Continue only if the approved pause/help flow permits it**.
During an active user-configured emergency window, the selected-app path is **package transition → check emergency policy → temporary hard block → Help now / Home**, with no Continue into that selected app until the window expires. The spike starts with a UsageStatsManager-based signal plus permitted overlay;
only if it misses the product target or fails a privacy, battery or distribution constraint does it
compare `AccessibilityService` window-change events,
a narrow service configuration and an
accessibility overlay/global Home action if needed. The latter can work with package names without
requesting window-content retrieval; that is a design constraint to verify, not a measured result.
An overlay is not permission to impersonate system UI. Recursion on our own recovery UI and
rapid app switches must not strand the user.

No `QUERY_ALL_PACKAGES` is authorized. How to present a user-selectable app list under Android
package visibility rules is part of the spike. The existing M1 `VpnService` and its
`systemExempted` foreground-service type confer **no** background-execution privilege on a new
blocker service; any additional service, notification or overlay permission must be justified
against its own Android contract. The build and Play declaration impact is reviewed before code
ships. A8's eventual production build disposition for the experimental M1 VPN is unchanged.
Usage events are queried, not pushed as a general immediate foreground-change callback. Continuous
polling may require a persistent foreground service, notification, battery cost and OEM background
behavior review. Its service type is **not yet selected**: `specialUse` is one possible type only
if justified under Android and Play rules; it is not implied by choosing Usage Access.

## 3. Permissions, privacy and exit

| Capability | Why it might be needed | Decision and limitation |
|---|---|---|
| Usage Access | Query app usage / foreground events | First prototype candidate; polling or delayed events may miss the prompt-interruption target. Do not keep a usage timeline. A required persistent service, notification and Play declaration are evaluated rather than assumed. |
| Draw over other apps | Cover a chosen target without relying on a background Activity launch | Prototype candidate; explicit system grant and visible in-app explanation. Do not cover Settings or system consent screens. |
| AccessibilityService | Window-change event, optional accessibility overlay or Home action | **Conditional candidate only** if the narrower route fails. Request only required event types; do not request window-content retrieval, key filtering, text events or screenshots. The OS grant is broad in consequence even with narrow app-side processing. |
| Device Admin / Device Owner | Would raise removal friction or control settings | Not selected. The user's right to revoke permissions and uninstall remains. |

For Accessibility, the app must tell the user before the system grant that Android may expose
information about the apps on screen, exactly which signal we process, what stays local and how
to turn it off. Do not mark `isAccessibilityTool=true` for a general recovery app. Google's
policy permits narrow deterministic rules but requires declaration, prominent disclosure,
affirmative consent and review; it also restricts preventing ordinary users from disabling or
uninstalling apps through the API. Store no raw Accessibility events. A denied or revoked grant
means App Blocking Inactive/Unavailable, never a green status. Permission and local-data deletion
must be clear, with a usable exit from a mistaken block.
Android Advanced Protection may restrict non-accessibility-tool services; this is a compatibility
and claim boundary, not a reason to misdeclare the app as an accessibility tool. Test the actual
target Android/OEM configuration and show Unavailable if the chosen signal cannot run.

Data model: a locally stored list of chosen package identifiers and schedule plus an optional
aggregate counter. Updates to the list and schedule are atomic; the detector uses one immutable
snapshot per event so a simultaneous rule edit cannot leave an inconsistent decision. A locally
configured delay changes **in-app** policy changes only. No accounts, sync, per-domain rows or
server-side event pipeline are introduced. Export, backup and retention are decided before any
event-count feature; the current app has `allowBackup=false`.

## 4. State and truthful claim

Keep `Filter Active` exclusively for the verified DNS boundary (H7/H15). Separately expose:

- **App Blocking Active:** user has enabled it, required grants are observed, the event service is
  connected, a usable policy exists and the current device/configuration has passed the approved
  launch-path tests. This is evidence of a working mechanism, not proof that every attempted
  launch will be blocked.
- **Needs setup / Unavailable / Stopped / Degraded:** missing grant, unsupported device behavior,
  service disconnected, disabled schedule, stale/unverified coverage or a tested bypass. Present
  the reason and a repair action. A restored service does not inherit an old success claim.

Before any user-facing claim, maintain an explicit L1 coverage register with each tested path classified **COVERED / DETECTED / DISCLOSED / UNKNOWN**, including launcher, notification, deep link, Recents, cold/warm start, split screen, floating windows, secondary profiles and alternative clients. Name the tested apps, Android/OEM version, profile, launch paths and remaining first-frame exposure. Blocking a package does not block the same service's website, an alternative
client, a Lite variant or an instance installed in another profile. Never say “cannot open”,
“unbreakable”, “prevents uninstall” or that DNS
filters content inside an allowed app. H10 applies to **both** layers. A discreet icon/name can
be explored, but cannot hide the permission explanation, OS notifications or the product's
actual purpose from the user.

## 5. Acceptance and rejection before implementation or release

The Owner-approved D13 architecture boundary is recorded. Before production code, perform a small user/product check: ask which apps people would choose, whether they understand and accept each permission explanation, whether the **normal** interruption actually leads to Help now, and whether the already-decided **emergency temporary hard-block** semantics are understandable and usable. The product check does not re-open OD6 or choose between normal and emergency product policy. A voluntary, manual Digital Wellbeing Focus Mode plus recovery shortcut can
test that last hypothesis cheaply; it is not evidence that our technical blocker works. The
recovery content brief remains a draft and requires its own appropriate review before clinical
or effectiveness claims.

The enforcement mechanism and strength claim are **UNKNOWN** until a bounded, harmless-app spike.
The proposed timebox and its relationship to #40/#41 are tracked in
[AB-01 / issue #61](https://github.com/takh86/ai-engineering-lab/issues/61).
Before collecting timing data, record a fixed duration, device matrix, benign target apps and a
maximum delay from foreground transition to an opaque, untappable interruption. The starting
product hypothesis is **at most one second**, subject to the product check before it becomes an
acceptance threshold. Also record whether any target content could be read or tapped; latency
alone cannot certify the user experience. Do not relax the threshold after seeing results.

| Gate | Evidence required | If it fails |
|---|---|---|
| Mechanism | Try Usage Access/overlay first; compare narrow Accessibility only if necessary on the same physical device for launcher, notification, deep link, Recents, cold/warm start, split screen, reboot, rapid switches, floating windows/chat bubbles, battery restrictions and Advanced Protection when available. Capture timing, first-frame exposure and target interaction. | Select the variant supported by results; if neither meets the pre-registered boundary, narrow the claim or reject app blocking. Do not present “immediate” as proven. |
| Safety/reliability | Revoke each permission; kill or disable the service; edit rules concurrently; crash and restore; test self-block loops, emergency/essential-app allowlist, false positives and exit. DNS/recovery continue independently. | No App Blocking Active claim for that state; fix or disclose the gap. |
| Coverage boundaries | Characterize the same service in a browser, a Lite/alternative client, and in Samsung Secure Folder, Dual Messenger or a work profile when available, without real sensitive content. Record unsupported configurations as DISCLOSED rather than quietly dropping them. | No claim that blocking one package covers another package, profile or website. |
| Privacy/distribution | Verify merged manifest and in-app consent against the actual Play declaration; test that no screen text, URL, raw events or attempt history are persisted or sent. Review OEM restrictions. | Do not distribute the affected build or request the sensitive permission. |
| Product | On the same benign test app, observe whether Help now is reachable and whether the commitment delay adds useful steps/time without trapping the owner. | Adjust the flow and the claim; never add an OS lock by default. |

This is an architecture and validation gate, not a production implementation plan. No device
results are recorded here. A8's V0–V13 and friction work continue under their own pre-registered
criteria. A combined release claim requires **both** decisions and their separate evidence.

## 6. Sources checked on 2026-09-26

- [Android AccessibilityEvent](https://developer.android.com/reference/android/view/accessibility/AccessibilityEvent): window events and package name; event source is unavailable without window-content retrieval.
- [Android AccessibilityService](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService): service callbacks and `GLOBAL_ACTION_HOME`.
- [Android AccessibilityServiceInfo](https://developer.android.com/reference/android/accessibilityservice/AccessibilityServiceInfo): event and package filtering, window-content capability.
- [Android UsageStatsManager](https://developer.android.com/reference/android/app/usage/UsageStatsManager): query-based usage events and user-granted Usage Access.
- [Android Advanced Protection Mode](https://developer.android.com/privacy-and-security/advanced-protection-mode) and [Android Help](https://support.google.com/android/answer/16339980?hl=en): restricted capabilities, including accessibility-tool restrictions.
- [Google's Android 17 security update](https://blog.google/security/whats-new-in-android-security-privacy-2026/): Accessibility restrictions for apps not labeled as verified accessibility tools under Advanced Protection.
- [Google Play foreground-service requirements](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en): service types and their review; `specialUse` only in limited justified cases.
- [Android Digital Wellbeing Focus Mode](https://support.google.com/android/answer/9346420?hl=en): built-in app pausing for the no-code product check.
- [Google Play Accessibility API policy](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en): deterministic automation, declaration, disclosure and consent.
- [Google Play sensitive API policy](https://support.google.com/googleplay/android-developer/answer/16909972?hl=en-GB): restrictions on disabling/uninstalling and misleading use.
- [AppBlock permissions](https://appblock.app/help/android/personal-data/) and [Strict Mode](https://appblock.app/help/android/strict-mode/): competitive example, **not** an audit of its implementation or approval for ours.

**AI contribution:** Codex drafted this bounded decision and checked sources. The Owner approved
the product direction, local-data approach and permission review in the project conversation.
