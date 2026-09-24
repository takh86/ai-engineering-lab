package com.muslimrecovery.protection.dns

import org.junit.Assert.assertEquals
import org.junit.Test
import java.net.InetAddress

class UpstreamDnsSelectorTest {

    // InetAddress.getByAddress never performs a DNS lookup.
    private fun v4(a: Int, b: Int, c: Int, d: Int): InetAddress =
        InetAddress.getByAddress(byteArrayOf(a.toByte(), b.toByte(), c.toByte(), d.toByte()))

    private val virtualDns = v4(10, 111, 222, 1)
    private val tunAddress = v4(10, 111, 222, 2)
    private val excluded = setOf(virtualDns, tunAddress)
    private val routerDns = v4(192, 168, 1, 1)
    private val ipv6Dns = InetAddress.getByAddress(ByteArray(16).also {
        it[0] = 0x20
        it[1] = 0x01
        it[2] = 0x0D
        it[3] = 0xB8.toByte()
        it[15] = 0x53
    })

    private fun facts(
        isVpn: Boolean = false,
        hasInternet: Boolean = true,
        privateDnsActive: Boolean = false,
        dnsServers: List<InetAddress> = listOf(routerDns),
    ) = UnderlyingNetworkDnsFacts(isVpn, hasInternet, privateDnsActive, dnsServers)

    @Test
    fun `selects the underlying network's own DNS server`() {
        assertEquals(UpstreamDnsSelection.Selected(routerDns), UpstreamDnsSelector.select(facts(), excluded))
    }

    @Test
    fun `Private DNS active refuses plaintext forwarding even when a DNS server is available`() {
        val selection = UpstreamDnsSelector.select(facts(privateDnsActive = true), excluded)

        assertEquals(UpstreamDnsSelection.Refused(UpstreamRefusalReason.PRIVATE_DNS_ACTIVE), selection)
        assertEquals(
            DnsProxyStatus.REFUSED_PRIVATE_DNS_ACTIVE,
            DnsProxyStatus.fromRefusal(UpstreamRefusalReason.PRIVATE_DNS_ACTIVE),
        )
        assertEquals(false, DnsProxyStatus.REFUSED_PRIVATE_DNS_ACTIVE.isOperational)
    }

    @Test
    fun `missing or non-internet network is refused`() {
        assertEquals(
            UpstreamDnsSelection.Refused(UpstreamRefusalReason.NO_UNDERLYING_NETWORK),
            UpstreamDnsSelector.select(null, excluded),
        )
        assertEquals(
            UpstreamDnsSelection.Refused(UpstreamRefusalReason.NO_UNDERLYING_NETWORK),
            UpstreamDnsSelector.select(facts(hasInternet = false), excluded),
        )
    }

    @Test
    fun `a VPN network is never used as the upstream network`() {
        assertEquals(
            UpstreamDnsSelection.Refused(UpstreamRefusalReason.UNDERLYING_NETWORK_IS_VPN),
            UpstreamDnsSelector.select(facts(isVpn = true), excluded),
        )
    }

    @Test
    fun `the proxy's own addresses are never selected, preventing a forwarding loop`() {
        assertEquals(
            UpstreamDnsSelection.Refused(UpstreamRefusalReason.NO_USABLE_DNS_SERVER),
            UpstreamDnsSelector.select(facts(dnsServers = listOf(virtualDns, tunAddress)), excluded),
        )
        assertEquals(
            UpstreamDnsSelection.Selected(routerDns),
            UpstreamDnsSelector.select(facts(dnsServers = listOf(virtualDns, routerDns)), excluded),
        )
    }

    @Test
    fun `loopback, wildcard and multicast addresses are not usable`() {
        val unusable = listOf(v4(127, 0, 0, 1), v4(0, 0, 0, 0), v4(224, 0, 0, 251))

        assertEquals(
            UpstreamDnsSelection.Refused(UpstreamRefusalReason.NO_USABLE_DNS_SERVER),
            UpstreamDnsSelector.select(facts(dnsServers = unusable), excluded),
        )
    }

    @Test
    fun `empty DNS server list is refused`() {
        assertEquals(
            UpstreamDnsSelection.Refused(UpstreamRefusalReason.NO_USABLE_DNS_SERVER),
            UpstreamDnsSelector.select(facts(dnsServers = emptyList()), excluded),
        )
    }

    @Test
    fun `IPv4 servers are preferred, IPv6 is used only when no IPv4 server exists`() {
        assertEquals(
            UpstreamDnsSelection.Selected(routerDns),
            UpstreamDnsSelector.select(facts(dnsServers = listOf(ipv6Dns, routerDns)), excluded),
        )
        assertEquals(
            UpstreamDnsSelection.Selected(ipv6Dns),
            UpstreamDnsSelector.select(facts(dnsServers = listOf(ipv6Dns)), excluded),
        )
    }

    @Test
    fun `a periodic re-check refusal stops the runtime with the matching reason`() {
        val privateDns = DnsRuntimeStopReason.forRefusal(UpstreamRefusalReason.PRIVATE_DNS_ACTIVE)

        assertEquals(DnsRuntimeStopReason.PRIVATE_DNS_ACTIVE, privateDns)
        assertEquals(DnsProxyStatus.REFUSED_PRIVATE_DNS_ACTIVE, DnsProxyStatus.fromStopReason(privateDns))
        for (reason in UpstreamRefusalReason.values().filter { it != UpstreamRefusalReason.PRIVATE_DNS_ACTIVE }) {
            assertEquals(DnsRuntimeStopReason.UPSTREAM_UNAVAILABLE, DnsRuntimeStopReason.forRefusal(reason))
        }
    }

    @Test
    fun `refusal reasons map to non-operational experimental statuses`() {
        for (reason in UpstreamRefusalReason.values()) {
            assertEquals(false, DnsProxyStatus.fromRefusal(reason).isOperational)
        }
        for (reason in DnsRuntimeStopReason.values()) {
            assertEquals(false, DnsProxyStatus.fromStopReason(reason).isOperational)
        }
    }
}
