package com.muslimrecovery.protection.dns

import com.muslimrecovery.protection.dns.DnsTestPackets.VIRTUAL_DNS
import com.muslimrecovery.protection.dns.DnsTestPackets.ipv4Udp
import com.muslimrecovery.protection.dns.DnsTestPackets.query
import com.muslimrecovery.protection.dns.DnsTestPackets.readU16
import com.muslimrecovery.protection.dns.DnsTestPackets.response
import com.muslimrecovery.protection.domain.rules.DomainRule
import com.muslimrecovery.protection.domain.rules.RuleSet
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class DnsPacketProcessorTest {

    /** Records every forward and answers with a scripted result. */
    private class FakeUpstream(var answer: (DnsQuery, ByteArray) -> UpstreamDnsResult) : UpstreamDnsExchange {
        val forwarded = mutableListOf<ByteArray>()

        override fun exchange(query: DnsQuery, message: ByteArray): UpstreamDnsResult {
            forwarded += message.copyOf()
            return answer(query, message)
        }
    }

    private val upstream = FakeUpstream { _, message -> UpstreamDnsResult.Response(response(message)) }
    private val adapter = Ipv4UdpDnsPacketAdapter(VIRTUAL_DNS)
    private val processor = DnsPacketProcessor(
        adapter = adapter,
        engine = DnsFilteringEngine(RuleSet(listOf(DomainRule.of("blocked.example")!!))),
        upstream = upstream,
    )

    /** Parses a response packet (addressed back to the TUN) and returns its DNS payload. */
    private fun dnsPayloadOf(packet: ByteArray): ByteArray {
        assertEquals(53, readU16(packet, 20))
        return packet.copyOfRange(28, packet.size)
    }

    private fun rcode(dns: ByteArray): Int = readU16(dns, 2) and 0x000F

    @Test
    fun `blocked query is answered locally with NXDOMAIN and never reaches upstream`() {
        val packet = ipv4Udp(query("www.blocked.example", id = 0x4242))

        val result = processor.process(packet, packet.size)

        val dns = dnsPayloadOf(assertNotNullPacket(result))
        assertEquals(0x4242, readU16(dns, 0))
        assertEquals(DnsMessageCodec.RCODE_NXDOMAIN, rcode(dns))
        assertEquals(0, upstream.forwarded.size)
        assertNull(result.stopReason)
        assertEquals(ExperimentalDnsCounters(blocked = 1), processor.counters)
    }

    @Test
    fun `allowed query forwards the original DNS bytes and relays the upstream response`() {
        val message = query("allowed.example", id = 0x0A0B, withOpt = true)
        val packet = ipv4Udp(message, sourcePort = 50_505)

        val result = processor.process(packet, packet.size)

        assertEquals(1, upstream.forwarded.size)
        assertArrayEquals("forwarded unchanged", message, upstream.forwarded.single())
        val responsePacket = assertNotNullPacket(result)
        assertEquals(50_505, readU16(responsePacket, 22))
        assertArrayEquals(response(message), dnsPayloadOf(responsePacket))
        assertEquals(ExperimentalDnsCounters(forwarded = 1), processor.counters)
    }

    @Test
    fun `invalid hostname is refused locally and never reaches upstream`() {
        val packet = ipv4Udp(query("_x.blocked.example"))

        val result = processor.process(packet, packet.size)

        assertEquals(DnsMessageCodec.RCODE_REFUSED, rcode(dnsPayloadOf(assertNotNullPacket(result))))
        assertEquals(0, upstream.forwarded.size)
        assertEquals(ExperimentalDnsCounters(refusedOrUnsupported = 1), processor.counters)
    }

    @Test
    fun `malformed packet and malformed DNS are dropped without a response or a forward`() {
        val notUdp = ipv4Udp(query("allowed.example"), protocol = 6)
        val garbageDns = ipv4Udp(byteArrayOf(1, 2, 3))

        assertNull(processor.process(notUdp, notUdp.size).responsePacket)
        assertNull(processor.process(garbageDns, garbageDns.size).responsePacket)
        assertNull(processor.process(ByteArray(3), 3).responsePacket)

        assertEquals(0, upstream.forwarded.size)
        assertEquals(ExperimentalDnsCounters(dropped = 3), processor.counters)
    }

    @Test
    fun `Private DNS becoming active refuses the query and stops the runtime`() {
        upstream.answer = { _, _ -> UpstreamDnsResult.Failed(UpstreamFailure.PRIVATE_DNS_ACTIVE) }
        val packet = ipv4Udp(query("allowed.example"))

        val result = processor.process(packet, packet.size)

        assertEquals(DnsMessageCodec.RCODE_REFUSED, rcode(dnsPayloadOf(assertNotNullPacket(result))))
        assertEquals(DnsRuntimeStopReason.PRIVATE_DNS_ACTIVE, result.stopReason)
        assertEquals(DnsProxyStatus.REFUSED_PRIVATE_DNS_ACTIVE, DnsProxyStatus.fromStopReason(result.stopReason!!))
        assertEquals(ExperimentalDnsCounters(upstreamFailures = 1), processor.counters)
    }

    @Test
    fun `lost upstream network answers SERVFAIL and stops the runtime`() {
        for (failure in listOf(UpstreamFailure.UPSTREAM_UNAVAILABLE, UpstreamFailure.SOCKET_SETUP_FAILED)) {
            upstream.answer = { _, _ -> UpstreamDnsResult.Failed(failure) }
            val packet = ipv4Udp(query("allowed.example"))

            val result = processor.process(packet, packet.size)

            assertEquals(DnsMessageCodec.RCODE_SERVFAIL, rcode(dnsPayloadOf(assertNotNullPacket(result))))
            assertEquals(DnsRuntimeStopReason.UPSTREAM_UNAVAILABLE, result.stopReason)
        }
    }

    @Test
    fun `transient upstream IO error answers SERVFAIL but keeps running`() {
        upstream.answer = { _, _ -> UpstreamDnsResult.Failed(UpstreamFailure.IO_ERROR) }
        val packet = ipv4Udp(query("allowed.example"))

        val result = processor.process(packet, packet.size)

        assertEquals(DnsMessageCodec.RCODE_SERVFAIL, rcode(dnsPayloadOf(assertNotNullPacket(result))))
        assertNull(result.stopReason)
    }

    @Test
    fun `upstream timeout or cancellation stays silent so the client can retry`() {
        for (failure in listOf(UpstreamFailure.TIMEOUT, UpstreamFailure.CANCELLED)) {
            upstream.answer = { _, _ -> UpstreamDnsResult.Failed(failure) }
            val packet = ipv4Udp(query("allowed.example"))

            val result = processor.process(packet, packet.size)

            assertNull(result.responsePacket)
            assertNull(result.stopReason)
        }
    }

    @Test
    fun `upstream response too large for one IPv4 packet is not relayed`() {
        upstream.answer = { _, _ -> UpstreamDnsResult.Response(ByteArray(Ipv4UdpDnsPacketAdapter.MAX_DNS_PAYLOAD_LENGTH + 1)) }
        val packet = ipv4Udp(query("allowed.example"))

        val result = processor.process(packet, packet.size)

        assertNull(result.responsePacket)
        assertEquals(ExperimentalDnsCounters(upstreamFailures = 1), processor.counters)
    }

    @Test
    fun `processing result diagnostics never contain the hostname`() {
        val packet = ipv4Udp(query("secret-name.blocked.example"))

        val result = processor.process(packet, packet.size)

        assertEquals(false, result.toString().contains("secret"))
    }

    private fun assertNotNullPacket(result: DnsPacketProcessingResult): ByteArray {
        assertNotNull("expected a response packet", result.responsePacket)
        return result.responsePacket!!
    }
}
