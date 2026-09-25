package com.muslimrecovery.protection.dns

import com.muslimrecovery.protection.dns.DnsTestPackets.TYPE_AAAA
import com.muslimrecovery.protection.dns.DnsTestPackets.TYPE_HTTPS
import com.muslimrecovery.protection.dns.DnsTestPackets.header
import com.muslimrecovery.protection.dns.DnsTestPackets.query
import com.muslimrecovery.protection.dns.DnsTestPackets.question
import com.muslimrecovery.protection.dns.DnsTestPackets.readU16
import com.muslimrecovery.protection.domain.rules.DomainRule
import com.muslimrecovery.protection.domain.rules.RuleDecision
import com.muslimrecovery.protection.domain.rules.RuleSet
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DnsFilteringEngineTest {

    private val ruleSet = RuleSet(listOf(DomainRule.of("blocked.example")!!))
    private val engine = DnsFilteringEngine(ruleSet)

    private fun respond(decision: DnsFilterDecision): DnsFilterDecision.Respond {
        assertTrue("expected Respond but was $decision", decision is DnsFilterDecision.Respond)
        return decision as DnsFilterDecision.Respond
    }

    private fun rcode(response: ByteArray): Int = readU16(response, 2) and 0x000F

    @Test
    fun `blocked domain gets a synthetic NXDOMAIN with its transaction ID and question`() {
        val message = query("blocked.example", id = 0x7E57)

        val decision = respond(engine.decide(message))

        assertEquals(SyntheticResponseKind.BLOCKED_NXDOMAIN, decision.kind)
        assertEquals(0x7E57, readU16(decision.response, 0))
        assertEquals(DnsMessageCodec.RCODE_NXDOMAIN, rcode(decision.response))
        assertArrayEquals(question("blocked.example"), decision.response.copyOfRange(12, decision.response.size))
    }

    @Test
    fun `subdomain of a blocked rule is blocked`() {
        val decision = respond(engine.decide(query("deep.www.blocked.example")))

        assertEquals(SyntheticResponseKind.BLOCKED_NXDOMAIN, decision.kind)
    }

    @Test
    fun `uppercase and trailing-dot-free wire names are normalized by the RuleSet and blocked`() {
        assertEquals(SyntheticResponseKind.BLOCKED_NXDOMAIN, respond(engine.decide(query("WWW.BLOCKED.EXAMPLE"))).kind)
        assertEquals(SyntheticResponseKind.BLOCKED_NXDOMAIN, respond(engine.decide(query("Blocked.Example"))).kind)
    }

    @Test
    fun `every query type is filtered alike`() {
        for (type in listOf(1, TYPE_AAAA, TYPE_HTTPS, 64, 255, 16)) {
            val decision = respond(engine.decide(query("blocked.example", type = type)))
            assertEquals("QTYPE $type", SyntheticResponseKind.BLOCKED_NXDOMAIN, decision.kind)
        }
    }

    @Test
    fun `label-boundary semantics are the RuleSet's (D9 unchanged)`() {
        assertTrue(engine.decide(query("fakeblocked.example")) is DnsFilterDecision.Forward)
        assertTrue(engine.decide(query("blocked.example.other")) is DnsFilterDecision.Forward)
    }

    @Test
    fun `allowed domain is forwarded with its parsed query`() {
        val decision = engine.decide(query("allowed.example", id = 0x0101, withOpt = true))

        assertTrue(decision is DnsFilterDecision.Forward)
        assertEquals(0x0101, (decision as DnsFilterDecision.Forward).query.transactionId)
    }

    @Test
    fun `RuleSet InvalidInput is answered REFUSED and never forwarded`() {
        // Each of these is a well-formed DNS name that the existing RuleSet rejects as a hostname.
        val invalidHostnames = listOf(
            "_dns.resolver.arpa",
            "_x.blocked.example", // must not become a way around the block rule
            "", // root
            "-leading.example",
            "trailing-.example",
            "under_score.example",
            "back\\slash.example",
            "a/b.example",
        )
        for (name in invalidHostnames) {
            assertTrue(ruleSet.evaluate(name) is RuleDecision.InvalidInput)

            val decision = engine.decide(query(name))

            assertFalse("'$name' must not be forwarded", decision is DnsFilterDecision.Forward)
            val respond = respond(decision)
            assertEquals(SyntheticResponseKind.INVALID_HOSTNAME_REFUSED, respond.kind)
            assertEquals(DnsMessageCodec.RCODE_REFUSED, rcode(respond.response))
        }
    }

    @Test
    fun `unsupported query shapes get a synthetic error response and are never forwarded`() {
        val notify = header(flags = 0x2000) + question("allowed.example")
        val chaos = header() + question("version.bind", type = 16, qclass = DnsTestPackets.CLASS_CH)

        val notifyDecision = respond(engine.decide(notify))
        val chaosDecision = respond(engine.decide(chaos))

        assertEquals(SyntheticResponseKind.UNSUPPORTED_QUERY, notifyDecision.kind)
        assertEquals(DnsMessageCodec.RCODE_NOTIMP, rcode(notifyDecision.response))
        assertEquals(SyntheticResponseKind.UNSUPPORTED_QUERY, chaosDecision.kind)
        assertEquals(DnsMessageCodec.RCODE_REFUSED, rcode(chaosDecision.response))
    }

    @Test
    fun `malformed message is dropped`() {
        val decision = engine.decide(ByteArray(5))

        assertEquals(DnsFilterDecision.Drop(DnsMalformedReason.TRUNCATED_HEADER), decision)
    }

    @Test
    fun `diagnostic strings never contain the queried hostname`() {
        val names = listOf("secret-blocked.blocked.example", "secret-allowed.example", "_secret-invalid.example")
        for (name in names) {
            val decision = engine.decide(query(name))
            val parsed = DnsMessageCodec.parseQuery(query(name))

            assertFalse(decision.toString().contains("secret"))
            assertFalse(parsed.toString().contains("secret"))
            if (decision is DnsFilterDecision.Forward) assertFalse(decision.query.toString().contains("secret"))
        }
    }

    @Test
    fun `the experiment rule set blocks only the controlled documentation domain`() {
        val experiment = DnsFilteringEngine(ExperimentalDnsTestRules.ruleSet())

        assertEquals(
            SyntheticResponseKind.BLOCKED_NXDOMAIN,
            respond(experiment.decide(query(ExperimentalDnsTestRules.BLOCKED_TEST_DOMAIN))).kind,
        )
        assertEquals(
            SyntheticResponseKind.BLOCKED_NXDOMAIN,
            respond(experiment.decide(query(ExperimentalDnsTestRules.BLOCKED_TEST_SUBDOMAIN))).kind,
        )
        assertTrue(experiment.decide(query(ExperimentalDnsTestRules.ALLOWED_TEST_DOMAIN)) is DnsFilterDecision.Forward)
        assertTrue(experiment.decide(query("example.net")) is DnsFilterDecision.Forward)
    }
}
