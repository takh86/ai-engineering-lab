package com.muslimrecovery.protection.core.design.layout

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Shared spacing scale (matches the extension's 4 to 32). Feature-specific dimensions may still use their own dp. */
object TabsiraSpacing {
    val xs: Dp = 4.dp
    val s: Dp = 8.dp
    val m: Dp = 12.dp
    val l: Dp = 16.dp
    val xl: Dp = 24.dp
    val xxl: Dp = 32.dp

    /** Minimum interactive size (accessibility requirement). */
    val minTouchTarget: Dp = 48.dp

    val borderHairline: Dp = 1.dp
    val borderControl: Dp = 2.dp
    val focusWidth: Dp = 3.dp
}
