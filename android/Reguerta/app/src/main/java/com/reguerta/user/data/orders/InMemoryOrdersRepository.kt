package com.reguerta.user.data.orders

import com.reguerta.user.domain.orders.OrderSummarySnapshot
import com.reguerta.user.domain.orders.OrdersRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryOrdersRepository : OrdersRepository {
    private val mutex = Mutex()
    private val historyWeekKeysByMemberId = mutableMapOf<String, Set<String>>()
    private val summariesByMemberWeek = mutableMapOf<String, OrderSummarySnapshot>()
    var forcedError: Throwable? = null

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

    suspend fun setOrderHistoryWeekKeys(memberId: String, weekKeys: List<String>) = mutex.withLock {
        historyWeekKeysByMemberId[memberId] = weekKeys.toSet()
    }

    suspend fun setOrderSummary(memberId: String, snapshot: OrderSummarySnapshot) = mutex.withLock {
        summariesByMemberWeek[key(memberId, snapshot.weekKey)] = snapshot
    }

    private fun key(memberId: String, weekKey: String): String = "$memberId|$weekKey"
}
