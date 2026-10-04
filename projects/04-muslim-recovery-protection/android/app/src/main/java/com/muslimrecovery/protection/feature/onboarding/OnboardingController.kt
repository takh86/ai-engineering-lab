package com.muslimrecovery.protection.feature.onboarding

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Performs the Finish commit through the [OnboardingStore] port: serialized, called at most once successfully, and
 * never throwing for store failures. Nothing is logged and no message from a failure is kept (it could contain text).
 */
class OnboardingController(private val store: OnboardingStore) {
    private val mutex = Mutex()
    private var committed = false

    suspend fun commit(commit: OnboardingCommit): CommitResult = mutex.withLock {
        if (committed) return CommitResult.Committed
        val result = try {
            store.commitOnboarding(commit)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (ignored: Exception) {
            CommitResult.Failure(CommitFailure.FAILED)
        }
        if (result is CommitResult.Committed) committed = true
        result
    }
}
