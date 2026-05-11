import FirebaseFirestore
import Foundation

func fetchReceivedOrdersSnapshotForProducer(
    producerId: String,
    targetWeekKey: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> ReceivedOrdersSnapshot? {
    let firestorePath = ReguertaFirestorePath(environment: environment)
    let lines = try await fetchReceivedOrderLines(
        producerId: producerId,
        targetWeekKey: targetWeekKey,
        readTargets: receivedOrderlineReadTargets(firestorePath: firestorePath, environment: environment),
        db: db
    )
    guard !lines.isEmpty else { return nil }
    let statusesByOrderId = try await fetchReceivedOrderStatusesByOrderId(
        orderIds: lines.map(\.orderId),
        producerId: producerId,
        db: db,
        environment: environment
    )
    let synchronizedStatuses = await synchronizeUnreadReceivedOrderStatuses(
        statusesByOrderId: statusesByOrderId,
        producerId: producerId,
        db: db,
        environment: environment
    )

    return buildReceivedOrdersSnapshot(from: lines, statusesByOrderId: synchronizedStatuses)
}

func updateReceivedOrderProducerStatus(
    orderId: String,
    producerId: String,
    status: ProducerOrderStatus,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment,
    nowMillis: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)
) async -> ReceivedOrderStatusWriteResult {
    let firestorePath = ReguertaFirestorePath(environment: environment)
    let writeTargets = Array(Set([
        firestorePath.collectionPath(.orders),
        "\(environment.rawValue)/collections/orders"
    ]))
    let nowTimestamp = Timestamp(date: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000))
    var lastFailure: ReceivedOrderStatusWriteResult = .failure

    for ordersPath in writeTargets {
        do {
            let orderRef = db.document("\(ordersPath)/\(orderId)")
            try await orderRef.updateData([
                "producerStatus": status.rawValue,
                "producerStatusesByVendor.\(producerId)": status.rawValue,
                "producerStatusUpdatedBy": producerId,
                "updatedAt": nowTimestamp
            ])
            return .success
        } catch {
            lastFailure = receivedOrderStatusWriteResult(from: error)
        }
    }

    return lastFailure
}

private func receivedOrderlineReadTargets(
    firestorePath: ReguertaFirestorePath,
    environment: ReguertaFirestoreEnvironment
) -> [String] {
    Array(Set([
        firestorePath.collectionPath(.orderlines),
        "\(environment.rawValue)/collections/orderLines",
        "\(environment.rawValue)/collections/orderlines"
    ]))
}

private func fetchReceivedOrderLines(
    producerId: String,
    targetWeekKey: String,
    readTargets: [String],
    db: Firestore
) async throws -> [ReceivedOrderLineRecord] {
    var dedupedLinesByKey: [String: ReceivedOrderLineRecord] = [:]
    var hasSuccessfulRead = false
    var lastError: Error?

    for orderlinesPath in readTargets {
        do {
            let snapshot = try await db.collection(orderlinesPath)
                .whereField("vendorId", isEqualTo: producerId)
                .whereField("weekKey", isEqualTo: targetWeekKey)
                .getDocuments()
            hasSuccessfulRead = true
            for document in snapshot.documents {
                if let line = receivedOrderLineRecord(from: document.data(), fallbackDocumentID: document.documentID) {
                    dedupedLinesByKey[line.dedupKey] = line
                }
            }
        } catch {
            lastError = error
        }
    }

    if !hasSuccessfulRead, let lastError {
        throw lastError
    }

    return dedupedLinesByKey.values.sorted { lhs, rhs in
        if lhs.consumerDisplayName != rhs.consumerDisplayName {
            return lhs.consumerDisplayName.localizedCaseInsensitiveCompare(rhs.consumerDisplayName) == .orderedAscending
        }
        return lhs.productName.localizedCaseInsensitiveCompare(rhs.productName) == .orderedAscending
    }
}

