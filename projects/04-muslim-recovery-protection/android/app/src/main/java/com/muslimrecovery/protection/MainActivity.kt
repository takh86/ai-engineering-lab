package com.muslimrecovery.protection

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.muslimrecovery.protection.dns.DnsProxyStatus
import com.muslimrecovery.protection.dns.ExperimentalDnsCounters
import com.muslimrecovery.protection.dns.ExperimentalDnsTestRules
import com.muslimrecovery.protection.domain.protection.ProtectionState
import com.muslimrecovery.protection.domain.protection.ProtectionStateEvaluator
import com.muslimrecovery.protection.vpn.LocalProtectionVpnService
import com.muslimrecovery.protection.vpn.VpnRuntimeStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.InetAddress

/**
 * M1-04/M1-05 development/test harness only — NOT the product UI (see docs/decisions.md). It exists
 * so a human can exercise the real VPN consent + lifecycle flow and the M1-05 standard-DNS
 * experiment on-device, producing reproducible engineering evidence. It intentionally shows the
 * domain-truthful [ProtectionState] and never claims "Protected": the DNS experiment is not
 * verified protection (D11), so `filteringOperational` stays false.
 */
class MainActivity : ComponentActivity() {

    private val vpnPermissionGranted = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        refreshVpnPermission()
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProtectionLifecycleHarness(
                        vpnPermissionGranted = vpnPermissionGranted.value,
                        onPermissionRefreshed = { granted -> vpnPermissionGranted.value = granted },
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Android does not push a live callback when the user revokes VPN access from system
        // Settings; re-checking on resume is how the harness notices that truthfully.
        refreshVpnPermission()
    }

    private fun refreshVpnPermission() {
        vpnPermissionGranted.value = isVpnPrepared(this)
    }
}

@Composable
private fun ProtectionLifecycleHarness(
    vpnPermissionGranted: Boolean,
    onPermissionRefreshed: (Boolean) -> Unit,
) {
    val context = LocalContext.current

    val consentLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val granted = isVpnPrepared(context)
        onPermissionRefreshed(granted)
        if (result.resultCode == Activity.RESULT_OK && granted) {
            startVpnService(context)
        }
        // Denied/cancelled: deliberately do nothing further. The service is never started, so
        // the state stays Stopped/PermissionRequired — never Protected.
    }

    // Sequenced deliberately: launching two system permission/activity flows concurrently
    // (notification permission + VPN consent) is unreliable. This callback always continues
    // to the VPN consent step regardless of grant/deny — POST_NOTIFICATIONS denial must never
    // block VPN startup, since the service is still permitted to run without it (only the
    // visible notification would be suppressed).
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        proceedToVpnConsent(context, consentLauncher, onPermissionRefreshed)
    }

    val runtimeFacts by VpnRuntimeStatus.facts
    val dnsCounters by VpnRuntimeStatus.dnsCounters
    val protectionState = ProtectionStateEvaluator.evaluate(
        runtimeFacts.toProtectionSignals(vpnPermissionGranted),
    )

    val scope = rememberCoroutineScope()
    var lookupResult by remember { mutableStateOf("No test lookup yet") }
    val resolveTestDomain: (String) -> Unit = { domain ->
        lookupResult = "$domain: resolving..."
        scope.launch {
            // Off the main thread, through the normal system resolver (the same path other apps use).
            lookupResult = withContext(Dispatchers.IO) { resolveWithSystemResolver(domain) }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Recovery Protection — M1-05 DNS experiment harness")
        Text(text = "State: ${describe(protectionState)}")
        Text(text = "Experimental DNS proxy: ${describe(runtimeFacts.dnsProxyStatus)}")
        Text(text = describe(dnsCounters))
        Text(text = "Standard DNS experiment only. Full protection is NOT verified.")

        Button(onClick = {
            // Sequenced: request the notification permission first (only if not already
            // granted, and never re-request once granted), then continue into VPN
            // prepare/consent only after that flow's callback fires — never both system
            // flows at once.
            if (needsNotificationPermissionRequest(context)) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                proceedToVpnConsent(context, consentLauncher, onPermissionRefreshed)
            }
        }) {
            Text("Start")
        }

        Button(onClick = { stopVpnService(context) }) {
            Text("Stop")
        }

        Button(onClick = { resolveTestDomain(ExperimentalDnsTestRules.BLOCKED_TEST_DOMAIN) }) {
            Text("Resolve blocked test domain")
        }

        Button(onClick = { resolveTestDomain(ExperimentalDnsTestRules.BLOCKED_TEST_SUBDOMAIN) }) {
            Text("Resolve blocked test subdomain")
        }

        Button(onClick = { resolveTestDomain(ExperimentalDnsTestRules.ALLOWED_TEST_DOMAIN) }) {
            Text("Resolve allowed test domain")
        }

        Text(text = lookupResult)
    }
}

