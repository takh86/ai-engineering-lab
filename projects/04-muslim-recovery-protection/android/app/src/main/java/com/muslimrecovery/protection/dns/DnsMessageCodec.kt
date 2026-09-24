package com.muslimrecovery.protection.dns

/**
 * One parsed standard DNS query (M1-05A shape: exactly one question). Built only by
 * [DnsMessageCodec.parseQuery].
 *
 * [questionName] is the QNAME exactly as it appeared on the wire (original letter case, labels
 * joined with `.`, the root name as ""). It is NOT normalized or validated as a hostname here —
 * that is the existing RuleSet's job (D9). It is deliberately excluded from [toString] so a query
 * can never leak a hostname into a log line or diagnostic string by accident.
 */
class DnsQuery internal constructor(
    val transactionId: Int,
    val flags: Int,
    val questionName: String,
    val questionType: Int,
    val questionClass: Int,
    private val questionSection: ByteArray,
) {
    val opcode: Int get() = (flags shr 11) and 0xF

    /** Raw wire bytes of the question section (QNAME + QTYPE + QCLASS). Returns a copy. */
    fun questionSectionBytes(): ByteArray = questionSection.copyOf()

    internal val questionSectionLength: Int get() = questionSection.size

    internal fun questionByte(index: Int): Int = questionSection[index].toInt() and 0xFF

    override fun toString(): String = "DnsQuery(opcode=$opcode, type=$questionType, class=$questionClass)"
}

/** Why a DNS message could not be safely interpreted at all. Such messages are dropped, never forwarded. */
enum class DnsMalformedReason {
    TRUNCATED_HEADER,
    NOT_A_QUERY,
    UNSUPPORTED_QUESTION_COUNT,
    TRUNCATED_QUESTION,
    COMPRESSION_NOT_SUPPORTED,
    INVALID_LABEL_TYPE,
    INVALID_LABEL_CHARACTER,
    NAME_TOO_LONG,
}

/**
 * Why a query whose question parsed cleanly is still outside the supported M1-05A shape. These get
 * a synthetic error response (see [DnsMessageCodec.rcodeFor]) and are never forwarded.
 */
enum class DnsUnsupportedReason {
    UNSUPPORTED_OPCODE,
    UNEXPECTED_ANSWER_OR_AUTHORITY_RECORDS,
    UNEXPECTED_TRAILING_DATA,
    INVALID_ADDITIONAL_RECORD,
    UNSUPPORTED_CLASS,
}

sealed interface DnsQueryParseResult {

    /** A supported one-question IN-class standard query. */
    class Supported(val query: DnsQuery) : DnsQueryParseResult {
        override fun toString(): String = "Supported($query)"
    }

    /** The question parsed, but the message shape is unsupported; [query] allows an error reply. */
    class Unsupported(val query: DnsQuery, val reason: DnsUnsupportedReason) : DnsQueryParseResult {
        override fun toString(): String = "Unsupported($reason)"
    }

    /** Not safely interpretable; no reply can be associated with it. */
    data class Malformed(val reason: DnsMalformedReason) : DnsQueryParseResult
}

/**
 * Deliberately narrow, strict DNS wire codec for the M1-05A standard-DNS experiment (D11). It
 * supports exactly what the experiment needs and nothing more:
 *
 * - parse one-question queries (QR=0), tolerating at most one EDNS OPT record in the additional
 *   section (which is validated structurally, never interpreted);
 * - build a header+question synthetic response with a chosen RCODE (NXDOMAIN, REFUSED, ...);
 * - check that an upstream message is the response to a given query.
 *
 * Safety properties:
 * - every read is bounds-checked against the caller-supplied length;
 * - compression pointers are rejected in the question (a query's question starts at offset 12, so
 *   a pointer could only ever point back into the header) — no pointer is ever followed, so
 *   pointer loops are impossible;
 * - labels longer than 63 octets and names longer than 255 octets are rejected;
 * - label bytes outside printable ASCII, and any literal `.` byte inside a label, are rejected, so
 *   the dotted [DnsQuery.questionName] can never be interpreted differently from the wire name an
 *   upstream resolver would see;
 * - parsing never throws for any input and every loop is bounded by the message length.
 */
object DnsMessageCodec {

    const val HEADER_LENGTH = 12

