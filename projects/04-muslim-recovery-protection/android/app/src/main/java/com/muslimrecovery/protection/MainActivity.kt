package com.muslimrecovery.protection

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import com.muslimrecovery.protection.app.ProductShell
import com.muslimrecovery.protection.app.TabsiraApplication
import com.muslimrecovery.protection.core.data.ThemeMode
import com.muslimrecovery.protection.core.design.components.TabsiraScreen
import com.muslimrecovery.protection.core.design.theme.TabsiraTheme

/**
 * The product launcher (M3-01 W0b). Intentionally minimal: it hosts [ProductShell] and nothing from the
 * historical M1 DNS/VPN experiment, which lives only in the internal flavor
 * (see docs/android/historical-code-map.md).
 *
 * F9: an [AppCompatActivity] so the AppCompat per-app locale mechanism owns the UI language (it recreates this
 * activity on a language change). The theme starts from SYSTEM and reacts to the persisted [ThemeMode] flow;
 * there is deliberately no blocking read at startup.
 */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val settings = (application as TabsiraApplication).container.settingsStore
        setContent {
            val themeMode by settings.themeMode.collectAsState(initial = ThemeMode.SYSTEM)
            TabsiraTheme(themeMode = themeMode) {
                TabsiraScreen {
                    ProductShell()
                }
            }
        }
    }
}
