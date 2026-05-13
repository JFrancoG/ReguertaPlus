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
        firestorePath: firestorePath
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
    firestorePath: ReguertaFirestorePath
) -> [MyOrderCheckoutWriteTarget] {
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
