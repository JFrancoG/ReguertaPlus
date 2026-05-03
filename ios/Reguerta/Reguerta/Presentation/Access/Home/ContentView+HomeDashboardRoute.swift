import SwiftUI

private let homeOrderCartStoragePrefix = "reguerta_my_order_cart"
private let homeOrderCartQuantitiesSuffix = ".quantities"
private let homeOrderConfirmedQuantitiesSuffix = ".confirmed_quantities"

enum HomeOrderStateDisplay: Equatable {
    case notStarted
    case unconfirmed
    case completed

    var titleKey: String {
        switch self {
        case .notStarted: AccessL10nKey.homeDashboardOrderStateNotStarted
        case .unconfirmed: AccessL10nKey.homeDashboardOrderStateUnconfirmed
        case .completed: AccessL10nKey.homeDashboardOrderStateCompleted
        }
    }

    var myOrderSubtitleKey: String {
        switch self {
        case .notStarted: AccessL10nKey.homeDashboardMyOrderSubtitleEdit
        case .unconfirmed: AccessL10nKey.homeDashboardMyOrderSubtitleReview
        case .completed: AccessL10nKey.homeDashboardMyOrderSubtitleCompleted
        }
    }
}

struct HomeWeeklySummaryDisplay: Equatable {
    let weekKey: String
    let weekRangeLabel: String
    let weekBadgeLabel: String
    let producerName: String
    let deliveryLabel: String
    let responsibleName: String
    let helperName: String
    let orderState: HomeOrderStateDisplay
}

extension ContentView {
    @ViewBuilder
    var dashboardRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            switch viewModel.mode {
            case .signedOut:
                cardContainer {
                    Text(localizedKey(AccessL10nKey.signedOutHint))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            case .unauthorized:
                EmptyView()
            case .authorized(let session):
                authorizedHome(session: session)
            }

            latestNewsCard
                .frame(maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    func authorizedHome(session: AuthorizedSession) -> some View {
        let summary = homeWeeklySummary(for: session)
        HomeWeeklySummaryCardView(tokens: tokens, display: summary)
        HomeActionRowView(
            tokens: tokens,
            myOrderFreshnessState: viewModel.myOrderFreshnessState,
            canOpenReceivedOrders: session.member.canAccessReceivedOrders,
            orderState: summary.orderState,
            onOpenMyOrder: {
                homeDestination = .myOrder
                viewModel.refreshMyOrderProducts()
            },
            onOpenReceivedOrders: {
                homeDestination = .receivedOrders
            },
            onRetryFreshness: {
                viewModel.refreshMyOrderFreshness()
            }
        )
    }

    var nextShiftsCard: some View {
        NextShiftsCardView(
            tokens: tokens,
            isLoading: viewModel.isLoadingShifts,
            nextDeliverySummary: viewModel.nextDeliveryShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            nextMarketSummary: viewModel.nextMarketShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            onViewAll: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            }
        )
    }

    var latestNewsCard: some View {
        LatestNewsCardView(
            tokens: tokens,
            latestNews: viewModel.latestNews
        )
    }

    @ViewBuilder
    func operationalModules(
        modulesEnabled: Bool,
        canOpenProducts: Bool,
        myOrderFreshnessState: MyOrderFreshnessState,
        disabledMessageKey: String? = nil
    ) -> some View {
        OperationalModulesCardView(
            tokens: tokens,
            modulesEnabled: modulesEnabled,
            canOpenProducts: canOpenProducts,
            myOrderFreshnessState: myOrderFreshnessState,
            disabledMessageKey: disabledMessageKey,
            onOpenMyOrder: {
                homeDestination = .myOrder
                viewModel.refreshMyOrderProducts()
            },
            onOpenProducts: {
                homeDestination = .products
                viewModel.refreshProducts()
            },
            onOpenShifts: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            },
            onOpenBylaws: {
                homeDestination = .bylaws
            },
            onRetryFreshness: {
                viewModel.refreshMyOrderFreshness()
            }
        )
    }

