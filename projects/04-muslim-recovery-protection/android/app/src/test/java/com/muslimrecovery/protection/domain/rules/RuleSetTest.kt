package com.muslimrecovery.protection.domain.rules

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RuleSetTest {

    private fun rule(rawDomain: String): DomainRule =
        DomainRule.of(rawDomain) ?: error("test fixture domain '$rawDomain' must be a valid rule")

    private fun ruleSetOf(vararg rawDomains: String): RuleSet =
        RuleSet(rawDomains.map { rule(it) })

    @Test
    fun `exact rule domain is Blocked`() {
        val ruleSet = ruleSetOf("blocked.example")

        val decision = ruleSet.evaluate("blocked.example")

        assertEquals(RuleDecision.Blocked(rule("blocked.example")), decision)
    }

    @Test
    fun `direct subdomain is Blocked`() {
        val ruleSet = ruleSetOf("blocked.example")

        val decision = ruleSet.evaluate("www.blocked.example")

        assertEquals(RuleDecision.Blocked(rule("blocked.example")), decision)
    }

    @Test
    fun `deeply nested subdomain is Blocked`() {
        val ruleSet = ruleSetOf("blocked.example")

        val decision = ruleSet.evaluate("a.b.blocked.example")

        assertEquals(RuleDecision.Blocked(rule("blocked.example")), decision)
    }

    @Test
    fun `unrelated domain is Allowed`() {
        val ruleSet = ruleSetOf("blocked.example")

        assertEquals(RuleDecision.Allowed, ruleSet.evaluate("safe.example"))
    }

    @Test
    fun `prefix near-match domain is Allowed`() {
        val ruleSet = ruleSetOf("blocked.example")

        assertEquals(RuleDecision.Allowed, ruleSet.evaluate("notblocked.example"))
        assertEquals(RuleDecision.Allowed, ruleSet.evaluate("fakeblocked.example"))
    }

    @Test
    fun `rule domain followed by another suffix is Allowed`() {
        val ruleSet = ruleSetOf("blocked.example")

        assertEquals(RuleDecision.Allowed, ruleSet.evaluate("blocked.example.other"))
    }

    @Test
    fun `bare domain shorter than rule is Allowed`() {
        val ruleSet = ruleSetOf("blocked.example")

        assertEquals(RuleDecision.Allowed, ruleSet.evaluate("example"))
    }

    @Test
    fun `uppercase hostname normalizes and matches`() {
        val ruleSet = ruleSetOf("blocked.example")

        val decision = ruleSet.evaluate("WWW.BLOCKED.EXAMPLE")

        assertEquals(RuleDecision.Blocked(rule("blocked.example")), decision)
    }

    @Test
    fun `trailing root dot normalizes and matches`() {
        val ruleSet = ruleSetOf("blocked.example")

        val decision = ruleSet.evaluate("blocked.example.")

        assertEquals(RuleDecision.Blocked(rule("blocked.example")), decision)
    }

    @Test
    fun `rule with trailing root dot normalizes equivalently to without`() {
        val ruleSet = ruleSetOf("blocked.example.")

        assertEquals(RuleDecision.Blocked(rule("blocked.example")), ruleSet.evaluate("blocked.example"))
    }

    @Test
    fun `malformed hostname is InvalidInput`() {
        val ruleSet = ruleSetOf("blocked.example")

        val decision = ruleSet.evaluate("http://blocked.example/path")

        assertTrue(decision is RuleDecision.InvalidInput)
    }

    @Test
    fun `hostname with empty label is InvalidInput`() {
        val ruleSet = ruleSetOf("blocked.example")

        val decision = ruleSet.evaluate("blocked..example")

        assertTrue(decision is RuleDecision.InvalidInput)
    }

    @Test
    fun `empty hostname is InvalidInput`() {
        val ruleSet = ruleSetOf("blocked.example")

        assertTrue(ruleSet.evaluate("") is RuleDecision.InvalidInput)
        assertTrue(ruleSet.evaluate("   ") is RuleDecision.InvalidInput)
    }

    @Test
    fun `Blocked decision identifies the matched rule`() {
        val ruleSet = ruleSetOf("blocked.example")

        val decision = ruleSet.evaluate("www.blocked.example") as RuleDecision.Blocked

        assertEquals(rule("blocked.example"), decision.matchedRule)
    }

    @Test
    fun `identical input and rules always produce identical decision`() {
        val ruleSet = ruleSetOf("blocked.example")

        val first = ruleSet.evaluate("www.blocked.example")
        val second = ruleSet.evaluate("www.blocked.example")

        assertEquals(first, second)
    }

    @Test
    fun `multiple rules report the specific rule that matched`() {
        val ruleSet = ruleSetOf("blocked.example", "another.example")

        val decisionForBlocked = ruleSet.evaluate("sub.blocked.example") as RuleDecision.Blocked
        val decisionForAnother = ruleSet.evaluate("another.example") as RuleDecision.Blocked

        assertEquals(rule("blocked.example"), decisionForBlocked.matchedRule)
        assertEquals(rule("another.example"), decisionForAnother.matchedRule)
    }

    @Test
    fun `multiple rules leave unmatched hostname Allowed`() {
        val ruleSet = ruleSetOf("blocked.example", "another.example")

        assertEquals(RuleDecision.Allowed, ruleSet.evaluate("safe.example"))
    }
}
