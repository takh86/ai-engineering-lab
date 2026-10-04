package com.muslimrecovery.protection.vpn

import com.muslimrecovery.protection.dns.DnsProxyStatus
import com.muslimrecovery.protection.dns.UnderlyingNetworkCapabilityFacts
import com.muslimrecovery.protection.dns.UnderlyingNetworkDnsFacts
import com.muslimrecovery.protection.dns.UnderlyingNetworkLinkFacts
import com.muslimrecovery.protection.dns.UpstreamRefusalReason
import com.muslimrecovery.protection.domain.protection.ServiceLifecycleState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.net.InetAddress

/**
 * M1-07 (M-1): the captured underlying network must stop the session once it is no longer a
 * trustworthy upstream path, exactly once, and never because of another session's or another
 * network's events. Network identities are plain strings here (`android.net.Network` on device).
 */
class CapturedNetworkWatchTest {

    // InetAddress.getByAddress never performs a DNS lookup.
    private fun v4(a: Int, b: Int, c: Int, d: Int): InetAddress =
        InetAddress.getByAddress(byteArrayOf(a.toByte(), b.toByte(), c.toByte(), d.toByte()))

    private val excluded = setOf(v4(10, 111, 222, 1), v4(10, 111, 222, 2))
    private val routerDns = v4(192, 168, 1, 1)

    private val healthyCapabilities = UnderlyingNetworkCapabilityFacts(
        isVpn = false,
        hasInternet = true,
        isValidated = true,
        isForeground = true,
        isSuspended = false,
    )
    private val healthyLink = UnderlyingNetworkLinkFacts(privateDnsActive = false, dnsServers = listOf(routerDns))
    private val healthyFacts = UnderlyingNetworkDnsFacts(healthyCapabilities, healthyLink, isBlockedForApp = false)

    private fun watch(captured: String = WIFI, tracksBestNetwork: Boolean = false) =
        CapturedNetworkWatch(captured, healthyFacts, excluded, tracksBestNetwork)

    private fun bothModes(test: (CapturedNetworkWatch<String>) -> Unit) {
        test(watch(tracksBestNetwork = false))
        test(watch(tracksBestNetwork = true))
    }

    @Test
    fun `a healthy captured network stays valid across repeated reports`() = bothModes { watch ->
        repeat(3) {
            assertNull(watch.onAvailable(WIFI))
            assertNull(watch.onCapabilitiesChanged(WIFI, healthyCapabilities))
            assertNull(watch.onLinkPropertiesChanged(WIFI, healthyLink))
            assertNull(watch.onBlockedStatusChanged(WIFI, false))
        }
    }

    @Test
    fun `the captured network disappearing invalidates it`() = bothModes { watch ->
        assertEquals(UpstreamRefusalReason.NO_UNDERLYING_NETWORK, watch.onLost(WIFI))
    }

    @Test
    fun `losing INTERNET invalidates the captured network`() = bothModes { watch ->
        assertEquals(
            UpstreamRefusalReason.NO_UNDERLYING_NETWORK,
            watch.onCapabilitiesChanged(WIFI, healthyCapabilities.copy(hasInternet = false)),
        )
    }

    @Test
    fun `losing VALIDATED invalidates the captured network`() = bothModes { watch ->
        assertEquals(
            UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_VALIDATED,
            watch.onCapabilitiesChanged(WIFI, healthyCapabilities.copy(isValidated = false)),
        )
    }

    @Test
    fun `losing its last usable DNS server invalidates the captured network`() = bothModes { watch ->
        assertEquals(
            UpstreamRefusalReason.NO_USABLE_DNS_SERVER,
            watch.onLinkPropertiesChanged(WIFI, healthyLink.copy(dnsServers = emptyList())),
        )
    }

