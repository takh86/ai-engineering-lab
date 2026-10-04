package com.muslimrecovery.protection.feature.helpnow

/**
 * The personal tier as seen by Help Now. A feature-local port (the shared `PersonalSupportReader` is still only a
 * proposal, OD-W1-1); the Integration Agent adapts the real source to it. Locked and Unavailable carry no text.
 */
sealed interface PersonalSupport {
    /** Unlocked: the person's own reasons and steps. [toString] is redacted so crash reports cannot leak them. */
    class Open(val reasons: List<String>, val steps: List<String>) : PersonalSupport {
        override fun toString(): String = "PersonalSupport.Open(redacted)"
    }

    data object Locked : PersonalSupport

    data object Unavailable : PersonalSupport
}

/**
 * Read-only source of the personal tier. Must never throw for a locked or failing store (return Locked or
 * Unavailable); the route still guards with a timeout and a catch, so a slow or failing source never blocks Help Now.
 */
fun interface PersonalSupportSource {
    suspend fun read(): PersonalSupport
}

/** The route waits at most this long for the personal tier; the generic tier is already on screen. */
const val PERSONAL_SUPPORT_TIMEOUT_MILLIS: Long = 1500L
