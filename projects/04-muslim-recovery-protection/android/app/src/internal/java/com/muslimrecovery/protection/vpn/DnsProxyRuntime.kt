package com.muslimrecovery.protection.vpn

import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import android.system.StructPollfd
import android.util.Log
import com.muslimrecovery.protection.dns.DnsPacketProcessor
import com.muslimrecovery.protection.dns.DnsRuntimeStopReason
import com.muslimrecovery.protection.dns.ExperimentalDnsCounters
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The M1-05 DNS proxy worker: ONE dedicated thread that reads packets from the TUN, hands each to
 * [DnsPacketProcessor], and writes any response packet back. There is no app-level queue — the
 * kernel's TUN buffer is the only (bounded) queue — and no other threads.
 *
 * Resource ownership:
 * - [tunnel] is this runtime's OWN duplicate of the service's TUN descriptor. Only the worker
 *   thread uses it, and only the worker closes it, in its `finally` block. The service closes its
 *   original descriptor independently. Because the worker never shares a descriptor number with
 *   anyone, a concurrent stop can never make it read from a closed-and-reused fd; the TUN interface
 *   itself is torn down once both descriptors are closed.
 * - [upstream]'s in-flight socket is closed by [stop] to unblock a pending receive.
 * - The stop signal is [running]; the TUN is polled with a [POLL_TIMEOUT_MS] timeout, so the worker
 *   notices a stop within that bound (plus at most one in-flight upstream exchange).
 *
 * Every [HEALTH_CHECK_INTERVAL_MS] the worker also re-checks the upstream precondition (Private DNS
 * still inactive; underlying network still present, validated and usable; DNS server still present)
 * and stops itself if it no longer holds — so the experimental status never keeps claiming "running"
 * after Private DNS was enabled, even if no allowed query happened to be forwarded in the meantime.
 * (M1-07: [UnderlyingNetworkMonitor] reports the same conditions sooner, from network callbacks.)
 *
 * [stop] is idempotent, never blocks, and is safe from any thread, including the worker itself.
 * [Listener.onRuntimeStopped] is invoked (on the worker thread) only when the runtime stops ITSELF
 * — never after an external [stop] — so a normal stop can never be reported as a failure.
 */
