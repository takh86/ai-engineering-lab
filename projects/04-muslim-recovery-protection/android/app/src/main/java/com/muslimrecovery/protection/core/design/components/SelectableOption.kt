package com.muslimrecovery.protection.core.design.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.muslimrecovery.protection.core.design.layout.TabsiraSpacing
import com.muslimrecovery.protection.core.design.theme.TabsiraDesign

/** Test hooks for the position of the selection marker and the label (RTL mirroring evidence). */
internal const val SELECTABLE_OPTION_MARKER_TAG = "tabsira_option_marker"
internal const val SELECTABLE_OPTION_LABEL_TAG = "tabsira_option_label"

/**
 * A single-choice (radio) or multi-choice (checkbox) option row. Selection is shown three ways, never by color
 * alone: a check icon replaces the empty marker, the border is 2dp instead of 1dp, and the semantics expose the
 * selected/checked state with the radio or checkbox role. The whole row is the touch target (at least 48dp).
 */
@Composable
fun SelectableOption(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    description: String? = null,
    multiSelect: Boolean = false,
    enabled: Boolean = true,
) {
    val colors = TabsiraDesign.colors
    val shape = MaterialTheme.shapes.medium
    val borderWidth = if (selected) TabsiraSpacing.borderControl else TabsiraSpacing.borderHairline
    val interaction = if (multiSelect) {
        Modifier.toggleable(value = selected, enabled = enabled, role = Role.Checkbox, onValueChange = { onClick() })
    } else {
        Modifier.selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = onClick)
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = TabsiraSpacing.minTouchTarget)
            .clip(shape)
            .border(BorderStroke(borderWidth, if (enabled) colors.borderStrong else colors.disabledContent), shape)
            .then(interaction)
            .padding(TabsiraSpacing.m),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(TabsiraSpacing.m),
    ) {
        Box(modifier = Modifier.size(24.dp).testTag(SELECTABLE_OPTION_MARKER_TAG), contentAlignment = Alignment.Center) {
            if (selected) {
                Icon(
                    imageVector = Icons.Filled.CheckCircle,
                    contentDescription = null,
                    tint = if (enabled) MaterialTheme.colorScheme.secondary else colors.disabledContent,
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .border(
                            BorderStroke(TabsiraSpacing.borderControl, if (enabled) colors.borderStrong else colors.disabledContent),
                            CircleShape,
                        ),
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                modifier = Modifier.testTag(SELECTABLE_OPTION_LABEL_TAG),
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                color = if (enabled) MaterialTheme.colorScheme.onSurface else colors.disabledContent,
            )
            if (description != null) {
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (enabled) colors.textSecondary else colors.disabledContent,
                )
            }
        }
    }
}
