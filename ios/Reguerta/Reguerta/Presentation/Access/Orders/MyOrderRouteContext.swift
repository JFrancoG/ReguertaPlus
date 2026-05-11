import Foundation

struct MyOrderRouteContext: Sendable {
    let products: [Product]
    let seasonalCommitments: [SeasonalCommitment]
    let shifts: [ShiftAssignment]
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let nowMillis: Int64
    let isLoading: Bool
    let currentMember: Member?
    let members: [Member]

    static let empty = MyOrderRouteContext(
        products: [],
        seasonalCommitments: [],
        shifts: [],
        defaultDeliveryDayOfWeek: nil,
        deliveryCalendarOverrides: [],
        nowMillis: 0,
        isLoading: false,
        currentMember: nil,
        members: []
    )

    var identity: String {
        [
            currentMember?.id ?? "none",
            nowMillis.isoWeekKey,
            String(isLoading),
            products.map(productSignature).joined(separator: ","),
            seasonalCommitments.map(commitmentSignature).joined(separator: ","),
            shifts.map(shiftSignature).joined(separator: ","),
            deliveryCalendarOverrides.map(overrideSignature).joined(separator: ","),
            defaultDeliveryDayOfWeek?.rawValue ?? "none",
            members.map(memberSignature).joined(separator: ",")
        ].joined(separator: "|")
    }

    private func productSignature(_ product: Product) -> String {
        [
            product.id,
            product.vendorId,
            product.name,
            String(product.price),
            product.pricingMode.rawValue,
            String(product.unitQty),
            String(product.isAvailable),
            product.stockMode.rawValue,
            String(product.stockQty ?? -1),
            String(product.isEcoBasket),
            String(product.isCommonPurchase),
            String(product.archived),
            String(product.updatedAtMillis)
        ].joined(separator: ":")
    }

    private func commitmentSignature(_ commitment: SeasonalCommitment) -> String {
        [
            commitment.id,
            commitment.userId,
            commitment.productId,
            commitment.seasonKey,
            String(commitment.fixedQtyPerOfferedWeek),
            String(commitment.active),
            String(commitment.updatedAtMillis)
        ].joined(separator: ":")
    }

    private func shiftSignature(_ shift: ShiftAssignment) -> String {
        [
            shift.id,
            shift.type.rawValue,
            String(shift.dateMillis),
            shift.assignedUserIds.joined(separator: ","),
            shift.helperUserId ?? "",
            shift.status.rawValue,
            String(shift.updatedAtMillis)
        ].joined(separator: ":")
    }

    private func overrideSignature(_ override: DeliveryCalendarOverride) -> String {
        [
            override.weekKey,
            String(override.deliveryDateMillis),
            String(override.ordersOpenAtMillis),
            String(override.ordersCloseAtMillis),
            String(override.updatedAtMillis)
        ].joined(separator: ":")
    }

    private func memberSignature(_ member: Member) -> String {
        [
            member.id,
            String(member.isActive),
            String(member.producerCatalogEnabled),
            member.producerParity?.rawValue ?? "none",
            member.ecoCommitmentMode.rawValue,
            member.ecoCommitmentParity?.rawValue ?? "none"
        ].joined(separator: ":")
    }
}
