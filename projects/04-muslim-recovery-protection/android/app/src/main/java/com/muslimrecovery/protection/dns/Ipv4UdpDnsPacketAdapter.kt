package com.muslimrecovery.protection.dns

/** An IPv4 address as its 32 network-order bits. */
@JvmInline
value class Ipv4Address(val bits: Int) {

    override fun toString(): String =
        "${(bits ushr 24) and 0xFF}.${(bits ushr 16) and 0xFF}.${(bits ushr 8) and 0xFF}.${bits and 0xFF}"

    fun toByteArray(): ByteArray =
        byteArrayOf((bits ushr 24).toByte(), (bits ushr 16).toByte(), (bits ushr 8).toByte(), bits.toByte())

    companion object {
        /** Parses a strict dotted-quad literal (no hostnames, no shorthand); null if invalid. */
        fun parse(dotted: String): Ipv4Address? {
            val parts = dotted.split(".")
            if (parts.size != 4) return null
            var bits = 0
            for (part in parts) {
                if (part.isEmpty() || part.length > 3 || part.any { it !in '0'..'9' }) return null
                val value = part.toInt()
                if (value > 255) return null
                bits = (bits shl 8) or value
            }
            return Ipv4Address(bits)
        }
    }
}

/** Why a packet read from the TUN is not a DNS query this adapter will handle. It is dropped. */
enum class PacketRejectReason {
    TRUNCATED_IP_HEADER,
    NOT_IPV4,
    INVALID_IHL,
    INVALID_TOTAL_LENGTH,
    BAD_IP_HEADER_CHECKSUM,
    FRAGMENTED,
    NOT_UDP,
    WRONG_DESTINATION_ADDRESS,
    TRUNCATED_UDP_HEADER,
    INVALID_UDP_LENGTH,
    WRONG_DESTINATION_PORT,
    INVALID_SOURCE_PORT,
}

sealed interface PacketParseResult {

    /**
     * A UDP datagram addressed to the virtual DNS endpoint. [dnsPayload] is a copy of the UDP payload
     * (the raw DNS message); it is excluded from [toString].
     */
    class DnsDatagram(
        val source: Ipv4Address,
        val sourcePort: Int,
        val destination: Ipv4Address,
        val destinationPort: Int,
        val dnsPayload: ByteArray,
    ) : PacketParseResult {
        override fun toString(): String = "DnsDatagram(payloadLength=${dnsPayload.size})"
    }

    data class Rejected(val reason: PacketRejectReason) : PacketParseResult
}

/**
 * The minimal IPv4 + UDP framing needed to carry DNS through the DNS-only TUN (D11). This is NOT a
 * general packet parser: it only accepts unfragmented IPv4/UDP datagrams addressed to
 * [virtualDnsAddress]:53 and rejects everything else without looking further. It never inspects
 * TCP, HTTP, TLS, or any other application content.
 *
 * Input checks, in order: minimum IPv4 header size, version 4, IHL (>= 5 and within the packet),
 * total length (covers the header and fits the bytes actually read), IPv4 header checksum (the
 * local kernel always computes it, so a mismatch means corruption), not a fragment, protocol UDP,
 * destination address, UDP header present, UDP length (>= 8 and within the IP payload), destination
 * port 53, and a non-zero source port (a reply must be addressable). UDP checksums on input are not
 * verified: the datagram was produced by the local kernel and the DNS payload is validated
 * independently by [DnsMessageCodec].
 *
 * Responses are built as fresh 20-byte-header IPv4 packets with source/destination addresses and
 * ports swapped relative to the query, and with both the IPv4 header checksum and the UDP checksum
 * (over the RFC 768 pseudo-header) computed.
 */
class Ipv4UdpDnsPacketAdapter(private val virtualDnsAddress: Ipv4Address) {

