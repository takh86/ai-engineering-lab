package com.muslimrecovery.protection.core.design.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.muslimrecovery.protection.core.design.layout.TabsiraSpacing
import com.muslimrecovery.protection.core.design.theme.TabsiraDesign

/**
 * A grouped surface with a hairline border and no elevation. In Dark the royal card does not separate from the navy
 * background by contrast (1.56:1), so grouping relies on the heading and spacing inside it, not on the fill.
 */
@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface,
        border = BorderStroke(TabsiraSpacing.borderHairline, TabsiraDesign.colors.border),
    ) {
        Column(modifier = Modifier.padding(TabsiraSpacing.l), content = content)
    }
}
