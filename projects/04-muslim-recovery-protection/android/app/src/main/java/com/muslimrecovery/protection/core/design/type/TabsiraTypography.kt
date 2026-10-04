package com.muslimrecovery.protection.core.design.type

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Material3 typography mapped onto the five Tabsira styles: headline, title, body, bodySmall and label.
 * `letterSpacing = 0` everywhere; sizes are `sp`.
 */
internal fun tabsiraTypography(): Typography {
    fun heading(step: TypeScale.Step) = TextStyle(
        fontFamily = HeadingFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = step.sizeSp.sp,
        lineHeight = step.lineHeightSp.sp,
        letterSpacing = 0.sp,
    )

    fun text(step: TypeScale.Step) = TextStyle(
        fontFamily = BodyFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = step.sizeSp.sp,
        lineHeight = step.lineHeightSp.sp,
        letterSpacing = 0.sp,
    )

    val headline = heading(TypeScale.headline)
    val title = heading(TypeScale.title)
    val label = heading(TypeScale.label)
    val body = text(TypeScale.body)
    val bodySmall = text(TypeScale.bodySmall)
    return Typography(
        displayLarge = headline,
        displayMedium = headline,
        displaySmall = headline,
        headlineLarge = headline,
        headlineMedium = headline,
        headlineSmall = title,
        titleLarge = title,
        titleMedium = title,
        titleSmall = label,
        bodyLarge = body,
        bodyMedium = bodySmall,
        bodySmall = bodySmall,
        labelLarge = label,
        labelMedium = label,
        labelSmall = label,
    )
}
