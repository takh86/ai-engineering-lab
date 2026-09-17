package com.muslimrecovery.protection.domain.rules

/**
 * An immutable collection of block-only [DomainRule]s and the pure, deterministic engine that
 * evaluates a hostname against them.
 *
 * Input contract: [evaluate] takes a bare hostname/domain name (e.g. `www.blocked.example`),
 * never a full URL. Malformed input produces [RuleDecision.InvalidInput] rather than being
 * silently treated as [RuleDecision.Allowed].
 */
data class RuleSet(val rules: List<DomainRule>) {

    fun evaluate(hostname: String): RuleDecision {
        val candidate = NormalizedHostname.of(hostname)
            ?: return RuleDecision.InvalidInput("'$hostname' is not a valid hostname")

        val matchedRule = rules.firstOrNull { it.matches(candidate) }
        return if (matchedRule != null) RuleDecision.Blocked(matchedRule) else RuleDecision.Allowed
    }
}
