package com.muslimrecovery.protection.dns

import com.muslimrecovery.protection.dns.DnsTestPackets.CLASS_CH
import com.muslimrecovery.protection.dns.DnsTestPackets.TYPE_A
import com.muslimrecovery.protection.dns.DnsTestPackets.TYPE_AAAA
import com.muslimrecovery.protection.dns.DnsTestPackets.TYPE_HTTPS
import com.muslimrecovery.protection.dns.DnsTestPackets.header
import com.muslimrecovery.protection.dns.DnsTestPackets.optRecord
import com.muslimrecovery.protection.dns.DnsTestPackets.query
import com.muslimrecovery.protection.dns.DnsTestPackets.question
import com.muslimrecovery.protection.dns.DnsTestPackets.readU16
import com.muslimrecovery.protection.dns.DnsTestPackets.response
import com.muslimrecovery.protection.dns.DnsTestPackets.u16
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DnsMessageCodecTest {

    private fun supported(message: ByteArray): DnsQuery {
        val result = DnsMessageCodec.parseQuery(message)
        assertTrue("expected Supported but was $result", result is DnsQueryParseResult.Supported)
        return (result as DnsQueryParseResult.Supported).query
    }

    private fun malformedReason(message: ByteArray): DnsMalformedReason {
        val result = DnsMessageCodec.parseQuery(message)
        assertTrue("expected Malformed but was $result", result is DnsQueryParseResult.Malformed)
        return (result as DnsQueryParseResult.Malformed).reason
    }

    private fun unsupportedReason(message: ByteArray): DnsUnsupportedReason {
        val result = DnsMessageCodec.parseQuery(message)
        assertTrue("expected Unsupported but was $result", result is DnsQueryParseResult.Unsupported)
        return (result as DnsQueryParseResult.Unsupported).reason
    }

    // --- valid queries ---

    @Test
    fun `valid one-question query is parsed`() {
        val parsed = supported(query("www.blocked.example", type = TYPE_AAAA, id = 0xBEEF))

        assertEquals(0xBEEF, parsed.transactionId)
        assertEquals("www.blocked.example", parsed.questionName)
        assertEquals(TYPE_AAAA, parsed.questionType)
        assertEquals(DnsMessageCodec.CLASS_IN, parsed.questionClass)
        assertEquals(0, parsed.opcode)
    }

    @Test
    fun `query with one EDNS OPT record is supported`() {
        val parsed = supported(query("allowed.example", withOpt = true))

        assertEquals("allowed.example", parsed.questionName)
    }

    @Test
    fun `query with OPT carrying option data is supported`() {
        val message = header(arCount = 1) + question("allowed.example") + optRecord(rdata = ByteArray(12) { 0 })

        assertEquals("allowed.example", supported(message).questionName)
    }

    @Test
    fun `uppercase name is preserved exactly as sent - normalization is the RuleSet's job`() {
        assertEquals("WWW.Blocked.EXAMPLE", supported(query("WWW.Blocked.EXAMPLE")).questionName)
    }

    @Test
    fun `root name parses to an empty question name`() {
        assertEquals("", supported(query("")).questionName)
    }

    @Test
    fun `underscore label is not a codec error - the RuleSet decides it is not a valid hostname`() {
        assertEquals("_dns.resolver.arpa", supported(query("_dns.resolver.arpa")).questionName)
    }

    @Test
    fun `maximum length name of 255 octets is accepted`() {
        // 3 labels of 63 + 1 label of 61: wire length = 3*64 + 62 + 1 (root) = 255.
        val name = listOf("a".repeat(63), "b".repeat(63), "c".repeat(63), "d".repeat(61)).joinToString(".")

        assertEquals(name, supported(query(name)).questionName)
    }

    @Test
    fun `parses a message at an offset within a larger buffer`() {
        val message = query("allowed.example")
        val buffer = ByteArray(7) + message + ByteArray(5)

        val result = DnsMessageCodec.parseQuery(buffer, offset = 7, length = message.size)

        assertEquals("allowed.example", (result as DnsQueryParseResult.Supported).query.questionName)
    }

    // --- malformed: dropped, never forwarded ---

    @Test
    fun `empty and short messages are a truncated header`() {
        assertEquals(DnsMalformedReason.TRUNCATED_HEADER, malformedReason(ByteArray(0)))
        assertEquals(DnsMalformedReason.TRUNCATED_HEADER, malformedReason(ByteArray(11)))
    }

    @Test
    fun `out of range offset and length are rejected without throwing`() {
        val message = query("allowed.example")

        assertTrue(DnsMessageCodec.parseQuery(message, offset = -1, length = 12) is DnsQueryParseResult.Malformed)
        assertTrue(DnsMessageCodec.parseQuery(message, offset = 0, length = message.size + 1) is DnsQueryParseResult.Malformed)
        assertTrue(DnsMessageCodec.parseQuery(message, offset = message.size, length = 12) is DnsQueryParseResult.Malformed)
        assertTrue(DnsMessageCodec.parseQuery(message, offset = 0, length = -5) is DnsQueryParseResult.Malformed)
    }

    @Test
    fun `a response message is not treated as a query`() {
        assertEquals(DnsMalformedReason.NOT_A_QUERY, malformedReason(response(query("allowed.example"))))
    }

    @Test
    fun `zero or multiple questions are unsupported`() {
        assertEquals(DnsMalformedReason.UNSUPPORTED_QUESTION_COUNT, malformedReason(header(qdCount = 0)))
        val twoQuestions = header(qdCount = 2) + question("a.example") + question("b.example")
        assertEquals(DnsMalformedReason.UNSUPPORTED_QUESTION_COUNT, malformedReason(twoQuestions))
    }

    @Test
    fun `truncated question is rejected`() {
        val full = query("allowed.example")

        // Cut inside a label, at the terminating zero, and inside QTYPE/QCLASS.
        assertEquals(DnsMalformedReason.TRUNCATED_QUESTION, malformedReason(full.copyOf(15)))
        assertEquals(DnsMalformedReason.TRUNCATED_QUESTION, malformedReason(full.copyOf(12 + 17)))
        assertEquals(DnsMalformedReason.TRUNCATED_QUESTION, malformedReason(full.copyOf(full.size - 1)))
        assertEquals(DnsMalformedReason.TRUNCATED_QUESTION, malformedReason(header()))
    }

    @Test
    fun `label length running past the end of the message is rejected`() {
        val message = header() + byteArrayOf(40) + "short".toByteArray()

        assertEquals(DnsMalformedReason.TRUNCATED_QUESTION, malformedReason(message))
    }

    @Test
    fun `compression pointer in the question is rejected, including a self-referencing loop`() {
        val pointerToHeader = header() + byteArrayOf(0xC0.toByte(), 0x00) + u16(TYPE_A) + u16(1)
        val pointerToItself = header() + byteArrayOf(0xC0.toByte(), 12) + u16(TYPE_A) + u16(1)

        assertEquals(DnsMalformedReason.COMPRESSION_NOT_SUPPORTED, malformedReason(pointerToHeader))
        assertEquals(DnsMalformedReason.COMPRESSION_NOT_SUPPORTED, malformedReason(pointerToItself))
    }

    @Test
    fun `label length above 63 uses reserved label types and is rejected`() {
        val length64 = header() + byteArrayOf(64) + ByteArray(64) { 'a'.code.toByte() } + byteArrayOf(0) + u16(1) + u16(1)
        val extended = header() + byteArrayOf(0x80.toByte()) + u16(1) + u16(1)

        assertEquals(DnsMalformedReason.INVALID_LABEL_TYPE, malformedReason(length64))
        assertEquals(DnsMalformedReason.INVALID_LABEL_TYPE, malformedReason(extended))
    }

    @Test
    fun `name longer than 255 octets is rejected`() {
        // 4 labels of 63: wire length = 4*64 + 1 = 257.
        val name = List(4) { "a".repeat(63) }.joinToString(".")

        assertEquals(DnsMalformedReason.NAME_TOO_LONG, malformedReason(query(name)))
    }

    @Test
    fun `label bytes that could change the dotted name are rejected`() {
        fun withLabelBytes(vararg bytes: Int): ByteArray =
            header() + byteArrayOf(bytes.size.toByte()) + ByteArray(bytes.size) { bytes[it].toByte() } +
                byteArrayOf(0) + u16(TYPE_A) + u16(1)

        // A literal dot inside one label would be indistinguishable from a label separator.
        assertEquals(DnsMalformedReason.INVALID_LABEL_CHARACTER, malformedReason(withLabelBytes('a'.code, '.'.code, 'b'.code)))
        assertEquals(DnsMalformedReason.INVALID_LABEL_CHARACTER, malformedReason(withLabelBytes('a'.code, 0x00)))
        assertEquals(DnsMalformedReason.INVALID_LABEL_CHARACTER, malformedReason(withLabelBytes(' '.code, 'a'.code)))
        assertEquals(DnsMalformedReason.INVALID_LABEL_CHARACTER, malformedReason(withLabelBytes(0xC3, 0xA9)))
        assertEquals(DnsMalformedReason.INVALID_LABEL_CHARACTER, malformedReason(withLabelBytes(0x7F)))
    }

    // --- parsed but unsupported: synthetic error response ---

    @Test
    fun `non-QUERY opcode is unsupported and answered NOTIMP`() {
        val message = header(flags = 0x2000 or 0x0100) + question("allowed.example") // opcode 4 (NOTIFY)

        val reason = unsupportedReason(message)

        assertEquals(DnsUnsupportedReason.UNSUPPORTED_OPCODE, reason)
        assertEquals(DnsMessageCodec.RCODE_NOTIMP, DnsMessageCodec.rcodeFor(reason))
    }

    @Test
    fun `answer or authority records in a query are unsupported`() {
        assertEquals(
            DnsUnsupportedReason.UNEXPECTED_ANSWER_OR_AUTHORITY_RECORDS,
            unsupportedReason(header(anCount = 1) + question("allowed.example")),
        )
        assertEquals(
            DnsUnsupportedReason.UNEXPECTED_ANSWER_OR_AUTHORITY_RECORDS,
            unsupportedReason(header(nsCount = 1) + question("allowed.example")),
        )
    }

    @Test
    fun `trailing bytes without an additional record are unsupported`() {
        assertEquals(
            DnsUnsupportedReason.UNEXPECTED_TRAILING_DATA,
            unsupportedReason(query("allowed.example") + byteArrayOf(1, 2, 3)),
        )
    }

    @Test
    fun `additional record that is not exactly one well-formed OPT is unsupported`() {
        val notOpt = header(arCount = 1) + question("allowed.example") +
            byteArrayOf(0) + u16(TYPE_A) + u16(1) + byteArrayOf(0, 0, 0, 0) + u16(0)
        val optWithBadLength = header(arCount = 1) + question("allowed.example") + optRecord().copyOf(10)
        val optWithTrailing = query("allowed.example", withOpt = true) + byteArrayOf(9)
        val twoAdditional = header(arCount = 2) + question("allowed.example") + optRecord() + optRecord()

        for (message in listOf(notOpt, optWithBadLength, optWithTrailing, twoAdditional)) {
            assertEquals(DnsUnsupportedReason.INVALID_ADDITIONAL_RECORD, unsupportedReason(message))
        }
    }

    @Test
    fun `non-IN class is unsupported and answered REFUSED`() {
        val message = header() + question("version.bind", type = 16, qclass = CLASS_CH)

        val reason = unsupportedReason(message)

        assertEquals(DnsUnsupportedReason.UNSUPPORTED_CLASS, reason)
        assertEquals(DnsMessageCodec.RCODE_REFUSED, DnsMessageCodec.rcodeFor(reason))
    }

    // --- synthetic responses ---

    @Test
    fun `NXDOMAIN response preserves transaction ID and question`() {
        val message = query("www.blocked.example", type = TYPE_HTTPS, id = 0xA1B2, withOpt = true)
        val parsed = supported(message)

        val response = DnsMessageCodec.buildResponse(parsed, DnsMessageCodec.RCODE_NXDOMAIN)

        assertEquals(0xA1B2, readU16(response, 0))
        val flags = readU16(response, 2)
        assertTrue("QR set", flags and 0x8000 != 0)
        assertEquals("opcode QUERY", 0, (flags shr 11) and 0xF)
        assertEquals("AA clear", 0, flags and 0x0400)
        assertEquals("TC clear", 0, flags and 0x0200)
        assertTrue("RD copied", flags and 0x0100 != 0)
        assertTrue("RA set", flags and 0x0080 != 0)
        assertEquals("Z/AD clear", 0, flags and 0x0060)
        assertEquals("NXDOMAIN", 3, flags and 0x000F)
        assertEquals(1, readU16(response, 4))
        assertEquals(0, readU16(response, 6))
        assertEquals(0, readU16(response, 8))
        assertEquals("no OPT echoed", 0, readU16(response, 10))
        assertArrayEquals(question("www.blocked.example", type = TYPE_HTTPS), response.copyOfRange(12, response.size))
        assertArrayEquals(parsed.questionSectionBytes(), response.copyOfRange(12, response.size))
    }

    @Test
    fun `synthetic response copies CD and leaves RD clear when the query had it clear`() {
        val message = header(flags = 0x0010) + question("allowed.example") // CD set, RD clear

        val response = DnsMessageCodec.buildResponse(supported(message), DnsMessageCodec.RCODE_REFUSED)

        val flags = readU16(response, 2)
        assertEquals(0, flags and 0x0100)
        assertTrue(flags and 0x0010 != 0)
        assertEquals(5, flags and 0x000F)
    }

    @Test
    fun `synthetic response for an unsupported opcode keeps that opcode`() {
        val parsed = (DnsMessageCodec.parseQuery(header(flags = 0x2000) + question("a.example")) as DnsQueryParseResult.Unsupported).query

        val response = DnsMessageCodec.buildResponse(parsed, DnsMessageCodec.RCODE_NOTIMP)

        assertEquals(4, (readU16(response, 2) shr 11) and 0xF)
    }

    @Test
    fun `synthetic response is itself parseable as a response, not a query`() {
        val response = DnsMessageCodec.buildResponse(supported(query("a.example")), DnsMessageCodec.RCODE_NXDOMAIN)

        assertEquals(DnsMalformedReason.NOT_A_QUERY, malformedReason(response))
    }

    // --- upstream response matching ---

    @Test
    fun `matching upstream response is accepted`() {
        val message = query("allowed.example", withOpt = true)
        val upstream = response(message)

        assertTrue(DnsMessageCodec.isResponseTo(supported(message), upstream, upstream.size))
    }

    @Test
    fun `upstream response may differ only in QNAME letter case`() {
        val message = query("allowed.example")
        val upstream = response(query("ALLOWED.Example"))

        assertTrue(DnsMessageCodec.isResponseTo(supported(message), upstream, upstream.size))
    }

    @Test
    fun `mismatched upstream responses are rejected`() {
        val parsed = supported(query("allowed.example", id = 0x1111))

        val wrongId = response(query("allowed.example", id = 0x2222))
        val notAResponse = query("allowed.example", id = 0x1111)
        val otherName = response(query("other.example", id = 0x1111))
        val otherType = response(query("allowed.example", type = TYPE_AAAA, id = 0x1111))
        val truncated = response(query("allowed.example", id = 0x1111)).copyOf(20)

        assertFalse(DnsMessageCodec.isResponseTo(parsed, wrongId, wrongId.size))
        assertFalse(DnsMessageCodec.isResponseTo(parsed, notAResponse, notAResponse.size))
        assertFalse(DnsMessageCodec.isResponseTo(parsed, otherName, otherName.size))
        assertFalse(DnsMessageCodec.isResponseTo(parsed, otherType, otherType.size))
        assertFalse(DnsMessageCodec.isResponseTo(parsed, truncated, truncated.size))
        assertFalse(DnsMessageCodec.isResponseTo(parsed, ByteArray(0), 0))
        assertFalse(DnsMessageCodec.isResponseTo(parsed, wrongId, wrongId.size + 1))
    }

    @Test
    fun `QTYPE bytes are compared exactly, not case-folded`() {
        // QTYPE 65 (0x0041 = 'A') must not match QTYPE 97 (0x0061 = 'a').
        val parsed = supported(query("allowed.example", type = 65))
        val upstream = response(query("allowed.example", type = 97))

        assertFalse(DnsMessageCodec.isResponseTo(parsed, upstream, upstream.size))
    }

    @Test
    fun `query toString never contains the hostname`() {
        val parsed = supported(query("secret-name.blocked.example"))

        assertFalse(parsed.toString().contains("secret-name"))
        assertFalse(DnsMessageCodec.parseQuery(query("secret-name.blocked.example")).toString().contains("secret-name"))
    }
}
