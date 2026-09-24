package com.muslimrecovery.protection.dns

import java.io.ByteArrayOutputStream

/**
 * Test-only builders for DNS messages and IPv4/UDP packets, written independently of the production
 * codec/adapter so tests don't just check the code against itself. Domains used by tests are
 * harmless synthetic/documentation names only (D3).
 */
object DnsTestPackets {

    const val TYPE_A = 1
    const val TYPE_AAAA = 28
    const val TYPE_HTTPS = 65
    const val CLASS_IN = 1
    const val CLASS_CH = 3

    val VIRTUAL_DNS: Ipv4Address = Ipv4Address.parse("10.111.222.1")!!
    val TUN_ADDRESS: Ipv4Address = Ipv4Address.parse("10.111.222.2")!!

    /** Wire-encodes [name] as uncompressed labels (no escaping; tests pass plain labels). */
    fun encodeName(name: String): ByteArray {
        val out = ByteArrayOutputStream()
        if (name.isNotEmpty()) {
            for (label in name.split(".")) {
                val bytes = label.toByteArray(Charsets.US_ASCII)
                out.write(bytes.size)
                out.write(bytes)
            }
        }
        out.write(0)
        return out.toByteArray()
    }

    fun question(name: String, type: Int = TYPE_A, qclass: Int = CLASS_IN): ByteArray =
        encodeName(name) + u16(type) + u16(qclass)

    /** One EDNS OPT record (root name, type 41, 1232-byte UDP size, no options), as Android sends. */
    fun optRecord(rdata: ByteArray = ByteArray(0)): ByteArray =
        byteArrayOf(0) + u16(41) + u16(1232) + byteArrayOf(0, 0, 0, 0) + u16(rdata.size) + rdata

    fun header(
        id: Int = 0x1234,
        flags: Int = 0x0100, // RD
        qdCount: Int = 1,
        anCount: Int = 0,
        nsCount: Int = 0,
        arCount: Int = 0,
    ): ByteArray = u16(id) + u16(flags) + u16(qdCount) + u16(anCount) + u16(nsCount) + u16(arCount)

    fun query(
        name: String,
        type: Int = TYPE_A,
        id: Int = 0x1234,
        withOpt: Boolean = false,
    ): ByteArray = header(id = id, arCount = if (withOpt) 1 else 0) +
        question(name, type) +
        (if (withOpt) optRecord() else ByteArray(0))

    /** A plausible upstream response (one A record, compressed pointer to the question name). */
    fun response(query: ByteArray, rcode: Int = 0): ByteArray {
        val id = ((query[0].toInt() and 0xFF) shl 8) or (query[1].toInt() and 0xFF)
        var questionEnd = 12
        while (query[questionEnd].toInt() != 0) questionEnd += 1 + query[questionEnd]
        questionEnd += 5
        val answer = byteArrayOf(0xC0.toByte(), 12) + u16(TYPE_A) + u16(CLASS_IN) +
            byteArrayOf(0, 0, 0x0E, 0x10) + u16(4) + byteArrayOf(192.toByte(), 0, 2, 10) // 192.0.2.10 (TEST-NET-1)
        return header(id = id, flags = 0x8180 or rcode, anCount = 1) +
            query.copyOfRange(12, questionEnd) + answer
    }

    /** A well-formed IPv4/UDP packet with correct header checksum (UDP checksum left 0 = none). */
    fun ipv4Udp(
        payload: ByteArray,
        source: Ipv4Address = TUN_ADDRESS,
        destination: Ipv4Address = VIRTUAL_DNS,
        sourcePort: Int = 40_000,
        destinationPort: Int = 53,
        protocol: Int = 17,
        flagsAndFragment: Int = 0x4000,
        options: ByteArray = ByteArray(0),
    ): ByteArray {
        require(options.size % 4 == 0)
        val headerLength = 20 + options.size
        val udp = u16(sourcePort) + u16(destinationPort) + u16(8 + payload.size) + u16(0) + payload
        val header = byteArrayOf((0x40 or (headerLength / 4)).toByte(), 0) +
            u16(headerLength + udp.size) + u16(0) + u16(flagsAndFragment) +
            byteArrayOf(64, protocol.toByte(), 0, 0) + source.toByteArray() + destination.toByteArray() + options
        val checksum = referenceChecksum(header)
        header[10] = (checksum ushr 8).toByte()
        header[11] = checksum.toByte()
        return header + udp
    }

    /**
     * Recomputes the IPv4 header checksum after a test mutates header bytes. Leaves the packet
     * unchanged when its (possibly mutated) IHL doesn't describe a header that fits.
     */
    fun fixIpv4HeaderChecksum(packet: ByteArray): ByteArray {
        val copy = packet.copyOf()
        val headerLength = (copy[0].toInt() and 0x0F) * 4
        if (headerLength < 12 || headerLength > copy.size) return copy
        copy[10] = 0
        copy[11] = 0
        val checksum = referenceChecksum(copy.copyOfRange(0, headerLength))
        copy[10] = (checksum ushr 8).toByte()
        copy[11] = checksum.toByte()
        return copy
    }

    /** Straightforward RFC 1071 reference implementation, independent of production code. */
    fun referenceChecksum(bytes: ByteArray): Int {
        var sum = 0L
        var i = 0
        while (i < bytes.size) {
            val high = bytes[i].toInt() and 0xFF
            val low = if (i + 1 < bytes.size) bytes[i + 1].toInt() and 0xFF else 0
            sum += (high shl 8) + low
            i += 2
        }
        while (sum > 0xFFFF) sum = (sum and 0xFFFF) + (sum shr 16)
        return (sum.toInt().inv()) and 0xFFFF
    }

    fun u16(value: Int): ByteArray = byteArrayOf((value ushr 8).toByte(), value.toByte())

    fun readU16(bytes: ByteArray, index: Int): Int =
        ((bytes[index].toInt() and 0xFF) shl 8) or (bytes[index + 1].toInt() and 0xFF)
}
