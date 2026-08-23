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
    let weekRangeAccessibilityLabel: String
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

struct HomeDashboardInitialVoiceOverFocusGate {
    private(set) var hasRequestedFocus = false

    mutating func requestFocusIfNeeded(isVoiceOverEnabled: Bool, isTargetMounted: Bool) -> Bool {
        guard isVoiceOverEnabled, isTargetMounted, !hasRequestedFocus else { return false }
        hasRequestedFocus = true
        return true
    }
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
        let orderStateScope = rootViewModel.currentHomeOrderStateScope
        HomeDashboardRouteView(
            tokens: tokens,
            presentation: rootViewModel.homeDashboardPresentation,
            newsViewModel: rootViewModel.newsNotificationsViewModel,
            loadNewsImageData: loadNewsImageData,
            onOpenMyOrder: rootViewModel.handleHomeDashboardMyOrderAction,
            onOpenReceivedOrders: rootViewModel.handleHomeDashboardReceivedOrdersAction
        )
        .task(id: orderStateScope) {
            await rootViewModel.refreshHomeOrderState(for: orderStateScope)
        }
    }
}

struct HomeDashboardRouteView: View {
    @Environment(\.accessibilityVoiceOverEnabled) private var isVoiceOverEnabled
    @AccessibilityFocusState(for: .voiceOver) private var isWeeklySummaryFocused: Bool
    @State private var initialVoiceOverFocusGate = HomeDashboardInitialVoiceOverFocusGate()
    @State private var isWeeklySummaryFocusTargetMounted = false

    let tokens: ReguertaDesignTokens
    let presentation: HomeDashboardPresentation
    let newsViewModel: NewsNotificationsFeatureViewModel
    let loadNewsImageData: @Sendable (URL) async throws -> Data
    let onOpenMyOrder: () -> Void
    let onOpenReceivedOrders: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                HomeDashboardSessionSectionView(
                    tokens: tokens,
                    content: presentation.content,
                    weeklySummaryAccessibilityFocus: $isWeeklySummaryFocused,
                    onWeeklySummaryAccessibilityTargetVisibilityChange: updateWeeklySummaryFocusTargetVisibility,
                    onOpenMyOrder: onOpenMyOrder,
                    onOpenReceivedOrders: onOpenReceivedOrders
                )

                LatestNewsCardView(
                    tokens: tokens,
                    latestNews: newsViewModel.homeLatestNewsItems,
                    loadNewsImageData: loadNewsImageData
                )
            }
            .frame(maxWidth: tokens.layout.readableContentMaximumWidth, alignment: .topLeading)
        }
        .accessibilityIdentifier("home.dashboard.scroll")
        .onChange(of: isVoiceOverEnabled) {
            requestInitialVoiceOverFocusIfNeeded()
        }
    }

    private func updateWeeklySummaryFocusTargetVisibility(_ isMounted: Bool) {
        isWeeklySummaryFocusTargetMounted = isMounted
        requestInitialVoiceOverFocusIfNeeded()
    }

    private func requestInitialVoiceOverFocusIfNeeded() {
        guard initialVoiceOverFocusGate.requestFocusIfNeeded(
            isVoiceOverEnabled: isVoiceOverEnabled,
            isTargetMounted: isWeeklySummaryFocusTargetMounted
        ) else { return }
        isWeeklySummaryFocused = true
    }
}

private struct HomeDashboardSessionSectionView: View {
    let tokens: ReguertaDesignTokens
    let content: HomeDashboardContent
    let weeklySummaryAccessibilityFocus: AccessibilityFocusState<Bool>.Binding
    let onWeeklySummaryAccessibilityTargetVisibilityChange: (Bool) -> Void
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
                weeklySummaryAccessibilityFocus: weeklySummaryAccessibilityFocus,
                onWeeklySummaryAccessibilityTargetVisibilityChange:
                    onWeeklySummaryAccessibilityTargetVisibilityChange,
                onOpenMyOrder: onOpenMyOrder,
                onOpenReceivedOrders: onOpenReceivedOrders
            )
        }
    }
}

private struct HomeAuthorizedDashboardSectionView: View {
    let tokens: ReguertaDesignTokens
    let presentation: HomeAuthorizedDashboardPresentation
    let weeklySummaryAccessibilityFocus: AccessibilityFocusState<Bool>.Binding
    let onWeeklySummaryAccessibilityTargetVisibilityChange: (Bool) -> Void
    let onOpenMyOrder: () -> Void
    let onOpenReceivedOrders: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            HomeWeeklySummaryCardView(
                tokens: tokens,
                display: presentation.weeklySummary,
                accessibilityFocus: weeklySummaryAccessibilityFocus,
                onAccessibilityTargetVisibilityChange: onWeeklySummaryAccessibilityTargetVisibilityChange
            )
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
