package com.muslimrecovery.protection.domain.rules

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class NormalizedHostnameTest {

    @Test
    fun `valid hostname normalizes to lowercase labels`() {
        val hostname = NormalizedHostname.of("Blocked.Example")

        assertEquals(listOf("blocked", "example"), hostname?.labels)
        assertEquals("blocked.example", hostname?.value)
    }

    @Test
    fun `single trailing root dot is stripped`() {
        assertEquals(NormalizedHostname.of("blocked.example"), NormalizedHostname.of("blocked.example."))
    }

    @Test
    fun `hyphenated label is valid`() {
        assertNotNull(NormalizedHostname.of("safe-domain.example"))
    }

    @Test
    fun `leading or trailing hyphen in a label is invalid`() {
        assertNull(NormalizedHostname.of("-blocked.example"))
        assertNull(NormalizedHostname.of("blocked-.example"))
    }

    @Test
    fun `consecutive dots produce an empty label and are invalid`() {
        assertNull(NormalizedHostname.of("blocked..example"))
    }

    @Test
    fun `double trailing dot is invalid`() {
        assertNull(NormalizedHostname.of("blocked.example.."))
    }

    @Test
    fun `url-shaped input is invalid`() {
        assertNull(NormalizedHostname.of("https://blocked.example/path"))
    }

    @Test
    fun `whitespace-only input is invalid`() {
        assertNull(NormalizedHostname.of("   "))
    }

    @Test
    fun `empty input is invalid`() {
        assertNull(NormalizedHostname.of(""))
    }

    @Test
    fun `leading or trailing whitespace is never trimmed into validity`() {
        assertNotNull(NormalizedHostname.of("blocked.example"))
        assertNull(NormalizedHostname.of(" blocked.example"))
        assertNull(NormalizedHostname.of("blocked.example "))
        assertNull(NormalizedHostname.of(" blocked.example "))
    }

    @Test
    fun `interior whitespace is invalid`() {
        assertNull(NormalizedHostname.of("blocked .example"))
        assertNull(NormalizedHostname.of("blocked. example"))
    }
}
