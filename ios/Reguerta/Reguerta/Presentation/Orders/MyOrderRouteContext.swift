import Foundation

@MainActor
func ordersRouteHasActiveAuthorization(
    sessionViewModel: SessionViewModel,
    currentMember: Member?,
    environment: SessionEnvironment
) -> Bool {
    guard case .authorized(let session) = sessionViewModel.mode else { return false }
    return session.representsActiveAuthorization &&
        session.member == currentMember &&
        session.environment == environment
}

struct MyOrderRouteContext {
    let products: [Product]
    let seasonalCommitments: [SeasonalCommitment]
    let shifts: [ShiftAssignment]
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let nowMillis: Int64
    let isLoading: Bool
    let currentMember: Member?
    let members: [Member]
    let environment: SessionEnvironment

    static let empty = MyOrderRouteContext(
        products: [],
        seasonalCommitments: [],
        shifts: [],
        defaultDeliveryDayOfWeek: nil,
        deliveryCalendarOverrides: [],
        nowMillis: 0,
        isLoading: false,
        currentMember: nil,
        members: [],
        environment: .develop
    )

    var currentWeekKey: String {
        nowMillis.isoWeekKey
    }

    var consultaWindow: MyOrderConsultaWindow {
        resolveMyOrderConsultaWindow(
            defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: deliveryCalendarOverrides,
            shifts: shifts,
            now: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        )
    }

    var cartStorageKey: String {
        myOrderLocalStateStorageKey(
            memberId: currentMember?.id,
            weekKey: currentWeekKey,
            environment: environment
        )
    }

    var identity: String {
        [
            currentMember?.id ?? "none",
            environment.rawValue,
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
