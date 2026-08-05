import FirebaseFirestore
import Foundation

func resolveMyOrderConsultaWindow(
    defaultDeliveryDayOfWeek _: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts _: [ShiftAssignment],
    now: Date = Date(),
    timeZone: TimeZone = TimeZone(identifier: "Europe/Madrid") ?? .current
) -> MyOrderConsultaWindow {
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = timeZone

    let weekStartDay = calendar.startOfDay(
        for: calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
    )
    let today = calendar.startOfDay(for: now)
    let currentWeekKey = String(
        format: "%04d-W%02d",
        calendar.component(.yearForWeekOfYear, from: weekStartDay),
        calendar.component(.weekOfYear, from: weekStartDay)
    )

    let effectiveDeliveryDate: Date
    if let override = deliveryCalendarOverrides.first(where: { $0.weekKey == currentWeekKey }) {
        effectiveDeliveryDate = calendar.startOfDay(
            for: Date(timeIntervalSince1970: TimeInterval(override.deliveryDateMillis) / 1_000)
        )
    } else {
        effectiveDeliveryDate = calendar.date(byAdding: .day, value: 2, to: weekStartDay) ?? weekStartDay
    }

    let previousWeekDate = calendar.date(byAdding: .day, value: -7, to: weekStartDay) ?? weekStartDay
    let previousWeekKey = String(
        format: "%04d-W%02d",
        calendar.component(.yearForWeekOfYear, from: previousWeekDate),
        calendar.component(.weekOfYear, from: previousWeekDate)
    )
    let isConsultaPhase = today >= weekStartDay && today <= effectiveDeliveryDate

    return MyOrderConsultaWindow(
        isConsultaPhase: isConsultaPhase,
        previousWeekKey: previousWeekKey
    )
}

