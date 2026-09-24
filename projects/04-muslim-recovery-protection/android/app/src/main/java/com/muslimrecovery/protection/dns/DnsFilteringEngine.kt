package com.muslimrecovery.protection.dns

import com.muslimrecovery.protection.domain.rules.RuleDecision
import com.muslimrecovery.protection.domain.rules.RuleSet

/** Which kind of locally generated DNS answer a [DnsFilterDecision.Respond] carries. */
enum class SyntheticResponseKind {
    /** RuleSet returned Blocked: NXDOMAIN. */
    BLOCKED_NXDOMAIN,

    /** RuleSet returned InvalidInput (e.g. `_service` labels, the root name): REFUSED, never forwarded. */
    INVALID_HOSTNAME_REFUSED,

    /** The question parsed but the query shape is unsupported: NOTIMP / FORMERR / REFUSED. */
    UNSUPPORTED_QUERY,
}

sealed interface DnsFilterDecision {

    /** RuleSet returned Allowed: forward the original DNS message upstream unchanged. */
    class Forward(val query: DnsQuery) : DnsFilterDecision {
        override fun toString(): String = "Forward"
    }

    /** Answer locally with [response] (a complete DNS message); nothing is sent upstream. */
    class Respond(val kind: SyntheticResponseKind, val response: ByteArray) : DnsFilterDecision {
        override fun toString(): String = "Respond($kind)"
    }

    /** Not a safely interpretable query: no response, never forwarded. */
    data class Drop(val reason: DnsMalformedReason) : DnsFilterDecision
}

/**
 * Connects the strict DNS codec to the EXISTING M1-03 [RuleSet] (D9 matching semantics unchanged;
 * hostname normalization and label-suffix matching are entirely the RuleSet's job).
 *
 * Decision policy for one DNS message, applied to every QTYPE alike (A, AAAA, HTTPS, ...):
 * - malformed → [DnsFilterDecision.Drop];
 * - question parsed but unsupported shape → synthetic error response ([DnsMessageCodec.rcodeFor]);
 * - [RuleDecision.Blocked] → synthetic NXDOMAIN;
 * - [RuleDecision.InvalidInput] → synthetic REFUSED. It is never treated as Allowed: a name the
 *   RuleSet cannot evaluate (e.g. `_x.blocked.example`) must not become a way around a block rule,
 *   and REFUSED fails fast instead of making the client wait for a timeout;
 * - [RuleDecision.Allowed] → [DnsFilterDecision.Forward].
 *
 * The `when` over [RuleDecision] is exhaustive with no `else`, so adding a new decision type fails
 * compilation here instead of silently falling through to forwarding.
 */
class DnsFilteringEngine(private val ruleSet: RuleSet) {

    fun decide(message: ByteArray): DnsFilterDecision =
        when (val parsed = DnsMessageCodec.parseQuery(message)) {
            is DnsQueryParseResult.Malformed -> DnsFilterDecision.Drop(parsed.reason)

            is DnsQueryParseResult.Unsupported -> DnsFilterDecision.Respond(
                SyntheticResponseKind.UNSUPPORTED_QUERY,
                DnsMessageCodec.buildResponse(parsed.query, DnsMessageCodec.rcodeFor(parsed.reason)),
            )

            is DnsQueryParseResult.Supported -> decideForRule(parsed.query)
        }

    private fun decideForRule(query: DnsQuery): DnsFilterDecision =
        when (ruleSet.evaluate(query.questionName)) {
            is RuleDecision.Blocked -> DnsFilterDecision.Respond(
                SyntheticResponseKind.BLOCKED_NXDOMAIN,
                DnsMessageCodec.buildResponse(query, DnsMessageCodec.RCODE_NXDOMAIN),
            )

            is RuleDecision.InvalidInput -> DnsFilterDecision.Respond(
                SyntheticResponseKind.INVALID_HOSTNAME_REFUSED,
                DnsMessageCodec.buildResponse(query, DnsMessageCodec.RCODE_REFUSED),
            )

            RuleDecision.Allowed -> DnsFilterDecision.Forward(query)
        }
}
