package com.reguerta.user.data.orders

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.orders.OrderSummaryGroup
import com.reguerta.user.domain.orders.OrderSummaryLine
import com.reguerta.user.domain.orders.OrderSummarySnapshot
import com.reguerta.user.domain.orders.OrdersRepository
import com.reguerta.user.domain.orders.isValidIsoWeekKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale

class FirestoreOrdersRepository(
    private val firestore: FirebaseFirestore,
    environment: ReguertaFirestoreEnvironment? = null,
) : OrdersRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val ordersPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.ORDERS)

    private val orderLinesPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.ORDER_LINES)

    override suspend fun orderHistoryWeekKeys(currentMemberId: String?): List<String> = withContext(Dispatchers.IO) {
        val memberId = currentMemberId?.trim()?.takeIf(String::isNotBlank) ?: return@withContext emptyList()
        val weekKeys = linkedSetOf<String>()
        var hasSuccessfulRead = false
        var lastFailure: Throwable? = null

        listOf("userId", "memberId").forEach { fieldName ->
            runCatching {
                Tasks.await(
                    firestore.collection(ordersPath)
                        .whereEqualTo(fieldName, memberId)
                        .get(),
                )
            }.onSuccess { snapshot ->
                hasSuccessfulRead = true
                snapshot.documents.forEach { document ->
                    orderHistoryWeekKey(document.data.orEmpty(), document.id)?.let(weekKeys::add)
                }
            }.onFailure { lastFailure = it }

            runCatching {
                Tasks.await(
                    firestore.collection(orderLinesPath)
                        .whereEqualTo(fieldName, memberId)
                        .get(),
                )
            }.onSuccess { snapshot ->
                hasSuccessfulRead = true
                snapshot.documents.forEach { document ->
                    orderHistoryWeekKey(document.data.orEmpty(), document.id)?.let(weekKeys::add)
                }
            }.onFailure { lastFailure = it }
        }

        if (!hasSuccessfulRead && lastFailure != null) {
            throw lastFailure
        }
        weekKeys.sorted()
    }

    override suspend fun orderSummarySnapshot(
        currentMemberId: String?,
        weekKey: String,
    ): OrderSummarySnapshot? = withContext(Dispatchers.IO) {
        val memberId = currentMemberId?.trim()?.takeIf(String::isNotBlank) ?: return@withContext null
        val normalizedWeekKey = weekKey.trim().takeIf(String::isValidIsoWeekKey) ?: return@withContext null
        val deterministicOrderId = "${memberId}_$normalizedWeekKey"
        val orderDocuments = fetchMemberOrderDocuments(
            memberId = memberId,
            weekKey = normalizedWeekKey,
            deterministicOrderId = deterministicOrderId,
        )
        val candidateOrderIds = (listOf(deterministicOrderId) + orderDocuments.keys)
            .map(String::trim)
            .filter(String::isNotBlank)
            .distinct()
        val lineDocuments = fetchMemberOrderLineDocuments(
            memberId = memberId,
            weekKey = normalizedWeekKey,
            candidateOrderIds = candidateOrderIds,
        )
        val groups = buildOrderSummaryGroups(lineDocuments.values.map(::orderSummaryLine))
        if (groups.isEmpty()) {
            null
        } else {
            val total = orderDocuments.values.firstNotNullOfOrNull { payload ->
                (payload["total"] as? Number)?.toDouble()
            } ?: groups.sumOf(OrderSummaryGroup::subtotal)
            OrderSummarySnapshot(
                weekKey = normalizedWeekKey,
                groups = groups,
                total = total,
            )
        }
    }

    private fun fetchMemberOrderDocuments(
        memberId: String,
        weekKey: String,
        deterministicOrderId: String,
    ): Map<String, Map<String, Any>> {
        val orderDocuments = linkedMapOf<String, Map<String, Any>>()
        val deterministicOrderSnapshot = Tasks.await(firestore.document("$ordersPath/$deterministicOrderId").get())
        if (deterministicOrderSnapshot.exists()) {
            orderDocuments[deterministicOrderSnapshot.id] = deterministicOrderSnapshot.data.orEmpty()
        }

        val weekOrdersSnapshot = Tasks.await(
            firestore.collection(ordersPath)
                .whereEqualTo("weekKey", weekKey)
                .get(),
        )
        weekOrdersSnapshot.documents
            .filter { document ->
                document.id == deterministicOrderId ||
                    document.data.orEmpty().matchesMemberOrder(memberId, weekKey, deterministicOrderId, document.id)
            }
            .forEach { document ->
                orderDocuments[document.id] = document.data.orEmpty()
            }
        return orderDocuments
    }

    private fun fetchMemberOrderLineDocuments(
        memberId: String,
        weekKey: String,
        candidateOrderIds: List<String>,
    ): Map<String, Map<String, Any>> {
        val lineDocuments = linkedMapOf<String, Map<String, Any>>()
        candidateOrderIds.forEach { orderId ->
            val linesSnapshot = Tasks.await(
                firestore.collection(orderLinesPath)
                    .whereEqualTo("orderId", orderId)
                    .get(),
            )
            linesSnapshot.documents.forEach { document ->
                lineDocuments[document.id] = document.data.orEmpty()
            }
        }

        val weekLinesSnapshot = Tasks.await(
            firestore.collection(orderLinesPath)
                .whereEqualTo("weekKey", weekKey)
                .get(),
        )
        weekLinesSnapshot.documents
            .filter { document ->
                document.data.orEmpty().matchesOrderLine(memberId, weekKey, candidateOrderIds)
            }
            .forEach { document ->
                lineDocuments[document.id] = document.data.orEmpty()
            }
        return lineDocuments
    }
}

