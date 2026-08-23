import Foundation

struct HomeWeeklySummaryLocalization {
    let locale: Locale
    let weekLabel: String
    let weekRangeAccessibilityFormat: String
    let pendingLabel: String

    static var current: HomeWeeklySummaryLocalization {
        HomeWeeklySummaryLocalization(
            locale: .current,
            weekLabel: l10n(AccessL10nKey.homeDashboardWeek),
            weekRangeAccessibilityFormat: l10n(AccessL10nKey.homeDashboardWeekRangeAccessibility),
            pendingLabel: l10n(AccessL10nKey.homeDashboardPending)
        )
    }
}

private struct HomeWeeklySummaryResolutionContext {
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let shifts: [ShiftAssignment]
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

private struct HomeWeeklySummaryPresentationContext {
    let members: [Member]
    let calendar: Calendar
    let locale: Locale
    let weekLabel: String
    let weekRangeAccessibilityFormat: String
    let pendingLabel: String
}

func resolveHomeWeeklySummaryDisplay(
    nowMillis: Int64,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts: [ShiftAssignment],
    members: [Member],
    businessTimeZone: TimeZone = OrderBusinessCalendar.timeZone,
    localization: HomeWeeklySummaryLocalization = .current
) -> HomeWeeklySummaryDisplay {
    let calendar = OrderBusinessCalendar.make(timeZone: businessTimeZone)
    let now = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    let today = calendar.startOfDay(for: now)
    let context = HomeWeeklySummaryResolutionContext(
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        shifts: shifts,
        calendar: calendar
    )
    let consultationCycle = resolveOrderConsultationCycle(
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        now: now,
        calendar: calendar
    )
    let target = resolveHomeWeeklySummaryTarget(
        today: today,
        currentWeekStart: consultationCycle.weekStart,
        currentDeliveryDate: consultationCycle.deliveryDate,
        context: context
    )

    return buildHomeWeeklySummaryDisplay(
        target: target,
        context: HomeWeeklySummaryPresentationContext(
            members: members,
            calendar: calendar,
            locale: localization.locale,
            weekLabel: localization.weekLabel,
            weekRangeAccessibilityFormat: localization.weekRangeAccessibilityFormat,
            pendingLabel: localization.pendingLabel
        ),
        isConsultaPhase: consultationCycle.isConsultaPhase
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
        calendar: context.calendar
    )
    let targetMarketShift = resolveHomeTargetMarketShift(
        shifts: context.shifts,
        today: today,
        calendar: context.calendar
    )
    let deliveryDate = resolveHomeTargetDeliveryDate(
        weekStart: targetWeekStart,
        defaultDeliveryDayOfWeek: context.defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: context.deliveryCalendarOverrides,
        calendar: context.calendar
    )
    let marketDate = targetMarketShift.map {
        Date(timeIntervalSince1970: TimeInterval($0.dateMillis) / 1_000)
    } ?? resolveHomeNextScheduledMarketDate(onOrAfter: today, calendar: context.calendar)
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
    context: HomeWeeklySummaryPresentationContext,
    isConsultaPhase: Bool
) -> HomeWeeklySummaryDisplay {
    let rangeStart = target.weekStart.homeShortDayMonth(locale: context.locale, calendar: context.calendar)
    let rangeEnd = target.weekEnd.homeShortDayMonth(locale: context.locale, calendar: context.calendar)
    let weekRangeAccessibilityArguments: [CVarArg] = [rangeStart, rangeEnd]
    return HomeWeeklySummaryDisplay(
        weekKey: target.weekKey,
        orderWeekKey: target.orderWeekKey,
        weekRangeLabel: "\(rangeStart)–\(rangeEnd)",
        weekRangeAccessibilityLabel: String(
            format: context.weekRangeAccessibilityFormat,
            locale: context.locale,
            arguments: weekRangeAccessibilityArguments
        ),
        weekBadgeLabel: "\(context.weekLabel) \(target.weekNumber)",
        producerName: resolveHomeProducerName(
            weekStart: target.weekStart,
            members: context.members,
            calendar: context.calendar,
            pendingLabel: context.pendingLabel
        ),
        deliveryLabel: target.deliveryDate.homeShortWeekdayDay(
            locale: context.locale,
            calendar: context.calendar
        ),
        responsibleName: target.shift?.assignedUserIds.first.flatMap { memberId in
            context.members.first(where: { $0.id == memberId })?.displayName
        } ?? context.pendingLabel,
        helperName: target.shift?.helperUserId.flatMap { memberId in
            context.members.first(where: { $0.id == memberId })?.displayName
        } ?? context.pendingLabel,
        marketLabel: target.marketDate.map { date in
            target.marketShift == nil
                ? date.homeShortDayMonth(locale: context.locale, calendar: context.calendar)
                : date.homeShortWeekdayDay(locale: context.locale, calendar: context.calendar)
        } ?? context.pendingLabel,
        marketResponsibleNames: homeDisplayNames(
            for: Array(target.marketShift?.assignedUserIds.prefix(3) ?? []),
            members: context.members,
            pendingLabel: context.pendingLabel
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

private func resolveHomeTargetDeliveryShift(
    shifts: [ShiftAssignment],
    targetWeekKey: String,
    calendar: Calendar
) -> ShiftAssignment? {
    shifts
        .filter { $0.type == .delivery }
        .first { shift in
            shift.dateMillis.homeIsoWeekKey(calendar: calendar) == targetWeekKey
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

private func resolveHomeNextScheduledMarketDate(onOrAfter today: Date, calendar: Calendar) -> Date? {
    let monthComponents = calendar.dateComponents([.year, .month], from: today)
    guard var monthStart = calendar.date(from: monthComponents) else { return nil }

    for _ in 0..<24 {
        let month = calendar.component(.month, from: monthStart)
        if month != 7 && month != 8 {
            let weekday = calendar.component(.weekday, from: monthStart)
            let daysUntilSaturday = (7 - weekday + 7) % 7
            let thirdSaturdayOffset = daysUntilSaturday + 14
            if let thirdSaturday = calendar.date(
                byAdding: .day,
                value: thirdSaturdayOffset,
                to: monthStart
            ), thirdSaturday >= today {
                return thirdSaturday
            }
        }
        guard let nextMonth = calendar.date(byAdding: .month, value: 1, to: monthStart) else { return nil }
        monthStart = nextMonth
    }
    return nil
}

private func resolveHomeTargetDeliveryDate(
    weekStart: Date,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    calendar: Calendar
) -> Date {
    resolveOrderDeliveryDate(
        weekStart: weekStart,
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        calendar: calendar
    )
}

private func homeDisplayNames(for memberIds: [String], members: [Member], pendingLabel: String) -> [String] {
    let names = memberIds.map { memberId in
        members.first(where: { $0.id == memberId })?.displayName ?? memberId
    }
    return names.isEmpty ? [pendingLabel] : names
}

func resolveHomeOrderState(_ state: MyOrderLocalState) -> HomeOrderStateDisplay {
    switch state {
    case .empty: .notStarted
    case .draft: .unconfirmed
    case .confirmed: .completed
    }
}

func resolveHomeDisplayedOrderState(isConsultaPhase: Bool, orderState: HomeOrderStateDisplay) -> HomeOrderStateDisplay {
    isConsultaPhase ? .consultation : orderState
}

func formatHomeTopBarDate(
    nowMillis: Int64,
    locale: Locale = .current,
    businessTimeZone: TimeZone = OrderBusinessCalendar.timeZone
) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    let formatter = DateFormatter()
    formatter.calendar = OrderBusinessCalendar.make(timeZone: businessTimeZone)
    formatter.locale = locale
    formatter.timeZone = businessTimeZone
    formatter.setLocalizedDateFormatFromTemplate("EEEE d MMMM")
    return formatter.string(from: date)
}

private func resolveHomeProducerName(
    weekStart: Date,
    members: [Member],
    calendar: Calendar,
    pendingLabel: String
) -> String {
    let orderWeekStart = calendar.date(byAdding: .day, value: -7, to: weekStart) ?? weekStart
    let orderWeekNumber = calendar.component(.weekOfYear, from: orderWeekStart)
    let parity: ProducerParity = orderWeekNumber.isMultiple(of: 2) ? .even : .odd
    let producers = members
        .filter(\.isProducer)
        .sorted { lhs, rhs in
            let lhsName = lhs.companyName?.isEmpty == false ? lhs.companyName! : lhs.displayName
            let rhsName = rhs.companyName?.isEmpty == false ? rhs.companyName! : rhs.displayName
            return lhsName.localizedCaseInsensitiveCompare(rhsName) == .orderedAscending
        }
    let producer = producers.first { $0.producerParity == parity } ??
        producers[safe: orderWeekNumber % max(producers.count, 1)]
    return producer?.companyName?.isEmpty == false ? producer!.companyName! : (producer?.displayName ?? pendingLabel)
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private extension Int64 {
    func homeIsoWeekKey(calendar: Calendar) -> String {
        Date(
            timeIntervalSince1970: TimeInterval(self) / 1_000
        ).homeIsoWeekKey(calendar: calendar)
    }
}

private extension Date {
    func homeIsoWeekKey(calendar: Calendar) -> String {
        let week = calendar.component(.weekOfYear, from: self)
        let year = calendar.component(.yearForWeekOfYear, from: self)
        return String(format: "%04d-W%02d", year, week)
    }

    func homeShortDayMonth(locale: Locale, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = locale
        formatter.timeZone = calendar.timeZone
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter.string(from: self).replacingOccurrences(of: ".", with: "")
    }

    func homeShortWeekdayDay(locale: Locale, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = locale
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "EEE d"
        return formatter.string(from: self).replacingOccurrences(of: ".", with: "").capitalized
    }
}