    @ViewBuilder
    func adminToolsCard(session: AuthorizedSession) -> some View {
        AdminToolsCardView(
            tokens: tokens,
            session: session,
            isExpanded: $isAdminToolsExpanded,
            memberDraft: memberDraftBinding,
            onCreateMember: viewModel.createAuthorizedMember,
            onToggleAdmin: { memberId in
                viewModel.toggleAdmin(memberId: memberId)
            },
            onToggleActive: { memberId in
                viewModel.toggleActive(memberId: memberId)
            }
        )
    }

    func homeWeeklySummary(for session: AuthorizedSession) -> HomeWeeklySummaryDisplay {
        let nowMillis = viewModel.nowOverrideMillis ?? Int64(Date().timeIntervalSince1970 * 1_000)
        let baseline = resolveHomeWeeklySummaryDisplay(
            nowMillis: nowMillis,
            defaultDeliveryDayOfWeek: viewModel.defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: viewModel.deliveryCalendarOverrides,
            shifts: viewModel.shiftsFeed,
            members: session.members
        )
        return HomeWeeklySummaryDisplay(
            weekKey: baseline.weekKey,
            weekRangeLabel: baseline.weekRangeLabel,
            weekBadgeLabel: baseline.weekBadgeLabel,
            producerName: baseline.producerName,
            deliveryLabel: baseline.deliveryLabel,
            responsibleName: baseline.responsibleName,
            helperName: baseline.helperName,
            orderState: resolveHomeOrderState(memberId: session.member.id, weekKey: baseline.weekKey)
        )
    }
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
    let deliveryWeekday = defaultDeliveryDayOfWeek ?? .wednesday
    let currentDeliveryDate = resolveHomeDeliveryDate(
        weekStart: currentWeekStart,
        deliveryWeekday: deliveryWeekday,
        overrides: deliveryCalendarOverrides,
        calendar: calendar
    )
    let targetWeekStart = today > currentDeliveryDate
        ? (calendar.date(byAdding: .day, value: 7, to: currentWeekStart) ?? currentWeekStart)
        : currentWeekStart
    let targetWeekKey = targetWeekStart.homeIsoWeekKey(calendar: calendar)
    let targetShift = shifts
        .filter { $0.type == .delivery }
        .first { shift in
            effectiveHomeDeliveryMillis(for: shift, overrides: deliveryCalendarOverrides)
                .homeIsoWeekKey == targetWeekKey
        }
    let targetDeliveryDate = targetShift.map {
        Date(timeIntervalSince1970: TimeInterval(effectiveHomeDeliveryMillis(for: $0, overrides: deliveryCalendarOverrides)) / 1_000)
    } ?? resolveHomeDeliveryDate(
        weekStart: targetWeekStart,
        deliveryWeekday: deliveryWeekday,
        overrides: deliveryCalendarOverrides,
        calendar: calendar
    )
    let weekNumber = calendar.component(.weekOfYear, from: targetWeekStart)
    let targetWeekEnd = calendar.date(byAdding: .day, value: 6, to: targetWeekStart) ?? targetWeekStart

    return HomeWeeklySummaryDisplay(
        weekKey: targetWeekKey,
        weekRangeLabel: "\(targetWeekStart.homeShortDayMonth(locale: locale)) - \(targetWeekEnd.homeShortDayMonth(locale: locale))",
        weekBadgeLabel: "Semana \(weekNumber)",
        producerName: resolveHomeProducerName(weekStart: targetWeekStart, members: members, calendar: calendar),
        deliveryLabel: targetDeliveryDate.homeShortWeekdayDay(locale: locale),
        responsibleName: targetShift?.assignedUserIds.first.flatMap { memberId in
            members.first(where: { $0.id == memberId })?.displayName
        } ?? "Pendiente",
        helperName: targetShift?.helperUserId.flatMap { memberId in
            members.first(where: { $0.id == memberId })?.displayName
        } ?? "Pendiente",
        orderState: .notStarted
    )
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

private func resolveHomeProducerName(
    weekStart: Date,
    members: [Member],
    calendar: Calendar
) -> String {
    let parity: ProducerParity = calendar.component(.weekOfYear, from: weekStart).isMultiple(of: 2) ? .even : .odd
    let producers = members.filter { $0.isProducer && $0.producerCatalogEnabled }
    let producer = producers.first { $0.producerParity == parity } ?? producers.first
    return producer?.companyName?.isEmpty == false ? producer!.companyName! : (producer?.displayName ?? "Pendiente")
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
