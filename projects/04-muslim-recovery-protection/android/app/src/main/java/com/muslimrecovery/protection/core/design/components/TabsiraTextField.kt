package com.muslimrecovery.protection.core.design.components

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.TextStyle
import com.muslimrecovery.protection.R
import com.muslimrecovery.protection.core.design.theme.TabsiraDesign

/**
 * A labelled text field. The label is mandatory (accessibility). An error is shown with a warning icon plus the
 * [errorText] message and a navy/white border, never with a red color. User-typed text uses content-based text
 * direction so mixed Arabic/Latin input aligns correctly in either layout direction.
 */
@Composable
fun TabsiraTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    singleLine: Boolean = false,
    errorText: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    val colors = TabsiraDesign.colors
    val isError = errorText != null
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        enabled = enabled,
        singleLine = singleLine,
        isError = isError,
        label = { Text(label) },
        textStyle = MaterialTheme.typography.bodyLarge.merge(TextStyle(textDirection = TextDirection.Content)),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        supportingText = if (errorText != null) {
            { Text(errorText) }
        } else {
            null
        },
        trailingIcon = if (isError) {
            { Icon(Icons.Filled.Warning, contentDescription = stringResource(R.string.common_error_icon_description)) }
        } else {
            null
        },
        shape = MaterialTheme.shapes.small,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = colors.focus,
            unfocusedBorderColor = colors.borderStrong,
            errorBorderColor = MaterialTheme.colorScheme.onSurface,
            disabledBorderColor = colors.disabledContent,
            focusedLabelColor = MaterialTheme.colorScheme.onSurface,
            unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
            errorLabelColor = MaterialTheme.colorScheme.onSurface,
            focusedTextColor = MaterialTheme.colorScheme.onSurface,
            unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
            errorTextColor = MaterialTheme.colorScheme.onSurface,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            errorContainerColor = MaterialTheme.colorScheme.surface,
            focusedSupportingTextColor = MaterialTheme.colorScheme.onSurface,
            unfocusedSupportingTextColor = MaterialTheme.colorScheme.onSurface,
            errorSupportingTextColor = MaterialTheme.colorScheme.onSurface,
            errorTrailingIconColor = MaterialTheme.colorScheme.onSurface,
            cursorColor = colors.focus,
            errorCursorColor = colors.focus,
        ),
    )
}
