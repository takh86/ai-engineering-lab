package com.muslimrecovery.protection.dns

import com.muslimrecovery.protection.dns.DnsTestPackets.TUN_ADDRESS
import com.muslimrecovery.protection.dns.DnsTestPackets.VIRTUAL_DNS
import com.muslimrecovery.protection.dns.DnsTestPackets.fixIpv4HeaderChecksum
import com.muslimrecovery.protection.dns.DnsTestPackets.ipv4Udp
import com.muslimrecovery.protection.dns.DnsTestPackets.query
import com.muslimrecovery.protection.dns.DnsTestPackets.readU16
import com.muslimrecovery.protection.dns.DnsTestPackets.referenceChecksum
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class Ipv4UdpDnsPacketAdapterTest {

    private val adapter = Ipv4UdpDnsPacketAdapter(VIRTUAL_DNS)

    private fun datagram(packet: ByteArray, length: Int = packet.size): PacketParseResult.DnsDatagram {
        val result = adapter.parse(packet, length)
        assertTrue("expected DnsDatagram but was $result", result is PacketParseResult.DnsDatagram)
        return result as PacketParseResult.DnsDatagram
    }

    private fun rejection(packet: ByteArray, length: Int = packet.size): PacketRejectReason {
        val result = adapter.parse(packet, length)
        assertTrue("expected Rejected but was $result", result is PacketParseResult.Rejected)
        return (result as PacketParseResult.Rejected).reason
    }

    /** Sets header byte [index] to [value] and re-fixes the header checksum. */
    private fun ByteArray.withHeaderByte(index: Int, value: Int): ByteArray =
        fixIpv4HeaderChecksum(copyOf().also { it[index] = value.toByte() })

    // --- Ipv4Address ---

    @Test
    fun `IPv4 address literals parse strictly`() {
        assertEquals("10.111.222.1", Ipv4Address.parse("10.111.222.1").toString())
        for (invalid in listOf("", "10.111.222", "10.111.222.1.5", "256.0.0.1", "10..0.1", " 10.0.0.1", "a.b.c.d", "1000.0.0.1")) {
            assertNull(invalid, Ipv4Address.parse(invalid))
        }
    }

    // --- valid input ---

    @Test
    fun `valid IPv4 UDP DNS packet yields addressing and a copy of the DNS payload`() {
        val payload = query("allowed.example")
        val packet = ipv4Udp(payload, sourcePort = 51_234)

        val parsed = datagram(packet)

        assertEquals(TUN_ADDRESS, parsed.source)
        assertEquals(51_234, parsed.sourcePort)
        assertEquals(VIRTUAL_DNS, parsed.destination)
        assertEquals(53, parsed.destinationPort)
        assertArrayEquals(payload, parsed.dnsPayload)
    }

    @Test
    fun `IPv4 options are skipped using IHL`() {
        val payload = query("allowed.example")
        val packet = ipv4Udp(payload, options = byteArrayOf(1, 1, 1, 0)) // NOP, NOP, NOP, EOL

        assertArrayEquals(payload, datagram(packet).dnsPayload)
    }

    @Test
    fun `bytes beyond the IP total length and UDP padding are ignored`() {
        val payload = query("allowed.example")
        val packet = ipv4Udp(payload)

        assertArrayEquals(payload, datagram(packet + ByteArray(9)).dnsPayload)
        // Only the first `packet.size` bytes of a larger read buffer are valid.
        assertArrayEquals(payload, datagram(packet + ByteArray(100) { 7 }, packet.size).dnsPayload)
    }

    // --- rejected input ---

    @Test
    fun `truncated IP header is rejected`() {
        val packet = ipv4Udp(query("allowed.example"))

        assertEquals(PacketRejectReason.TRUNCATED_IP_HEADER, rejection(ByteArray(0)))
        assertEquals(PacketRejectReason.TRUNCATED_IP_HEADER, rejection(packet, 19))
        assertEquals(PacketRejectReason.TRUNCATED_IP_HEADER, rejection(packet, -1))
        assertEquals(PacketRejectReason.TRUNCATED_IP_HEADER, rejection(packet, packet.size + 1))
    }

    @Test
    fun `wrong IP version is rejected, including IPv6`() {
        val packet = ipv4Udp(query("allowed.example"))

        assertEquals(PacketRejectReason.NOT_IPV4, rejection(packet.withHeaderByte(0, 0x65)))
        assertEquals(PacketRejectReason.NOT_IPV4, rejection(packet.copyOf().also { it[0] = 0x60 }))
    }

    @Test
    fun `invalid IHL is rejected`() {
        val packet = ipv4Udp(query("allowed.example"))

        assertEquals(PacketRejectReason.INVALID_IHL, rejection(packet.copyOf().also { it[0] = 0x44 }))
        assertEquals(PacketRejectReason.INVALID_IHL, rejection(packet.copyOf().also { it[0] = 0x40 }))
        // IHL 15 = 60 header bytes, longer than this 20-byte-header packet read with length 40.
        assertEquals(PacketRejectReason.INVALID_IHL, rejection(packet.copyOf().also { it[0] = 0x4F }, 40))
    }

    @Test
    fun `invalid total length is rejected`() {
        val packet = ipv4Udp(query("allowed.example"))

        val longerThanRead = packet.copyOf().also { it[2] = 0x7F }
        val shorterThanHeader = packet.copyOf().also {
            it[2] = 0
            it[3] = 19
        }

        assertEquals(PacketRejectReason.INVALID_TOTAL_LENGTH, rejection(fixIpv4HeaderChecksum(longerThanRead)))
        assertEquals(PacketRejectReason.INVALID_TOTAL_LENGTH, rejection(fixIpv4HeaderChecksum(shorterThanHeader)))
        assertEquals(PacketRejectReason.INVALID_TOTAL_LENGTH, rejection(packet, packet.size - 1))
    }

    @Test
    fun `corrupted IP header checksum is rejected`() {
        val packet = ipv4Udp(query("allowed.example")).copyOf().also { it[8] = 63 } // TTL changed, checksum not fixed

        assertEquals(PacketRejectReason.BAD_IP_HEADER_CHECKSUM, rejection(packet))
    }

    @Test
    fun `fragments are rejected`() {
        val payload = query("allowed.example")

        assertEquals(PacketRejectReason.FRAGMENTED, rejection(ipv4Udp(payload, flagsAndFragment = 0x2000)))
        assertEquals(PacketRejectReason.FRAGMENTED, rejection(ipv4Udp(payload, flagsAndFragment = 0x0001)))
    }

    @Test
    fun `non-UDP packets are rejected without inspecting their content`() {
        val tcp = ipv4Udp(query("allowed.example"), protocol = 6)
        val icmp = ipv4Udp(query("allowed.example"), protocol = 1)

        assertEquals(PacketRejectReason.NOT_UDP, rejection(tcp))
        assertEquals(PacketRejectReason.NOT_UDP, rejection(icmp))
    }

    @Test
    fun `packets to any other destination are rejected`() {
        val other = Ipv4Address.parse("192.0.2.53")!!

        assertEquals(PacketRejectReason.WRONG_DESTINATION_ADDRESS, rejection(ipv4Udp(query("a.example"), destination = other)))
    }

    @Test
    fun `truncated UDP header is rejected`() {
        val packet = ipv4Udp(query("allowed.example"))
        val headerOnlyPlusFour = fixIpv4HeaderChecksum(packet.copyOf(24).also {
            it[2] = 0
            it[3] = 24
        })

        assertEquals(PacketRejectReason.TRUNCATED_UDP_HEADER, rejection(headerOnlyPlusFour))
    }

    @Test
    fun `invalid UDP length is rejected`() {
        val packet = ipv4Udp(query("allowed.example"))
        val tooSmall = packet.copyOf().also {
            it[24] = 0
            it[25] = 7
        }
        val tooLarge = packet.copyOf().also {
            it[24] = 0x7F
            it[25] = 0
        }

        assertEquals(PacketRejectReason.INVALID_UDP_LENGTH, rejection(tooSmall))
        assertEquals(PacketRejectReason.INVALID_UDP_LENGTH, rejection(tooLarge))
    }

    @Test
    fun `wrong destination port is rejected`() {
        assertEquals(PacketRejectReason.WRONG_DESTINATION_PORT, rejection(ipv4Udp(query("a.example"), destinationPort = 853)))
        assertEquals(PacketRejectReason.WRONG_DESTINATION_PORT, rejection(ipv4Udp(query("a.example"), destinationPort = 5353)))
    }

    @Test
    fun `source port zero is rejected because a reply could not be addressed`() {
        assertEquals(PacketRejectReason.INVALID_SOURCE_PORT, rejection(ipv4Udp(query("a.example"), sourcePort = 0)))
    }

    // --- response construction ---

    @Test
    fun `response swaps addresses and ports and carries the payload`() {
        val request = datagram(ipv4Udp(query("allowed.example"), sourcePort = 40_123))
        val dnsResponse = byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)

        val packet = adapter.buildResponse(request, dnsResponse)!!

        assertEquals(0x45, packet[0].toInt() and 0xFF)
        assertEquals(packet.size, readU16(packet, 2))
        assertEquals(20 + 8 + dnsResponse.size, packet.size)
        assertEquals(0, readU16(packet, 6) and 0x3FFF) // not a fragment
        assertEquals(17, packet[9].toInt())
        assertArrayEquals(VIRTUAL_DNS.toByteArray(), packet.copyOfRange(12, 16))
        assertArrayEquals(TUN_ADDRESS.toByteArray(), packet.copyOfRange(16, 20))
        assertEquals(53, readU16(packet, 20))
        assertEquals(40_123, readU16(packet, 22))
        assertEquals(8 + dnsResponse.size, readU16(packet, 24))
        assertArrayEquals(dnsResponse, packet.copyOfRange(28, packet.size))
    }

    @Test
    fun `response has a valid IPv4 header checksum`() {
        val request = datagram(ipv4Udp(query("allowed.example")))

        val packet = adapter.buildResponse(request, ByteArray(33) { it.toByte() })!!

        assertEquals(0, referenceChecksum(packet.copyOfRange(0, 20)))
    }

    @Test
    fun `response has a valid UDP checksum over the pseudo-header, for even and odd payloads`() {
        val request = datagram(ipv4Udp(query("allowed.example"), sourcePort = 61_000))

        for (size in listOf(12, 13, 29, 512)) {
            val packet = adapter.buildResponse(request, ByteArray(size) { (it * 31 + 7).toByte() })!!
            val udpLength = packet.size - 20
            val pseudoHeader = packet.copyOfRange(12, 20) + byteArrayOf(0, 17) + DnsTestPackets.u16(udpLength)

            assertTrue("UDP checksum must be transmitted", readU16(packet, 26) != 0)
            assertEquals("payload size $size", 0, referenceChecksum(pseudoHeader + packet.copyOfRange(20, packet.size)))
        }
    }

    @Test
    fun `a computed UDP checksum of zero is transmitted as 0xFFFF`() {
        val request = datagram(ipv4Udp(query("allowed.example"), sourcePort = 52_000))
        // With a zero payload word the checksum is C. Replacing that word with C makes the
        // one's-complement sum 0xFFFF, so the computed checksum becomes 0 (RFC 768: send 0xFFFF).
        val base = adapter.buildResponse(request, byteArrayOf(0, 0))!!
        val c = readU16(base, 26)
        val packet = adapter.buildResponse(request, byteArrayOf((c ushr 8).toByte(), c.toByte()))!!

        val udpLength = packet.size - 20
        val pseudoHeader = packet.copyOfRange(12, 20) + byteArrayOf(0, 17) + DnsTestPackets.u16(udpLength)
        assertEquals(0xFFFF, readU16(packet, 26))
        assertEquals(0, referenceChecksum(pseudoHeader + packet.copyOfRange(20, packet.size)))
    }

    @Test
    fun `a response packet round-trips through the parser of the opposite direction`() {
        val request = datagram(ipv4Udp(query("allowed.example"), sourcePort = 45_000))
        val packet = adapter.buildResponse(request, query("allowed.example"))!!

        // Parse it as if the TUN address were the "virtual DNS" endpoint: every header field is valid.
        val reverse = Ipv4UdpDnsPacketAdapter(TUN_ADDRESS).parse(packet, packet.size)

        // Destination port is the client's ephemeral port, not 53 — everything before that check passed.
        assertEquals(PacketParseResult.Rejected(PacketRejectReason.WRONG_DESTINATION_PORT), reverse)
    }

    @Test
    fun `IPv4 checksum matches a published reference vector`() {
        // RFC 1071-style example header (commonly cited): checksum field 0xB861.
        val header = byteArrayOf(
            0x45, 0x00, 0x00, 0x73, 0x00, 0x00, 0x40, 0x00, 0x40, 0x11, 0x00, 0x00,
            0xC0.toByte(), 0xA8.toByte(), 0x00, 0x01, 0xC0.toByte(), 0xA8.toByte(), 0x00, 0xC7.toByte(),
        )

        assertEquals(0xB861, InternetChecksum.compute(header, 0, header.size))
        header[10] = 0xB8.toByte()
        header[11] = 0x61
        assertEquals(0, InternetChecksum.compute(header, 0, header.size))
    }

    @Test
    fun `payload too large for one IPv4 packet produces no response`() {
        val request = datagram(ipv4Udp(query("allowed.example")))

        assertTrue(adapter.buildResponse(request, ByteArray(Ipv4UdpDnsPacketAdapter.MAX_DNS_PAYLOAD_LENGTH)) != null)
        assertNull(adapter.buildResponse(request, ByteArray(Ipv4UdpDnsPacketAdapter.MAX_DNS_PAYLOAD_LENGTH + 1)))
    }
}