/**
 * Resolves one of the fixed harmless test domains via [InetAddress] (getaddrinfo → Android's system
 * resolver). Reports only the outcome and address count. Note: Android caches lookup results in
 * the app process for ~2 seconds, so wait a few seconds between repeating a lookup across a VPN
 * start/stop.
 */
private fun resolveWithSystemResolver(domain: String): String = try {
    val addresses = InetAddress.getAllByName(domain)
    "$domain: resolved (${addresses.size} address(es))"
} catch (e: Exception) {
    "$domain: NOT resolved (${e.javaClass.simpleName})"
}

private fun isVpnPrepared(context: Context): Boolean = VpnService.prepare(context) == null

private fun needsNotificationPermissionRequest(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return false
    return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
        PackageManager.PERMISSION_GRANTED
}

private fun proceedToVpnConsent(
    context: Context,
    consentLauncher: ActivityResultLauncher<Intent>,
    onPermissionRefreshed: (Boolean) -> Unit,
) {
    val prepareIntent = VpnService.prepare(context)
    if (prepareIntent != null) {
        consentLauncher.launch(prepareIntent)
    } else {
        onPermissionRefreshed(true)
        startVpnService(context)
    }
}

private fun startVpnService(context: Context) {
    val intent = Intent(context, LocalProtectionVpnService::class.java)
        .setAction(LocalProtectionVpnService.ACTION_START)
    ContextCompat.startForegroundService(context, intent)
}

private fun stopVpnService(context: Context) {
    val intent = Intent(context, LocalProtectionVpnService::class.java)
        .setAction(LocalProtectionVpnService.ACTION_STOP)
    context.startService(intent)
}

private fun describe(state: ProtectionState): String = when (state) {
    ProtectionState.PermissionRequired -> "Permission required"
    ProtectionState.Starting -> "Starting"
    // Unreachable in M1-04/M1-05: filteringOperational is always false (D8, D11), so the evaluator
    // can only ever produce this once a future, human-approved milestone verifies real protection.
    ProtectionState.Protected -> "Protected"
    is ProtectionState.Degraded -> "Degraded (${state.reasons.joinToString()})"
    ProtectionState.Stopped -> "Stopped"
    is ProtectionState.Error -> "Error: ${state.reason}"
}

private fun describe(status: DnsProxyStatus): String = when (status) {
    DnsProxyStatus.NOT_RUNNING -> "not running"
    DnsProxyStatus.RUNNING -> "running (standard DNS only, experimental)"
    DnsProxyStatus.REFUSED_PRIVATE_DNS_ACTIVE -> "refused: Private DNS is active (no plaintext downgrade)"
    DnsProxyStatus.UNAVAILABLE_NO_UPSTREAM -> "unavailable: underlying network changed or not usable (see State)"
    DnsProxyStatus.FAILED -> "failed"
}

private fun describe(counters: ExperimentalDnsCounters): String =
    "DNS counters: blocked=${counters.blocked}, forwarded=${counters.forwarded}, " +
        "refused/unsupported=${counters.refusedOrUnsupported}, dropped=${counters.dropped}, " +
        "upstream failures=${counters.upstreamFailures}"
