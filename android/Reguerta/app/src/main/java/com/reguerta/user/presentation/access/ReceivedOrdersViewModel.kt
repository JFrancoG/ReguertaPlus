package com.reguerta.user.presentation.access

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.orders.OrdersRepository
import com.reguerta.user.domain.orders.ReceivedOrderProducerStatus
import com.reguerta.user.domain.orders.ReceivedOrderStatusWriteResult
import com.reguerta.user.domain.orders.ReceivedOrdersSnapshot
import com.reguerta.user.domain.orders.toIsoWeekStartDate
import com.reguerta.user.domain.orders.toIsoWeekKey
import com.reguerta.user.domain.shifts.ShiftAssignment
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId

enum class ReceivedOrdersRouteTab {
    BY_PRODUCT,
    BY_MEMBER,
}

data class ReceivedOrdersWindow(
    val isEnabled: Boolean,
    val targetWeekKey: String,
)

data class ReceivedOrdersContext(
    val producerId: String? = null,
    val isProducer: Boolean = false,
    val shifts: List<ShiftAssignment> = emptyList(),
    val defaultDeliveryDayOfWeek: DeliveryWeekday? = null,
    val deliveryCalendarOverrides: List<DeliveryCalendarOverride> = emptyList(),
    val nowMillis: Long = 0L,
) {
    val window: ReceivedOrdersWindow
        get() = resolveReceivedOrdersWindow(
            nowMillis = nowMillis,
            defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides = deliveryCalendarOverrides,
            shifts = shifts,
        )

    val identity: String
        get() = listOf(
            producerId.orEmpty(),
            isProducer.toString(),
            window.isEnabled.toString(),
            window.targetWeekKey,
            shifts.joinToString(separator = ",") { shift ->
                "${shift.id}:${shift.type}:${shift.dateMillis}:${shift.status}:${shift.updatedAtMillis}"
            },
            deliveryCalendarOverrides.joinToString(separator = ",") { override ->
                "${override.weekKey}:${override.deliveryDateMillis}:${override.ordersOpenAtMillis}:${override.ordersCloseAtMillis}:${override.updatedAtMillis}"
            },
            defaultDeliveryDayOfWeek?.name.orEmpty(),
        ).joinToString(separator = "|")
}

sealed interface ReceivedOrdersLoadState {
    data object Idle : ReceivedOrdersLoadState
    data object Loading : ReceivedOrdersLoadState
    data class Loaded(val snapshot: ReceivedOrdersSnapshot) : ReceivedOrdersLoadState
    data object Empty : ReceivedOrdersLoadState
    data object Error : ReceivedOrdersLoadState
}

data class ReceivedOrdersUiState(
    val selectedTab: ReceivedOrdersRouteTab = ReceivedOrdersRouteTab.BY_PRODUCT,
    val isProducer: Boolean = false,
    val window: ReceivedOrdersWindow = ReceivedOrdersWindow(isEnabled = false, targetWeekKey = ""),
    val loadState: ReceivedOrdersLoadState = ReceivedOrdersLoadState.Idle,
    val updatingStatusOrderId: String? = null,
    val statusWriteFeedback: ReceivedOrderStatusWriteResult? = null,
)

