package com.muslimrecovery.protection.app

import android.app.Application

/** Process entry point that owns the [AppContainer]. */
class TabsiraApplication : Application() {
    val container: AppContainer by lazy { AppContainer.create(this) }
}
