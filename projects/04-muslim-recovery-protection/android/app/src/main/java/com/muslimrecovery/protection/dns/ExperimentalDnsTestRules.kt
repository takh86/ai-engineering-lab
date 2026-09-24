package com.muslimrecovery.protection.dns

import com.muslimrecovery.protection.domain.rules.DomainRule
import com.muslimrecovery.protection.domain.rules.RuleSet

/**
 * TEMPORARY M1-05 EXPERIMENT CONFIGURATION — NOT A PRODUCTION RULESET.
 *
 * Controlled, harmless test domains only (D3). `example.com` / `example.org` are IANA-reserved
 * documentation domains (RFC 2606 / RFC 6761). Blocking `example.com` exists solely to produce
 * reproducible engineering evidence for the standard-DNS filtering experiment; it has no product
 * meaning. There is no production rule distribution in M1-05.
 */
object ExperimentalDnsTestRules {

    /** Blocked by the experiment rule. */
    const val BLOCKED_TEST_DOMAIN = "example.com"

    /** A subdomain of the blocked rule; blocked by D9 label-suffix matching. */
    const val BLOCKED_TEST_SUBDOMAIN = "www.example.com"

    /** Not matched by any rule; resolution is forwarded to the underlying network's DNS server. */
    const val ALLOWED_TEST_DOMAIN = "example.org"

    fun ruleSet(): RuleSet = RuleSet(listOf(checkNotNull(DomainRule.of(BLOCKED_TEST_DOMAIN))))
}
