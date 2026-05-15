import Foundation

private let homeOrderCartStoragePrefix = "reguerta_my_order_cart"
private let homeOrderCartQuantitiesSuffix = ".quantities"
private let homeOrderConfirmedQuantitiesSuffix = ".confirmed_quantities"

private struct HomeWeeklySummaryResolutionContext {
    let deliveryWeekday: DeliveryWeekday
    let shifts: [ShiftAssignment]
    let overrides: [DeliveryCalendarOverride]
    let calendar: Calendar
}

private struct HomeWeeklySummaryTarget {
    let weekKey: String
    let orderWeekKey: String
    let weekStart: Date
    let weekEnd: Date
    let weekNumber: Int
    let deliveryDate: Date
    let shift: ShiftAssignment?
    let marketDate: Date?
    let marketShift: ShiftAssignment?
}

func resolveHomeWeeklySummaryDisplay(
    nowMillis: Int64,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts: [ShiftAssignment],
    members: [Member],
    calendar: Calendar = Calendar(identifier: .iso8601)
) -> HomeWeeklySummaryDisplay {
    var calendar = calendar
    calendar.timeZone = .current
    let locale = Locale(identifier: "es_ES")
    let today = calendar.startOfDay(for: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000))
    let currentWeekStart = calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today
    let isConsultaPhase = resolveHomeConsultaPhase(
        nowMillis: nowMillis,
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        shifts: shifts
    )
    let deliveryWeekday = defaultDeliveryDayOfWeek ?? .wednesday
    let context = HomeWeeklySummaryResolutionContext(
        deliveryWeekday: deliveryWeekday,
        shifts: shifts,
        overrides: deliveryCalendarOverrides,
        calendar: calendar
    )
    let currentDeliveryDate = resolveHomeEffectiveDeliveryDate(
        weekKey: currentWeekStart.homeIsoWeekKey(calendar: calendar),
        weekStart: currentWeekStart,
        context: context
    )
    let target = resolveHomeWeeklySummaryTarget(
        today: today,
        currentWeekStart: currentWeekStart,
        currentDeliveryDate: currentDeliveryDate,
        context: context
    )

    return buildHomeWeeklySummaryDisplay(
        target: target,
        members: members,
        calendar: calendar,
        locale: locale,
        isConsultaPhase: isConsultaPhase
    )
}

private func resolveHomeWeeklySummaryTarget(
    today: Date,
    currentWeekStart: Date,
    currentDeliveryDate: Date,
    context: HomeWeeklySummaryResolutionContext
) -> HomeWeeklySummaryTarget {
    let targetWeekStart = resolveHomeTargetWeekStart(
        today: today,
        currentWeekStart: currentWeekStart,
        currentDeliveryDate: currentDeliveryDate,
        calendar: context.calendar
    )
    let targetWeekKey = targetWeekStart.homeIsoWeekKey(calendar: context.calendar)
    let orderWeekStart = context.calendar.date(byAdding: .day, value: -7, to: targetWeekStart) ?? targetWeekStart
    let orderWeekKey = orderWeekStart.homeIsoWeekKey(calendar: context.calendar)
    let targetShift = resolveHomeTargetDeliveryShift(
        shifts: context.shifts,
        targetWeekKey: targetWeekKey,
        overrides: context.overrides
    )
    let targetMarketShift = resolveHomeTargetMarketShift(
        shifts: context.shifts,
        today: today,
        calendar: context.calendar
    )
    let deliveryDate = resolveHomeTargetDeliveryDate(
        targetShift: targetShift,
        weekStart: targetWeekStart,
        deliveryWeekday: context.deliveryWeekday,
        overrides: context.overrides,
        calendar: context.calendar
    )
    let fallbackMarketDate = context.calendar.date(byAdding: .day, value: 5, to: orderWeekStart) ?? orderWeekStart
    let marketDate = targetMarketShift.map {
        Date(timeIntervalSince1970: TimeInterval($0.dateMillis) / 1_000)
    } ?? (fallbackMarketDate < today ? nil : fallbackMarketDate)
    return HomeWeeklySummaryTarget(
        weekKey: targetWeekKey,
        orderWeekKey: orderWeekKey,
        weekStart: targetWeekStart,
        weekEnd: context.calendar.date(byAdding: .day, value: 6, to: targetWeekStart) ?? targetWeekStart,
        weekNumber: context.calendar.component(.weekOfYear, from: targetWeekStart),
        deliveryDate: deliveryDate,
        shift: targetShift,
        marketDate: marketDate,
        marketShift: targetMarketShift
    )
}

