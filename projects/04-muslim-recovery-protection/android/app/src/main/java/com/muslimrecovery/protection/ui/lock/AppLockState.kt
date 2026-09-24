package com.muslimrecovery.protection.ui.lock

/**
 * Pure app-lock decision, no Android framework dependency. The actual authentication is
 * delegated entirely to the platform's own device-credential prompt
 * (`KeyguardManager.createConfirmDeviceCredentialIntent`) — this type only tracks which screen
 * to show given verifiable facts (whether the device has a screen lock configured, and whether
 * the last confirmation attempt succeeded). No password/PIN is ever read, stored, or compared
 * by this app.
 */
sealed class AppLockState {
    data object Locked : AppLockState()
    data object Unlocked : AppLockState()

    /**
     * The device has no PIN/pattern/password/biometric configured, so there is no credential
     * for Android to confirm. Access is not gated in this case — a screen claiming to check a
     * lock that cannot possibly be enforced would misrepresent protection, echoing this
     * project's rule (see docs/decisions.md D8) against claiming a security state that isn't
     * actually verified.
     */
    data object DeviceCredentialUnavailable : AppLockState()
}

object AppLockEvaluator {
    fun initial(deviceCredentialAvailable: Boolean): AppLockState =
        if (deviceCredentialAvailable) AppLockState.Locked else AppLockState.DeviceCredentialUnavailable

    fun afterAuthResult(current: AppLockState, succeeded: Boolean): AppLockState =
        if (current == AppLockState.Locked && succeeded) AppLockState.Unlocked else current
}
