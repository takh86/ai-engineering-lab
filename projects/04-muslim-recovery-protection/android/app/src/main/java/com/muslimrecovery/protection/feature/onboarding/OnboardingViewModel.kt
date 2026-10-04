package com.muslimrecovery.protection.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.muslimrecovery.protection.core.design.locale.AppLanguageController

/**
 * Keeps the onboarding draft across configuration changes and the locale-change recreation. It deliberately does not
 * use SavedStateHandle: reasons are D1 and must not be copied into framework saved state (OD-W1-3). After process
 * death onboarding restarts at the first step; that is the accepted trade-off in the contract.
 */
class OnboardingViewModel(
    store: OnboardingStore,
    languageController: AppLanguageController,
    faithAvailable: Boolean,
) : ViewModel() {
    val holder: OnboardingStateHolder = OnboardingStateHolder(store, languageController, viewModelScope, faithAvailable)
}

/** Factory for the host (Integration) to pass to a `ViewModelProvider`; no navigation or viewmodel-compose library needed. */
fun onboardingViewModelFactory(
    store: OnboardingStore,
    languageController: AppLanguageController,
    faithAvailable: Boolean = false,
): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(OnboardingViewModel::class.java)) { "Unsupported ViewModel class" }
        return OnboardingViewModel(store, languageController, faithAvailable) as T
    }
}
