package com.reguerta.user.presentation.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.reguerta.user.domain.orders.OrderHistoryWeekOption
import com.reguerta.user.domain.orders.OrdersRepository
import com.reguerta.user.domain.orders.ReceivedOrdersSnapshot
import com.reguerta.user.domain.orders.orderHistoryBrowsableWeekOptions
import com.reguerta.user.domain.orders.orderHistoryPreviousIsoWeekKey
import com.reguerta.user.domain.orders.orderHistoryWeekOption
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class ReceivedOrdersHistoryTab {
    BY_PRODUCT,
    BY_MEMBER,
}

data class ReceivedOrdersHistoryContext(
    val producerId: String? = null,
    val isProducer: Boolean = false,
    val nowMillis: Long = 0L,
) {
    val identity: String
        get() = "${producerId.orEmpty()}|$isProducer|${orderHistoryPreviousIsoWeekKey(nowMillis)}"
}

sealed interface ReceivedOrdersHistoryLoadState {
    data object Idle : ReceivedOrdersHistoryLoadState
    data object Loading : ReceivedOrdersHistoryLoadState
    data class Loaded(val snapshot: ReceivedOrdersSnapshot) : ReceivedOrdersHistoryLoadState
    data object Empty : ReceivedOrdersHistoryLoadState
    data object Error : ReceivedOrdersHistoryLoadState
}

data class ReceivedOrdersHistoryUiState(
    val availableWeeks: List<OrderHistoryWeekOption> = emptyList(),
    val selectedWeekKey: String? = null,
    val pickerSelectedWeekKey: String? = null,
    val isWeekPickerVisible: Boolean = false,
    val selectedTab: ReceivedOrdersHistoryTab = ReceivedOrdersHistoryTab.BY_PRODUCT,
    val isProducer: Boolean = false,
    val loadState: ReceivedOrdersHistoryLoadState = ReceivedOrdersHistoryLoadState.Idle,
) {
    val selectedWeek: OrderHistoryWeekOption?
        get() = selectedWeekKey?.let { weekKey ->
            availableWeeks.firstOrNull { it.weekKey == weekKey } ?: orderHistoryWeekOption(weekKey)
        }

    val selectedTitle: String?
        get() = selectedWeek?.let { week -> "Pedidos recibidos ${week.rangeLabel}" }

    val selectedWeekIndex: Int?
        get() = selectedWeekKey?.let { weekKey -> availableWeeks.indexOfFirst { it.weekKey == weekKey } }
            ?.takeIf { it >= 0 }

    val canGoPrevious: Boolean
        get() = selectedWeekIndex?.let { it > availableWeeks.indices.first } == true

    val canGoNext: Boolean
        get() = selectedWeekIndex?.let { it < availableWeeks.indices.last } == true
}