private fun orderHistoryWeekKey(payload: Map<String, Any>, documentId: String): String? {
    val payloadWeekKey = (payload["weekKey"] as? String)?.trim()
    if (!payloadWeekKey.isNullOrBlank() && payloadWeekKey.isValidIsoWeekKey()) {
        return payloadWeekKey
    }
    return documentId.split("_").lastOrNull(String::isValidIsoWeekKey)
}

private fun Map<String, Any>.matchesMemberOrder(
    memberId: String,
    weekKey: String,
    deterministicOrderId: String,
    documentId: String,
): Boolean {
    val payloadWeekKey = (this["weekKey"] as? String)?.trim()
    val payloadUserId = (this["userId"] as? String)?.trim()
    val payloadMemberId = (this["memberId"] as? String)?.trim()
    val parsedUserId = parseOrderUserIdFromDocumentId(documentId, weekKey)
    val matchesWeek = payloadWeekKey == weekKey || documentId.endsWith("_$weekKey")
    val matchesMember = payloadUserId == memberId ||
        payloadMemberId == memberId ||
        parsedUserId == memberId ||
        documentId == deterministicOrderId
    return matchesWeek && matchesMember
}

private fun Map<String, Any>.matchesOrderLine(
    memberId: String,
    weekKey: String,
    candidateOrderIds: List<String>,
): Boolean {
    val orderId = (this["orderId"] as? String)?.trim()
    val payloadWeekKey = (this["weekKey"] as? String)?.trim()
    val payloadUserId = (this["userId"] as? String)?.trim()
    val payloadMemberId = (this["memberId"] as? String)?.trim()
    val matchesOrderId = orderId?.let(candidateOrderIds::contains) ?: false
    val matchesWeek = payloadWeekKey == weekKey || matchesOrderId
    val matchesMember = payloadUserId == memberId || payloadMemberId == memberId || matchesOrderId
    return matchesWeek && matchesMember
}

private fun parseOrderUserIdFromDocumentId(documentId: String, weekKey: String): String? {
    val suffix = "_$weekKey"
    if (!documentId.endsWith(suffix) || documentId.length <= suffix.length) return null
    return documentId.removeSuffix(suffix).takeIf(String::isNotBlank)
}