private func fetchReceivedOrderStatusesByOrderId(
    orderIds: [String],
    producerId: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> [String: ProducerOrderStatus] {
    let dedupedOrderIds = Array(Set(orderIds)).filter(\.isNotEmpty)
    guard !dedupedOrderIds.isEmpty else { return [:] }

    let firestorePath = ReguertaFirestorePath(environment: environment)
    let readTargets = Array(Set([
        firestorePath.collectionPath(.orders),
        "\(environment.rawValue)/collections/orders"
    ]))
    var statusesByOrderId: [String: ProducerOrderStatus] = [:]
    var hasSuccessfulRead = false
    var lastError: Error?

    for ordersPath in readTargets {
        for chunk in dedupedOrderIds.chunked(into: 10) {
            do {
                let snapshot = try await db.collection(ordersPath)
                    .whereField(FieldPath.documentID(), in: chunk)
                    .getDocuments()
                hasSuccessfulRead = true
                for document in snapshot.documents {
                    statusesByOrderId[document.documentID] = receivedOrderStatus(
                        from: document.data(),
                        producerId: producerId
                    )
                }
            } catch {
                lastError = error
            }
        }
    }

    if !hasSuccessfulRead, let lastError {
        throw lastError
    }
    return statusesByOrderId
}

private func synchronizeUnreadReceivedOrderStatuses(
    statusesByOrderId: [String: ProducerOrderStatus],
    producerId: String,
    db: Firestore,
    environment: ReguertaFirestoreEnvironment
) async -> [String: ProducerOrderStatus] {
    let unreadOrderIds = statusesByOrderId
        .filter { $0.value == .unread }
        .map(\.key)
    guard !unreadOrderIds.isEmpty else {
        return statusesByOrderId
    }

    let markedAsRead = await markReceivedOrdersAsRead(
        orderIds: unreadOrderIds,
        producerId: producerId,
        db: db,
        environment: environment
    )
    guard !markedAsRead.isEmpty else {
        return statusesByOrderId
    }

    var synchronizedStatuses = statusesByOrderId
    for orderId in markedAsRead {
        synchronizedStatuses[orderId] = .read
    }
    return synchronizedStatuses
}

private func markReceivedOrdersAsRead(
    orderIds: [String],
    producerId: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async -> Set<String> {
    var updatedOrderIds = Set<String>()
    for orderId in Array(Set(orderIds)).filter(\.isNotEmpty) {
        let updateResult = await updateReceivedOrderProducerStatus(
            orderId: orderId,
            producerId: producerId,
            status: .read,
            db: db,
            environment: environment
        )
        if updateResult == .success {
            updatedOrderIds.insert(orderId)
        }
    }
    return updatedOrderIds
}

private func buildReceivedOrdersSnapshot(
    from lines: [ReceivedOrderLineRecord],
    statusesByOrderId: [String: ProducerOrderStatus]
) -> ReceivedOrdersSnapshot {
    ReceivedOrdersSnapshot(
        byProductRows: buildReceivedOrdersProductRows(from: lines),
        byMemberGroups: buildReceivedOrdersMemberGroups(from: lines, statusesByOrderId: statusesByOrderId),
        generalTotal: receivedOrdersGeneralTotal(from: lines)
    )
}

private func buildReceivedOrdersProductRows(
    from lines: [ReceivedOrderLineRecord]
) -> [ReceivedOrdersProductRow] {
    Dictionary(grouping: lines, by: \.productId)
        .compactMap { productId, grouped -> ReceivedOrdersProductRow? in
            guard let first = grouped.first else { return nil }
            let totalQuantity = grouped.reduce(0) { partial, line in partial + line.quantity }
            return ReceivedOrdersProductRow(
                productId: productId,
                productName: first.productName,
                productImageUrl: first.productImageUrl,
                companyName: first.companyName,
                packagingLine: first.packagingLine,
                totalQuantity: totalQuantity,
                quantityUnitSingular: first.quantityUnitSingular,
                quantityUnitPlural: first.quantityUnitPlural
            )
        }
        .sorted { lhs, rhs in
            lhs.productName.localizedCaseInsensitiveCompare(rhs.productName) == .orderedAscending
        }
}

private func buildReceivedOrdersMemberGroups(
    from lines: [ReceivedOrderLineRecord],
    statusesByOrderId: [String: ProducerOrderStatus]
) -> [ReceivedOrdersMemberGroup] {
    Dictionary(grouping: lines, by: { "\($0.consumerId)|\($0.consumerDisplayName)" })
        .compactMap { key, grouped -> ReceivedOrdersMemberGroup? in
            guard let first = grouped.first else { return nil }
            let memberLines = buildReceivedOrdersMemberLines(from: grouped)
            let total = memberLines.reduce(0) { partial, line in partial + line.subtotal }
            return ReceivedOrdersMemberGroup(
                id: key,
                orderId: first.orderId,
                consumerDisplayName: first.consumerDisplayName,
                producerStatus: statusesByOrderId[first.orderId] ?? .unread,
                lines: memberLines,
                total: total
            )
        }
        .sorted { lhs, rhs in
            lhs.consumerDisplayName.localizedCaseInsensitiveCompare(rhs.consumerDisplayName) == .orderedAscending
        }
}

private func buildReceivedOrdersMemberLines(
    from lines: [ReceivedOrderLineRecord]
) -> [ReceivedOrdersMemberLine] {
    lines.map { line in
        ReceivedOrdersMemberLine(
            id: "\(line.orderId)|\(line.productId)",
            productName: line.productName,
            packagingLine: line.packagingLine,
            quantity: line.quantity,
            quantityUnitSingular: line.quantityUnitSingular,
            quantityUnitPlural: line.quantityUnitPlural,
            subtotal: line.subtotal
        )
    }.sorted { lhs, rhs in
        lhs.productName.localizedCaseInsensitiveCompare(rhs.productName) == .orderedAscending
    }
}

private func receivedOrdersGeneralTotal(from lines: [ReceivedOrderLineRecord]) -> Double {
    lines.reduce(0) { partial, line in
        partial + line.subtotal
    }
}

private func receivedOrderStatus(
    from data: [String: Any],
    producerId: String
) -> ProducerOrderStatus {
    if let statusesByVendor = data["producerStatusesByVendor"] as? [String: Any],
       let statusValue = statusesByVendor[producerId] as? String {
        return ProducerOrderStatus.from(statusValue)
    }
    return ProducerOrderStatus.from(data["producerStatus"] as? String)
}
