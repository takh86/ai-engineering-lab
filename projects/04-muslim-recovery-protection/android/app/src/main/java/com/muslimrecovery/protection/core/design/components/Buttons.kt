package com.muslimrecovery.protection.core.design.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import com.muslimrecovery.protection.core.design.layout.TabsiraSpacing
import com.muslimrecovery.protection.core.design.theme.TabsiraDesign

/**
 * The primary action: lime fill with a navy label (6.97:1). Lime on a light surface is only 1.48:1, so the button
 * always carries a 2dp navy border and never relies on its fill alone. Labels wrap (never truncate) and the minimum
 * size is 48dp. [text] must already be localized; the caller owns the string resource.
 */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val colors = TabsiraDesign.colors
    Button(
        onClick = onClick,
        modifier = modifier.heightIn(min = TabsiraSpacing.minTouchTarget),
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            disabledContentColor = colors.disabledContent,
        ),
        border = BorderStroke(
            TabsiraSpacing.borderControl,
            if (enabled) MaterialTheme.colorScheme.onPrimary else colors.disabledContent,
        ),
    ) {
        Text(text = text, style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center)
    }
}

/** A secondary action: transparent fill, 2dp strong border and a secondary-colored label. */
@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val colors = TabsiraDesign.colors
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = TabsiraSpacing.minTouchTarget),
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = Color.Transparent,
            contentColor = MaterialTheme.colorScheme.secondary,
            disabledContainerColor = Color.Transparent,
            disabledContentColor = colors.disabledContent,
        ),
        border = BorderStroke(
            TabsiraSpacing.borderControl,
            if (enabled) colors.borderStrong else colors.disabledContent,
        ),
    ) {
        Text(text = text, style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center)
    }
}

/** A low-emphasis action. Underlined, so it is never identified by color alone. */
@Composable
fun TextAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val colors = TabsiraDesign.colors
    TextButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = TabsiraSpacing.minTouchTarget),
        enabled = enabled,
        colors = ButtonDefaults.textButtonColors(
            contentColor = MaterialTheme.colorScheme.secondary,
            disabledContentColor = colors.disabledContent,
        ),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            textDecoration = TextDecoration.Underline,
            textAlign = TextAlign.Center,
        )
    }
}