    const val RCODE_FORMERR = 1
    const val RCODE_SERVFAIL = 2
    const val RCODE_NXDOMAIN = 3
    const val RCODE_NOTIMP = 4
    const val RCODE_REFUSED = 5

    const val CLASS_IN = 1
    private const val TYPE_OPT = 41

    private const val MAX_NAME_WIRE_LENGTH = 255
    private const val OPT_FIXED_LENGTH = 11 // root name (1) + type (2) + class (2) + ttl (4) + rdlength (2)

    private const val FLAG_QR = 0x8000
    private const val FLAG_RD = 0x0100
    private const val FLAG_RA = 0x0080
    private const val FLAG_CD = 0x0010
    private const val OPCODE_MASK = 0x7800

    fun parseQuery(message: ByteArray, offset: Int = 0, length: Int = message.size): DnsQueryParseResult {
        if (offset < 0 || length < 0 || offset > message.size - length) {
            return DnsQueryParseResult.Malformed(DnsMalformedReason.TRUNCATED_HEADER)
        }
        if (length < HEADER_LENGTH) return DnsQueryParseResult.Malformed(DnsMalformedReason.TRUNCATED_HEADER)

        val end = offset + length
        val id = readU16(message, offset)
        val flags = readU16(message, offset + 2)
        val qdCount = readU16(message, offset + 4)
        val anCount = readU16(message, offset + 6)
        val nsCount = readU16(message, offset + 8)
        val arCount = readU16(message, offset + 10)

        if (flags and FLAG_QR != 0) return DnsQueryParseResult.Malformed(DnsMalformedReason.NOT_A_QUERY)
        if (qdCount != 1) return DnsQueryParseResult.Malformed(DnsMalformedReason.UNSUPPORTED_QUESTION_COUNT)

        val questionStart = offset + HEADER_LENGTH
        val name = StringBuilder()
        var position = questionStart
        var nameWireLength = 0
        while (true) {
            if (position >= end) return DnsQueryParseResult.Malformed(DnsMalformedReason.TRUNCATED_QUESTION)
            val labelLength = message[position].toInt() and 0xFF
            when (labelLength and 0xC0) {
                0xC0 -> return DnsQueryParseResult.Malformed(DnsMalformedReason.COMPRESSION_NOT_SUPPORTED)
                0x40, 0x80 -> return DnsQueryParseResult.Malformed(DnsMalformedReason.INVALID_LABEL_TYPE)
            }
            position++
            nameWireLength += 1 + labelLength
            if (nameWireLength > MAX_NAME_WIRE_LENGTH) {
                return DnsQueryParseResult.Malformed(DnsMalformedReason.NAME_TOO_LONG)
            }
            if (labelLength == 0) break
            if (labelLength > end - position) return DnsQueryParseResult.Malformed(DnsMalformedReason.TRUNCATED_QUESTION)

            if (name.isNotEmpty()) name.append('.')
            for (i in position until position + labelLength) {
                val octet = message[i].toInt() and 0xFF
                if (octet < 0x21 || octet > 0x7E || octet == '.'.code) {
                    return DnsQueryParseResult.Malformed(DnsMalformedReason.INVALID_LABEL_CHARACTER)
                }
                name.append(octet.toChar())
            }
            position += labelLength
        }

        if (end - position < 4) return DnsQueryParseResult.Malformed(DnsMalformedReason.TRUNCATED_QUESTION)
        val questionType = readU16(message, position)
        val questionClass = readU16(message, position + 2)
        val questionEnd = position + 4

        val query = DnsQuery(
            transactionId = id,
            flags = flags,
            questionName = name.toString(),
            questionType = questionType,
            questionClass = questionClass,
            questionSection = message.copyOfRange(questionStart, questionEnd),
        )

        val unsupported = when {
            query.opcode != 0 -> DnsUnsupportedReason.UNSUPPORTED_OPCODE
            anCount != 0 || nsCount != 0 -> DnsUnsupportedReason.UNEXPECTED_ANSWER_OR_AUTHORITY_RECORDS
            arCount == 0 && questionEnd != end -> DnsUnsupportedReason.UNEXPECTED_TRAILING_DATA
            arCount == 1 && !isSingleOptRecord(message, questionEnd, end) -> DnsUnsupportedReason.INVALID_ADDITIONAL_RECORD
            arCount > 1 -> DnsUnsupportedReason.INVALID_ADDITIONAL_RECORD
            questionClass != CLASS_IN -> DnsUnsupportedReason.UNSUPPORTED_CLASS
            else -> null
        }

        return if (unsupported == null) {
            DnsQueryParseResult.Supported(query)
        } else {
            DnsQueryParseResult.Unsupported(query, unsupported)
        }
    }

