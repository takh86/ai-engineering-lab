package com.muslimrecovery.protection.feature.helpnow

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PersonalSupportTest {
    @Test
    fun openRedactsItsTextInToString() {
        val open = PersonalSupport.Open(listOf("secret-reason-91"), listOf("secret-step-92"))
        assertFalse(open.toString().contains("secret"))
        assertFalse("$open".contains("91"))
    }

    @Test
    fun lockedAndUnavailableCarryNoText() {
        assertTrue(PersonalSupport.Locked.toString().none { it.isDigit() })
        assertTrue(PersonalSupport.Locked != PersonalSupport.Unavailable)
    }

    @Test
    fun theTimeoutIsShortSoASlowStoreCannotBlockHelp() {
        assertTrue(PERSONAL_SUPPORT_TIMEOUT_MILLIS in 500L..3_000L)
    }
}
