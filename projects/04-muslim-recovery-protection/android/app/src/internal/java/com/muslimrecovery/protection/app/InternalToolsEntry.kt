package com.muslimrecovery.protection.app

import android.content.Intent
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import com.muslimrecovery.protection.ExperimentalHarnessActivity
import com.muslimrecovery.protection.R

/** Test tag of the internal harness entry button. */
internal const val INTERNAL_HARNESS_ENTRY_TAG = "internal_harness_entry"

/**
 * INTERNAL flavor only: the way from the product shell to the historical M1 DNS/VPN harness.
 * The play flavor declares an empty function with the same name; nothing here exists in play.
 */
@Composable
internal fun InternalToolsEntry() {
    val context = LocalContext.current
    Button(
        onClick = { context.startActivity(Intent(context, ExperimentalHarnessActivity::class.java)) },
        modifier = Modifier.testTag(INTERNAL_HARNESS_ENTRY_TAG),
    ) {
        Text(stringResource(R.string.internal_harness_entry))
    }
}
