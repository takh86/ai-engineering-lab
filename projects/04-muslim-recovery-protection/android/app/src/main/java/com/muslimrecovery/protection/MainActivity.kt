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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.muslimrecovery.protection.domain.protection.ProtectionSignals
import com.muslimrecovery.protection.domain.protection.ProtectionState
import com.muslimrecovery.protection.domain.protection.ProtectionStateEvaluator
import com.muslimrecovery.protection.vpn.LocalProtectionVpnService
import com.muslimrecovery.protection.vpn.VpnRuntimeStatus

/**
 * M1-04 development/test harness only — NOT the product UI (see docs/decisions.md). It exists
 * so a human can exercise the real VPN consent + lifecycle flow on-device. It intentionally
 * shows the domain-truthful [ProtectionState] and never claims "Protected", because M1-04
 * implements no filtering.
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
    val protectionState = ProtectionStateEvaluator.evaluate(
        ProtectionSignals(
            vpnPermissionGranted = vpnPermissionGranted,
            serviceLifecycleState = runtimeFacts.serviceLifecycleState,
            tunnelEstablished = runtimeFacts.tunnelEstablished,
            filteringOperational = false,
            fatalError = runtimeFacts.fatalError,
        ),
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Recovery Protection — M1-04 lifecycle harness")
        Text(text = "State: ${describe(protectionState)}")

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
    }
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
    // Unreachable in M1-04: filteringOperational is always false, so the evaluator can only
    // ever produce this while a future milestone actually implements filtering.
    ProtectionState.Protected -> "Protected"
    is ProtectionState.Degraded -> "Degraded (${state.reasons.joinToString()})"
    ProtectionState.Stopped -> "Stopped"
    is ProtectionState.Error -> "Error: ${state.reason}"
}
