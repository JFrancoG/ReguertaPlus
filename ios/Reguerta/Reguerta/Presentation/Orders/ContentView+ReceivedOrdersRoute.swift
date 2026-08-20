import SwiftUI

struct ReceivedOrdersRouteView: View {
    @Environment(\.reguertaMotionPolicy) private var motionPolicy

    let tokens: ReguertaDesignTokens
    let viewModel: ReceivedOrdersRouteViewModel
    let context: ReceivedOrdersRouteContext

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            tabSelector
            statusFeedbackView

            routeContent
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task(id: context.identity) {
            await viewModel.appear(context: context)
        }
    }

    @ViewBuilder
    private var statusFeedbackView: some View {
        switch viewModel.statusWriteFeedback {
        case .permissionDenied:
            Text(l10n(AccessL10nKey.receivedOrdersStatusPermissionDenied))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.feedbackError)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .failure:
            Text(l10n(AccessL10nKey.receivedOrdersStatusFailure))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.feedbackError)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .success, .none:
            EmptyView()
        }
    }

    @ViewBuilder
    private var tabSelector: some View {
        Picker(
            l10n(AccessL10nKey.receivedOrdersTabsTitle),
            selection: Binding(
                get: { viewModel.selectedTab },
                set: { tab in
                    withAnimation(motionPolicy.materialAnimation(.snappy(duration: tokens.motion.standardDuration))) {
                        viewModel.selectTab(tab)
                    }
                }
            )
        ) {
            ForEach(ReceivedOrdersTab.allCases) { tab in
                Text(tab.title)
                    .font(tokens.typography.label.weight(.semibold))
                    .tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .tint(tokens.colors.actionPrimary)
        .accessibilityIdentifier("receivedOrders.tabSelector")
    }

    @ViewBuilder
    private var routeContent: some View {
        if !viewModel.isProducer {
            infoCard(
                title: l10n(AccessL10nKey.receivedOrdersProducerOnlyTitle),
                body: l10n(AccessL10nKey.receivedOrdersProducerOnlyBody)
            )
        } else if !viewModel.window.isEnabled {
            windowClosedCard
        } else {
            switch viewModel.loadState {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            case .empty:
                infoCard(
                    title: l10n(AccessL10nKey.receivedOrdersEmptyTitle),
                    body: l10n(
                        AccessL10nKey.receivedOrdersEmptyBodyFormat,
                        viewModel.window.targetWeekKey
                    )
                )
            case .error:
                reguertaCard {
                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        Text(l10n(AccessL10nKey.receivedOrdersErrorTitle))
                            .font(tokens.typography.titleCard.weight(.semibold))
                            .foregroundStyle(tokens.colors.feedbackError)
                        Text(l10n(AccessL10nKey.receivedOrdersErrorBody))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                        reguertaButton(LocalizedStringKey(AccessL10nKey.receivedOrdersRetry)) {
                            Task {
                                await viewModel.retry()
                            }
                        }
                    }
                }
            case .loaded(let snapshot):
                loadedContent(snapshot)
            }
        }
    }
}

private extension ReceivedOrdersRouteView {
    var windowClosedCard: some View {
        let shape = RoundedRectangle(cornerRadius: tokens.radius.lg, style: .continuous)

        return HStack(alignment: .top, spacing: tokens.spacing.md) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: tokens.icons.standard, weight: .semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .frame(
                    minWidth: tokens.layout.minimumTouchTarget,
                    minHeight: tokens.layout.minimumTouchTarget
                )
                .background(
                    tokens.colors.actionPrimary.opacity(0.14),
                    in: RoundedRectangle(cornerRadius: tokens.radius.md, style: .continuous)
                )
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(l10n(AccessL10nKey.receivedOrdersWindowClosedTitle))
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(l10n(AccessL10nKey.receivedOrdersWindowClosedBody))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(tokens.spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tokens.colors.actionPrimary.opacity(0.09), in: shape)
        .overlay(shape.stroke(tokens.colors.actionPrimary.opacity(0.28), lineWidth: 1))
    }

    @ViewBuilder func loadedContent(_ snapshot: ReceivedOrdersSnapshot) -> some View {
        ReceivedOrdersSummaryContent(
            tokens: tokens,
            snapshot: snapshot,
            selectedTab: viewModel.selectedTab,
            updatingStatusOrderId: viewModel.updatingStatusOrderId,
            showsStatusActions: true,
            onSelectStatus: { orderId, status in
                Task {
                    await viewModel.updateProducerStatus(orderId: orderId, status: status)
                }
            }
        )
        .accessibilityIdentifier("receivedOrders.summaryContent")
    }

    @ViewBuilder func infoCard(title: String, body: String) -> some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(title)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(body)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }

}