private func buildHomeWeeklySummaryDisplay(
    target: HomeWeeklySummaryTarget,
    members: [Member],
    calendar: Calendar,
    locale: Locale,
    isConsultaPhase: Bool
) -> HomeWeeklySummaryDisplay {
    HomeWeeklySummaryDisplay(
        weekKey: target.weekKey,
        orderWeekKey: target.orderWeekKey,
        weekRangeLabel: "\(target.weekStart.homeShortDayMonth(locale: locale)) - \(target.weekEnd.homeShortDayMonth(locale: locale))",
        weekBadgeLabel: "Semana \(target.weekNumber)",
        producerName: resolveHomeProducerName(weekStart: target.weekStart, members: members, calendar: calendar),
        deliveryLabel: target.deliveryDate.homeShortWeekdayDay(locale: locale),
        responsibleName: target.shift?.assignedUserIds.first.flatMap { memberId in
            members.first(where: { $0.id == memberId })?.displayName
        } ?? "Pendiente",
        helperName: target.shift?.helperUserId.flatMap { memberId in
            members.first(where: { $0.id == memberId })?.displayName
        } ?? "Pendiente",
        marketLabel: target.marketDate?.homeShortWeekdayDay(locale: locale) ?? "Pendiente",
        marketResponsibleNames: homeDisplayNames(
            for: Array(target.marketShift?.assignedUserIds.prefix(3) ?? []),
            members: members
        ),
        orderState: .notStarted,
        isConsultaPhase: isConsultaPhase
    )
}

private func resolveHomeTargetWeekStart(
    today: Date,
    currentWeekStart: Date,
    currentDeliveryDate: Date,
    calendar: Calendar
) -> Date {
    today > currentDeliveryDate
        ? (calendar.date(byAdding: .day, value: 7, to: currentWeekStart) ?? currentWeekStart)
        : currentWeekStart
}

private func resolveHomeConsultaPhase(
    nowMillis: Int64,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts: [ShiftAssignment]
) -> Bool {
    resolveMyOrderConsultaWindow(
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        shifts: shifts,
        now: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    ).isConsultaPhase
}

private func resolveHomeTargetDeliveryShift(
    shifts: [ShiftAssignment],
    targetWeekKey: String,
    overrides: [DeliveryCalendarOverride]
) -> ShiftAssignment? {
    shifts
        .filter { $0.type == .delivery }
        .first { shift in
            effectiveHomeDeliveryMillis(for: shift, overrides: overrides).homeIsoWeekKey == targetWeekKey
        }
}

private func resolveHomeTargetMarketShift(
    shifts: [ShiftAssignment],
    today: Date,
    calendar: Calendar
) -> ShiftAssignment? {
    shifts
        .filter { shift in
            guard shift.type == .market else { return false }
            let marketDate = calendar.startOfDay(
                for: Date(timeIntervalSince1970: TimeInterval(shift.dateMillis) / 1_000)
            )
            return marketDate >= today
        }
        .min { $0.dateMillis < $1.dateMillis }
}

private func resolveHomeTargetDeliveryDate(
    targetShift: ShiftAssignment?,
    weekStart: Date,
    deliveryWeekday: DeliveryWeekday,
    overrides: [DeliveryCalendarOverride],
    calendar: Calendar
) -> Date {
    targetShift.map {
        Date(timeIntervalSince1970: TimeInterval(effectiveHomeDeliveryMillis(for: $0, overrides: overrides)) / 1_000)
    } ?? resolveHomeDeliveryDate(
        weekStart: weekStart,
        deliveryWeekday: deliveryWeekday,
        overrides: overrides,
        calendar: calendar
    )
}

private func homeDisplayNames(for memberIds: [String], members: [Member]) -> [String] {
    let names = memberIds.map { memberId in
        members.first(where: { $0.id == memberId })?.displayName ?? memberId
    }
    return names.isEmpty ? ["Pendiente"] : names
}

func resolveHomeOrderState(
    userDefaults: UserDefaults = .standard,
    memberId: String?,
    weekKey: String
) -> HomeOrderStateDisplay {
    let storageKey = "member_\(memberId ?? "")_week_\(weekKey)"
    let confirmedKey = "\(homeOrderCartStoragePrefix).\(storageKey)\(homeOrderConfirmedQuantitiesSuffix)"
    let cartKey = "\(homeOrderCartStoragePrefix).\(storageKey)\(homeOrderCartQuantitiesSuffix)"
    if userDefaults.hasPositiveHomeOrderQuantity(forKey: confirmedKey) {
        return .completed
    }
    if userDefaults.hasPositiveHomeOrderQuantity(forKey: cartKey) {
        return .unconfirmed
    }
    return .notStarted
}

func formatHomeTopBarDate(
    nowMillis: Int64,
    locale: Locale = Locale(identifier: "es_ES")
) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.dateFormat = "EEEE d MMMM"
    return formatter.string(from: date).lowercased()
}