class ReceivedOrdersHistoryViewModel(
    private val ordersRepository: OrdersRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ReceivedOrdersHistoryUiState())
    val uiState: StateFlow<ReceivedOrdersHistoryUiState> = _uiState.asStateFlow()

    private var context = ReceivedOrdersHistoryContext()
    private var loadedHistoryIdentity: String? = null
    private var loadedWeekKey: String? = null

    fun appear(context: ReceivedOrdersHistoryContext) {
        this.context = context
        viewModelScope.launch {
            loadHistoryIfNeeded()
        }
    }

    fun selectTab(tab: ReceivedOrdersHistoryTab) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    fun retry() {
        viewModelScope.launch {
            loadedWeekKey = null
            if (_uiState.value.availableWeeks.isEmpty()) {
                loadedHistoryIdentity = null
                loadHistoryIfNeeded(force = true)
            } else {
                loadSelectedWeek(force = true)
            }
        }
    }

    fun selectPreviousWeek() {
        val state = _uiState.value
        val index = state.selectedWeekIndex ?: return
        if (!state.canGoPrevious) return
        selectWeek(state.availableWeeks[index - 1].weekKey)
    }

    fun selectNextWeek() {
        val state = _uiState.value
        val index = state.selectedWeekIndex ?: return
        if (!state.canGoNext) return
        selectWeek(state.availableWeeks[index + 1].weekKey)
    }

    fun selectWeek(weekKey: String) {
        if (_uiState.value.selectedWeekKey == weekKey) return
        viewModelScope.launch {
            _uiState.update { it.copy(selectedWeekKey = weekKey) }
            loadedWeekKey = null
            loadSelectedWeek(force = true)
        }
    }

    fun presentWeekPicker() {
        _uiState.update {
            it.copy(
                pickerSelectedWeekKey = it.selectedWeekKey ?: it.availableWeeks.firstOrNull()?.weekKey,
                isWeekPickerVisible = true,
            )
        }
    }

    fun dismissWeekPicker() {
        _uiState.update { it.copy(isWeekPickerVisible = false) }
    }

    fun setPickerSelection(weekKey: String) {
        _uiState.update { it.copy(pickerSelectedWeekKey = weekKey) }
    }

    fun commitPickerSelection() {
        val target = _uiState.value.pickerSelectedWeekKey
        dismissWeekPicker()
        if (!target.isNullOrBlank()) {
            selectWeek(target)
        }
    }

    private suspend fun loadHistoryIfNeeded(force: Boolean = false) {
        if (!context.isProducer) {
            resetForUnavailableProducer()
            return
        }
        if (!force && loadedHistoryIdentity == context.identity) {
            loadSelectedWeek()
            return
        }
        loadedHistoryIdentity = context.identity
        val preferredWeekKey = orderHistoryPreviousIsoWeekKey(context.nowMillis)
        _uiState.update {
            it.copy(
                isProducer = true,
                selectedWeekKey = preferredWeekKey,
                pickerSelectedWeekKey = preferredWeekKey,
                loadState = ReceivedOrdersHistoryLoadState.Loading,
            )
        }
        loadedWeekKey = null
        runCatching {
            val realWeekKeys = ordersRepository.receivedOrdersHistoryWeekKeys(context.producerId)
            val oldestOrderWeekKey = ordersRepository.oldestOrderHistoryWeekKey()
            val options = orderHistoryBrowsableWeekOptions(
                realWeekKeys = realWeekKeys,
                oldestOrderWeekKey = oldestOrderWeekKey,
                preferredWeekKey = preferredWeekKey,
            ).ifEmpty {
                orderHistoryWeekOption(preferredWeekKey)?.let(::listOf).orEmpty()
            }
            _uiState.update {
                it.copy(
                    availableWeeks = options,
                    selectedWeekKey = preferredWeekKey,
                    pickerSelectedWeekKey = preferredWeekKey,
                )
            }
            loadSelectedWeek(force = true)
        }.onFailure {
            loadedHistoryIdentity = null
            _uiState.update {
                it.copy(
                    availableWeeks = orderHistoryBrowsableWeekOptions(
                        realWeekKeys = emptyList(),
                        preferredWeekKey = preferredWeekKey,
                    ),
                    loadState = ReceivedOrdersHistoryLoadState.Error,
                )
            }
        }
    }

    private suspend fun loadSelectedWeek(force: Boolean = false) {
        val weekKey = _uiState.value.selectedWeekKey ?: orderHistoryPreviousIsoWeekKey(context.nowMillis)
        if (!force && loadedWeekKey == weekKey) return
        loadedWeekKey = weekKey
        _uiState.update { it.copy(selectedWeekKey = weekKey, loadState = ReceivedOrdersHistoryLoadState.Loading) }
        runCatching {
            ordersRepository.receivedOrdersSnapshot(
                producerId = context.producerId,
                weekKey = weekKey,
                markUnreadAsRead = false,
            )
        }.fold(
            onSuccess = { snapshot ->
                _uiState.update {
                    it.copy(
                        loadState = if (
                            snapshot == null ||
                            (snapshot.byProductRows.isEmpty() && snapshot.byMemberGroups.isEmpty())
                        ) {
                            ReceivedOrdersHistoryLoadState.Empty
                        } else {
                            ReceivedOrdersHistoryLoadState.Loaded(snapshot)
                        },
                    )
                }
            },
            onFailure = {
                loadedWeekKey = null
                _uiState.update { it.copy(loadState = ReceivedOrdersHistoryLoadState.Error) }
            },
        )
    }

    private fun resetForUnavailableProducer() {
        loadedHistoryIdentity = null
        loadedWeekKey = null
        _uiState.value = ReceivedOrdersHistoryUiState()
    }
}

class ReceivedOrdersHistoryViewModelFactory(
    private val ordersRepository: OrdersRepository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ReceivedOrdersHistoryViewModel::class.java)) {
            return ReceivedOrdersHistoryViewModel(ordersRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class ${modelClass.name}")
    }
}
