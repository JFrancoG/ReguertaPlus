import FirebaseFirestore
import Foundation

extension Double {
    var myOrderUiDecimal: String {
        myOrderUiDecimal(locale: reguertaPresentationLocale())
    }

    func myOrderUiDecimal(locale: Locale) -> String {
        formatted(
            .number
                .grouping(.never)
                .precision(.fractionLength(0...3))
                .locale(locale)
        )
    }
}

func countNoPickupEcoBasketUnits(
    products: [Product],
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) -> Int {
    products
        .filter(\.isEcoBasket)
        .reduce(0) { partial, product in
            if selectedEcoBasketOptions[product.id] == ecoBasketOptionNoPickup {
                return partial + selectedQuantities[product.id, default: 0]
            }
            return partial
        }
}

struct MyOrderCheckoutLineSnapshot {
    let product: Product
    let quantityAtOrder: Double
    let subtotal: Double
    let ecoBasketOption: String?
}

typealias MyOrderCheckoutWriteTarget = (orders: String, orderlines: String)

struct MyOrderCheckoutContext {
    let orderId: String
    let weekKey: String
    let weekNumber: Int
    let nowTimestamp: Timestamp
    let total: Double
    let totalsByVendor: [String: Double]
}

private struct MyOrderCheckoutBatchContent {
    let target: MyOrderCheckoutWriteTarget
    let context: MyOrderCheckoutContext
    let member: Member
    let lineSnapshots: [MyOrderCheckoutLineSnapshot]
    let existingLineDocumentIds: [String]
    let orderRef: DocumentReference
    let createdAt: Timestamp
    let deliveryDate: Timestamp
}

nonisolated struct MyOrderOwnedWeekQueryScope: Equatable {
    let ownerField: String
    let ownerId: String
    let weekKey: String
}

nonisolated enum MyOrderCheckoutResolutionError: Error, Equatable, Sendable {
    case ambiguousExistingOrders
}

extension FirestoreOrdersRepository {
    func submitCheckoutOrderToFirestore(
        request: MyOrderCheckoutRequest,
        environment: ReguertaFirestoreEnvironment
    ) async throws -> Bool {
        guard let member = request.currentMember else { return false }

        let lineSnapshots = buildMyOrderCheckoutLineSnapshots(
            products: request.products,
            selectedQuantities: request.selectedQuantities,
            selectedEcoBasketOptions: request.selectedEcoBasketOptions
        )
        guard !lineSnapshots.isEmpty else { return false }

        let firestorePath = ReguertaFirestorePath(environment: environment)
        let writeTargets = resolveMyOrderCheckoutWriteTargets(
            firestorePath: firestorePath
        )
        let checkoutContext = buildMyOrderCheckoutContext(
            member: member,
            weekKey: request.weekKey,
            nowMillis: request.nowMillis,
            lineSnapshots: lineSnapshots
        )

        guard let target = writeTargets.first else { return false }
        return try await submitMyOrderCheckout(
            target: target,
            context: checkoutContext,
            member: member,
            lineSnapshots: lineSnapshots
        )
    }
}

func buildMyOrderCheckoutLineSnapshots(
    products: [Product],
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) -> [MyOrderCheckoutLineSnapshot] {
    products.compactMap { product in
        let selectedUnits = selectedQuantities[product.id, default: 0]
        guard selectedUnits > 0 else { return nil }
        let quantityAtOrder = product.selectedQuantity(selectionCount: selectedUnits)
        let subtotal = quantityAtOrder * product.price
        let selectedOption = selectedEcoBasketOptions[product.id]
        let ecoBasketOption = (selectedOption == ecoBasketOptionPickup || selectedOption == ecoBasketOptionNoPickup)
            ? selectedOption
            : nil
        return MyOrderCheckoutLineSnapshot(
            product: product,
            quantityAtOrder: quantityAtOrder,
            subtotal: subtotal,
            ecoBasketOption: ecoBasketOption
        )
    }
}

func resolveMyOrderCheckoutWriteTargets(firestorePath: ReguertaFirestorePath) -> [MyOrderCheckoutWriteTarget] {
    [
        (
            orders: firestorePath.collectionPath(.orders),
            orderlines: firestorePath.collectionPath(.orderlines)
        )
    ]
}

