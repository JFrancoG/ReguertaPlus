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
    let hidesTitle: Bool
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
        showsBack && !hidesTitle ? titleText : nil
    }

    private var leadingText: ReguertaHeaderText? {
        showsBack || hidesTitle ? nil : titleText
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

    private let compactColumnWidth: CGFloat = 96.resize

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
                summaryGridRow {
                    orderStateCell(display.orderState)
                } right: {
                    summaryPrimaryCell(
                        titleKey: AccessL10nKey.homeDashboardProducer,
                        value: display.producerName
                    )
                }
                Divider()
                summaryGridRow {
                    summaryPrimaryCell(
                        titleKey: AccessL10nKey.homeDashboardDelivery,
                        value: display.deliveryLabel
                    )
                } right: {
                    deliveryResponsiblesCell(
                        titleKey: AccessL10nKey.homeDashboardDeliveryResponsibles,
                        primary: display.responsibleName,
                        secondary: String(
                            format: NSLocalizedString(AccessL10nKey.homeDashboardHelperFormat, comment: ""),
                            display.helperName
                        )
                    )
                }
                Divider()
                summaryGridRow {
                    summaryPrimaryCell(
                        titleKey: AccessL10nKey.homeDashboardMarket,
                        value: display.marketLabel
                    )
                } right: {
                    marketResponsiblesCell(
                        titleKey: AccessL10nKey.homeDashboardMarketResponsibles,
                        names: display.marketResponsibleNames
                    )
                }
            }
            .frame(maxWidth: .infinity)
            .overlay(RoundedRectangle(cornerRadius: tokens.radius.md).stroke(tokens.colors.borderSubtle, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func summaryGridRow(
        @ViewBuilder left: () -> some View,
        @ViewBuilder right: () -> some View
    ) -> some View {
        HStack(spacing: 0) {
            left()
                .frame(width: compactColumnWidth)
            Divider()
            right()
                .frame(maxWidth: .infinity)
        }
    }

    private func summaryPrimaryCell(
        titleKey: String,
        value: String,
        valueColor: Color? = nil,
        maxValueLines: Int = 1
    ) -> some View {
        VStack(alignment: .center, spacing: 2.resize) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(1)
            Text(value)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(valueColor ?? tokens.colors.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(maxValueLines)
                .minimumScaleFactor(0.82)
                .truncationMode(.tail)
        }
        .frame(maxWidth: .infinity, minHeight: 56.resize, alignment: .center)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.vertical, tokens.spacing.xs)
    }

    private func deliveryResponsiblesCell(titleKey: String, primary: String, secondary: String) -> some View {
        VStack(alignment: .center, spacing: 2.resize) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(1)
            Text(primary)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(1)
                .truncationMode(.tail)
            Text(secondary)
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .frame(maxWidth: .infinity, minHeight: 56.resize, alignment: .center)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.vertical, tokens.spacing.xs)
    }

    private func marketResponsiblesCell(titleKey: String, names: [String]) -> some View {
        VStack(alignment: .center, spacing: 1.resize) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(1)
            ForEach(Array(names.prefix(3).enumerated()), id: \.offset) { _, name in
                Text(name)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 56.resize, alignment: .center)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.vertical, tokens.spacing.xs)
    }

    private func orderStateCell(_ state: HomeOrderStateDisplay) -> some View {
        summaryPrimaryCell(
            titleKey: AccessL10nKey.homeDashboardState,
            value: NSLocalizedString(state.titleKey, comment: ""),
            valueColor: state.color(tokens: tokens),
            maxValueLines: 2
        )
    }
}

struct HomeActionRowView: View {
    @Environment(\.colorScheme) private var colorScheme

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
                    .foregroundStyle(primary ? tokens.colors.actionPrimary : tokens.colors.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineLimit(subtitleKey == nil ? 2 : 1)
                    .minimumScaleFactor(0.82)
                if let subtitleKey {
                    Text(localizedKey(subtitleKey))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 82.resize, alignment: .center)
            .padding(tokens.spacing.md)
            .contentShape(RoundedRectangle(cornerRadius: tokens.radius.md))
            .homeActionTileGlass(
                tokens: tokens,
                primary: primary,
                enabled: enabled,
                colorScheme: colorScheme
            )
            .opacity(enabled ? 1 : 0.55)
        }
        .disabled(!enabled)
        .buttonStyle(.plain)
        .accessibilityIdentifier(accessibilityIdentifier)
    }
}

private extension View {
    @ViewBuilder
    func homeActionTileGlass(
        tokens: ReguertaDesignTokens,
        primary: Bool,
        enabled: Bool,
        colorScheme: ColorScheme
    ) -> some View {
        let shape = RoundedRectangle(cornerRadius: tokens.radius.md)
        let isDarkMode = colorScheme == .dark
        let neutralTint = isDarkMode ? Color.black.opacity(0.32) : Color.white.opacity(0.40)
        let primaryTint = tokens.colors.actionPrimary.opacity(isDarkMode ? 0.26 : 0.20)
        let tint = primary ? primaryTint : neutralTint

        if #available(iOS 26.0, *) {
            self.glassEffect(
                .regular
                    .tint(tint)
                    .interactive(enabled),
                in: shape
            )
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .background(tint, in: shape)
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
