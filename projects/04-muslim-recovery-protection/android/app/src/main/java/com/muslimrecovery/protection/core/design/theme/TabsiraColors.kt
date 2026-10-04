package com.muslimrecovery.protection.core.design.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Compose-facing view of [ColorTokens] for roles Material3 has no slot for. Features read these through
 * [com.muslimrecovery.protection.core.design.theme.TabsiraDesign], never through color literals.
 */
class TabsiraColors internal constructor(internal val tokens: ColorTokens) {
    val borderStrong: Color get() = Color(tokens.borderStrong)
    val border: Color get() = Color(tokens.border)
    val focus: Color get() = Color(tokens.focus)
    val accentGraphic: Color get() = Color(tokens.accentGraphic)
    val disabledContent: Color get() = Color(tokens.disabledContent)
    val textSecondary: Color get() = Color(tokens.textSecondary)
    val scrim: Color get() = Color(tokens.scrim).copy(alpha = ColorTokens.SCRIM_ALPHA)
}

internal val LocalTabsiraColors = staticCompositionLocalOf { TabsiraColors(ColorTokens.Light) }

/**
 * Maps the semantic tokens onto every Material3 slot. All slots are set explicitly through the constructor, so
 * no Material baseline (purple) or default red can leak in; a Material3 upgrade that adds a slot fails to compile
 * here and must be reviewed.
 */
internal fun ColorTokens.toColorScheme(): ColorScheme {
    val bg = Color(background)
    val surf = Color(surface)
    val variant = Color(surfaceVariant)
    val text = Color(textPrimary)
    val textSecond = Color(textSecondary)
    val prim = Color(primary)
    val onPrim = Color(onPrimary)
    val second = Color(secondary)
    val onSecond = Color(onSecondary)
    return ColorScheme(
        primary = prim,
        onPrimary = onPrim,
        primaryContainer = variant,
        onPrimaryContainer = text,
        inversePrimary = prim,
        secondary = second,
        onSecondary = onSecond,
        secondaryContainer = variant,
        onSecondaryContainer = text,
        tertiary = second,
        onTertiary = onSecond,
        tertiaryContainer = variant,
        onTertiaryContainer = text,
        background = bg,
        onBackground = text,
        surface = surf,
        onSurface = text,
        surfaceVariant = variant,
        onSurfaceVariant = textSecond,
        surfaceTint = Color.Transparent,
        inverseSurface = text,
        inverseOnSurface = bg,
        error = text,
        onError = bg,
        errorContainer = variant,
        onErrorContainer = text,
        outline = Color(borderStrong),
        outlineVariant = Color(border),
        scrim = Color(scrim),
        surfaceBright = surf,
        surfaceDim = bg,
        surfaceContainerLowest = surf,
        surfaceContainerLow = surf,
        surfaceContainer = surf,
        surfaceContainerHigh = variant,
        surfaceContainerHighest = variant,
        primaryFixed = prim,
        primaryFixedDim = prim,
        onPrimaryFixed = onPrim,
        onPrimaryFixedVariant = onPrim,
        secondaryFixed = variant,
        secondaryFixedDim = variant,
        onSecondaryFixed = text,
        onSecondaryFixedVariant = text,
        tertiaryFixed = variant,
        tertiaryFixedDim = variant,
        onTertiaryFixed = text,
        onTertiaryFixedVariant = text,
    )
}
