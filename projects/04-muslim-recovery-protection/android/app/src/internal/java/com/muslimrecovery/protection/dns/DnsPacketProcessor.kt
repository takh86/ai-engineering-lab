package com.muslimrecovery.protection.dns

/** Why a forward to the upstream DNS server did not produce a response. */
enum class UpstreamFailure {
    /** Private DNS became active on the underlying network: plaintext forwarding refused. */
    PRIVATE_DNS_ACTIVE,

    /** The underlying network is gone or no longer offers a usable DNS server. */
    UPSTREAM_UNAVAILABLE,

    /** The upstream socket could not be protected from the VPN or bound to the underlying network. */
    SOCKET_SETUP_FAILED,

    /** No matching response arrived before the bounded timeout. */
    TIMEOUT,

    /** A transient send/receive error. */
    IO_ERROR,

    /** The runtime is stopping and cancelled the in-flight exchange. */
    CANCELLED,
}

sealed interface UpstreamDnsResult {
    /** A message already verified by [DnsMessageCodec.isResponseTo] for the forwarded query. */
    class Response(val message: ByteArray) : UpstreamDnsResult {
        override fun toString(): String = "Response(length=${message.size})"
    }

    data class Failed(val failure: UpstreamFailure) : UpstreamDnsResult
}

/**
 * Sends one allowed DNS query to the upstream resolver and waits (bounded) for its response. The
 * Android implementation gates every exchange on the underlying network's current Private DNS state
 * and uses a VPN-protected socket bound to that network.
 */
fun interface UpstreamDnsExchange {
    fun exchange(query: DnsQuery, message: ByteArray): UpstreamDnsResult
}

/** Why the DNS proxy runtime must stop itself (and tear the VPN down) rather than keep running. */
enum class DnsRuntimeStopReason {
    PRIVATE_DNS_ACTIVE,
    UPSTREAM_UNAVAILABLE,
    TUNNEL_IO_FAILED,
    ;

    companion object {
        /** Maps a periodic upstream re-check that no longer yields a usable plaintext upstream. */
        fun forRefusal(reason: UpstreamRefusalReason): DnsRuntimeStopReason = when (reason) {
            UpstreamRefusalReason.PRIVATE_DNS_ACTIVE -> PRIVATE_DNS_ACTIVE
            UpstreamRefusalReason.NO_UNDERLYING_NETWORK,
            UpstreamRefusalReason.UNDERLYING_NETWORK_IS_VPN,
            UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_VALIDATED,
            UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_USABLE,
            UpstreamRefusalReason.UNDERLYING_NETWORK_SUPERSEDED,
            UpstreamRefusalReason.NO_USABLE_DNS_SERVER,
            -> UPSTREAM_UNAVAILABLE
        }
    }
}

/** In-memory aggregate counters for the M1-05 harness. Counts only — no hostnames, no history. */
data class ExperimentalDnsCounters(
    val blocked: Long = 0,
    val forwarded: Long = 0,
    val refusedOrUnsupported: Long = 0,
    val dropped: Long = 0,
    val upstreamFailures: Long = 0,
)

class DnsPacketProcessingResult(
    /** A complete IPv4 packet to write back to the TUN, or null to write nothing. */
    val responsePacket: ByteArray?,
    /** Non-null if the runtime must stop after writing [responsePacket]. */
    val stopReason: DnsRuntimeStopReason? = null,
) {
    override fun toString(): String =
        "DnsPacketProcessingResult(respond=${responsePacket != null}, stopReason=$stopReason)"
}

/**
 * The complete per-packet DNS pipeline, independent of Android:
 * TUN packet → [Ipv4UdpDnsPacketAdapter] → [DnsFilteringEngine] (existing RuleSet) → either a
 * synthetic local answer or a forward via [UpstreamDnsExchange] → IPv4/UDP response packet.
 *
 * Not thread-safe: owned and driven by exactly one worker thread.
 */
class DnsPacketProcessor(
    private val adapter: Ipv4UdpDnsPacketAdapter,
    private val engine: DnsFilteringEngine,
    private val upstream: UpstreamDnsExchange,
) {
    var counters: ExperimentalDnsCounters = ExperimentalDnsCounters()
        private set

    fun process(packet: ByteArray, length: Int): DnsPacketProcessingResult {
        val datagram = when (val parsed = adapter.parse(packet, length)) {
            is PacketParseResult.Rejected -> return drop()
            is PacketParseResult.DnsDatagram -> parsed
        }

        return when (val decision = engine.decide(datagram.dnsPayload)) {
            is DnsFilterDecision.Drop -> drop()

            is DnsFilterDecision.Respond -> {
                counters = when (decision.kind) {
                    SyntheticResponseKind.BLOCKED_NXDOMAIN -> counters.copy(blocked = counters.blocked + 1)
                    SyntheticResponseKind.INVALID_HOSTNAME_REFUSED,
                    SyntheticResponseKind.UNSUPPORTED_QUERY,
                    -> counters.copy(refusedOrUnsupported = counters.refusedOrUnsupported + 1)
                }
                DnsPacketProcessingResult(adapter.buildResponse(datagram, decision.response))
            }

            is DnsFilterDecision.Forward -> forward(datagram, decision.query)
        }
    }

    private fun forward(datagram: PacketParseResult.DnsDatagram, query: DnsQuery): DnsPacketProcessingResult {
        return when (val result = upstream.exchange(query, datagram.dnsPayload)) {
            is UpstreamDnsResult.Response -> {
                val packet = adapter.buildResponse(datagram, result.message)
                counters = if (packet != null) {
                    counters.copy(forwarded = counters.forwarded + 1)
                } else {
                    counters.copy(upstreamFailures = counters.upstreamFailures + 1)
                }
                DnsPacketProcessingResult(packet)
            }

            is UpstreamDnsResult.Failed -> {
                counters = counters.copy(upstreamFailures = counters.upstreamFailures + 1)
                when (result.failure) {
                    // Fail closed, fast, and stop: never fall back to any other plaintext path.
                    UpstreamFailure.PRIVATE_DNS_ACTIVE -> DnsPacketProcessingResult(
                        adapter.buildResponse(datagram, DnsMessageCodec.buildResponse(query, DnsMessageCodec.RCODE_REFUSED)),
                        DnsRuntimeStopReason.PRIVATE_DNS_ACTIVE,
                    )

                    UpstreamFailure.UPSTREAM_UNAVAILABLE,
                    UpstreamFailure.SOCKET_SETUP_FAILED,
                    -> DnsPacketProcessingResult(
                        adapter.buildResponse(datagram, DnsMessageCodec.buildResponse(query, DnsMessageCodec.RCODE_SERVFAIL)),
                        DnsRuntimeStopReason.UPSTREAM_UNAVAILABLE,
                    )

                    UpstreamFailure.IO_ERROR -> DnsPacketProcessingResult(
                        adapter.buildResponse(datagram, DnsMessageCodec.buildResponse(query, DnsMessageCodec.RCODE_SERVFAIL)),
                    )

                    // Stay silent, like a lost packet: the client's resolver retries on its own schedule.
                    UpstreamFailure.TIMEOUT,
                    UpstreamFailure.CANCELLED,
                    -> DnsPacketProcessingResult(null)
                }
            }
        }
    }

    private fun drop(): DnsPacketProcessingResult {
        counters = counters.copy(dropped = counters.dropped + 1)
        return DnsPacketProcessingResult(null)
    }
}