internal class DnsProxyRuntime private constructor(
    private val tunnel: ParcelFileDescriptor,
    private val processor: DnsPacketProcessor,
    private val upstream: ProtectedUpstreamDnsExchange,
    private val listener: Listener,
) {

    interface Listener {
        fun onCountersChanged(runtime: DnsProxyRuntime, counters: ExperimentalDnsCounters)
        fun onRuntimeStopped(runtime: DnsProxyRuntime, reason: DnsRuntimeStopReason)
    }

    private val running = AtomicBoolean(true)
    private val worker = Thread(::runLoop, WORKER_NAME)

    fun stop() {
        if (running.compareAndSet(true, false)) {
            upstream.cancel()
        }
    }

    private fun runLoop() {
        var selfStopReason: DnsRuntimeStopReason? = null
        try {
            selfStopReason = pumpPackets()
        } catch (e: ErrnoException) {
            selfStopReason = DnsRuntimeStopReason.TUNNEL_IO_FAILED
        } catch (e: IOException) {
            selfStopReason = DnsRuntimeStopReason.TUNNEL_IO_FAILED
        } finally {
            upstream.cancel()
            try {
                tunnel.close()
            } catch (e: IOException) {
                Log.w(TAG, "Error closing DNS proxy TUN descriptor")
            }
        }

        // compareAndSet claims the stop: if an external stop() already happened, this was not a
        // self-stop (e.g. the TUN was torn down underneath us by a revoke) and is not reported.
        if (selfStopReason != null && running.compareAndSet(true, false)) {
            Log.w(TAG, "DNS proxy stopped: $selfStopReason")
            listener.onRuntimeStopped(this, selfStopReason)
        } else {
            Log.i(TAG, "DNS proxy stopped")
        }
    }

    /** Returns a self-stop reason, or null when stopped externally. */
    private fun pumpPackets(): DnsRuntimeStopReason? {
        val fd = tunnel.fileDescriptor
        val pollFds = arrayOf(StructPollfd().apply {
            this.fd = fd
            events = OsConstants.POLLIN.toShort()
        })
        val buffer = ByteArray(READ_BUFFER_LENGTH)
        var nextHealthCheckAt = SystemClock.elapsedRealtime() + HEALTH_CHECK_INTERVAL_MS

        while (running.get()) {
            if (SystemClock.elapsedRealtime() >= nextHealthCheckAt) {
                upstream.checkUpstreamHealth()?.let { return it }
                nextHealthCheckAt = SystemClock.elapsedRealtime() + HEALTH_CHECK_INTERVAL_MS
            }

            pollFds[0].revents = 0
            val ready = try {
                Os.poll(pollFds, POLL_TIMEOUT_MS)
            } catch (e: ErrnoException) {
                if (e.errno == OsConstants.EINTR) continue
                throw e
            }
            if (ready == 0) continue

            val revents = pollFds[0].revents.toInt()
            if (revents and (OsConstants.POLLERR or OsConstants.POLLHUP or OsConstants.POLLNVAL) != 0) {
                return DnsRuntimeStopReason.TUNNEL_IO_FAILED
            }
            if (revents and OsConstants.POLLIN == 0) continue

            val length = try {
                Os.read(fd, buffer, 0, buffer.size)
            } catch (e: ErrnoException) {
                if (e.errno == OsConstants.EAGAIN || e.errno == OsConstants.EINTR) continue
                throw e
            }
            if (length <= 0) continue

            val result = try {
                processor.process(buffer, length)
            } catch (e: RuntimeException) {
                // Defense in depth only — the pure pipeline is fuzz-tested not to throw. One bad
                // packet must not take down the proxy (any local app can send to the virtual DNS
                // address), and the packet is never forwarded. No payload is logged.
                Log.w(TAG, "Unexpected DNS packet processing error; packet dropped")
                continue
            }
            if (!running.get()) return null

            result.responsePacket?.let { response ->
                try {
                    Os.write(fd, response, 0, response.size)
                } catch (e: ErrnoException) {
                    // A single response the kernel will not accept is dropped like a lost packet
                    // (the client retries); any other error means the TUN itself is unusable.
                    if (e.errno !in PER_PACKET_WRITE_ERRNOS) throw e
                    Log.w(TAG, "DNS response write rejected; response dropped")
                }
            }
            listener.onCountersChanged(this, processor.counters)
            result.stopReason?.let { return it }
        }
        return null
    }

    companion object {
        private const val TAG = "DnsProxyRuntime"
        private const val WORKER_NAME = "m1-05-dns-proxy"
        private const val POLL_TIMEOUT_MS = 250
        private const val HEALTH_CHECK_INTERVAL_MS = 2_000L

        /** A DNS query packet is tiny; anything read beyond this would be truncated and then rejected. */
        private const val READ_BUFFER_LENGTH = 32_767

        private val PER_PACKET_WRITE_ERRNOS = setOf(
            OsConstants.EAGAIN,
            OsConstants.ENOBUFS,
            OsConstants.EINVAL,
            OsConstants.EMSGSIZE,
        )

        /**
         * Starts a runtime that owns a duplicate of [serviceTunnel] (the caller keeps and closes its
         * own). Throws [IOException] if the descriptor cannot be duplicated; nothing is left running.
         */
        @Throws(IOException::class)
        fun start(
            serviceTunnel: ParcelFileDescriptor,
            processor: DnsPacketProcessor,
            upstream: ProtectedUpstreamDnsExchange,
            listener: Listener,
        ): DnsProxyRuntime {
            val owned = serviceTunnel.dup()
            val runtime = DnsProxyRuntime(owned, processor, upstream, listener)
            try {
                runtime.worker.start()
            } catch (e: RuntimeException) {
                owned.close()
                throw IOException("DNS proxy worker could not start", e)
            }
            Log.i(TAG, "DNS proxy started")
            return runtime
        }
    }
}