    @Test
    fun `a DNS server list of only unusable addresses invalidates the captured network`() = bothModes { watch ->
        val onlyUnusable = healthyLink.copy(dnsServers = listOf(v4(127, 0, 0, 1)) + excluded)

        assertEquals(UpstreamRefusalReason.NO_USABLE_DNS_SERVER, watch.onLinkPropertiesChanged(WIFI, onlyUnusable))
    }

    @Test
    fun `Private DNS becoming active stops the session with the no-downgrade status`() = bothModes { watch ->
        val reason = watch.onLinkPropertiesChanged(WIFI, healthyLink.copy(privateDnsActive = true))

        assertEquals(UpstreamRefusalReason.PRIVATE_DNS_ACTIVE, reason)
        assertEquals(DnsProxyStatus.REFUSED_PRIVATE_DNS_ACTIVE, DnsProxyStatus.fromRefusal(reason!!))
    }

    @Test
    fun `being kept in the background after another network became default invalidates the captured network`() =
        bothModes { watch ->
            assertEquals(
                UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_USABLE,
                watch.onCapabilitiesChanged(WIFI, healthyCapabilities.copy(isForeground = false)),
            )
        }

    @Test
    fun `a suspended captured network is invalidated`() = bothModes { watch ->
        assertEquals(
            UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_USABLE,
            watch.onCapabilitiesChanged(WIFI, healthyCapabilities.copy(isSuspended = true)),
        )
    }

    @Test
    fun `access to the captured network being blocked for this app invalidates it`() = bothModes { watch ->
        assertEquals(UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_USABLE, watch.onBlockedStatusChanged(WIFI, true))
    }

    @Test
    fun `when tracking the best network, another network becoming the best match supersedes the captured one`() {
        val watch = watch(tracksBestNetwork = true)

        assertNull(watch.onAvailable(WIFI))
        assertEquals(UpstreamRefusalReason.UNDERLYING_NETWORK_SUPERSEDED, watch.onAvailable(MOBILE))
    }

    @Test
    fun `the captured network about to be lost (moved to the background) supersedes it in both modes`() =
        bothModes { watch ->
            assertNull(watch.onLosing(MOBILE))
            assertEquals(UpstreamRefusalReason.UNDERLYING_NETWORK_SUPERSEDED, watch.onLosing(WIFI))
        }

    @Test
    fun `when listening to all networks, another network appearing does not invalidate the captured one`() {
        val watch = watch(tracksBestNetwork = false)

        assertNull(watch.onAvailable(MOBILE))
        assertNull(watch.onCapabilitiesChanged(MOBILE, healthyCapabilities))
        assertNull(watch.onLinkPropertiesChanged(MOBILE, healthyLink))
    }

    @Test
    fun `problems reported for other networks never invalidate the captured network`() = bothModes { watch ->
        assertNull(watch.onLost(MOBILE))
        assertNull(watch.onCapabilitiesChanged(MOBILE, healthyCapabilities.copy(hasInternet = false, isValidated = false)))
        assertNull(watch.onLinkPropertiesChanged(MOBILE, healthyLink.copy(privateDnsActive = true)))
        assertNull(watch.onBlockedStatusChanged(MOBILE, true))

        // ...and the captured network is still judged on its own facts afterwards.
        assertNull(watch.onCapabilitiesChanged(WIFI, healthyCapabilities))
        assertEquals(UpstreamRefusalReason.NO_UNDERLYING_NETWORK, watch.onLost(WIFI))
    }

    @Test
    fun `a benign link change keeps the network valid and a later capability loss still invalidates it`() =
        bothModes { watch ->
            // A benign change (a different, still usable DNS server) keeps the network valid...
            assertNull(watch.onLinkPropertiesChanged(WIFI, healthyLink.copy(dnsServers = listOf(v4(192, 168, 1, 53)))))
            assertNull(watch.onCapabilitiesChanged(WIFI, healthyCapabilities))
            // ...and a later capability loss still invalidates it.
            assertEquals(
                UpstreamRefusalReason.UNDERLYING_NETWORK_NOT_VALIDATED,
                watch.onCapabilitiesChanged(WIFI, healthyCapabilities.copy(isValidated = false)),
            )
        }

