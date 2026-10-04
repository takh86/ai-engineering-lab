package com.muslimrecovery.protection.core.design.theme

/**
 * Semantic color roles, defined once for Light and Dark from the brand palette only.
 *
 * Rules the tests enforce:
 *  - every role is a brand color (disabledContent may be a brand color at reduced alpha);
 *  - declared text/UI pairs meet WCAG contrast thresholds (ContrastTest);
 *  - lime and sky are never a text color; lime is never a foreground on light surfaces.
 *
 * State (selected, error, focus, disabled) is never carried by color alone: components add an icon, text,
 * border width or semantics state. Dark cards (royal on navy, 1.56:1) do not separate from the background by
 * contrast, so grouping there relies on spacing and headings; [border] is decorative and exempt from contrast.
 */
internal data class ColorTokens(
    val background: Long,
    val surface: Long,
    val surfaceVariant: Long,
    val textPrimary: Long,
    val textSecondary: Long,
    /** Fill of the primary action. */
    val primary: Long,
    val onPrimary: Long,
    /** Links, outlines and icons on surfaces. */
    val secondary: Long,
    val onSecondary: Long,
    /** Decorative hairline. Exempt from contrast. */
    val border: Long,
    /** Boundary of interactive controls. At least 3:1 against the surfaces it sits on. */
    val borderStrong: Long,
    val focus: Long,
    /** Illustrations and decoration only, never text. */
    val accentGraphic: Long,
    /** Disabled text and icons: a brand color at 38% alpha. Disabled content is exempt from contrast. */
    val disabledContent: Long,
    /** Opaque; scrims are drawn at [SCRIM_ALPHA]. */
    val scrim: Long,
) {
    companion object {
        const val SCRIM_ALPHA: Float = 0.6f
        private const val DISABLED_ALPHA = 0x61 // 38%

        val Light = ColorTokens(
            background = BrandPalette.SURFACE,
            surface = BrandPalette.WHITE,
            surfaceVariant = BrandPalette.SURFACE,
            textPrimary = BrandPalette.NAVY,
            textSecondary = BrandPalette.NAVY,
            primary = BrandPalette.LIME,
            onPrimary = BrandPalette.NAVY,
            secondary = BrandPalette.ROYAL,
            onSecondary = BrandPalette.WHITE,
            border = BrandPalette.SURFACE,
            borderStrong = BrandPalette.ROYAL,
            focus = BrandPalette.NAVY,
            accentGraphic = BrandPalette.SKY,
            disabledContent = BrandPalette.NAVY.withAlpha(DISABLED_ALPHA),
            scrim = BrandPalette.NAVY,
        )

        val Dark = ColorTokens(
            background = BrandPalette.NAVY,
            surface = BrandPalette.ROYAL,
            surfaceVariant = BrandPalette.NAVY,
            textPrimary = BrandPalette.WHITE,
            textSecondary = BrandPalette.SURFACE,
            primary = BrandPalette.LIME,
            onPrimary = BrandPalette.NAVY,
            secondary = BrandPalette.WHITE,
            onSecondary = BrandPalette.NAVY,
            border = BrandPalette.ROYAL,
            borderStrong = BrandPalette.WHITE,
            focus = BrandPalette.LIME,
            accentGraphic = BrandPalette.SKY,
            disabledContent = BrandPalette.WHITE.withAlpha(DISABLED_ALPHA),
            scrim = BrandPalette.NAVY,
        )
    }
}

/** WCAG 2.x relative luminance and contrast ratio for opaque sRGB colors. */
internal object Contrast {
    private fun channel(value: Long): Double {
        val c = value / 255.0
        return if (c <= 0.03928) c / 12.92 else Math.pow((c + 0.055) / 1.055, 2.4)
    }

    fun luminance(argb: Long): Double {
        val r = channel((argb shr 16) and 0xFF)
        val g = channel((argb shr 8) and 0xFF)
        val b = channel(argb and 0xFF)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    fun ratio(foreground: Long, background: Long): Double {
        val a = luminance(foreground)
        val b = luminance(background)
        return (maxOf(a, b) + 0.05) / (minOf(a, b) + 0.05)
    }
}
