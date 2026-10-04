package com.muslimrecovery.protection.feature.helpnow

/** The phases of one Help Now session (contract section 5). In-memory only; nothing here is ever persisted. */
enum class HelpNowPhase { Need, Step, Reflect, Reassess, Done }

/**
 * What the person may name they need. Optional and skippable. DRAFT content: wording lives in
 * `strings_helpnow.xml` under `helpnow_need_<name lowercase>` and is release-gated on clinical review (OD8, D-15).
 */
enum class HelpNeed { Calm, Distraction, Movement, Connection, Rest }

/**
 * The generic, built-in steps (DRAFT, release-gated on review). Strings: `helpnow_step_<name lowercase>_title` and
 * `helpnow_step_<name lowercase>_body`. Declaration order is the default order of the suggestion policy.
 */
enum class HelpStep { SlowBreathing, WaterAndStretch, ChangePlace, NameFiveThings, ShortWalk }

/** The in-session duration choices (contract section 2; OD-F3-4 confirms the values). Never persisted. */
object HelpNowDurations {
    val choicesSeconds: List<Int> = listOf(60, 90, 120)
    const val DEFAULT_SECONDS: Int = 90

    fun isAllowed(seconds: Int): Boolean = seconds in choicesSeconds
}
