import SwiftUI

private enum HomeDashboardLayout {
    static let compactColumnWidth: CGFloat = 96
    static let summaryRowMinimumHeight: CGFloat = 56
    static let actionMinimumHeight: CGFloat = 82
}

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
                accessibilityLabel: .localized(AccessL10nKey.myOrderCartViewAction),
                accessibilityIdentifier: "home.topBar.cartButton",
                isEnabled: cartUnits > 0,
                badge: showsCartBadge && cartUnits > 0 ? .count(cartUnits) : nil,
                action: onCartAction
            )
        }

        return nil
    }

    private var headerConfiguration: ReguertaScreenHeaderConfiguration {
        ReguertaScreenHeaderConfiguration(
            title: headerTitle,
            leadingAction: leadingAction,
            leadingText: leadingText,
            trailingAction: trailingAction
        )
    }

    var body: some View {
        ReguertaScreenHeaderView(configuration: headerConfiguration)
    }
}

struct HomeWeeklySummaryCardView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let tokens: ReguertaDesignTokens
    let display: HomeWeeklySummaryDisplay
    let accessibilityFocus: AccessibilityFocusState<Bool>.Binding
    let onAccessibilityTargetVisibilityChange: (Bool) -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey { LocalizedStringKey(key) }

    var body: some View {
        let headerLayout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: tokens.spacing.sm))
            : AnyLayout(HStackLayout(alignment: .center, spacing: tokens.spacing.sm))

        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            headerLayout {
                Text(display.weekRangeLabel)
                    .font(tokens.typography.titleSection)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                    .minimumScaleFactor(0.78)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(Text(display.weekRangeAccessibilityLabel))
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused(accessibilityFocus)
                    .onAppear {
                        onAccessibilityTargetVisibilityChange(true)
                    }
                    .onDisappear {
                        onAccessibilityTargetVisibilityChange(false)
                    }
                if !dynamicTypeSize.isAccessibilitySize {
                    Spacer(minLength: 0)
                }
                Text(display.weekBadgeLabel)
                    .font(tokens.typography.labelRegular)
                    .foregroundStyle(tokens.colors.actionPrimary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                    .fixedSize(horizontal: false, vertical: true)
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
            .background(tokens.colors.surfaceSecondary, in: RoundedRectangle(cornerRadius: tokens.radius.md))
            .overlay(RoundedRectangle(cornerRadius: tokens.radius.md).stroke(tokens.colors.borderSubtle, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func summaryGridRow(
        @ViewBuilder left: () -> some View,
        @ViewBuilder right: () -> some View
    ) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: 0) {
                left()
                    .frame(maxWidth: .infinity)
                Divider()
                right()
                    .frame(maxWidth: .infinity)
            }
        } else {
            HStack(spacing: 0) {
                left()
                    .frame(width: HomeDashboardLayout.compactColumnWidth)
                Divider()
                right()
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private func summaryPrimaryCell(
        titleKey: String,
        value: String,
        valueColor: Color? = nil,
        maxValueLines: Int = 1
    ) -> some View {
        VStack(alignment: .center, spacing: tokens.spacing.xs / 2) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
            Text(value)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(valueColor ?? tokens.colors.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : maxValueLines)
                .minimumScaleFactor(0.82)
                .truncationMode(.tail)
        }
        .frame(maxWidth: .infinity, minHeight: HomeDashboardLayout.summaryRowMinimumHeight, alignment: .center)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.vertical, tokens.spacing.xs)
        .accessibilityElement(children: .combine)
    }

    private func deliveryResponsiblesCell(titleKey: String, primary: String, secondary: String) -> some View {
        VStack(alignment: .center, spacing: tokens.spacing.xs / 2) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
            Text(primary)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                .truncationMode(.tail)
            Text(secondary)
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                .truncationMode(.tail)
        }
        .frame(maxWidth: .infinity, minHeight: HomeDashboardLayout.summaryRowMinimumHeight, alignment: .center)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.vertical, tokens.spacing.xs)
        .accessibilityElement(children: .combine)
    }

    private func marketResponsiblesCell(titleKey: String, names: [String]) -> some View {
        VStack(alignment: .center, spacing: tokens.spacing.xs / 4) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
            ForEach(Array(names.prefix(3).enumerated()), id: \.offset) { _, name in
                Text(name)
                    .font(tokens.typography.labelRegular)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                    .truncationMode(.tail)
            }
        }
        .frame(maxWidth: .infinity, minHeight: HomeDashboardLayout.summaryRowMinimumHeight, alignment: .center)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.vertical, tokens.spacing.sm)
        .accessibilityElement(children: .combine)
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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let tokens: ReguertaDesignTokens
    let presentation: HomeActionRowPresentation
    let onOpenMyOrder: () -> Void
    let onOpenReceivedOrders: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey { LocalizedStringKey(key) }

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: tokens.spacing.sm) {
                actionRowContent
            }
        } else {
            actionRowContent
        }
    }

    private var actionRowContent: some View {
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: tokens.spacing.sm))
            : AnyLayout(HStackLayout(spacing: tokens.spacing.sm))
        let panelShape = RoundedRectangle(cornerRadius: tokens.radius.lg)

        return layout {
            actionTile(
                titleKey: AccessL10nKey.myOrder,
                subtitleKey: presentation.myOrderSubtitleKey,
                primary: true,
                enabled: presentation.isMyOrderEnabled,
                action: onOpenMyOrder
            )
            if presentation.canOpenReceivedOrders {
                actionTile(
                    titleKey: AccessL10nKey.homeShellActionReceivedOrders,
                    subtitleKey: nil,
                    primary: false,
                    enabled: true,
                    action: onOpenReceivedOrders
                )
            }
        }
        .padding(tokens.spacing.sm)
        .background(tokens.colors.surfaceSecondary, in: panelShape)
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
            .frame(maxWidth: .infinity, minHeight: HomeDashboardLayout.actionMinimumHeight, alignment: .center)
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

#Preview("Home actions AX5", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let presentation = HomeActionRowPresentation(
        myOrderFreshnessState: .ready,
        canOpenReceivedOrders: true,
        orderState: .unconfirmed,
        myOrderSubtitleKey: AccessL10nKey.homeDashboardMyOrderSubtitleReview
    )

    HomeActionRowView(
        tokens: .light,
        presentation: presentation,
        onOpenMyOrder: {},
        onOpenReceivedOrders: {}
    )
    .environment(\.dynamicTypeSize, .accessibility5)
    .frame(width: 320)
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
        let primaryTint = tokens.colors.actionPrimary.opacity(
            ReguertaContrastContract.maximumActionTintOpacity
        )
        let tint = primary ? primaryTint : neutralTint

        if #available(iOS 26.0, *) {
            self
                .background(tokens.colors.surfacePrimary, in: shape)
                .glassEffect(
                    .regular
                        .tint(tint)
                        .interactive(enabled),
                    in: shape
                )
        } else {
            self
                .background(tint, in: shape)
                .background(tokens.colors.surfacePrimary, in: shape)
        }
    }
}

private extension HomeOrderStateDisplay {
    func color(tokens: ReguertaDesignTokens) -> Color {
        switch self {
        case .consultation:
            return tokens.colors.textPrimary
        case .notStarted:
            return tokens.colors.feedbackError
        case .unconfirmed:
            return tokens.colors.feedbackWarning
        case .completed:
            return tokens.colors.actionPrimary
        }
    }
}
