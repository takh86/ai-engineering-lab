package com.muslimrecovery.protection.domain.rules

/**
 * An immutable collection of block-only [DomainRule]s and the pure, deterministic engine that
 * evaluates a hostname against them.
 *
 * [rules] is defensively copied at construction time, so mutating a [MutableList] passed to the
 * constructor after the fact has no effect on this instance's behavior.
 *
 * Input contract: [evaluate] takes a bare hostname/domain name (e.g. `www.blocked.example`),
 * never a full URL. Malformed input produces [RuleDecision.InvalidInput] rather than being
 * silently treated as [RuleDecision.Allowed].
 */
class RuleSet(rules: List<DomainRule>) {

    private val rules: List<DomainRule> = rules.toList()

    fun evaluate(hostname: String): RuleDecision {
        val candidate = NormalizedHostname.of(hostname)
            ?: return RuleDecision.InvalidInput(InvalidReason.MALFORMED_HOSTNAME)

        val matchedRule = rules.firstOrNull { it.matches(candidate) }
        return if (matchedRule != null) RuleDecision.Blocked(matchedRule) else RuleDecision.Allowed
    }
}
