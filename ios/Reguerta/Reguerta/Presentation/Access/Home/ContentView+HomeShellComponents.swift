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

            Spacer()

            if let titleOverride {
                Text(titleOverride)
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            } else {
                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
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

            if units > 0 {
                Text("\(min(units, 99))")
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.actionOnPrimary)
                    .frame(width: 20.resize, height: 20.resize)
                    .background(tokens.colors.feedbackError, in: Circle())
                    .padding(.top, 7.resize)
                    .padding(.trailing, 7.resize)
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

struct NextShiftsCardView: View {
    let tokens: ReguertaDesignTokens
    let isLoading: Bool
    let nextDeliverySummary: String
    let nextMarketSummary: String
    let onViewAll: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.shiftsNextTitle))
                    .font(tokens.typography.titleCard)
                Text(localizedKey(AccessL10nKey.shiftsNextSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                if isLoading {
                    Text(localizedKey(AccessL10nKey.shiftsLoading))
                        .font(tokens.typography.bodySecondary)
                } else {
                    summaryRow(titleKey: AccessL10nKey.shiftsNextDelivery, value: nextDeliverySummary)
                    summaryRow(titleKey: AccessL10nKey.shiftsNextMarket, value: nextMarketSummary)
                }
                ReguertaButton(localizedKey(AccessL10nKey.shiftsViewAll), variant: .text, action: onViewAll)
            }
        }
    }

    private func summaryRow(titleKey: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
            Spacer(minLength: tokens.spacing.md)
            Text(value)
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }
}

struct LatestNewsCardView: View {
    let tokens: ReguertaDesignTokens
    let latestNews: [NewsArticle]

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(localizedKey(AccessL10nKey.homeShellNewsTitle))
                .font(tokens.typography.titleSection)
                .frame(maxWidth: .infinity, alignment: .center)
            if latestNews.isEmpty {
                Text(localizedKey(AccessL10nKey.newsEmptyState))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else {
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: tokens.spacing.sm) {
                        ForEach(latestNews.indices, id: \.self) { index in
                            let article = latestNews[index]
                            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                                Text(article.title)
                                    .font(tokens.typography.body.weight(.semibold))
                                    .foregroundStyle(tokens.colors.textPrimary)
                                Text(article.body)
                                    .font(tokens.typography.bodySecondary)
                                    .foregroundStyle(tokens.colors.textSecondary)
                                    .lineLimit(3)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            if index < latestNews.count - 1 {
                                Divider()
                                    .background(tokens.colors.borderSubtle.opacity(0.65))
                            }
                        }
                    }
                }
                .scrollBounceBehavior(.basedOnSize)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct OperationalModulesCardView: View {
    let tokens: ReguertaDesignTokens
    let modulesEnabled: Bool
    let canOpenProducts: Bool
    let myOrderFreshnessState: MyOrderFreshnessState
    let disabledMessageKey: String?
    let onOpenMyOrder: () -> Void
    let onOpenProducts: () -> Void
    let onOpenShifts: () -> Void
    let onOpenBylaws: () -> Void
    let onRetryFreshness: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.operationalModulesTitle))
                    .font(tokens.typography.titleCard)
                Button(action: onOpenMyOrder) {
                    Text(localizedKey(AccessL10nKey.myOrder))
                }
                .accessibilityIdentifier("home.module.myOrder")
                .disabled(!modulesEnabled || myOrderFreshnessState != .ready)
                Button(action: onOpenProducts) {
                    Text(localizedKey(AccessL10nKey.catalog))
                }
                .accessibilityIdentifier("home.module.catalog")
                .disabled(!modulesEnabled || !canOpenProducts)
                Button(action: onOpenShifts) {
                    Text(localizedKey(AccessL10nKey.shifts))
                }
                .accessibilityIdentifier("home.module.shifts")
                .disabled(!modulesEnabled)
                Button(action: onOpenBylaws) {
                    Text(localizedKey(AccessL10nKey.homeShellActionBylaws))
                }
                .accessibilityIdentifier("home.module.bylaws")
                .disabled(!modulesEnabled)

                if !modulesEnabled, let disabledMessageKey {
                    Text(localizedKey(disabledMessageKey))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                }

                switch myOrderFreshnessState {
                case .checking:
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessChecking))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                case .timedOut, .unavailable:
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessErrorTitle))
                        .font(tokens.typography.bodySecondary.weight(.semibold))
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessErrorMessage))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    Button(action: onRetryFreshness) {
                        Text(localizedKey(AccessL10nKey.myOrderFreshnessRetry))
                    }
                case .idle, .ready:
                    EmptyView()
                }
            }
        }
    }
}
