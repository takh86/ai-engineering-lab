package com.muslimrecovery.protection.feature.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Holds the [PlanController] across rotation and the locale-change recreate. The draft text lives only in this
 * object's memory: it is deliberately not placed in SavedStateHandle or any saved instance state (it is D1), so a
 * process kill loses an unsaved draft (accepted, OD-W1-3).
 */
class PlanViewModel(
    store: PlanStore,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
) : ViewModel() {
    private val controller = PlanController(store)

    val state: StateFlow<PlanState> get() = controller.state

    init {
        scope.launch { controller.observe() }
    }

    fun onEvent(event: PlanEvent) = controller.dispatch(event)

    /** Save, save-as-new and confirmed delete: each makes exactly one store call. */
    fun submit(event: PlanEvent) {
        scope.launch { controller.submit(event) }
    }

    override fun onCleared() {
        scope.cancel()
    }

    companion object {
        /** Factory for the Integration Agent: `ViewModelProvider(owner, PlanViewModel.factory(store))`. */
        fun factory(store: PlanStore): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = PlanViewModel(store) as T
        }
    }
}
