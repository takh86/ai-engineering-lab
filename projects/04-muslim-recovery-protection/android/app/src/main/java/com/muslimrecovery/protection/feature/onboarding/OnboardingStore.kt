package com.muslimrecovery.protection.feature.onboarding

sealed interface CommitResult {
    object Committed : CommitResult

    data class Failure(val kind: CommitFailure) : CommitResult
}

/**
 * Feature-local port for the one write onboarding performs (a stand-in for the proposed shared `RecoveryProfileStore`
 * until the Owner approves the shared ports task, OD-W1-1, and F7 provides secure persistence).
 *
 * Contract for every implementation:
 *  - ATOMIC: mode, reasons and "onboarding is complete" become visible together or not at all. Completion is not a
 *    separate flag and there is deliberately no method to set it on its own, so a state "complete, but the choice is
 *    lost" cannot be expressed through this port.
 *  - never throws for expected failures: return [CommitResult.Failure]. Implementations must not log [commit].
 *
 * No implementation in this feature persists anything: see [InMemoryOnboardingStore].
 */
interface OnboardingStore {
    suspend fun commitOnboarding(commit: OnboardingCommit): CommitResult
}

/**
 * Process-memory implementation for developer builds and tests ONLY. It is not persistence: it does not survive a
 * process restart, it is not encrypted and it must never be bound in the play flavor (a source test guards that
 * nothing in `src/main` or `src/play` outside this feature references it). Real D1 persistence belongs to F7.
 */
class InMemoryOnboardingStore : OnboardingStore {
    private val lock = Any()
    private var record: OnboardingCommit? = null
    private var pendingFailure: CommitFailure? = null

    /** The committed choice, or null when onboarding is not complete. Completion IS the presence of the record. */
    fun snapshot(): OnboardingCommit? = synchronized(lock) { record }

    /** Makes the next commit fail with [failure], leaving no state behind. */
    fun failNextCommit(failure: CommitFailure) = synchronized(lock) { pendingFailure = failure }

    override suspend fun commitOnboarding(commit: OnboardingCommit): CommitResult = synchronized(lock) {
        val failure = pendingFailure
        if (failure != null) {
            pendingFailure = null
            CommitResult.Failure(failure)
        } else {
            record = OnboardingCommit(commit.mode, commit.reasons.toList())
            CommitResult.Committed
        }
    }
}
