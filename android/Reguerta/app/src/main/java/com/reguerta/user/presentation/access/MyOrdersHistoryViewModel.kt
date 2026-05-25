package com.reguerta.user.presentation.access

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.reguerta.user.domain.orders.OrderHistoryWeekOption
import com.reguerta.user.domain.orders.OrderSummarySnapshot
import com.reguerta.user.domain.orders.OrdersRepository
import com.reguerta.user.domain.orders.orderHistoryContinuousWeekOptions
import com.reguerta.user.domain.orders.orderHistoryPreviousIsoWeekKey
import com.reguerta.user.domain.orders.orderHistoryWeekOption
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MyOrdersHistoryContext(
    val currentMemberId: String? = null,
    val nowMillis: Long = 0L,
) {
    val identity: String
        get() = "${currentMemberId.orEmpty()}|${orderHistoryPreviousIsoWeekKey(nowMillis)}"
}

sealed interface MyOrdersHistoryLoadState {
    data object Idle : MyOrdersHistoryLoadState
    data object Loading : MyOrdersHistoryLoadState
    data class Loaded(val snapshot: OrderSummarySnapshot) : MyOrdersHistoryLoadState
    data object Empty : MyOrdersHistoryLoadState
    data object Error : MyOrdersHistoryLoadState
}

data class MyOrdersHistoryUiState(
    val availableWeeks: List<OrderHistoryWeekOption> = emptyList(),
    val selectedWeekKey: String? = null,
    val pickerSelectedWeekKey: String? = null,
    val isWeekPickerVisible: Boolean = false,
    val loadState: MyOrdersHistoryLoadState = MyOrdersHistoryLoadState.Idle,
) {
    val selectedWeek: OrderHistoryWeekOption?
        get() = selectedWeekKey?.let { weekKey ->
            availableWeeks.firstOrNull { it.weekKey == weekKey } ?: orderHistoryWeekOption(weekKey)
        }

    val selectedWeekIndex: Int?
        get() = selectedWeekKey?.let { weekKey -> availableWeeks.indexOfFirst { it.weekKey == weekKey } }
            ?.takeIf { it >= 0 }

    val canGoPrevious: Boolean
        get() = selectedWeekIndex?.let { it > availableWeeks.indices.first } == true

    val canGoNext: Boolean
        get() = selectedWeekIndex?.let { it < availableWeeks.indices.last } == true
}

class MyOrdersHistoryViewModel(
    private val ordersRepository: OrdersRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(MyOrdersHistoryUiState())
    val uiState: StateFlow<MyOrdersHistoryUiState> = _uiState.asStateFlow()

    private var context = MyOrdersHistoryContext()
    private var loadedHistoryIdentity: String? = null
    private var loadedWeekKey: String? = null

    fun appear(context: MyOrdersHistoryContext) {
        this.context = context
        viewModelScope.launch {
            loadHistoryIfNeeded()
        }
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
        if (!force && loadedHistoryIdentity == context.identity) {
            loadSelectedWeek()
            return
        }
        loadedHistoryIdentity = context.identity
        val preferredWeekKey = orderHistoryPreviousIsoWeekKey(context.nowMillis)
        _uiState.update {
            it.copy(
                selectedWeekKey = preferredWeekKey,
                pickerSelectedWeekKey = preferredWeekKey,
                loadState = MyOrdersHistoryLoadState.Loading,
            )
        }
        loadedWeekKey = null
        runCatching {
            val realWeekKeys = ordersRepository.orderHistoryWeekKeys(context.currentMemberId)
            val options = orderHistoryContinuousWeekOptions(
                realWeekKeys = realWeekKeys,
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
                    availableWeeks = orderHistoryWeekOption(preferredWeekKey)?.let(::listOf).orEmpty(),
                    loadState = MyOrdersHistoryLoadState.Error,
                )
            }
        }
    }

    private suspend fun loadSelectedWeek(force: Boolean = false) {
        val weekKey = _uiState.value.selectedWeekKey ?: orderHistoryPreviousIsoWeekKey(context.nowMillis)
        if (!force && loadedWeekKey == weekKey) return
        loadedWeekKey = weekKey
        _uiState.update { it.copy(selectedWeekKey = weekKey, loadState = MyOrdersHistoryLoadState.Loading) }
        runCatching {
            ordersRepository.orderSummarySnapshot(context.currentMemberId, weekKey)
        }.fold(
            onSuccess = { snapshot ->
                _uiState.update {
                    it.copy(
                        loadState = if (snapshot == null || snapshot.groups.isEmpty()) {
                            MyOrdersHistoryLoadState.Empty
                        } else {
                            MyOrdersHistoryLoadState.Loaded(snapshot)
                        },
                    )
                }
            },
            onFailure = {
                loadedWeekKey = null
                _uiState.update { it.copy(loadState = MyOrdersHistoryLoadState.Error) }
            },
        )
    }
}

class MyOrdersHistoryViewModelFactory(
    private val ordersRepository: OrdersRepository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MyOrdersHistoryViewModel::class.java)) {
            return MyOrdersHistoryViewModel(ordersRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class ${modelClass.name}")
    }
}
