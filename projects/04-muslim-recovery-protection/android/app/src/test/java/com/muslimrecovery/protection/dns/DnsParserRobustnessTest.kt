package com.muslimrecovery.protection.dns

import com.muslimrecovery.protection.dns.DnsTestPackets.VIRTUAL_DNS
import com.muslimrecovery.protection.dns.DnsTestPackets.ipv4Udp
import com.muslimrecovery.protection.dns.DnsTestPackets.query
import com.muslimrecovery.protection.domain.rules.DomainRule
import com.muslimrecovery.protection.domain.rules.RuleDecision
import com.muslimrecovery.protection.domain.rules.RuleSet
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import kotlin.random.Random

/**
 * Deterministic, bounded robustness check for the pure packet/DNS parsers (no external fuzzing
 * infrastructure). Fixed seeds keep every run identical. Acceptance: every input yields a controlled
 * result — no exception, no hang (JUnit timeout), and a malformed input is never turned into a
 * forward of a name the RuleSet would not itself allow.
 */
class DnsParserRobustnessTest {

    private val ruleSet = RuleSet(listOf(DomainRule.of("blocked.example")!!))
    private val engine = DnsFilteringEngine(ruleSet)
    private val adapter = Ipv4UdpDnsPacketAdapter(VIRTUAL_DNS)

    private val seeds = listOf(
        query("allowed.example"),
        query("www.blocked.example", withOpt = true),
        query("_dns.resolver.arpa", type = 64),
        query(""),
        DnsTestPackets.response(query("allowed.example")),
    )

    private fun exercise(bytes: ByteArray) {
        try {
            val parsed = DnsMessageCodec.parseQuery(bytes)
            if (parsed is DnsQueryParseResult.Supported) {
                DnsMessageCodec.buildResponse(parsed.query, DnsMessageCodec.RCODE_NXDOMAIN)
                DnsMessageCodec.isResponseTo(parsed.query, bytes, bytes.size)
            }

            val decision = engine.decide(bytes)
            if (decision is DnsFilterDecision.Forward) {
                // A forward must always be a strictly parsed query whose name the RuleSet allowed.
                assertTrue(parsed is DnsQueryParseResult.Supported)
                assertTrue(ruleSet.evaluate(decision.query.questionName) == RuleDecision.Allowed)
            }

            val packetResult = adapter.parse(bytes, bytes.size)
            if (packetResult is PacketParseResult.DnsDatagram) {
                adapter.buildResponse(packetResult, packetResult.dnsPayload)
            }
        } catch (e: Throwable) {
            if (e is AssertionError) throw e
            fail("Parser threw ${e.javaClass.simpleName} for a ${bytes.size}-byte input")
        }
    }

    @Test(timeout = 10_000)
    fun `random byte arrays never crash the parsers`() {
        val random = Random(20260924)
        repeat(20_000) {
            val length = random.nextInt(0, 600)
            exercise(random.nextBytes(length))
        }
    }

    @Test(timeout = 10_000)
    fun `mutated valid DNS messages never crash and never forward malformed names`() {
        val random = Random(1035)
        repeat(20_000) {
            val bytes = seeds[random.nextInt(seeds.size)].copyOf()
            repeat(random.nextInt(1, 6)) {
                if (bytes.isNotEmpty()) bytes[random.nextInt(bytes.size)] = random.nextInt(256).toByte()
            }
            val truncated = if (random.nextInt(4) == 0) bytes.copyOf(random.nextInt(bytes.size + 1)) else bytes
            exercise(truncated)
        }
    }

    @Test(timeout = 10_000)
    fun `mutated valid IPv4 packets never crash the adapter`() {
        val random = Random(791)
        val packets = seeds.map { ipv4Udp(it) }
        repeat(20_000) {
            val bytes = packets[random.nextInt(packets.size)].copyOf()
            repeat(random.nextInt(1, 4)) {
                bytes[random.nextInt(bytes.size)] = random.nextInt(256).toByte()
            }
            // Keep the header checksum valid half of the time so mutations reach deeper checks.
            val candidate = if (random.nextBoolean()) DnsTestPackets.fixIpv4HeaderChecksum(bytes) else bytes
            val length = if (random.nextInt(4) == 0) random.nextInt(candidate.size + 1) else candidate.size
            try {
                val result = adapter.parse(candidate, length)
                if (result is PacketParseResult.DnsDatagram) {
                    exercise(result.dnsPayload)
                    adapter.buildResponse(result, result.dnsPayload)
                }
            } catch (e: Throwable) {
                if (e is AssertionError) throw e
                fail("Adapter threw ${e.javaClass.simpleName} for a mutated packet")
            }
        }
    }

    @Test(timeout = 10_000)
    fun `adversarial name shapes are rejected quickly`() {
        val header = DnsTestPackets.header()
        val inputs = listOf(
            // A long chain of pointers, each pointing at the previous one.
            header + ByteArray(400) { if (it % 2 == 0) 0xC0.toByte() else (12 + it - 1).toByte() },
            // Hundreds of one-byte labels (exceeds the 255-octet name limit).
            header + ByteArray(600) { if (it % 2 == 0) 1 else 'a'.code.toByte() },
            // Maximum label length byte repeated with no terminator.
            header + ByteArray(600) { 63 },
            // Label length bytes of 0xFF everywhere.
            header + ByteArray(600) { 0xFF.toByte() },
        )
        for (input in inputs) {
            exercise(input)
            assertTrue(DnsMessageCodec.parseQuery(input) is DnsQueryParseResult.Malformed)
        }
    }
}
