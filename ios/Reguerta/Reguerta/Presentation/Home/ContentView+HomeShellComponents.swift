import SwiftUI

struct HomeShellTopBarView: View {
    let titleKey: String
    let titleOverride: String?
    let showsBack: Bool
    let showsNotificationsAction: Bool
    let hasNotificationIndicator: Bool
    let showsCartAction: Bool
    let cartUnits: Int
    let showsCartBadge: Bool
    let onPrimaryAction: () -> Void
    let onNotificationsAction: () -> Void
    let onCartAction: () -> Void

    private var titleText: ReguertaHeaderText {
        if let titleOverride {
            return .verbatim(titleOverride)
        }
        return .localized(titleKey)
    }

    private var headerTitle: ReguertaHeaderText? {
        showsBack ? titleText : nil
    }

    private var leadingText: ReguertaHeaderText? {
        showsBack ? nil : titleText
    }

    private var leadingAction: ReguertaHeaderAction {
        ReguertaHeaderAction(
            systemImageName: showsBack ? "chevron.left" : "line.3.horizontal",
            accessibilityLabel: .localized(showsBack ? AccessL10nKey.commonBack : AccessL10nKey.homeShellMenu),
            accessibilityIdentifier: showsBack ? "home.topBar.backButton" : "home.topBar.menuButton",
            action: onPrimaryAction
        )
    }

    private var trailingAction: ReguertaHeaderAction? {
        if showsNotificationsAction {
            return ReguertaHeaderAction(
                systemImageName: "bell",
                accessibilityLabel: .localized(AccessL10nKey.homeShellNotifications),
                accessibilityIdentifier: "home.topBar.notificationsButton",
                badge: hasNotificationIndicator ? .dot : nil,
                action: onNotificationsAction
            )
        }

        if showsCartAction {
            return ReguertaHeaderAction(
                systemImageName: "cart",
                accessibilityLabel: .verbatim("Ver carrito"),
                accessibilityIdentifier: "home.topBar.cartButton",
                isEnabled: cartUnits > 0,
                badge: showsCartBadge && cartUnits > 0 ? .count(cartUnits) : nil,
                action: onCartAction
            )
        }

        return nil
    }

    private var headerViewModel: ReguertaScreenHeaderViewModel {
        ReguertaScreenHeaderViewModel(
            title: headerTitle,
            leadingAction: leadingAction,
            leadingText: leadingText,
            trailingAction: trailingAction
        )
    }

    var body: some View {
        ReguertaScreenHeaderView(viewModel: headerViewModel)
    }
}

