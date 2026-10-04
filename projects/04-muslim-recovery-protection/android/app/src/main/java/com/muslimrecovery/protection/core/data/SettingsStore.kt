package com.muslimrecovery.protection.core.data

import kotlinx.coroutines.flow.Flow

/** User-chosen theme. D0 (public / non-sensitive local) data. */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

/**
 * Store for **D0 only** (public / non-sensitive local) settings (M3-01 §9).
 *
 * Nothing private may be added here: reasons, plans, notes, the Recovery/Faith preference,
 * trusted-person data and selected apps are D1 and must go through the F7-approved secure
 * persistence mechanism. `onboardingComplete` is deliberately absent: persisting it here while the
 * required D1 preference lives elsewhere could leave contradictory state after process death
 * (Amendment A4); F1's Feature Contract decides where it is committed.
 *
 * The UI language is deliberately **not** stored here: since F9 it is owned solely by the Android/AppCompat
 * per-app locale mechanism (single source of truth, no second persisted copy).
 *
 * Read behaviour is total: a missing, unreadable or corrupt store, or an unknown stored value,
 * yields the default (`SYSTEM`), never an exception.
 */
interface SettingsStore {
    val themeMode: Flow<ThemeMode>

    suspend fun setThemeMode(mode: ThemeMode)
}