func buildMyOrderCheckoutContext(
    member: Member,
    weekKey: String,
    nowMillis: Int64,
    lineSnapshots: [MyOrderCheckoutLineSnapshot]
) -> MyOrderCheckoutContext {
    let orderId = "\(member.id)_\(weekKey)"
    let nowDate = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    let nowTimestamp = Timestamp(date: nowDate)
    let parsedWeek = weekKey.split(separator: "W").last.flatMap { Int($0) }
    let weekNumber = parsedWeek ?? Calendar(identifier: .iso8601).component(.weekOfYear, from: nowDate)
    let total = lineSnapshots.reduce(0) { $0 + $1.subtotal }
    let totalsByVendor = Dictionary(grouping: lineSnapshots, by: { $0.product.vendorId })
        .mapValues { snapshots in snapshots.reduce(0) { $0 + $1.subtotal } }

    return MyOrderCheckoutContext(
        orderId: orderId,
        weekKey: weekKey,
        weekNumber: weekNumber,
        nowTimestamp: nowTimestamp,
        total: total,
        totalsByVendor: totalsByVendor
    )
}

extension FirestoreOrdersRepository {
    func submitMyOrderCheckout(
        target: MyOrderCheckoutWriteTarget,
        context: MyOrderCheckoutContext,
        member: Member,
        lineSnapshots: [MyOrderCheckoutLineSnapshot]
    ) async throws -> Bool {
        let existingOrderDocuments = try await fetchMyOrderOwnedWeekDocuments(
            collectionPath: target.orders,
            memberId: member.id,
            weekKey: context.weekKey
        )
        let effectiveOrderId = try resolveMyOrderCheckoutDocumentId(
            newOrderId: context.orderId,
            existingOrderIds: Array(existingOrderDocuments.keys)
        )
        let effectiveContext = MyOrderCheckoutContext(
            orderId: effectiveOrderId,
            weekKey: context.weekKey,
            weekNumber: context.weekNumber,
            nowTimestamp: context.nowTimestamp,
            total: context.total,
            totalsByVendor: context.totalsByVendor
        )
        let orderRef = storedDB.document("\(target.orders)/\(effectiveOrderId)")
        let existingData = existingOrderDocuments[effectiveOrderId]
        let createdAt = (existingData?["createdAt"] as? Timestamp) ?? context.nowTimestamp
        let deliveryDate = (existingData?["deliveryDate"] as? Timestamp) ?? context.nowTimestamp
        let existingLineDocuments = try await fetchMyOrderOwnedLineDocuments(
            collectionPath: target.orderlines,
            orderIds: [effectiveOrderId],
            memberId: member.id,
            weekKey: nil
        )

        let batch = buildMyOrderCheckoutBatch(
            MyOrderCheckoutBatchContent(
                target: target,
                context: effectiveContext,
                member: member,
                lineSnapshots: lineSnapshots,
                existingLineDocumentIds: Array(existingLineDocuments.keys),
                orderRef: orderRef,
                createdAt: createdAt,
                deliveryDate: deliveryDate
            )
        )
        try await batch.commit()
        let serverOrderSnapshot = try await orderRef.getDocument(source: .server)
        return serverOrderSnapshot.exists
    }

    private func buildMyOrderCheckoutBatch(_ content: MyOrderCheckoutBatchContent) -> WriteBatch {
        let batch = storedDB.batch()
        batch.setData(
            myOrderCheckoutOrderPayload(
                member: content.member,
                context: content.context,
                createdAt: content.createdAt,
                deliveryDate: content.deliveryDate
            ),
            forDocument: content.orderRef,
            merge: true
        )
        for documentId in content.existingLineDocumentIds {
            batch.deleteDocument(storedDB.document("\(content.target.orderlines)/\(documentId)"))
        }
        for line in content.lineSnapshots {
            let lineRef = storedDB.document(
                "\(content.target.orderlines)/\(content.context.orderId)_\(line.product.id)"
            )
            batch.setData(
                myOrderCheckoutLinePayload(
                    line: line,
                    member: content.member,
                    context: content.context
                ),
                forDocument: lineRef,
                merge: true
            )
        }
        return batch
    }
}

nonisolated func myOrderOwnedWeekQueryScopes(memberId: String, weekKey: String) -> [MyOrderOwnedWeekQueryScope] {
    ["userId", "memberId"].map { ownerField in
        MyOrderOwnedWeekQueryScope(
            ownerField: ownerField,
            ownerId: memberId,
            weekKey: weekKey
        )
    }
}

nonisolated func resolveMyOrderCheckoutDocumentId(newOrderId: String, existingOrderIds: [String]) throws -> String {
    let normalizedExistingIds = normalizedUniqueMyOrderIds(existingOrderIds)
    switch normalizedExistingIds.count {
    case 0:
        return newOrderId
    case 1:
        return normalizedExistingIds[0]
    default:
        throw MyOrderCheckoutResolutionError.ambiguousExistingOrders
    }
}