    fun parse(packet: ByteArray, length: Int): PacketParseResult {
        if (length < 0 || length > packet.size) return reject(PacketRejectReason.TRUNCATED_IP_HEADER)
        if (length < IPV4_MIN_HEADER_LENGTH) return reject(PacketRejectReason.TRUNCATED_IP_HEADER)

        val versionAndIhl = packet[0].toInt() and 0xFF
        if (versionAndIhl ushr 4 != 4) return reject(PacketRejectReason.NOT_IPV4)

        val headerLength = (versionAndIhl and 0x0F) * 4
        if (headerLength < IPV4_MIN_HEADER_LENGTH || headerLength > length) return reject(PacketRejectReason.INVALID_IHL)

        val totalLength = readU16(packet, 2)
        if (totalLength < headerLength || totalLength > length) return reject(PacketRejectReason.INVALID_TOTAL_LENGTH)

        if (InternetChecksum.compute(packet, 0, headerLength) != 0) {
            return reject(PacketRejectReason.BAD_IP_HEADER_CHECKSUM)
        }

        val flagsAndFragmentOffset = readU16(packet, 6)
        if (flagsAndFragmentOffset and (FLAG_MORE_FRAGMENTS or FRAGMENT_OFFSET_MASK) != 0) {
            return reject(PacketRejectReason.FRAGMENTED)
        }

        if (packet[9].toInt() and 0xFF != PROTOCOL_UDP) return reject(PacketRejectReason.NOT_UDP)

        val source = Ipv4Address(readI32(packet, 12))
        val destination = Ipv4Address(readI32(packet, 16))
        if (destination != virtualDnsAddress) return reject(PacketRejectReason.WRONG_DESTINATION_ADDRESS)

        val ipPayloadLength = totalLength - headerLength
        if (ipPayloadLength < UDP_HEADER_LENGTH) return reject(PacketRejectReason.TRUNCATED_UDP_HEADER)

        val udpStart = headerLength
        val sourcePort = readU16(packet, udpStart)
        val destinationPort = readU16(packet, udpStart + 2)
        val udpLength = readU16(packet, udpStart + 4)
        if (udpLength < UDP_HEADER_LENGTH || udpLength > ipPayloadLength) {
            return reject(PacketRejectReason.INVALID_UDP_LENGTH)
        }
        if (destinationPort != DNS_PORT) return reject(PacketRejectReason.WRONG_DESTINATION_PORT)
        if (sourcePort == 0) return reject(PacketRejectReason.INVALID_SOURCE_PORT)

        val payloadStart = udpStart + UDP_HEADER_LENGTH
        return PacketParseResult.DnsDatagram(
            source = source,
            sourcePort = sourcePort,
            destination = destination,
            destinationPort = destinationPort,
            dnsPayload = packet.copyOfRange(payloadStart, udpStart + udpLength),
        )
    }

    /**
     * Wraps [dnsPayload] in an IPv4/UDP packet travelling back to the querying flow: source is the
     * query's destination (virtual DNS address, port 53), destination is the query's source address
     * and port. Returns null if the payload cannot fit in one IPv4 packet.
     */
    fun buildResponse(query: PacketParseResult.DnsDatagram, dnsPayload: ByteArray): ByteArray? {
        val udpLength = UDP_HEADER_LENGTH + dnsPayload.size
        val totalLength = IPV4_MIN_HEADER_LENGTH + udpLength
        if (totalLength > MAX_IPV4_TOTAL_LENGTH) return null

        val packet = ByteArray(totalLength)
        packet[0] = 0x45.toByte() // version 4, IHL 5 (no options)
        writeU16(packet, 2, totalLength)
        writeU16(packet, 4, 0) // identification: unused for an atomic (DF, unfragmented) datagram (RFC 6864)
        writeU16(packet, 6, FLAG_DONT_FRAGMENT)
        packet[8] = DEFAULT_TTL.toByte()
        packet[9] = PROTOCOL_UDP.toByte()
        writeI32(packet, 12, query.destination.bits)
        writeI32(packet, 16, query.source.bits)
        writeU16(packet, 10, InternetChecksum.compute(packet, 0, IPV4_MIN_HEADER_LENGTH))

        val udpStart = IPV4_MIN_HEADER_LENGTH
        writeU16(packet, udpStart, query.destinationPort)
        writeU16(packet, udpStart + 2, query.sourcePort)
        writeU16(packet, udpStart + 4, udpLength)
        dnsPayload.copyInto(packet, udpStart + UDP_HEADER_LENGTH)

        val udpChecksum = InternetChecksum.udpOverIpv4(
            source = query.destination,
            destination = query.source,
            segment = packet,
            offset = udpStart,
            length = udpLength,
        )
        // RFC 768: a computed checksum of zero is transmitted as all ones (zero means "no checksum").
        writeU16(packet, udpStart + 6, if (udpChecksum == 0) 0xFFFF else udpChecksum)
        return packet
    }

