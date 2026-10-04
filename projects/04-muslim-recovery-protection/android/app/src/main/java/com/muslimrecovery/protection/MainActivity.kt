package com.muslimrecovery.protection

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxSize
import com.muslimrecovery.protection.app.ProductShell

/**
 * The product launcher (M3-01 W0b). Intentionally minimal: it hosts [ProductShell] and nothing from the
 * historical M1 DNS/VPN experiment, which lives only in the internal flavor
 * (see docs/android/historical-code-map.md).
 */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductShell()
                }
            }
        }
    }
}