extension FirestoreOrdersRepository {
    func fetchMyOrderOwnedWeekDocuments(
        collectionPath: String,
        memberId: String,
        weekKey: String
    ) async throws -> [String: [String: Any]] {
        var documents: [String: [String: Any]] = [:]
        for scope in myOrderOwnedWeekQueryScopes(memberId: memberId, weekKey: weekKey) {
            let snapshot = try await storedDB.collection(collectionPath)
                .whereField(scope.ownerField, isEqualTo: scope.ownerId)
                .whereField("weekKey", isEqualTo: scope.weekKey)
                .getDocuments()
            for document in snapshot.documents {
                documents[document.documentID] = document.data()
            }
        }
        return documents
    }

    func fetchMyOrderOwnedLineDocuments(
        collectionPath: String,
        orderIds: [String],
        memberId: String,
        weekKey: String?
    ) async throws -> [String: [String: Any]] {
        var documents: [String: [String: Any]] = [:]
        for orderId in normalizedUniqueMyOrderIds(orderIds) {
            for ownerField in ["userId", "memberId"] {
                let snapshot = try await storedDB.collection(collectionPath)
                    .whereField("orderId", isEqualTo: orderId)
                    .whereField(ownerField, isEqualTo: memberId)
                    .getDocuments()
                for document in snapshot.documents {
                    documents[document.documentID] = document.data()
                }
            }
        }

        if let weekKey {
            for scope in myOrderOwnedWeekQueryScopes(memberId: memberId, weekKey: weekKey) {
                let snapshot = try await storedDB.collection(collectionPath)
                    .whereField(scope.ownerField, isEqualTo: scope.ownerId)
                    .whereField("weekKey", isEqualTo: scope.weekKey)
                    .getDocuments()
                for document in snapshot.documents {
                    documents[document.documentID] = document.data()
                }
            }
        }
        return documents
    }
}

nonisolated func normalizedUniqueMyOrderIds(_ orderIds: [String]) -> [String] {
    var seen = Set<String>()
    return orderIds.compactMap { orderId in
        let normalized = orderId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, seen.insert(normalized).inserted else {
            return nil
        }
        return normalized
    }
}

func myOrderCheckoutOrderPayload(
    member: Member,
    context: MyOrderCheckoutContext,
    createdAt: Timestamp,
    deliveryDate: Timestamp
) -> [String: Any] {
    [
        "userId": member.id,
        "consumerDisplayName": member.displayName,
        "week": context.weekNumber,
        "weekKey": context.weekKey,
        "deliveryDate": deliveryDate,
        "consumerStatus": "confirmado",
        "total": context.total,
        "totalsByVendor": context.totalsByVendor,
        "isAutoGenerated": false,
        "createdAt": createdAt,
        "updatedAt": context.nowTimestamp,
        "confirmedAt": context.nowTimestamp
    ]
}

func myOrderCheckoutLinePayload(
    line: MyOrderCheckoutLineSnapshot,
    member: Member,
    context: MyOrderCheckoutContext
) -> [String: Any] {
    [
        "orderId": context.orderId,
        "userId": member.id,
        "productId": line.product.id,
        "vendorId": line.product.vendorId,
        "consumerDisplayName": member.displayName,
        "companyName": line.product.companyName,
        "productName": line.product.name,
        "productImageUrl": line.product.productImageUrl as Any,
        "quantity": line.quantityAtOrder,
        "priceAtOrder": line.product.price,
        "subtotal": line.subtotal,
        "pricingModeAtOrder": line.product.pricingMode.orderWireValue,
        "unitName": line.product.unitName,
        "unitAbbreviation": line.product.unitAbbreviation as Any,
        "unitPlural": line.product.unitPlural,
        "unitQty": line.product.unitQty,
        "packContainerName": line.product.packContainerName as Any,
        "packContainerAbbreviation": line.product.packContainerAbbreviation as Any,
        "packContainerPlural": line.product.packContainerPlural as Any,
        "packContainerQty": line.product.packContainerQty as Any,
        "ecoBasketOptionAtOrder": line.ecoBasketOption as Any,
        "week": context.weekNumber,
        "weekKey": context.weekKey,
        "createdAt": context.nowTimestamp,
        "updatedAt": context.nowTimestamp
    ]
}

func myOrderSnapshotsMatch(_ lhs: MyOrderCartSnapshot, _ rhs: MyOrderCartSnapshot) -> Bool {
    lhs.selectedQuantities == rhs.selectedQuantities &&
        lhs.selectedEcoBasketOptions == rhs.selectedEcoBasketOptions
}