func loadMyOrderProducerStatuses(
    currentMember: Member?,
    weekKey: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async -> MyOrderProducerStatusSnapshot {
    guard let member = currentMember else {
        return MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
    }
    let firestorePath = ReguertaFirestorePath(environment: environment)
    do {
        let orderDocuments = try await fetchMyOrderOwnedWeekDocuments(
            collectionPath: firestorePath.collectionPath(.orders),
            memberId: member.id,
            weekKey: weekKey,
            db: db
        )
        guard orderDocuments.count == 1, let payload = orderDocuments.values.first else {
            return MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
        }
        return MyOrderProducerStatusSnapshot(
            byVendor: myOrderProducerStatusesByVendor(from: payload),
            legacyStatus: ProducerOrderStatus.from(payload["producerStatus"] as? String)
        )
    } catch {
        return MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
    }
}

func fetchPreviousWeekOrderSnapshot(
    currentMember: Member?,
    previousWeekKey: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> MyOrderPreviousOrderSnapshot? {
    try await fetchOrderSummarySnapshot(
        currentMember: currentMember,
        weekKey: previousWeekKey,
        db: db,
        environment: environment
    )
}

func fetchOrderSummarySnapshot(
    currentMember: Member?,
    weekKey: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> MyOrderPreviousOrderSnapshot? {
    guard let member = currentMember else {
        return nil
    }
    let firestorePath = ReguertaFirestorePath(environment: environment)
    let readTargets = resolvePreviousOrderReadTargets(
        firestorePath: firestorePath
    )
    let deterministicOrderId = "\(member.id)_\(weekKey)"
    var lastError: Error?
    var hasSuccessfulRead = false

    for target in readTargets {
        do {
            let snapshot = try await fetchPreviousWeekOrderSnapshot(
                target: target,
                deterministicOrderId: deterministicOrderId,
                memberId: member.id,
                previousWeekKey: weekKey,
                db: db
            )
            hasSuccessfulRead = true
            if let snapshot {
                return snapshot
            }
        } catch {
            lastError = error
            continue
        }
    }

    if !hasSuccessfulRead, let lastError {
        throw lastError
    }
    return nil
}

func resolvePreviousOrderReadTargets(firestorePath: ReguertaFirestorePath) -> [MyOrderCheckoutWriteTarget] {
    [
        (
            orders: firestorePath.collectionPath(.orders),
            orderlines: firestorePath.collectionPath(.orderlines)
        )
    ]
}

func fetchPreviousWeekOrderSnapshot(
    target: MyOrderCheckoutWriteTarget,
    deterministicOrderId: String,
    memberId: String,
    previousWeekKey: String,
    db: Firestore
) async throws -> MyOrderPreviousOrderSnapshot? {
    let orderDocuments = try await fetchPreviousOrderDocuments(
        target: target,
        memberId: memberId,
        weekKey: previousWeekKey,
        db: db
    )

    let candidateOrderIds = myOrderCandidateOrderIds(
        deterministicOrderId: deterministicOrderId,
        discoveredOrderIds: Array(orderDocuments.keys)
    )
    let lineDocuments = try await fetchPreviousOrderLineDocuments(
        target: target,
        candidateOrderIds: candidateOrderIds,
        memberId: memberId,
        weekKey: previousWeekKey,
        db: db
    )

    let lines = lineDocuments.values.map { data in
        myOrderPreviousLine(from: data)
    }
    let groups = buildMyOrderPreviousGroups(from: lines)
    guard !groups.isEmpty else {
        return nil
    }

    let documentedTotals = orderDocuments.values.compactMap { data in
        (data["total"] as? NSNumber)?.doubleValue
    }
    let total = documentedTotals.isEmpty
        ? groups.reduce(0) { $0 + $1.subtotal }
        : documentedTotals.reduce(0, +)

    return MyOrderPreviousOrderSnapshot(
        weekKey: previousWeekKey,
        groups: groups,
        total: total
    )
}

private func fetchPreviousOrderDocuments(
    target: MyOrderCheckoutWriteTarget,
    memberId: String,
    weekKey: String,
    db: Firestore
) async throws -> [String: [String: Any]] {
    try await fetchMyOrderOwnedWeekDocuments(
        collectionPath: target.orders,
        memberId: memberId,
        weekKey: weekKey,
        db: db
    )
}

private func fetchPreviousOrderLineDocuments(
    target: MyOrderCheckoutWriteTarget,
    candidateOrderIds: [String],
    memberId: String,
    weekKey: String,
    db: Firestore
) async throws -> [String: [String: Any]] {
    try await fetchMyOrderOwnedLineDocuments(
        collectionPath: target.orderlines,
        orderIds: candidateOrderIds,
        memberId: memberId,
        weekKey: weekKey,
        db: db
    )
}

nonisolated func myOrderCandidateOrderIds(deterministicOrderId: String, discoveredOrderIds: [String]) -> [String] {
    normalizedUniqueMyOrderIds([deterministicOrderId] + discoveredOrderIds)
}

func buildMyOrderPreviousGroups(from lines: [MyOrderPreviousOrderLine]) -> [MyOrderPreviousOrderGroup] {
    let grouped = Dictionary(grouping: lines) { line in
        MyOrderPreviousGroupKey(
            vendorId: line.vendorId,
            companyName: line.companyName
        )
    }
    let groups = grouped.map { key, groupedLines -> MyOrderPreviousOrderGroup in
        let sortedLines = groupedLines.sorted {
            $0.productName.localizedCaseInsensitiveCompare($1.productName) == .orderedAscending
        }
        let subtotal = sortedLines.reduce(0.0) { partial, line in
            partial + line.subtotal
        }
        return MyOrderPreviousOrderGroup(
            vendorId: key.vendorId,
            companyName: key.companyName,
            lines: sortedLines,
            subtotal: subtotal
        )
    }
    return groups.sorted {
        $0.companyName.localizedCaseInsensitiveCompare($1.companyName) == .orderedAscending
    }
}

func myOrderPreviousLine(from data: [String: Any]) -> MyOrderPreviousOrderLine {
    let vendorId = ((data["vendorId"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? "__vendor_unknown__"
    let companyName = ((data["companyName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? vendorId
    let productName = ((data["productName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? "Producto"
    let quantity = (data["quantity"] as? NSNumber)?.doubleValue ?? 0
    let subtotal = (data["subtotal"] as? NSNumber)?.doubleValue
        ?? quantity * ((data["priceAtOrder"] as? NSNumber)?.doubleValue ?? 0)
    let unitName = ((data["unitName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? "ud."

    return MyOrderPreviousOrderLine(
        vendorId: vendorId,
        companyName: companyName,
        productName: productName,
        packagingLine: myOrderPackagingLine(from: data),
        quantityLabel: myOrderQuantityLabel(
            quantity: quantity,
            pricingMode: (data["pricingModeAtOrder"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            unitName: unitName,
            unitAbbreviation: (data["unitAbbreviation"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
        ),
        subtotal: subtotal
    )
}

func myOrderProducerStatusesByVendor(from data: [String: Any]) -> [String: ProducerOrderStatus] {
    guard let rawMap = data["producerStatusesByVendor"] as? [String: Any] else {
        return [:]
    }
    return rawMap.reduce(into: [:]) { partialResult, entry in
        let vendorId = entry.key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard vendorId.isNotEmpty else { return }
        partialResult[vendorId] = ProducerOrderStatus.from(entry.value as? String)
    }
}

func myOrderPackagingLine(from data: [String: Any], locale: Locale = reguertaPresentationLocale()) -> String {
    let containerName = ((data["packContainerName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 }
    let containerQuantity = (data["packContainerQty"] as? NSNumber)?.doubleValue
    var containerComponents: [String] = []
    if let containerQuantity, abs(containerQuantity - 1) >= 0.000_1 {
        containerComponents.append(containerQuantity.myOrderUiDecimal(locale: locale))
    }
    if let containerName {
        containerComponents.append(containerName)
    }

    let measureQuantity = (data["unitQty"] as? NSNumber)?.doubleValue ?? 1
    let unitName = ((data["unitName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? ""
    let unitPlural = ((data["unitPlural"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? unitName
    let unit =
        ((data["unitAbbreviation"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        (abs(measureQuantity - 1) < 0.000_1 ? unitName : unitPlural)

    return [
        containerComponents.joined(separator: " "),
        measureQuantity.myOrderUiDecimal(locale: locale),
        unit
    ]
        .filter { !$0.isEmpty }
        .joined(separator: " ")
}

func myOrderQuantityLabel(
    quantity: Double,
    pricingMode: String?,
    unitName: String,
    unitAbbreviation: String?
) -> String {
    if pricingMode?.lowercased() == "weight" {
        let unit = unitAbbreviation?.isEmpty == false ? unitAbbreviation! : unitName
        return "\(quantity.myOrderUiDecimal) \(unit)"
    }
    if quantity == 1 {
        return "1 ud."
    }
    return "\(quantity.myOrderUiDecimal) uds."
}
