package com.muslimrecovery.protection.feature.helpnow

/** A monotonic millisecond clock (injected so timer tests are exact). */
fun interface MonotonicClock {
    fun nowMillis(): Long
}

/** Production clock: elapsed real time since boot, which keeps counting while the device sleeps. */
object AndroidMonotonicClock : MonotonicClock {
    override fun nowMillis(): Long = android.os.SystemClock.elapsedRealtime()
}

/**
 * OWNER DECISION REQUIRED - OD-F3-1 (not final policy): which numerals the timer shows (Latin digits in all
 * locales, locale digits, or a user setting). Every timer digit goes through this seam so the decision is a
 * one-class change. [NeutralLatinNumerals] is the contract's neutral default and only a TEMPORARY detail.
 */
fun interface TimerNumerals {
    /** Formats a non-negative whole number of seconds as a minutes:seconds clock. */
    fun format(totalSeconds: Int): String
}

/**
 * Temporary neutral default for OD-F3-1 (not final policy). It builds the text from ASCII digits directly, with no
 * `Locale`, `NumberFormat` or `String.format`, so the output cannot depend on the device's ICU defaults.
 */
object NeutralLatinNumerals : TimerNumerals {
    override fun format(totalSeconds: Int): String {
        val total = if (totalSeconds < 0) 0 else totalSeconds
        val minutes = total / 60
        val seconds = total % 60
        return minutes.toString() + ":" + (if (seconds < 10) "0" else "") + seconds.toString()
    }
}

/** Timer arithmetic over an absolute monotonic deadline. Pure; no state. */
object HelpNowTimer {
    /** Milliseconds left, never negative and never more than the chosen duration (guards against clock oddities). */
    fun remainingMillis(deadlineMillis: Long, nowMillis: Long, durationSeconds: Int): Long =
        (deadlineMillis - nowMillis).coerceIn(0L, durationSeconds * 1000L)

    /** Whole seconds to display: rounded up, so "0:00" appears only once the deadline has really passed. */
    fun displaySeconds(remainingMillis: Long): Int = ((remainingMillis + 999L) / 1000L).toInt()

    fun isExpired(deadlineMillis: Long, nowMillis: Long): Boolean = nowMillis >= deadlineMillis
}