class ReceivedOrdersViewModel(
    private val ordersRepository: OrdersRepository,
    private val nowMillisProvider: () -> Long = { System.currentTimeMillis() },
) : ViewModel() {
    private val _uiState = MutableStateFlow(ReceivedOrdersUiState())
    val uiState: StateFlow<ReceivedOrdersUiState> = _uiState.asStateFlow()

    private var context = ReceivedOrdersContext()
    private var loadedTaskId: String? = null

    fun appear(context: ReceivedOrdersContext) {
        this.context = context
        viewModelScope.launch {
            loadIfNeeded()
        }
    }

    fun selectTab(tab: ReceivedOrdersRouteTab) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    fun retry() {
        viewModelScope.launch {
            loadedTaskId = null
            loadIfNeeded(force = true)
        }
    }

    fun updateProducerStatus(orderId: String, status: ReceivedOrderProducerStatus) {
        if (_uiState.value.updatingStatusOrderId != null) return
        val producerId = context.producerId?.takeIf(String::isNotBlank) ?: return
        val currentSnapshot = (_uiState.value.loadState as? ReceivedOrdersLoadState.Loaded)?.snapshot ?: return
        val group = currentSnapshot.byMemberGroups.firstOrNull { it.orderId == orderId } ?: return
        if (group.producerStatus == status) return

        viewModelScope.launch {
            _uiState.update { it.copy(updatingStatusOrderId = orderId) }
            val result = ordersRepository.updateReceivedOrderProducerStatus(
                orderId = orderId,
                producerId = producerId,
                status = status,
                nowMillis = nowMillisProvider(),
            )
            _uiState.update { state ->
                if (result == ReceivedOrderStatusWriteResult.SUCCESS) {
                    state.copy(
                        loadState = ReceivedOrdersLoadState.Loaded(currentSnapshot.withProducerStatus(orderId, status)),
                        updatingStatusOrderId = null,
                        statusWriteFeedback = null,
                    )
                } else {
                    state.copy(
                        updatingStatusOrderId = null,
                        statusWriteFeedback = result,
                    )
                }
            }
        }
    }

    private suspend fun loadIfNeeded(force: Boolean = false) {
        val window = context.window
        if (!context.isProducer || !window.isEnabled) {
            loadedTaskId = null
            _uiState.update {
                it.copy(
                    isProducer = context.isProducer,
                    window = window,
                    loadState = ReceivedOrdersLoadState.Idle,
                    statusWriteFeedback = null,
                )
            }
            return
        }
        val taskId = "${context.producerId.orEmpty()}|${window.targetWeekKey}"
        if (!force && loadedTaskId == taskId) return
        loadedTaskId = taskId
        _uiState.update {
            it.copy(
                isProducer = true,
                window = window,
                loadState = ReceivedOrdersLoadState.Loading,
                statusWriteFeedback = null,
            )
        }
        runCatching {
            ordersRepository.receivedOrdersSnapshot(
                producerId = context.producerId,
                weekKey = window.targetWeekKey,
                markUnreadAsRead = true,
            )
        }.fold(
            onSuccess = { snapshot ->
                _uiState.update {
                    it.copy(
                        loadState = if (
                            snapshot == null ||
                            (snapshot.byProductRows.isEmpty() && snapshot.byMemberGroups.isEmpty())
                        ) {
                            ReceivedOrdersLoadState.Empty
                        } else {
                            ReceivedOrdersLoadState.Loaded(snapshot)
                        },
                    )
                }
            },
            onFailure = {
                loadedTaskId = null
                _uiState.update { it.copy(loadState = ReceivedOrdersLoadState.Error) }
            },
        )
    }
}

class ReceivedOrdersViewModelFactory(
    private val ordersRepository: OrdersRepository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ReceivedOrdersViewModel::class.java)) {
            return ReceivedOrdersViewModel(ordersRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class ${modelClass.name}")
    }
}

fun resolveReceivedOrdersWindow(
    nowMillis: Long,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    shifts: List<ShiftAssignment>,
): ReceivedOrdersWindow {
    val zoneId = ZoneId.of("Europe/Madrid")
    val today = Instant.ofEpochMilli(nowMillis).atZone(zoneId).toLocalDate()
    val currentWeekKey = today.toIsoWeekKey()
    val weekStart = currentWeekKey.toIsoWeekStartDate() ?: today.with(DayOfWeek.MONDAY)
    val effectiveDeliveryDate = resolveReceivedOrdersDeliveryDate(
        currentWeekKey = currentWeekKey,
        defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides = deliveryCalendarOverrides,
        shifts = shifts,
        fallbackWeekStart = weekStart,
        zoneId = zoneId,
    )
    val isConsultaPhase = !today.isBefore(weekStart) && !today.isAfter(effectiveDeliveryDate)
    return ReceivedOrdersWindow(
        isEnabled = isConsultaPhase,
        targetWeekKey = if (isConsultaPhase) weekStart.minusWeeks(1).toIsoWeekKey() else currentWeekKey,
    )
}

private fun resolveReceivedOrdersDeliveryDate(
    currentWeekKey: String,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    shifts: List<ShiftAssignment>,
    fallbackWeekStart: java.time.LocalDate,
    zoneId: ZoneId,
): java.time.LocalDate {
    val override = deliveryCalendarOverrides.firstOrNull { it.weekKey == currentWeekKey }
    if (override != null) {
        return Instant.ofEpochMilli(override.deliveryDateMillis).atZone(zoneId).toLocalDate()
    }
    val weekStart = currentWeekKey.toIsoWeekStartDate() ?: fallbackWeekStart
    return weekStart.plusDays((DayOfWeek.WEDNESDAY.value - DayOfWeek.MONDAY.value).toLong())
}
