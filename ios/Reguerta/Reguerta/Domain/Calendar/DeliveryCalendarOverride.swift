import Foundation

enum DeliveryWeekday: String, CaseIterable, Equatable, Sendable {
    case monday = "MON"
    case tuesday = "TUE"
    case wednesday = "WED"
    case thursday = "THU"
    case friday = "FRI"
    case saturday = "SAT"
    case sunday = "SUN"
}

struct DeliveryCalendarOverride: Equatable, Sendable {
    let weekKey: String
    let deliveryDateMillis: Int64
    let ordersBlockedDateMillis: Int64
    let ordersOpenAtMillis: Int64
    let ordersCloseAtMillis: Int64
    let updatedBy: String
    let updatedAtMillis: Int64
}
