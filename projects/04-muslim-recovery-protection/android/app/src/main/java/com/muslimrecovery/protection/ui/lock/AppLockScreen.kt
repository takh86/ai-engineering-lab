package com.muslimrecovery.protection.ui.lock

import android.app.Activity
import android.app.KeyguardManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.getSystemService
import com.muslimrecovery.protection.R

/**
 * Gates [content] behind the device's own screen-lock credential (PIN/pattern/password/
 * biometric), via the platform `KeyguardManager` confirmation flow — no credential is ever
 * read, stored, or compared by this app. If the device has no screen lock configured, gating is
 * skipped entirely rather than shown as a lock that cannot actually be enforced (see
 * [AppLockState.DeviceCredentialUnavailable]).
 */
@Composable
fun AppLockGate(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val keyguardManager = remember { context.getSystemService<KeyguardManager>() }
    val deviceCredentialAvailable = remember { keyguardManager?.isDeviceSecure == true }
    var lockState by remember {
        mutableStateOf(AppLockEvaluator.initial(deviceCredentialAvailable))
    }
    var lastAttemptFailed by remember { mutableStateOf(false) }

    val unlockLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val succeeded = result.resultCode == Activity.RESULT_OK
        lastAttemptFailed = !succeeded
        lockState = AppLockEvaluator.afterAuthResult(lockState, succeeded)
    }

    when (lockState) {
        AppLockState.Unlocked, AppLockState.DeviceCredentialUnavailable -> content()
        AppLockState.Locked -> LoginScreen(
            lastAttemptFailed = lastAttemptFailed,
            onUnlockClick = {
                val intent = keyguardManager?.createConfirmDeviceCredentialIntent(
                    context.getString(R.string.app_lock_prompt_title),
                    context.getString(R.string.app_lock_prompt_description),
                )
                if (intent != null) {
                    unlockLauncher.launch(intent)
                }
            },
        )
    }
}

@Composable
private fun LoginScreen(lastAttemptFailed: Boolean, onUnlockClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(R.string.app_lock_title),
            style = MaterialTheme.typography.headlineSmall,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.app_lock_description),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.widthIn(max = 320.dp),
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onUnlockClick) {
            Text(text = stringResource(R.string.app_lock_unlock_button))
        }
        if (lastAttemptFailed) {
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.app_lock_failed),
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}