    private fun reject(reason: PacketRejectReason) = PacketParseResult.Rejected(reason)

    companion object {
        const val DNS_PORT = 53

        private const val IPV4_MIN_HEADER_LENGTH = 20
        private const val UDP_HEADER_LENGTH = 8
        private const val MAX_IPV4_TOTAL_LENGTH = 0xFFFF
        private const val PROTOCOL_UDP = 17
        private const val DEFAULT_TTL = 64
        private const val FLAG_DONT_FRAGMENT = 0x4000
        private const val FLAG_MORE_FRAGMENTS = 0x2000
        private const val FRAGMENT_OFFSET_MASK = 0x1FFF

        /** Largest DNS payload [buildResponse] can wrap: 65535 - 20 (IPv4) - 8 (UDP). */
        const val MAX_DNS_PAYLOAD_LENGTH = MAX_IPV4_TOTAL_LENGTH - IPV4_MIN_HEADER_LENGTH - UDP_HEADER_LENGTH

        private fun readU16(bytes: ByteArray, index: Int): Int =
            ((bytes[index].toInt() and 0xFF) shl 8) or (bytes[index + 1].toInt() and 0xFF)

        private fun readI32(bytes: ByteArray, index: Int): Int = (readU16(bytes, index) shl 16) or readU16(bytes, index + 2)

        private fun writeU16(bytes: ByteArray, index: Int, value: Int) {
            bytes[index] = (value ushr 8).toByte()
            bytes[index + 1] = value.toByte()
        }

        private fun writeI32(bytes: ByteArray, index: Int, value: Int) {
            writeU16(bytes, index, value ushr 16)
            writeU16(bytes, index + 2, value)
        }
    }
}

/** RFC 1071 Internet checksum (16-bit one's complement of the one's complement sum). */
internal object InternetChecksum {

    /**
     * The checksum of [length] bytes starting at [offset]. Computing it over a region that already
     * contains a correct checksum field yields 0 — which is how received IPv4 headers are verified.
     */
    fun compute(bytes: ByteArray, offset: Int, length: Int): Int = fold(sum(bytes, offset, length, 0L))

    /** UDP checksum over the IPv4 pseudo-header (RFC 768) plus the UDP header and payload. */
    fun udpOverIpv4(source: Ipv4Address, destination: Ipv4Address, segment: ByteArray, offset: Int, length: Int): Int {
        var total = 0L
        total += (source.bits ushr 16).toLong() + (source.bits and 0xFFFF).toLong()
        total += (destination.bits ushr 16).toLong() + (destination.bits and 0xFFFF).toLong()
        total += 17L // zero byte + protocol UDP
        total += length.toLong()
        return fold(sum(segment, offset, length, total))
    }

    private fun sum(bytes: ByteArray, offset: Int, length: Int, initial: Long): Long {
        var total = initial
        var i = offset
        val end = offset + length
        while (i + 1 < end) {
            total += ((bytes[i].toInt() and 0xFF) shl 8 or (bytes[i + 1].toInt() and 0xFF)).toLong()
            i += 2
        }
        if (i < end) total += ((bytes[i].toInt() and 0xFF) shl 8).toLong()
        return total
    }

    private fun fold(sum: Long): Int {
        var folded = sum
        while (folded ushr 16 != 0L) folded = (folded and 0xFFFF) + (folded ushr 16)
        return folded.inv().toInt() and 0xFFFF
    }
}
