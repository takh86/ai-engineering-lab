package com.muslimrecovery.protection.feature.helpnow

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HelpNowTimerTest {
    private class FakeClock(var now: Long = 1_000L) : MonotonicClock {
        override fun nowMillis(): Long = now
    }

    @Test
    fun neutralNumeralsAreAsciiMinutesAndSeconds() {
        assertEquals("0:00", NeutralLatinNumerals.format(0))
        assertEquals("0:09", NeutralLatinNumerals.format(9))
        assertEquals("0:59", NeutralLatinNumerals.format(59))
        assertEquals("1:00", NeutralLatinNumerals.format(60))
        assertEquals("1:30", NeutralLatinNumerals.format(90))
        assertEquals("2:00", NeutralLatinNumerals.format(120))
        assertEquals("0:00", NeutralLatinNumerals.format(-5))
    }

    @Test
    fun neutralNumeralsNeverContainNonLatinDigitsWhateverTheDefaultLocale() {
        val saved = java.util.Locale.getDefault()
        try {
            for (tag in listOf("ar", "ar-SA", "ar-EG", "fa", "de", "en")) {
                java.util.Locale.setDefault(java.util.Locale.forLanguageTag(tag))
                for (s in 0..120) {
                    val text = NeutralLatinNumerals.format(s)
                    assertTrue("$tag $s -> $text", text.all { it in '0'..'9' || it == ':' })
                }
            }
        } finally {
            java.util.Locale.setDefault(saved)
        }
    }

    @Test
    fun remainingIsExactAgainstAnAbsoluteDeadline() {
        val deadline = 91_000L
        assertEquals(90_000L, HelpNowTimer.remainingMillis(deadline, 1_000L, 90))
        assertEquals(45_000L, HelpNowTimer.remainingMillis(deadline, 46_000L, 90))
        assertEquals(1L, HelpNowTimer.remainingMillis(deadline, 90_999L, 90))
        assertEquals(0L, HelpNowTimer.remainingMillis(deadline, 91_000L, 90))
        assertEquals(0L, HelpNowTimer.remainingMillis(deadline, 500_000L, 90))
    }

    @Test
    fun remainingIsCappedAtTheChosenDurationEvenIfTheClockMovedBackwards() {
        assertEquals(60_000L, HelpNowTimer.remainingMillis(1_000_000L, 0L, 60))
    }

    @Test
    fun displayRoundsUpSoZeroAppearsOnlyAtRealExpiry() {
        assertEquals(90, HelpNowTimer.displaySeconds(90_000L))
        assertEquals(90, HelpNowTimer.displaySeconds(89_001L))
        assertEquals(89, HelpNowTimer.displaySeconds(89_000L))
        assertEquals(1, HelpNowTimer.displaySeconds(1L))
        assertEquals(0, HelpNowTimer.displaySeconds(0L))
    }

    @Test
    fun expiryIsInclusiveOfTheDeadline() {
        assertFalse(HelpNowTimer.isExpired(5_000L, 4_999L))
        assertTrue(HelpNowTimer.isExpired(5_000L, 5_000L))
        assertTrue(HelpNowTimer.isExpired(5_000L, 9_000L))
    }

    @Test
    fun controllerCountsDownAndExpiresOnTheInjectedClock() {
        val clock = FakeClock()
        val c = HelpNowController(clock)
        c.confirmNeeds()
        assertEquals(90_000L, c.remainingMillis())
        assertFalse(c.isExpired())
        clock.now += 30_000L
        assertEquals(60_000L, c.remainingMillis())
        clock.now += 60_000L
        assertEquals(0L, c.remainingMillis())
        assertTrue(c.isExpired())
    }

    @Test
    fun backgroundingForLongerThanTheTimerShowsFinishedWithoutAnyTicking() {
        val clock = FakeClock()
        val c = HelpNowController(clock)
        c.skipNeeds()
        clock.now += 10 * 60_000L // device slept or the app was backgrounded; no tick ran in between
        assertTrue(c.isExpired())
        assertEquals(0L, c.remainingMillis())
        assertEquals(HelpNowPhase.Step, c.state.phase)
    }

    @Test
    fun aRecreatedUiReadsTheSameRemainingTimeFromTheSameController() {
        val clock = FakeClock()
        val c = HelpNowController(clock)
        c.confirmNeeds()
        clock.now += 20_000L
        val before = c.remainingMillis()
        // a recreated activity reuses the controller (held by the ViewModel) and re-reads; nothing is lost or restarted
        assertEquals(before, c.remainingMillis())
        assertEquals(70_000L, before)
    }

    @Test
    fun changingTheDurationRestartsFromNowAndAnotherStepGetsAFreshDeadline() {
        val clock = FakeClock()
        val c = HelpNowController(clock)
        c.confirmNeeds()
        clock.now += 10_000L
        c.setDuration(60)
        assertEquals(60_000L, c.remainingMillis())
        c.finishStep(); c.continueFromReflect(); c.stillStrong()
        clock.now += 500_000L
        c.anotherStep()
        assertEquals(HelpNowPhase.Step, c.state.phase)
        assertEquals(60_000L, c.remainingMillis())
    }
}
