package com.muslimrecovery.protection.domain.rules

/**
 * The outcome of evaluating one hostname against a [RuleSet]. This is domain data consumed
 * by future protection-runtime integration — it knows nothing about VPN, DNS packets, or
 * networking.
 */
sealed interface RuleDecision {

    /** No block rule matched; the hostname is not blocked. */
    data object Allowed : RuleDecision

    /** [matchedRule] identifies exactly which rule caused the block, for diagnosability. */
    data class Blocked(val matchedRule: DomainRule) : RuleDecision

    /** The input was not a valid hostname, so it could not be evaluated. [reason] is diagnostic only. */
    data class InvalidInput(val reason: String) : RuleDecision
}
