package com.muslimrecovery.protection.domain.rules

/**
 * An explicit block rule for one domain. Matches the domain itself and any subdomain beneath
 * it, on DNS label boundaries — never by unsafe substring comparison.
 *
 * Construct via [DomainRule.of], which normalizes and validates the raw domain the same way
 * [NormalizedHostname.of] validates a candidate hostname being checked against rules.
 */
data class DomainRule(val domain: NormalizedHostname) {

    /**
     * True if [candidate] is the exact rule domain or any subdomain beneath it, respecting
     * DNS label boundaries (e.g. rule `blocked.example` matches `www.blocked.example` but not
     * `blocked.example.other` or `fakeblocked.example`).
     */
    fun matches(candidate: NormalizedHostname): Boolean {
        val ruleLabels = domain.labels
        val candidateLabels = candidate.labels
        if (candidateLabels.size < ruleLabels.size) return false

        val tail = candidateLabels.subList(candidateLabels.size - ruleLabels.size, candidateLabels.size)
        return tail == ruleLabels
    }

    companion object {
        fun of(rawDomain: String): DomainRule? = NormalizedHostname.of(rawDomain)?.let { DomainRule(it) }
    }
}
