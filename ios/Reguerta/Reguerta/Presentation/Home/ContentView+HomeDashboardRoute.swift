import SwiftUI

enum HomeOrderStateDisplay: Equatable {
    case consultation
    case notStarted
    case unconfirmed
    case completed

    func myOrderSubtitleKey(isConsultaPhase: Bool) -> String {
        if isConsultaPhase || self == .consultation {
            return AccessL10nKey.homeDashboardMyOrderSubtitleLastOrder
        }
        return switch self {
        case .consultation: AccessL10nKey.homeDashboardMyOrderSubtitleLastOrder
        case .notStarted: AccessL10nKey.homeDashboardMyOrderSubtitleEdit
        case .unconfirmed: AccessL10nKey.homeDashboardMyOrderSubtitleReview
        case .completed: AccessL10nKey.homeDashboardMyOrderSubtitleCompleted
        }
    }

    var titleKey: String {
        switch self {
        case .consultation: AccessL10nKey.homeDashboardOrderStateConsultation
        case .notStarted: AccessL10nKey.homeDashboardOrderStateNotStarted
        case .unconfirmed: AccessL10nKey.homeDashboardOrderStateUnconfirmed
        case .completed: AccessL10nKey.homeDashboardOrderStateCompleted
        }
    }
}

struct HomeWeeklySummaryDisplay: Equatable {
    let weekKey: String
    let orderWeekKey: String
    let weekRangeLabel: String
    let weekBadgeLabel: String
    let producerName: String
    let deliveryLabel: String
    let responsibleName: String
    let helperName: String
    let marketLabel: String
    let marketResponsibleNames: [String]
    let orderState: HomeOrderStateDisplay
    let isConsultaPhase: Bool

    var myOrderSubtitleKey: String {
        orderState.myOrderSubtitleKey(isConsultaPhase: isConsultaPhase)
    }
}

enum HomeDashboardContent {
    case signedOut
    case unauthorized
    case authorized(HomeAuthorizedDashboardPresentation)
}

struct HomeDashboardPresentation {
    let content: HomeDashboardContent
}

struct HomeAuthorizedDashboardPresentation {
    let weeklySummary: HomeWeeklySummaryDisplay
    let actionRow: HomeActionRowPresentation
}

struct HomeActionRowPresentation {
    let myOrderFreshnessState: MyOrderFreshnessState
    let canOpenReceivedOrders: Bool
    let orderState: HomeOrderStateDisplay
    let myOrderSubtitleKey: String

    var isMyOrderEnabled: Bool {
        myOrderFreshnessState.allowsMyOrderEntryRequest
    }
}

extension MyOrderFreshnessState {
    var allowsMyOrderEntryRequest: Bool {
        self != .checking
    }
}

extension HomeShellView {
    @ViewBuilder
    var dashboardRoute: some View {
        HomeDashboardRouteView(
            tokens: tokens,
            presentation: rootViewModel.homeDashboardPresentation,
            newsViewModel: rootViewModel.newsNotificationsViewModel,
            loadNewsImageData: loadNewsImageData,
            onOpenMyOrder: rootViewModel.handleHomeDashboardMyOrderAction,
            onOpenReceivedOrders: rootViewModel.handleHomeDashboardReceivedOrdersAction
        )
    }
}

struct HomeDashboardRouteView: View {
    let tokens: ReguertaDesignTokens
    let presentation: HomeDashboardPresentation
    let newsViewModel: NewsNotificationsFeatureViewModel
    let loadNewsImageData: @Sendable (URL) async throws -> Data
    let onOpenMyOrder: () -> Void
    let onOpenReceivedOrders: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            HomeDashboardSessionSectionView(
                tokens: tokens,
                content: presentation.content,
                onOpenMyOrder: onOpenMyOrder,
                onOpenReceivedOrders: onOpenReceivedOrders
            )

            LatestNewsCardView(
                tokens: tokens,
                latestNews: newsViewModel.homeLatestNewsItems,
                loadNewsImageData: loadNewsImageData
            )
            .frame(maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(width: 358.resize, alignment: .topLeading)
        .frame(maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct HomeDashboardSessionSectionView: View {
    let tokens: ReguertaDesignTokens
    let content: HomeDashboardContent
    let onOpenMyOrder: () -> Void
    let onOpenReceivedOrders: () -> Void

    var body: some View {
        switch content {
        case .signedOut:
            HomeSignedOutDashboardCardView(tokens: tokens)
        case .unauthorized:
            EmptyView()
        case .authorized(let presentation):
            HomeAuthorizedDashboardSectionView(
                tokens: tokens,
                presentation: presentation,
                onOpenMyOrder: onOpenMyOrder,
                onOpenReceivedOrders: onOpenReceivedOrders
            )
        }
    }
}

private struct HomeAuthorizedDashboardSectionView: View {
    let tokens: ReguertaDesignTokens
    let presentation: HomeAuthorizedDashboardPresentation
    let onOpenMyOrder: () -> Void
    let onOpenReceivedOrders: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            HomeWeeklySummaryCardView(tokens: tokens, display: presentation.weeklySummary)
            HomeActionRowView(
                tokens: tokens,
                presentation: presentation.actionRow,
                onOpenMyOrder: onOpenMyOrder,
                onOpenReceivedOrders: onOpenReceivedOrders
            )
            Divider()
                .background(tokens.colors.borderSubtle.opacity(0.65))
        }
    }
}

private struct HomeSignedOutDashboardCardView: View {
    let tokens: ReguertaDesignTokens

    var body: some View {
        reguertaCard {
            Text(LocalizedStringKey(AccessL10nKey.signedOutHint))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }
}
