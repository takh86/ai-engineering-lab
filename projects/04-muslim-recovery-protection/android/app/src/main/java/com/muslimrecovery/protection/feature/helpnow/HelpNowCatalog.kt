package com.muslimrecovery.protection.feature.helpnow

import androidx.annotation.StringRes
import com.muslimrecovery.protection.R

/**
 * Maps the generic content ids to string resources (DRAFT copy, release-gated). A JVM test checks that every enum
 * entry has its `helpnow_*` keys, so a new need or step cannot ship without all three languages.
 */
object HelpNowCatalog {
    @StringRes
    fun needLabel(need: HelpNeed): Int = when (need) {
        HelpNeed.Calm -> R.string.helpnow_need_calm
        HelpNeed.Distraction -> R.string.helpnow_need_distraction
        HelpNeed.Movement -> R.string.helpnow_need_movement
        HelpNeed.Connection -> R.string.helpnow_need_connection
        HelpNeed.Rest -> R.string.helpnow_need_rest
    }

    @StringRes
    fun stepTitle(step: HelpStep): Int = when (step) {
        HelpStep.SlowBreathing -> R.string.helpnow_step_slowbreathing_title
        HelpStep.WaterAndStretch -> R.string.helpnow_step_waterandstretch_title
        HelpStep.ChangePlace -> R.string.helpnow_step_changeplace_title
        HelpStep.NameFiveThings -> R.string.helpnow_step_namefivethings_title
        HelpStep.ShortWalk -> R.string.helpnow_step_shortwalk_title
    }

    @StringRes
    fun stepBody(step: HelpStep): Int = when (step) {
        HelpStep.SlowBreathing -> R.string.helpnow_step_slowbreathing_body
        HelpStep.WaterAndStretch -> R.string.helpnow_step_waterandstretch_body
        HelpStep.ChangePlace -> R.string.helpnow_step_changeplace_body
        HelpStep.NameFiveThings -> R.string.helpnow_step_namefivethings_body
        HelpStep.ShortWalk -> R.string.helpnow_step_shortwalk_body
    }
}
