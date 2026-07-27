package com.reguerta.user.data.orders

import com.reguerta.user.domain.orders.OrderSummarySnapshot
import com.reguerta.user.domain.orders.OrdersRepository
import com.reguerta.user.domain.orders.ReceivedOrderProducerStatus
import com.reguerta.user.domain.orders.ReceivedOrderStatusWriteResult
import com.reguerta.user.domain.orders.ReceivedOrdersSnapshot
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryOrdersRepository : OrdersRepository {
    private val mutex = Mutex()
    private val historyWeekKeysByMemberId = mutableMapOf<String, Set<String>>()
    private val summariesByMemberWeek = mutableMapOf<String, OrderSummarySnapshot>()
    private val receivedHistoryWeekKeysByProducerId = mutableMapOf<String, Set<String>>()
    private val receivedSnapshotsByProducerWeek = mutableMapOf<String, ReceivedOrdersSnapshot>()
    private val receivedStatusUpdateRequests = mutableListOf<ReceivedStatusUpdateRequest>()
    private val receivedStatusUpdateResultsByOrderId = mutableMapOf<String, ReceivedOrderStatusWriteResult>()
    var forcedError: Throwable? = null

    data class ReceivedStatusUpdateRequest(
        val orderId: String,
        val producerId: String,
        val status: ReceivedOrderProducerStatus,
    )

    override suspend fun orderHistoryWeekKeys(currentMemberId: String?): List<String> = mutex.withLock {
        forcedError?.let { throw it }
        val memberId = currentMemberId ?: return@withLock emptyList()
        val explicitKeys = historyWeekKeysByMemberId[memberId].orEmpty()
        val seededKeys = summariesByMemberWeek.keys
            .mapNotNull { key -> key.substringAfter("|", missingDelimiterValue = "").takeIf(String::isNotBlank) }
            .toSet()
        (explicitKeys + seededKeys).sorted()
    }

    override suspend fun orderSummarySnapshot(currentMemberId: String?, weekKey: String): OrderSummarySnapshot? =
        mutex.withLock {
            forcedError?.let { throw it }
            val memberId = currentMemberId ?: return@withLock null
            summariesByMemberWeek[key(memberId, weekKey)]
        }

    override suspend fun receivedOrdersHistoryWeekKeys(producerId: String?): List<String> = mutex.withLock {
        forcedError?.let { throw it }
        val resolvedProducerId = producerId ?: return@withLock emptyList()
        val explicitKeys = receivedHistoryWeekKeysByProducerId[resolvedProducerId].orEmpty()
        val seededKeys = receivedSnapshotsByProducerWeek.keys
            .mapNotNull { key ->
                val parts = key.split("|")
                parts.getOrNull(1)?.takeIf { parts.firstOrNull() == resolvedProducerId }
            }
            .toSet()
        (explicitKeys + seededKeys).sorted()
    }

    override suspend fun receivedOrdersSnapshot(
        producerId: String?,
        weekKey: String,
        markUnreadAsRead: Boolean,
    ): ReceivedOrdersSnapshot? = mutex.withLock {
        forcedError?.let { throw it }
        val resolvedProducerId = producerId ?: return@withLock null
        receivedSnapshotsByProducerWeek[key(resolvedProducerId, weekKey)]
    }

    override suspend fun updateReceivedOrderProducerStatus(
        orderId: String,
        producerId: String,
        status: ReceivedOrderProducerStatus,
        nowMillis: Long,
    ): ReceivedOrderStatusWriteResult = mutex.withLock {
        receivedStatusUpdateRequests += ReceivedStatusUpdateRequest(orderId, producerId, status)
        receivedStatusUpdateResultsByOrderId[orderId] ?: ReceivedOrderStatusWriteResult.SUCCESS
    }

    suspend fun setOrderHistoryWeekKeys(memberId: String, weekKeys: List<String>) = mutex.withLock {
        historyWeekKeysByMemberId[memberId] = weekKeys.toSet()
    }

    suspend fun setOrderSummary(memberId: String, snapshot: OrderSummarySnapshot) = mutex.withLock {
        summariesByMemberWeek[key(memberId, snapshot.weekKey)] = snapshot
    }

    suspend fun setReceivedOrdersHistoryWeekKeys(producerId: String, weekKeys: List<String>) = mutex.withLock {
        receivedHistoryWeekKeysByProducerId[producerId] = weekKeys.toSet()
    }

    suspend fun setReceivedOrdersSnapshot(
        producerId: String,
        weekKey: String,
        snapshot: ReceivedOrdersSnapshot,
    ) = mutex.withLock {
        receivedSnapshotsByProducerWeek[key(producerId, weekKey)] = snapshot
    }

    suspend fun setReceivedStatusUpdateResult(
        orderId: String,
        result: ReceivedOrderStatusWriteResult,
    ) = mutex.withLock {
        receivedStatusUpdateResultsByOrderId[orderId] = result
    }

    suspend fun receivedStatusUpdateRequests(): List<ReceivedStatusUpdateRequest> = mutex.withLock {
        receivedStatusUpdateRequests.toList()
    }

    private fun key(memberId: String, weekKey: String): String = "$memberId|$weekKey"
}