private fun buildOrderSummaryGroups(lines: List<OrderSummaryLine>): List<OrderSummaryGroup> =
    lines.groupBy { line -> line.vendorId to line.companyName }
        .map { (groupKey, groupedLines) ->
            val sortedLines = groupedLines.sortedBy { it.productName.lowercase(Locale.getDefault()) }
            OrderSummaryGroup(
                vendorId = groupKey.first,
                companyName = groupKey.second,
                lines = sortedLines,
                subtotal = sortedLines.sumOf(OrderSummaryLine::subtotal),
            )
        }
        .sortedBy { it.companyName.lowercase(Locale.getDefault()) }

private fun orderSummaryLine(payload: Map<String, Any>): OrderSummaryLine {
    val vendorId = (payload["vendorId"] as? String)?.trim().orEmpty().ifBlank { "__vendor_unknown__" }
    val companyName = (payload["companyName"] as? String)?.trim().orEmpty().ifBlank { vendorId }
    val productName = (payload["productName"] as? String)?.trim().orEmpty().ifBlank { "Producto" }
    val quantity = (payload["quantity"] as? Number)?.toDouble() ?: 0.0
    val subtotal = (payload["subtotal"] as? Number)?.toDouble()
        ?: quantity * ((payload["priceAtOrder"] as? Number)?.toDouble() ?: 0.0)
    val unitName = (payload["unitName"] as? String)?.trim().orEmpty().ifBlank { "ud." }
    return OrderSummaryLine(
        id = "$vendorId|$productName",
        vendorId = vendorId,
        companyName = companyName,
        productName = productName,
        packagingLine = orderPackagingLine(payload),
        quantityLabel = orderQuantityLabel(
            quantity = quantity,
            pricingMode = (payload["pricingModeAtOrder"] as? String)?.trim(),
            unitName = unitName,
            unitAbbreviation = (payload["unitAbbreviation"] as? String)?.trim(),
        ),
        subtotal = subtotal,
    )
}

private fun orderPackagingLine(payload: Map<String, Any>): String {
    val containerName = (payload["packContainerName"] as? String)?.trim()?.takeIf(String::isNotBlank)
        ?: (payload["unitName"] as? String)?.trim().orEmpty()
    val quantity = ((payload["packContainerQty"] as? Number)?.toDouble()
        ?: (payload["unitQty"] as? Number)?.toDouble()
        ?: 1.0).toOrderUiDecimal()
    val unitName = (payload["unitName"] as? String)?.trim().orEmpty()
    val unitPlural = (payload["unitPlural"] as? String)?.trim().orEmpty()
    val unit = (payload["packContainerAbbreviation"] as? String)?.trim()?.takeIf(String::isNotBlank)
        ?: (payload["packContainerPlural"] as? String)?.trim()?.takeIf(String::isNotBlank)
        ?: (payload["unitAbbreviation"] as? String)?.trim()?.takeIf(String::isNotBlank)
        ?: if ((payload["packContainerQty"] as? Number)?.toDouble() == 1.0) unitName else unitPlural
    return listOf(containerName, quantity, unit)
        .filter(String::isNotBlank)
        .joinToString(separator = " ")
}

private fun orderQuantityLabel(
    quantity: Double,
    pricingMode: String?,
    unitName: String,
    unitAbbreviation: String?,
): String {
    if (pricingMode.equals("weight", ignoreCase = true)) {
        val unit = unitAbbreviation?.takeIf(String::isNotBlank) ?: unitName
        return "${quantity.toOrderUiDecimal()} $unit"
    }
    return if (quantity == 1.0) "1 ud." else "${quantity.toOrderUiDecimal()} uds."
}

private fun Double.toOrderUiDecimal(): String {
    if (this % 1.0 == 0.0) return toLong().toString()
    return String.format(Locale.US, "%.2f", this).trimEnd('0').trimEnd('.')
}
