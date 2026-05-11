import FirebaseFirestore
import Foundation

func resolveMyOrderConsultaWindow(
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts: [ShiftAssignment],
    now: Date = Date(),
    timeZone: TimeZone = TimeZone(identifier: "Europe/Madrid") ?? .current
) -> MyOrderConsultaWindow {
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = timeZone

    let weekStartDay = calendar.startOfDay(
        for: calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
    )
    let weekEndDay = calendar.date(byAdding: .day, value: 6, to: weekStartDay) ?? weekStartDay
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
    } else if let currentWeekDeliveryShiftDate = shifts
        .filter({ $0.type == .delivery })
        .map({ calendar.startOfDay(for: Date(timeIntervalSince1970: TimeInterval($0.dateMillis) / 1_000)) })
        .filter({ $0 >= weekStartDay && $0 <= weekEndDay })
        .sorted(by: <)
        .first {
        effectiveDeliveryDate = currentWeekDeliveryShiftDate
    } else {
        let dayOffset = (defaultDeliveryDayOfWeek ?? .wednesday).myOrderDayOffset
        effectiveDeliveryDate = calendar.date(byAdding: .day, value: dayOffset, to: weekStartDay) ?? weekStartDay
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
    orderId: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async -> MyOrderProducerStatusSnapshot {
    let firestorePath = ReguertaFirestorePath(environment: environment)
    let readTargets = Array(Set([
        firestorePath.collectionPath(.orders),
        "\(environment.rawValue)/collections/orders"
    ]))

    for ordersPath in readTargets {
        do {
            let orderSnapshot = try await db.document("\(ordersPath)/\(orderId)").getDocument()
            guard orderSnapshot.exists else { continue }
            let payload = orderSnapshot.data() ?? [:]
            let legacyStatus = ProducerOrderStatus.from(payload["producerStatus"] as? String)
            let byVendor = myOrderProducerStatusesByVendor(from: payload)
            return MyOrderProducerStatusSnapshot(
                byVendor: byVendor,
                legacyStatus: legacyStatus
            )
        } catch {
            continue
        }
    }

    return MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
}

func fetchPreviousWeekOrderSnapshot(
    currentMember: Member?,
    previousWeekKey: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> MyOrderPreviousOrderSnapshot? {
    guard let member = currentMember else {
        return nil
    }

    let firestorePath = ReguertaFirestorePath(environment: environment)
    let readTargets = resolvePreviousOrderReadTargets(
        firestorePath: firestorePath,
        environment: environment
    )
    let orderId = "\(member.id)_\(previousWeekKey)"
    var lastError: Error?
    var hasSuccessfulRead = false

    for target in readTargets {
        do {
            let snapshot = try await fetchPreviousWeekOrderSnapshot(
                target: target,
                orderId: orderId,
                previousWeekKey: previousWeekKey,
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

func resolvePreviousOrderReadTargets(
    firestorePath: ReguertaFirestorePath,
    environment: ReguertaFirestoreEnvironment
) -> [MyOrderCheckoutWriteTarget] {
    [
        (
            orders: firestorePath.collectionPath(.orders),
            orderlines: firestorePath.collectionPath(.orderlines)
        ),
        (
            orders: "\(environment.rawValue)/collections/orders",
            orderlines: "\(environment.rawValue)/collections/orderLines"
        ),
        (
            orders: "\(environment.rawValue)/collections/orders",
            orderlines: "\(environment.rawValue)/collections/orderlines"
        )
    ]
}

func fetchPreviousWeekOrderSnapshot(
    target: MyOrderCheckoutWriteTarget,
    orderId: String,
    previousWeekKey: String,
    db: Firestore
) async throws -> MyOrderPreviousOrderSnapshot? {
    let orderRef = db.document("\(target.orders)/\(orderId)")
    let orderSnapshot = try await orderRef.getDocument()
    let linesSnapshot = try await db.collection(target.orderlines)
        .whereField("orderId", isEqualTo: orderId)
        .getDocuments()

    let lines = linesSnapshot.documents.map { document in
        myOrderPreviousLine(from: document.data())
    }
    let groups = buildMyOrderPreviousGroups(from: lines)
    guard orderSnapshot.exists || !groups.isEmpty else {
        return nil
    }

    let total = (orderSnapshot.data()?["total"] as? NSNumber)?.doubleValue ??
        groups.reduce(0) { $0 + $1.subtotal }

    return MyOrderPreviousOrderSnapshot(
        weekKey: previousWeekKey,
        groups: groups,
        total: total
    )
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

func myOrderPackagingLine(from data: [String: Any]) -> String {
    let containerName = ((data["packContainerName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        (((data["unitName"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "")
    let quantity = ((data["packContainerQty"] as? NSNumber)?.doubleValue
        ?? (data["unitQty"] as? NSNumber)?.doubleValue
        ?? 1).myOrderUiDecimal
    let unitName = ((data["unitName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? ""
    let unitPlural = ((data["unitPlural"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? ""
    let unit = ((data["packContainerAbbreviation"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        ((data["packContainerPlural"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        ((data["unitAbbreviation"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        ((((data["packContainerQty"] as? NSNumber)?.doubleValue ?? 1) == 1) ? unitName : unitPlural)

    return [containerName, quantity, unit]
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