    /** The RCODE sent back for a query rejected with [reason]. */
    fun rcodeFor(reason: DnsUnsupportedReason): Int = when (reason) {
        DnsUnsupportedReason.UNSUPPORTED_OPCODE -> RCODE_NOTIMP
        DnsUnsupportedReason.UNEXPECTED_ANSWER_OR_AUTHORITY_RECORDS,
        DnsUnsupportedReason.UNEXPECTED_TRAILING_DATA,
        DnsUnsupportedReason.INVALID_ADDITIONAL_RECORD,
        -> RCODE_FORMERR
        DnsUnsupportedReason.UNSUPPORTED_CLASS -> RCODE_REFUSED
    }

    /**
     * A synthetic header+question response: same transaction ID and question as [query], QR=1,
     * OPCODE/RD/CD copied, RA=1, AA/TC/AD/Z clear, [rcode] set, and no answer/authority/additional
     * records. No SOA is included, so per RFC 2308 resolvers should not cache a synthetic NXDOMAIN —
     * stopping the VPN restores normal resolution immediately. No OPT is echoed (RFC 6891 allows a
     * responder to answer without EDNS).
     */
    fun buildResponse(query: DnsQuery, rcode: Int): ByteArray {
        require(rcode in 0..15) { "rcode out of range" }
        val response = ByteArray(HEADER_LENGTH + query.questionSectionLength)
        val flags = FLAG_QR or (query.flags and (OPCODE_MASK or FLAG_RD or FLAG_CD)) or FLAG_RA or rcode
        writeU16(response, 0, query.transactionId)
        writeU16(response, 2, flags)
        writeU16(response, 4, 1)
        for (i in 0 until query.questionSectionLength) {
            response[HEADER_LENGTH + i] = query.questionByte(i).toByte()
        }
        return response
    }

    /**
     * True if [message] (first [length] bytes) is a response to [query]: same transaction ID, QR=1,
     * same OPCODE, exactly one question, and that question equals the query's (QNAME compared
     * ASCII-case-insensitively; QTYPE/QCLASS compared exactly). Anything else is not a match.
     */
    fun isResponseTo(query: DnsQuery, message: ByteArray, length: Int): Boolean {
        if (length < 0 || length > message.size) return false
        val questionLength = query.questionSectionLength
        if (length < HEADER_LENGTH + questionLength) return false
        if (readU16(message, 0) != query.transactionId) return false

        val flags = readU16(message, 2)
        if (flags and FLAG_QR == 0) return false
        if ((flags shr 11) and 0xF != query.opcode) return false
        if (readU16(message, 4) != 1) return false

        val nameLength = questionLength - 4
        for (i in 0 until questionLength) {
            val expected = query.questionByte(i)
            val actual = message[HEADER_LENGTH + i].toInt() and 0xFF
            val equal = if (i < nameLength) asciiLower(expected) == asciiLower(actual) else expected == actual
            if (!equal) return false
        }
        return true
    }

    private fun isSingleOptRecord(message: ByteArray, start: Int, end: Int): Boolean {
        if (end - start < OPT_FIXED_LENGTH) return false
        if (message[start].toInt() != 0) return false
        if (readU16(message, start + 1) != TYPE_OPT) return false
        val rdLength = readU16(message, start + 9)
        return start + OPT_FIXED_LENGTH + rdLength == end
    }

    private fun asciiLower(octet: Int): Int = if (octet in 'A'.code..'Z'.code) octet + 32 else octet

    private fun readU16(bytes: ByteArray, index: Int): Int =
        ((bytes[index].toInt() and 0xFF) shl 8) or (bytes[index + 1].toInt() and 0xFF)

    private fun writeU16(bytes: ByteArray, index: Int, value: Int) {
        bytes[index] = (value shr 8).toByte()
        bytes[index + 1] = value.toByte()
    }
}
