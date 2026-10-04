package com.muslimrecovery.protection.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.muslimrecovery.protection.R

/** Test tag of the shell's title, used by the shell launch test. */
internal const val PRODUCT_SHELL_TITLE_TAG = "product_shell_title"

/**
 * Minimal product shell (W0b). It shows only the app name; real features arrive with their own
 * Feature Contracts. [InternalToolsEntry] is a compile-time, flavor-specific slot: empty in the play
 * flavor, the entry to the historical experiment in the internal flavor.
 */
@Composable
internal fun ProductShell() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(R.string.app_name),
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.testTag(PRODUCT_SHELL_TITLE_TAG),
        )
        InternalToolsEntry()
    }
}
