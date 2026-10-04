package com.muslimrecovery.protection.core.design.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.drawable.ColorDrawable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.layout.tabsiraShapes
import com.muslimrecovery.protection.core.design.type.tabsiraTypography

/** Accessor for the design roles Material3 has no slot for. */
object TabsiraDesign {
    val colors: TabsiraColors
        @Composable get() = LocalTabsiraColors.current
}

/**
 * The Tabsira theme: brand-only semantic colors, approved typography and shapes over Material3.
 *
 * [themeMode] comes from the D0 `SettingsStore`; SYSTEM follows the device. The theme starts from whatever mode the
 * caller supplies (SYSTEM by default) and simply recomposes when it changes: there is no startup blocking read.
 * It also sets the system-bar icon contrast and the window background so the OS chrome matches the active theme.
 * Dynamic color is deliberately not used (OD-F9-8).
 */
@Composable
fun TabsiraTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    content: @Composable () -> Unit,
) {
    val dark = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val tokens = if (dark) ColorTokens.Dark else ColorTokens.Light
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = view.context.findActivity()?.window
            if (window != null) {
                window.setBackgroundDrawable(ColorDrawable(tokens.background.toInt()))
                WindowCompat.getInsetsController(window, view).apply {
                    isAppearanceLightStatusBars = !dark
                    isAppearanceLightNavigationBars = !dark
                }
            }
        }
    }
    CompositionLocalProvider(LocalTabsiraColors provides TabsiraColors(tokens)) {
        MaterialTheme(
            colorScheme = tokens.toColorScheme(),
            typography = remember { tabsiraTypography() },
            shapes = remember { tabsiraShapes() },
            content = content,
        )
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