struct HomeWeeklySummaryCardView: View {
    let tokens: ReguertaDesignTokens
    let display: HomeWeeklySummaryDisplay

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            HStack(alignment: .center) {
                Text(display.weekRangeLabel)
                    .font(tokens.typography.titleSection)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                Spacer(minLength: tokens.spacing.sm)
                Text(display.weekBadgeLabel)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.actionPrimary)
                    .padding(.horizontal, tokens.spacing.sm)
                    .padding(.vertical, tokens.spacing.xs)
                    .overlay(Capsule().stroke(tokens.colors.actionPrimary, lineWidth: 1))
            }

            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    summaryField(
                        titleKey: AccessL10nKey.homeDashboardProducer,
                        value: display.producerName
                    )
                    .frame(maxWidth: .infinity)
                    Divider()
                    summaryField(
                        titleKey: AccessL10nKey.homeDashboardDelivery,
                        value: display.deliveryLabel
                    )
                    .frame(width: 112.resize)
                }
                Divider()
                HStack(spacing: 0) {
                    summaryField(
                        titleKey: AccessL10nKey.homeDashboardResponsible,
                        value: display.responsibleName,
                        secondary: String(
                            format: NSLocalizedString(AccessL10nKey.homeDashboardHelperFormat, comment: ""),
                            display.helperName
                        )
                    )
                    .frame(maxWidth: .infinity)
                    Divider()
                    orderStatePill(display.orderState)
                        .frame(width: 112.resize)
                }
            }
            .frame(maxWidth: .infinity)
            .overlay(RoundedRectangle(cornerRadius: tokens.radius.md).stroke(tokens.colors.borderSubtle, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func summaryField(titleKey: String, value: String, secondary: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2.resize) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .lineLimit(1)
            Text(value)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
            if let secondary {
                Text(secondary)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
        .frame(minHeight: 66.resize, alignment: .center)
        .padding(.horizontal, tokens.spacing.md)
        .padding(.vertical, tokens.spacing.sm)
    }

    private func orderStatePill(_ state: HomeOrderStateDisplay) -> some View {
        let color = state.color(tokens: tokens)
        return VStack(alignment: .leading, spacing: 2.resize) {
            Text(localizedKey(AccessL10nKey.homeDashboardState))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
            Text(localizedKey(state.titleKey))
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(color)
                .lineLimit(2)
                .minimumScaleFactor(0.82)
        }
        .frame(minHeight: 66.resize, alignment: .center)
        .padding(.horizontal, tokens.spacing.md)
        .padding(.vertical, tokens.spacing.sm)
    }
}

struct HomeActionRowView: View {
    let tokens: ReguertaDesignTokens
    let myOrderFreshnessState: MyOrderFreshnessState
    let canOpenReceivedOrders: Bool
    let orderState: HomeOrderStateDisplay
    let myOrderSubtitleKey: String
    let onOpenMyOrder: () -> Void
    let onOpenReceivedOrders: () -> Void
    let onRetryFreshness: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            if #available(iOS 26.0, *) {
                GlassEffectContainer(spacing: tokens.spacing.sm) {
                    actionRowContent
                }
            } else {
                actionRowContent
            }

            switch myOrderFreshnessState {
            case .checking:
                Text(localizedKey(AccessL10nKey.myOrderFreshnessChecking))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            case .timedOut, .unavailable:
                reguertaButton(localizedKey(AccessL10nKey.myOrderFreshnessRetry), variant: .text, fullWidth: false) {
                    onRetryFreshness()
                }
            case .idle, .ready:
                EmptyView()
            }
        }
    }

    private var actionRowContent: some View {
        HStack(spacing: tokens.spacing.sm) {
            actionTile(
                titleKey: AccessL10nKey.myOrder,
                subtitleKey: myOrderSubtitleKey,
                primary: true,
                enabled: myOrderFreshnessState == .ready,
                action: onOpenMyOrder
            )
            if canOpenReceivedOrders {
                actionTile(
                    titleKey: AccessL10nKey.homeShellActionReceivedOrders,
                    subtitleKey: nil,
                    primary: false,
                    enabled: true,
                    action: onOpenReceivedOrders
                )
            }
        }
    }

    private func actionTile(
        titleKey: String,
        subtitleKey: String?,
        primary: Bool,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        let accessibilityIdentifier = titleKey == AccessL10nKey.myOrder
            ? "home.module.myOrder"
            : "home.module.receivedOrders"

        return Button(action: action) {
            VStack(alignment: .center, spacing: tokens.spacing.xs) {
                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(subtitleKey == nil ? 2 : 1)
                    .minimumScaleFactor(0.82)
                if let subtitleKey {
                    Text(localizedKey(subtitleKey))
                        .font(tokens.typography.label)
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 82.resize, alignment: .center)
            .padding(tokens.spacing.md)
            .foregroundStyle(primary ? tokens.colors.actionOnPrimary : tokens.colors.actionPrimary)
            .background(primary ? tokens.colors.actionPrimary.opacity(0.82) : tokens.colors.surfacePrimary.opacity(0.34))
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(primary ? Color.clear : tokens.colors.actionPrimary.opacity(0.82), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
            .homeActionTileGlass(tokens: tokens, primary: primary)
            .opacity(enabled ? 1 : 0.55)
        }
        .disabled(!enabled)
        .buttonStyle(.plain)
        .accessibilityIdentifier(accessibilityIdentifier)
    }
}

private extension View {
    @ViewBuilder
    func homeActionTileGlass(tokens: ReguertaDesignTokens, primary: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: tokens.radius.md)

        if #available(iOS 26.0, *) {
            self.glassEffect(
                .regular
                    .tint((primary ? tokens.colors.actionPrimary : tokens.colors.surfaceSecondary).opacity(0.22))
                    .interactive(true),
                in: shape
            )
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .shadow(color: .black.opacity(0.12), radius: 8.resize, y: 3.resize)
        }
    }
}

private extension HomeOrderStateDisplay {
    func color(tokens: ReguertaDesignTokens) -> Color {
        switch self {
        case .notStarted:
            return tokens.colors.feedbackError
        case .unconfirmed:
            return tokens.colors.feedbackWarning
        case .completed:
            return tokens.colors.actionPrimary
        }
    }
}
