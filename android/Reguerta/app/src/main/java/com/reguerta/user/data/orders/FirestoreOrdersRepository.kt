package com.reguerta.user.data.orders

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.orders.OrderSummaryGroup
import com.reguerta.user.domain.orders.OrderSummaryLine
import com.reguerta.user.domain.orders.OrderSummarySnapshot
import com.reguerta.user.domain.orders.OrdersRepository
import com.reguerta.user.domain.orders.ReceivedOrderLineRecord
import com.reguerta.user.domain.orders.ReceivedOrderProducerStatus
import com.reguerta.user.domain.orders.ReceivedOrderStatusWriteResult
import com.reguerta.user.domain.orders.ReceivedOrdersMemberGroup
import com.reguerta.user.domain.orders.ReceivedOrdersMemberLine
import com.reguerta.user.domain.orders.ReceivedOrdersProductRow
import com.reguerta.user.domain.orders.ReceivedOrdersSnapshot
import com.reguerta.user.domain.orders.isValidIsoWeekKey
import com.reguerta.user.domain.orders.toReceivedOrderStatusWriteResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Date
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

    override suspend fun receivedOrdersHistoryWeekKeys(producerId: String?): List<String> = withContext(Dispatchers.IO) {
        val resolvedProducerId = producerId?.trim()?.takeIf(String::isNotBlank) ?: return@withContext emptyList()
        val weekKeys = linkedSetOf<String>()
        var hasSuccessfulRead = false
        var lastFailure: Throwable? = null

        runCatching {
            Tasks.await(
                firestore.collection(orderLinesPath)
                    .whereEqualTo("vendorId", resolvedProducerId)
                    .get(),
            )
        }.onSuccess { snapshot ->
            hasSuccessfulRead = true
            snapshot.documents.forEach { document ->
                val weekKey = (document.data.orEmpty()["weekKey"] as? String)?.trim()
                if (!weekKey.isNullOrBlank() && weekKey.isValidIsoWeekKey()) {
                    weekKeys += weekKey
                }
            }
        }.onFailure { failure ->
            lastFailure = failure
        }

        if (!hasSuccessfulRead && lastFailure != null) {
            throw lastFailure
        }
        weekKeys.sorted()
    }

    override suspend fun oldestOrderHistoryWeekKey(): String? = withContext(Dispatchers.IO) {
        val snapshot = Tasks.await(
            firestore.collection(ordersPath)
                .orderBy("weekKey")
                .limit(1)
                .get(),
        )
        snapshot.documents.firstOrNull()?.let { document ->
            orderHistoryWeekKey(document.data.orEmpty(), document.id)
        }
    }

    override suspend fun receivedOrdersSnapshot(
        producerId: String?,
        weekKey: String,
        markUnreadAsRead: Boolean,
    ): ReceivedOrdersSnapshot? = withContext(Dispatchers.IO) {
        val resolvedProducerId = producerId?.trim()?.takeIf(String::isNotBlank) ?: return@withContext null
        val normalizedWeekKey = weekKey.trim().takeIf(String::isValidIsoWeekKey) ?: return@withContext null
        val lines = fetchReceivedOrderLinesForProducer(
            producerId = resolvedProducerId,
            weekKey = normalizedWeekKey,
        )
        if (lines.isEmpty()) return@withContext null

        var statusesByOrderId = fetchReceivedOrderStatusesByOrderId(
            orderIds = lines.map(ReceivedOrderLineRecord::orderId).distinct(),
            producerId = resolvedProducerId,
        )
        if (markUnreadAsRead) {
            val unreadOrderIds = statusesByOrderId
                .filterValues { status -> status == ReceivedOrderProducerStatus.UNREAD }
                .keys
                .toList()
            if (unreadOrderIds.isNotEmpty()) {
                val markedAsRead = markReceivedOrdersAsRead(
                    orderIds = unreadOrderIds,
                    producerId = resolvedProducerId,
                )
                if (markedAsRead.isNotEmpty()) {
                    statusesByOrderId = statusesByOrderId.toMutableMap().apply {
                        markedAsRead.forEach { orderId ->
                            this[orderId] = ReceivedOrderProducerStatus.READ
                        }
                    }
                }
            }
        }
        buildReceivedOrdersSnapshot(lines, statusesByOrderId)
    }

    override suspend fun updateReceivedOrderProducerStatus(
        orderId: String,
        producerId: String,
        status: ReceivedOrderProducerStatus,
        nowMillis: Long,
    ): ReceivedOrderStatusWriteResult = withContext(Dispatchers.IO) {
        var lastFailure = ReceivedOrderStatusWriteResult.FAILURE
        try {
            val orderReference = firestore.document("$ordersPath/$orderId")
            Tasks.await(
                orderReference.update(
                    mapOf(
                        "producerStatus" to status.wireValue,
                        "producerStatusesByVendor.$producerId" to status.wireValue,
                        "producerStatusUpdatedBy" to producerId,
                        "updatedAt" to Timestamp(Date(nowMillis)),
                    ),
                ),
            )
            return@withContext ReceivedOrderStatusWriteResult.SUCCESS
        } catch (throwable: Throwable) {
            lastFailure = throwable.toReceivedOrderStatusWriteResult()
        }
        lastFailure
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

    private fun fetchReceivedOrderLinesForProducer(
        producerId: String,
        weekKey: String,
    ): List<ReceivedOrderLineRecord> {
        val dedupedByKey = linkedMapOf<String, ReceivedOrderLineRecord>()
        var hasSuccessfulRead = false
        var lastFailure: Throwable? = null

        runCatching {
            Tasks.await(
                firestore.collection(orderLinesPath)
                    .whereEqualTo("vendorId", producerId)
                    .whereEqualTo("weekKey", weekKey)
                    .get(),
            )
        }.onSuccess { snapshot ->
            hasSuccessfulRead = true
            snapshot.documents.forEach { document ->
                val payload = document.data.orEmpty()
                receivedOrderLineRecord(payload, fallbackDocumentId = document.id)?.let { line ->
                    dedupedByKey[line.dedupKey] = line
                }
            }
        }.onFailure { failure ->
            lastFailure = failure
        }

        if (!hasSuccessfulRead && lastFailure != null) {
            throw lastFailure
        }

        return dedupedByKey.values.sortedWith(
            compareBy(
                { it.consumerDisplayName.lowercase(Locale.ROOT) },
                { it.productName.lowercase(Locale.ROOT) },
            ),
        )
    }

    private fun fetchReceivedOrderStatusesByOrderId(
        orderIds: List<String>,
        producerId: String,
    ): Map<String, ReceivedOrderProducerStatus> {
        if (orderIds.isEmpty()) return emptyMap()

        val statusesByOrderId = mutableMapOf<String, ReceivedOrderProducerStatus>()
        var hasSuccessfulRead = false
        var lastFailure: Throwable? = null

        orderIds.distinct().chunked(10).forEach { chunk ->
            runCatching {
                Tasks.await(
                    firestore.collection(ordersPath)
                        .whereIn(FieldPath.documentId(), chunk)
                        .get(),
                )
            }.onSuccess { snapshot ->
                hasSuccessfulRead = true
                snapshot.documents.forEach { document ->
                    statusesByOrderId[document.id] = document.data.orEmpty().readProducerStatusForVendor(producerId)
                }
            }.onFailure { failure ->
                lastFailure = failure
            }
        }

        if (!hasSuccessfulRead && lastFailure != null) {
            throw lastFailure
        }
        return statusesByOrderId
    }

    private fun markReceivedOrdersAsRead(
        orderIds: List<String>,
        producerId: String,
    ): Set<String> {
        val updatedOrderIds = linkedSetOf<String>()
        orderIds.distinct().forEach { orderId ->
            val updated = runCatching {
                val orderReference = firestore.document("$ordersPath/$orderId")
                Tasks.await(
                    orderReference.update(
                        mapOf(
                            "producerStatus" to ReceivedOrderProducerStatus.READ.wireValue,
                            "producerStatusesByVendor.$producerId" to ReceivedOrderProducerStatus.READ.wireValue,
                            "producerStatusUpdatedBy" to producerId,
                            "updatedAt" to Timestamp(Date()),
                        ),
                    ),
                )
                ReceivedOrderStatusWriteResult.SUCCESS
            }.getOrElse { ReceivedOrderStatusWriteResult.FAILURE }
            if (updated == ReceivedOrderStatusWriteResult.SUCCESS) {
                updatedOrderIds += orderId
            }
        }
        return updatedOrderIds
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
    val containerQuantity = (payload["packContainerQty"] as? Number)?.toDouble()
    val containerLabel = listOfNotNull(
        containerQuantity
            ?.takeUnless { it.isOrderApproximatelyOne() }
            ?.toOrderUiDecimal(),
        containerName,
    ).joinToString(separator = " ")
    val unitName = (payload["unitName"] as? String)?.trim().orEmpty()
    val unitPlural = (payload["unitPlural"] as? String)?.trim().orEmpty().ifBlank { unitName }
    val unitQuantity = (payload["unitQty"] as? Number)?.toDouble() ?: 1.0
    val unit = (payload["unitAbbreviation"] as? String)?.trim()?.takeIf(String::isNotBlank)
        ?: if (unitQuantity.isOrderApproximatelyOne()) unitName else unitPlural
    return listOf(containerLabel, unitQuantity.toOrderUiDecimal(), unit)
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

private fun Double.isOrderApproximatelyOne(): Boolean =
    kotlin.math.abs(this - 1.0) < 0.0001

private fun buildReceivedOrdersSnapshot(
    lines: List<ReceivedOrderLineRecord>,
    statusesByOrderId: Map<String, ReceivedOrderProducerStatus>,
): ReceivedOrdersSnapshot {
    val byProductRows = lines.groupBy { it.productId }
        .mapNotNull { (productId, grouped) ->
            val first = grouped.firstOrNull() ?: return@mapNotNull null
            ReceivedOrdersProductRow(
                productId = productId,
                productName = first.productName,
                productImageUrl = first.productImageUrl,
                packagingLine = first.packagingLine,
                totalQuantity = grouped.sumOf { line -> line.orderedQuantity },
                quantityUnitSingular = first.quantityUnitSingular,
                quantityUnitPlural = first.quantityUnitPlural,
            )
        }
        .sortedBy { it.productName.lowercase(Locale.ROOT) }

    val byMemberGroups = lines.groupBy { line ->
        "${line.consumerId}|${line.consumerDisplayName}"
    }.mapNotNull { (key, grouped) ->
        val first = grouped.firstOrNull() ?: return@mapNotNull null
        val memberLines = grouped.map { line ->
            ReceivedOrdersMemberLine(
                id = "${line.orderId}|${line.productId}",
                productName = line.productName,
                packagingLine = line.packagingLine,
                quantity = line.orderedQuantity,
                quantityUnitSingular = line.quantityUnitSingular,
                quantityUnitPlural = line.quantityUnitPlural,
                subtotal = line.subtotal,
            )
        }.sortedBy { it.productName.lowercase(Locale.ROOT) }
        ReceivedOrdersMemberGroup(
            id = key,
            orderId = first.orderId,
            consumerDisplayName = first.consumerDisplayName,
            producerStatus = statusesByOrderId[first.orderId] ?: ReceivedOrderProducerStatus.UNREAD,
            lines = memberLines,
            total = memberLines.sumOf(ReceivedOrdersMemberLine::subtotal),
        )
    }.sortedBy { it.consumerDisplayName.lowercase(Locale.ROOT) }

    return ReceivedOrdersSnapshot(
        byProductRows = byProductRows,
        byMemberGroups = byMemberGroups,
        generalTotal = lines.sumOf(ReceivedOrderLineRecord::subtotal),
    )
}

private fun Map<String, Any>.readProducerStatusForVendor(producerId: String): ReceivedOrderProducerStatus {
    val statusesByVendor = this["producerStatusesByVendor"] as? Map<*, *>
    val vendorValue = statusesByVendor?.get(producerId) as? String
    if (!vendorValue.isNullOrBlank()) {
        return ReceivedOrderProducerStatus.fromWireValue(vendorValue)
    }
    return ReceivedOrderProducerStatus.fromWireValue(this["producerStatus"] as? String)
}

private fun receivedOrderLineRecord(
    payload: Map<String, Any>,
    fallbackDocumentId: String,
): ReceivedOrderLineRecord? {
    val orderId = (payload["orderId"] as? String)?.trim().orEmpty().ifBlank { fallbackDocumentId }
    val consumerId = (payload["userId"] as? String)?.trim().orEmpty().ifBlank { "__consumer_unknown__" }
    val consumerDisplayName = (payload["consumerDisplayName"] as? String)?.trim().orEmpty()
        .ifBlank { consumerId }
    val productId = (payload["productId"] as? String)?.trim().orEmpty().ifBlank { fallbackDocumentId }
    val productName = (payload["productName"] as? String)?.trim().orEmpty().ifBlank { "Producto" }
    val companyName = (payload["companyName"] as? String)?.trim().orEmpty().ifBlank { "Productor" }
    val quantity = (payload["quantity"] as? Number)?.toDouble() ?: 0.0
    if (quantity <= 0.0) return null
    val priceAtOrder = (payload["priceAtOrder"] as? Number)?.toDouble()
    val subtotal = (payload["subtotal"] as? Number)?.toDouble()
        ?: quantity * (priceAtOrder ?: 0.0)
    val quantityUnitSingular = (payload["packContainerName"] as? String)?.trim().orEmpty()
        .ifBlank { (payload["unitName"] as? String)?.trim().orEmpty().ifBlank { "ud." } }
    val quantityUnitPlural = (payload["packContainerPlural"] as? String)?.trim().orEmpty()
        .ifBlank { (payload["unitPlural"] as? String)?.trim().orEmpty().ifBlank { quantityUnitSingular } }
    val measureQuantityPerUnit = receivedOrdersMeasureQuantityPerUnitFromPayload(payload)
    val pricingMode = (payload["pricingModeAtOrder"] as? String)?.trim()

    return ReceivedOrderLineRecord(
        id = "${orderId}_${productId}_$consumerId",
        orderId = orderId,
        consumerId = consumerId,
        consumerDisplayName = consumerDisplayName,
        productId = productId,
        productName = productName,
        productImageUrl = (payload["productImageUrl"] as? String)?.trim().orEmpty().ifBlank { null },
        companyName = companyName,
        packagingLine = receivedOrdersPackagingLineFromPayload(payload),
        quantity = quantity,
        quantityUnitSingular = quantityUnitSingular,
        quantityUnitPlural = quantityUnitPlural,
        measureQuantityPerUnit = measureQuantityPerUnit,
        isWeightPricing = pricingMode.equals("weight", ignoreCase = true),
        subtotal = subtotal,
    )
}

private fun receivedOrdersPackagingLineFromPayload(payload: Map<String, Any>): String {
    val containerName = (payload["packContainerName"] as? String)
        ?.takeIf(String::isNotBlank)
        ?: (payload["unitName"] as? String).orEmpty()
    val quantity = receivedOrdersMeasureQuantityPerUnitFromPayload(payload)
    val unitName = (payload["unitName"] as? String).orEmpty()
    val unitPlural = (payload["unitPlural"] as? String).orEmpty().ifBlank { unitName }
    val unitLabel = receivedOrdersMeasureLabel(
        quantity = quantity,
        singular = unitName,
        plural = unitPlural,
        abbreviation = (payload["unitAbbreviation"] as? String)?.takeIf(String::isNotBlank)
            ?: (payload["packContainerAbbreviation"] as? String)?.takeIf(String::isNotBlank),
        prefersAbbreviation = false,
    )

    return listOf(containerName, unitLabel)
        .filter(String::isNotBlank)
        .joinToString(separator = " ")
}

private fun receivedOrdersMeasureQuantityPerUnitFromPayload(payload: Map<String, Any>): Double =
    (payload["unitQty"] as? Number)?.toDouble()
        ?: (payload["packContainerQty"] as? Number)?.toDouble()
        ?: 1.0

private fun receivedOrdersMeasureLabel(
    quantity: Double,
    singular: String,
    plural: String,
    abbreviation: String?,
    prefersAbbreviation: Boolean,
): String {
    val numberAwareUnit = if (receivedOrdersIsApproximatelyOne(quantity)) singular else plural
    val unit = if (prefersAbbreviation && !abbreviation.isNullOrBlank()) {
        abbreviation
    } else {
        numberAwareUnit
    }
    return listOf(quantity.toReceivedUiDecimal(), unit)
        .filter(String::isNotBlank)
        .joinToString(separator = " ")
}

private fun Double.toReceivedUiDecimal(): String {
    if (this % 1.0 == 0.0) {
        return toLong().toString()
    }
    return String.format(Locale.US, "%.2f", this)
        .trimEnd('0')
        .trimEnd('.')
}

private fun receivedOrdersIsApproximatelyOne(value: Double): Boolean =
    kotlin.math.abs(value - 1.0) < 0.0001