    @Test
    fun `duplicate and racing invalidations produce exactly one stop request`() {
        val events: List<Pair<String, (CapturedNetworkWatch<String>) -> UpstreamRefusalReason?>> = listOf(
            "lost" to { it.onLost(WIFI) },
            "lost again" to { it.onLost(WIFI) },
            "losing" to { it.onLosing(WIFI) },
            "VALIDATED lost" to { it.onCapabilitiesChanged(WIFI, healthyCapabilities.copy(isValidated = false)) },
            "Private DNS" to { it.onLinkPropertiesChanged(WIFI, healthyLink.copy(privateDnsActive = true)) },
            "blocked" to { it.onBlockedStatusChanged(WIFI, true) },
            "superseded" to { it.onAvailable(MOBILE) },
        )

        for (tracksBestNetwork in listOf(false, true)) {
            for (order in permutations(events.indices.toList())) {
                val watch = watch(tracksBestNetwork = tracksBestNetwork)
                val stops = order.mapNotNull { events[it].second(watch) }

                assertEquals("order=${order.map { events[it].first }}", 1, stops.size)
            }
        }
    }

    @Test
    fun `a callback arriving after the session stopped is ignored`() = bothModes { watch ->
        watch.close()
        watch.close() // idempotent

        assertNull(watch.onLost(WIFI))
        assertNull(watch.onLosing(WIFI))
        assertNull(watch.onAvailable(MOBILE))
        assertNull(watch.onCapabilitiesChanged(WIFI, healthyCapabilities.copy(isValidated = false)))
        assertNull(watch.onLinkPropertiesChanged(WIFI, healthyLink.copy(privateDnsActive = true)))
        assertNull(watch.onBlockedStatusChanged(WIFI, true))
    }

    @Test
    fun `start, stop, start - the old session's network events cannot stop the new session`() {
        for (tracksBestNetwork in listOf(false, true)) {
            val controller = VpnLifecycleController()
            controller.onStartRequested()
            controller.onTunnelEstablished()
            val oldSession = watch(captured = WIFI, tracksBestNetwork = tracksBestNetwork)

            assertEquals(VpnLifecycleController.StopDecision.CloseTunnel, controller.onStopRequested())
            oldSession.close()

            controller.onStartRequested()
            controller.onTunnelEstablished()
            val newSession = watch(captured = MOBILE, tracksBestNetwork = tracksBestNetwork)

            // Late callbacks from the old session's registration, and about the old network.
            val lateReports = listOfNotNull(
                oldSession.onLost(WIFI),
                oldSession.onLosing(WIFI),
                oldSession.onLinkPropertiesChanged(WIFI, healthyLink.copy(privateDnsActive = true)),
                oldSession.onAvailable(MOBILE),
                newSession.onLost(WIFI),
                newSession.onLosing(WIFI),
                newSession.onCapabilitiesChanged(WIFI, healthyCapabilities.copy(isValidated = false)),
                newSession.onBlockedStatusChanged(WIFI, true),
            )

            assertEquals(emptyList<UpstreamRefusalReason>(), lateReports)
            assertEquals(ServiceLifecycleState.RUNNING, controller.signals(true).serviceLifecycleState)
            assertNull(controller.signals(true).fatalError)

            // The new session is still watched on its own network.
            assertEquals(UpstreamRefusalReason.NO_UNDERLYING_NETWORK, newSession.onLost(MOBILE))
        }
    }

    private fun permutations(items: List<Int>): List<List<Int>> =
        if (items.size <= 1) {
            listOf(items)
        } else {
            items.flatMap { head -> permutations(items - head).map { listOf(head) + it } }
        }

    private companion object {
        const val WIFI = "wifi-100"
        const val MOBILE = "mobile-101"
    }
}
