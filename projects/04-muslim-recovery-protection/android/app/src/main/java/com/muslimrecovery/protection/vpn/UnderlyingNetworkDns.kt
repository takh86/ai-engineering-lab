package com.muslimrecovery.protection.vpn

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.VpnService
import android.os.Build
import android.os.SystemClock
import com.muslimrecovery.protection.dns.DnsMessageCodec
import com.muslimrecovery.protection.dns.DnsQuery
import com.muslimrecovery.protection.dns.DnsRuntimeStopReason
import com.muslimrecovery.protection.dns.UnderlyingNetworkDnsFacts
import com.muslimrecovery.protection.dns.UpstreamDnsExchange
import com.muslimrecovery.protection.dns.UpstreamDnsResult
import com.muslimrecovery.protection.dns.UpstreamDnsSelection
import com.muslimrecovery.protection.dns.UpstreamDnsSelector
import com.muslimrecovery.protection.dns.UpstreamFailure
import com.muslimrecovery.protection.dns.UpstreamRefusalReason
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.SocketTimeoutException
import java.util.concurrent.atomic.AtomicReference

/**
 * Reads the facts [UpstreamDnsSelector] needs about the underlying (non-VPN) network from
 * [ConnectivityManager]. Requires `ACCESS_NETWORK_STATE`.
 */
internal class UnderlyingNetworkInspector(private val connectivityManager: ConnectivityManager) {

    /**
     * The app's current default network. Only meaningful BEFORE this app's VPN is established: the
     * VPN applies to this app's own uid too (that is what lets the harness's lookups exercise the
     * proxy), so afterwards the default network would be the VPN itself.
     */
    fun currentDefaultNetwork(): Network? = try {
        connectivityManager.activeNetwork
    } catch (e: RuntimeException) {
        null
    }

    /** Null when [network] is null or no longer connected. */
    fun factsFor(network: Network?): UnderlyingNetworkDnsFacts? {
        if (network == null) return null
        return try {
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return null
            val linkProperties = connectivityManager.getLinkProperties(network) ?: return null
            UnderlyingNetworkDnsFacts(
                isVpn = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) ||
                    !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN),
                hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET),
                // Private DNS does not exist below API 28 (Android 9), so it cannot be active there.
                privateDnsActive = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && linkProperties.isPrivateDnsActive,
                dnsServers = linkProperties.dnsServers,
            )
        } catch (e: RuntimeException) {
            null
        }
    }
}

/**
 * Forwards one allowed query to the underlying network's own DNS server over plaintext UDP.
 *
 * Every exchange:
 * 1. re-reads the underlying network's facts and re-runs [UpstreamDnsSelector] — so Private DNS
 *    becoming active mid-session, or the network disappearing, is noticed before any plaintext
 *    byte is sent;
 * 2. uses a fresh [DatagramSocket] (random source port per query) that is [VpnService.protect]ed
 *    (if protect fails, nothing is sent) and bound to [network] with [Network.bindSocket], so the
 *    query can never loop back into this VPN and leaves on the same network whose DNS server was
 *    selected;
 * 3. connects the socket to the server, so datagrams from any other source are discarded by the
 *    kernel, and accepts only a message [DnsMessageCodec.isResponseTo] the query (transaction ID,
 *    QR, OPCODE, identical question), waiting at most [UPSTREAM_TIMEOUT_MS] in total.
 *
 * Used by exactly one worker thread; [cancel] may be called from any thread.
 */
internal class ProtectedUpstreamDnsExchange(
    private val vpnService: VpnService,
    private val network: Network,
    private val inspector: UnderlyingNetworkInspector,
    private val excludedAddresses: Set<InetAddress>,
) : UpstreamDnsExchange {

    private val inFlight = AtomicReference<DatagramSocket?>()

    @Volatile
    private var cancelled = false

    private val receiveBuffer = ByteArray(RECEIVE_BUFFER_LENGTH)

    override fun exchange(query: DnsQuery, message: ByteArray): UpstreamDnsResult {
        val server = when (val selection = UpstreamDnsSelector.select(inspector.factsFor(network), excludedAddresses)) {
            is UpstreamDnsSelection.Selected -> selection.server
            is UpstreamDnsSelection.Refused -> return failed(
                if (selection.reason == UpstreamRefusalReason.PRIVATE_DNS_ACTIVE) {
                    UpstreamFailure.PRIVATE_DNS_ACTIVE
                } else {
                    UpstreamFailure.UPSTREAM_UNAVAILABLE
                },
            )
        }

        val socket = try {
            DatagramSocket()
        } catch (e: IOException) {
            return failed(UpstreamFailure.SOCKET_SETUP_FAILED)
        }

        inFlight.set(socket)
        try {
            if (cancelled) return failed(UpstreamFailure.CANCELLED)
            if (!vpnService.protect(socket)) return failed(UpstreamFailure.SOCKET_SETUP_FAILED)
            try {
                network.bindSocket(socket)
            } catch (e: IOException) {
                return failed(UpstreamFailure.SOCKET_SETUP_FAILED)
            }

            socket.connect(InetSocketAddress(server, DNS_PORT))
            socket.send(DatagramPacket(message, message.size))

            val deadline = SystemClock.elapsedRealtime() + UPSTREAM_TIMEOUT_MS
            while (true) {
                val remaining = deadline - SystemClock.elapsedRealtime()
                if (remaining <= 0) return failed(UpstreamFailure.TIMEOUT)
                socket.soTimeout = remaining.toInt()
                val packet = DatagramPacket(receiveBuffer, receiveBuffer.size)
                socket.receive(packet)
                if (DnsMessageCodec.isResponseTo(query, receiveBuffer, packet.length)) {
                    return UpstreamDnsResult.Response(receiveBuffer.copyOf(packet.length))
                }
                // Not the response to this query: discard it and keep waiting within the deadline.
            }
        } catch (e: SocketTimeoutException) {
            return failed(UpstreamFailure.TIMEOUT)
        } catch (e: IOException) {
            return failed(if (cancelled) UpstreamFailure.CANCELLED else UpstreamFailure.IO_ERROR)
        } finally {
            inFlight.compareAndSet(socket, null)
            socket.close()
        }
    }

    /**
     * Re-checks, without sending anything, that plaintext forwarding is still allowed and possible:
     * null if so, otherwise why the runtime must stop (Private DNS became active, or the underlying
     * network / its DNS server is gone). Lets the runtime notice such changes even when no allowed
     * query happens to be forwarded.
     */
    fun checkUpstreamHealth(): DnsRuntimeStopReason? =
        when (val selection = UpstreamDnsSelector.select(inspector.factsFor(network), excludedAddresses)) {
            is UpstreamDnsSelection.Selected -> null
            is UpstreamDnsSelection.Refused -> DnsRuntimeStopReason.forRefusal(selection.reason)
        }

    /** Idempotent; unblocks an in-flight receive by closing its socket. */
    fun cancel() {
        cancelled = true
        inFlight.getAndSet(null)?.close()
    }

    private fun failed(failure: UpstreamFailure) = UpstreamDnsResult.Failed(failure)

    private companion object {
        const val DNS_PORT = 53
        const val UPSTREAM_TIMEOUT_MS = 2_000L

        /** Larger than any UDP payload, so a received datagram is never silently truncated. */
        const val RECEIVE_BUFFER_LENGTH = 65_535
    }
}
