import FirebaseFirestore
import Foundation

extension Double {
    var myOrderUiDecimal: String {
        if truncatingRemainder(dividingBy: 1) == 0 {
            return String(Int(self))
        }
        return String(format: "%.2f", self)
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

func submitCheckoutOrderToFirestore(
    currentMember: Member?,
    weekKey: String,
    products: [Product],
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String],
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment,
    nowMillis: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)
) async -> Bool {
    guard let member = currentMember else {
        return false
    }

    let lineSnapshots = buildMyOrderCheckoutLineSnapshots(
        products: products,
        selectedQuantities: selectedQuantities,
        selectedEcoBasketOptions: selectedEcoBasketOptions
    )
    guard !lineSnapshots.isEmpty else {
        return false
    }

    let firestorePath = ReguertaFirestorePath(environment: environment)
    let writeTargets = resolveMyOrderCheckoutWriteTargets(
        firestorePath: firestorePath,
        environment: environment
    )
    let checkoutContext = buildMyOrderCheckoutContext(
        member: member,
        weekKey: weekKey,
        nowMillis: nowMillis,
        lineSnapshots: lineSnapshots
    )

    for target in writeTargets {
        if let written = try? await submitMyOrderCheckout(
            target: target,
            context: checkoutContext,
            member: member,
            lineSnapshots: lineSnapshots,
            db: db
        ), written {
            return true
        }
    }

    return false
}

func buildMyOrderCheckoutLineSnapshots(
    products: [Product],
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) -> [MyOrderCheckoutLineSnapshot] {
    products.compactMap { product in
        let selectedUnits = selectedQuantities[product.id, default: 0]
        guard selectedUnits > 0 else { return nil }
        let quantityAtOrder = product.pricingMode == .weight
            ? Double(selectedUnits) * product.unitQty
            : Double(selectedUnits)
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

func resolveMyOrderCheckoutWriteTargets(
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

func submitMyOrderCheckout(
    target: MyOrderCheckoutWriteTarget,
    context: MyOrderCheckoutContext,
    member: Member,
    lineSnapshots: [MyOrderCheckoutLineSnapshot],
    db: Firestore
) async throws -> Bool {
    let orderRef = db.document("\(target.orders)/\(context.orderId)")
    let existingData = try? await orderRef.getDocument().data()
    let createdAt = (existingData?["createdAt"] as? Timestamp) ?? context.nowTimestamp
    let deliveryDate = (existingData?["deliveryDate"] as? Timestamp) ?? context.nowTimestamp
    let existingLinesSnapshot = try? await db.collection(target.orderlines)
        .whereField("orderId", isEqualTo: context.orderId)
        .getDocuments()

    let batch = db.batch()
    batch.setData(
        myOrderCheckoutOrderPayload(
            member: member,
            context: context,
            createdAt: createdAt,
            deliveryDate: deliveryDate
        ),
        forDocument: orderRef,
        merge: true
    )

    for document in existingLinesSnapshot?.documents ?? [] {
        batch.deleteDocument(document.reference)
    }
    for line in lineSnapshots {
        let lineRef = db.document("\(target.orderlines)/\(context.orderId)_\(line.product.id)")
        batch.setData(myOrderCheckoutLinePayload(line: line, member: member, context: context), forDocument: lineRef, merge: true)
    }

    try await batch.commit()
    let serverOrderSnapshot = try await orderRef.getDocument(source: .server)
    return serverOrderSnapshot.exists
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

func myOrderSnapshotsMatch(
    _ lhs: MyOrderCartSnapshot,
    _ rhs: MyOrderCartSnapshot
) -> Bool {
    lhs.selectedQuantities == rhs.selectedQuantities &&
        lhs.selectedEcoBasketOptions == rhs.selectedEcoBasketOptions
}

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

func readMyOrderCartSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String
) -> MyOrderCartSnapshot {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartOptionsSuffix)"

    let restoredQuantities = (userDefaults.dictionary(forKey: quantitiesKey) ?? [:])
        .reduce(into: [String: Int]()) { partialResult, entry in
            let quantity = (entry.value as? Int) ?? (entry.value as? NSNumber)?.intValue ?? 0
            if quantity > 0 {
                partialResult[entry.key] = quantity
            }
        }

    let restoredOptions = (userDefaults.dictionary(forKey: optionsKey) ?? [:])
        .reduce(into: [String: String]()) { partialResult, entry in
            guard let option = entry.value as? String else { return }
            if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                partialResult[entry.key] = option
            }
        }

    return MyOrderCartSnapshot(
        selectedQuantities: restoredQuantities,
        selectedEcoBasketOptions: restoredOptions
    )
}

func persistMyOrderCartSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String,
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartOptionsSuffix)"

    let normalizedQuantities = selectedQuantities.filter { $0.value > 0 }
    let normalizedOptions = selectedEcoBasketOptions
        .filter { normalizedQuantities[$0.key, default: 0] > 0 }
        .filter { $0.value == ecoBasketOptionPickup || $0.value == ecoBasketOptionNoPickup }

    if normalizedQuantities.isEmpty {
        userDefaults.removeObject(forKey: quantitiesKey)
    } else {
        userDefaults.set(normalizedQuantities, forKey: quantitiesKey)
    }

    if normalizedOptions.isEmpty {
        userDefaults.removeObject(forKey: optionsKey)
    } else {
        userDefaults.set(normalizedOptions, forKey: optionsKey)
    }
}

func readMyOrderConfirmedSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String
) -> MyOrderCartSnapshot {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedOptionsSuffix)"

    let restoredQuantities = (userDefaults.dictionary(forKey: quantitiesKey) ?? [:])
        .reduce(into: [String: Int]()) { partialResult, entry in
            let quantity = (entry.value as? Int) ?? (entry.value as? NSNumber)?.intValue ?? 0
            if quantity > 0 {
                partialResult[entry.key] = quantity
            }
        }

    let restoredOptions = (userDefaults.dictionary(forKey: optionsKey) ?? [:])
        .reduce(into: [String: String]()) { partialResult, entry in
            guard let option = entry.value as? String else { return }
            if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                partialResult[entry.key] = option
            }
        }

    return MyOrderCartSnapshot(
        selectedQuantities: restoredQuantities,
        selectedEcoBasketOptions: restoredOptions
    )
}

func persistMyOrderConfirmedSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String,
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedOptionsSuffix)"

    let normalizedQuantities = selectedQuantities.filter { $0.value > 0 }
    let normalizedOptions = selectedEcoBasketOptions
        .filter { normalizedQuantities[$0.key, default: 0] > 0 }
        .filter { $0.value == ecoBasketOptionPickup || $0.value == ecoBasketOptionNoPickup }

    if normalizedQuantities.isEmpty {
        userDefaults.removeObject(forKey: quantitiesKey)
    } else {
        userDefaults.set(normalizedQuantities, forKey: quantitiesKey)
    }

    if normalizedOptions.isEmpty {
        userDefaults.removeObject(forKey: optionsKey)
    } else {
        userDefaults.set(normalizedOptions, forKey: optionsKey)
    }
}

extension ProductPricingMode {
    var orderWireValue: String {
        switch self {
        case .fixed:
            return "fixed"
        case .weight:
            return "weight"
        }
    }
}

extension Product {
    func matchesMyOrderSearch(_ normalizedQuery: String) -> Bool {
        guard normalizedQuery.isNotEmpty else { return true }
        return name.searchNormalized.contains(normalizedQuery) ||
            description.searchNormalized.contains(normalizedQuery) ||
            companyName.searchNormalized.contains(normalizedQuery)
    }
}

extension String {
    var searchNormalized: String {
        folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var isNotEmpty: Bool {
        !isEmpty
    }
}

extension Member {
    func committedEcoBasketProducerId(in members: [Member]) -> String? {
        guard let parity = ecoCommitmentParity else {
            return nil
        }
        return members.first { producer in
            producer.id != id &&
                producer.isProducer &&
                producer.isActive &&
                producer.producerCatalogEnabled &&
                producer.producerParity == parity
        }?.id
    }
}

extension DeliveryWeekday {
    var myOrderDayOffset: Int {
        switch self {
        case .monday: return 0
        case .tuesday: return 1
        case .wednesday: return 2
        case .thursday: return 3
        case .friday: return 4
        case .saturday: return 5
        case .sunday: return 6
        }
    }
}

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard !isEmpty else { return [] }
        guard size > 0 else { return [self] }
        var result: [[Element]] = []
        var index = startIndex
        while index < endIndex {
            let nextIndex = self.index(index, offsetBy: size, limitedBy: endIndex) ?? endIndex
            result.append(Array(self[index..<nextIndex]))
            index = nextIndex
        }
        return result
    }
}