private func effectiveHomeDeliveryMillis(
    for shift: ShiftAssignment,
    overrides: [DeliveryCalendarOverride]
) -> Int64 {
    guard shift.type == .delivery else { return shift.dateMillis }
    return overrides.first(where: { $0.weekKey == shift.weekKey })?.deliveryDateMillis ?? shift.dateMillis
}

private func resolveHomeDeliveryDate(
    weekStart: Date,
    deliveryWeekday: DeliveryWeekday,
    overrides: [DeliveryCalendarOverride],
    calendar: Calendar
) -> Date {
    let weekKey = weekStart.homeIsoWeekKey(calendar: calendar)
    if let override = overrides.first(where: { $0.weekKey == weekKey }) {
        return calendar.startOfDay(for: Date(timeIntervalSince1970: TimeInterval(override.deliveryDateMillis) / 1_000))
    }
    return calendar.date(byAdding: .day, value: deliveryWeekday.homeDayOffset, to: weekStart) ?? weekStart
}

private func resolveHomeEffectiveDeliveryDate(
    weekKey: String,
    weekStart: Date,
    context: HomeWeeklySummaryResolutionContext
) -> Date {
    if let override = context.overrides.first(where: { $0.weekKey == weekKey }) {
        return context.calendar.startOfDay(
            for: Date(timeIntervalSince1970: TimeInterval(override.deliveryDateMillis) / 1_000)
        )
    }
    let weekEnd = context.calendar.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart
    if let deliveryShiftDate = context.shifts
        .filter({ $0.type == .delivery })
        .map({
            context.calendar.startOfDay(
                for: Date(
                    timeIntervalSince1970: TimeInterval(
                        effectiveHomeDeliveryMillis(for: $0, overrides: context.overrides)
                    ) / 1_000
                )
            )
        })
        .filter({ $0 >= weekStart && $0 <= weekEnd })
        .sorted(by: <)
        .first {
        return deliveryShiftDate
    }
    return context.calendar.date(
        byAdding: .day,
        value: context.deliveryWeekday.homeDayOffset,
        to: weekStart
    ) ?? weekStart
}

private func resolveHomeProducerName(
    weekStart: Date,
    members: [Member],
    calendar: Calendar
) -> String {
    let orderWeekStart = calendar.date(byAdding: .day, value: -7, to: weekStart) ?? weekStart
    let orderWeekNumber = calendar.component(.weekOfYear, from: orderWeekStart)
    let parity: ProducerParity = orderWeekNumber.isMultiple(of: 2) ? .even : .odd
    let producers = members
        .filter { $0.isProducer && $0.producerCatalogEnabled }
        .sorted { lhs, rhs in
            let lhsName = lhs.companyName?.isEmpty == false ? lhs.companyName! : lhs.displayName
            let rhsName = rhs.companyName?.isEmpty == false ? rhs.companyName! : rhs.displayName
            return lhsName.localizedCaseInsensitiveCompare(rhsName) == .orderedAscending
        }
    let producer = producers.first { $0.producerParity == parity } ?? producers[safe: orderWeekNumber % max(producers.count, 1)]
    return producer?.companyName?.isEmpty == false ? producer!.companyName! : (producer?.displayName ?? "Pendiente")
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private extension UserDefaults {
    func hasPositiveHomeOrderQuantity(forKey key: String) -> Bool {
        (dictionary(forKey: key) ?? [:]).contains { entry in
            ((entry.value as? Int) ?? (entry.value as? NSNumber)?.intValue ?? 0) > 0
        }
    }
}

private extension Int64 {
    var homeIsoWeekKey: String {
        Date(timeIntervalSince1970: TimeInterval(self) / 1_000).homeIsoWeekKey()
    }
}

private extension Date {
    func homeIsoWeekKey(calendar: Calendar = Calendar(identifier: .iso8601)) -> String {
        var calendar = calendar
        calendar.timeZone = .current
        let week = calendar.component(.weekOfYear, from: self)
        let year = calendar.component(.yearForWeekOfYear, from: self)
        return String(format: "%04d-W%02d", year, week)
    }

    func homeShortDayMonth(locale: Locale) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "d MMM"
        return formatter.string(from: self).replacingOccurrences(of: ".", with: "").lowercased()
    }

    func homeShortWeekdayDay(locale: Locale) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "EEE d"
        return formatter.string(from: self).replacingOccurrences(of: ".", with: "").capitalized
    }
}

private extension DeliveryWeekday {
    var homeDayOffset: Int {
        switch self {
        case .monday: 0
        case .tuesday: 1
        case .wednesday: 2
        case .thursday: 3
        case .friday: 4
        case .saturday: 5
        case .sunday: 6
        }
    }
}
