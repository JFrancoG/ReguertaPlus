import SwiftUI

struct HomeShellTopBarView: View {
    let tokens: ReguertaDesignTokens
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

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: tokens.spacing.xl) {
                topBarContent
            }
        } else {
            topBarContent
        }
    }

    private var topBarContent: some View {
        HStack {
            HomeShellGlassIconButton(
                tokens: tokens,
                systemName: showsBack ? "chevron.left" : "line.3.horizontal",
                fontSize: showsBack ? 21.resize : 23.resize,
                action: onPrimaryAction
            )
            .accessibilityIdentifier(showsBack ? "home.topBar.backButton" : "home.topBar.menuButton")

            Spacer()

            if let titleOverride {
                Text(titleOverride)
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                    .accessibilityIdentifier("home.topBar.title")
            } else {
                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                    .accessibilityIdentifier("home.topBar.title")
            }

            Spacer()

            if showsNotificationsAction {
                ZStack(alignment: .topTrailing) {
                    HomeShellGlassIconButton(
                        tokens: tokens,
                        systemName: "bell",
                        fontSize: 21.resize,
                        action: onNotificationsAction
                    )
                    .accessibilityLabel(localizedKey(AccessL10nKey.homeShellNotifications))

                    if hasNotificationIndicator {
                        Circle()
                            .fill(tokens.colors.feedbackError)
                            .frame(width: 9.resize, height: 9.resize)
                            .padding(.top, 12.resize)
                            .padding(.trailing, 12.resize)
                    }
                }
            } else if showsCartAction {
                HomeShellCartButton(
                    tokens: tokens,
                    units: cartUnits,
                    showsBadge: showsCartBadge,
                    action: onCartAction
                )
            } else {
                Color.clear
                    .frame(width: 58.resize, height: 58.resize)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 62.resize)
    }
}

private struct HomeShellCartButton: View {
    let tokens: ReguertaDesignTokens
    let units: Int
    let showsBadge: Bool
    let action: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Button(action: action) {
                Image(systemName: "cart")
                    .font(.system(size: 21.resize, weight: .semibold))
                    .foregroundStyle(units > 0 ? tokens.colors.textPrimary : tokens.colors.textSecondary)
                    .frame(width: 58.resize, height: 58.resize)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(units == 0)
            .homeShellGlassButton(tokens: tokens)
            .opacity(units > 0 ? 1 : 0.72)
            .accessibilityLabel("Ver carrito")

            if showsBadge && units > 0 {
                Text("\(min(units, 99))")
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.actionOnPrimary)
                    .frame(width: 18.resize, height: 18.resize)
                    .background(tokens.colors.feedbackError, in: Circle())
                    .overlay(Circle().stroke(tokens.colors.surfacePrimary, lineWidth: 1.5.resize))
                    .padding(.top, 5.resize)
                    .padding(.trailing, 5.resize)
                    .zIndex(1)
            }
        }
    }
}

private struct HomeShellGlassIconButton: View {
    let tokens: ReguertaDesignTokens
    let systemName: String
    let fontSize: CGFloat
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: fontSize, weight: .semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(width: 58.resize, height: 58.resize)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .homeShellGlassButton(tokens: tokens)
    }
}

private extension View {
    @ViewBuilder
    func homeShellGlassButton(tokens: ReguertaDesignTokens) -> some View {
        let shape = Circle()

        if #available(iOS 26.0, *) {
            self.glassEffect(
                .regular
                    .tint(tokens.colors.surfaceSecondary.opacity(0.18))
                    .interactive(true),
                in: shape
            )
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .overlay(
                    shape.stroke(tokens.colors.borderSubtle.opacity(0.42), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.18), radius: 10.resize, y: 4.resize)
        }
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
                ReguertaButton(localizedKey(AccessL10nKey.myOrderFreshnessRetry), variant: .text, fullWidth: false) {
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
