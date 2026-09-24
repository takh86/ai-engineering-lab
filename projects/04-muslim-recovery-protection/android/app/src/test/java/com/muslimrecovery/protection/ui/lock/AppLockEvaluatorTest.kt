package com.muslimrecovery.protection.ui.lock

import org.junit.Assert.assertEquals
import org.junit.Test

class AppLockEvaluatorTest {

    @Test
    fun `initial state is Locked when the device has a screen lock configured`() {
        val state = AppLockEvaluator.initial(deviceCredentialAvailable = true)

        assertEquals(AppLockState.Locked, state)
    }

    @Test
    fun `initial state is DeviceCredentialUnavailable when the device has no screen lock`() {
        val state = AppLockEvaluator.initial(deviceCredentialAvailable = false)

        assertEquals(AppLockState.DeviceCredentialUnavailable, state)
    }

    @Test
    fun `a successful confirmation from Locked unlocks`() {
        val state = AppLockEvaluator.afterAuthResult(AppLockState.Locked, succeeded = true)

        assertEquals(AppLockState.Unlocked, state)
    }

    @Test
    fun `a failed confirmation from Locked stays Locked`() {
        val state = AppLockEvaluator.afterAuthResult(AppLockState.Locked, succeeded = false)

        assertEquals(AppLockState.Locked, state)
    }

    @Test
    fun `an auth result while already Unlocked is a no-op`() {
        val state = AppLockEvaluator.afterAuthResult(AppLockState.Unlocked, succeeded = false)

        assertEquals(AppLockState.Unlocked, state)
    }

    @Test
    fun `an auth result while DeviceCredentialUnavailable is a no-op`() {
        val state = AppLockEvaluator.afterAuthResult(
            AppLockState.DeviceCredentialUnavailable,
            succeeded = true,
        )

        assertEquals(AppLockState.DeviceCredentialUnavailable, state)
    }
}
