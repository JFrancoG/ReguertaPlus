import SwiftUI

struct HomeShellTopBarView: View {
    let tokens: ReguertaDesignTokens
    let titleKey: String
    let titleOverride: String?
    let showsBack: Bool
    let hasNotificationIndicator: Bool
    let onPrimaryAction: () -> Void
    let onNotificationsAction: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        HStack {
            Button(action: onPrimaryAction) {
                Image(systemName: showsBack ? "chevron.left" : "line.3.horizontal")
                    .font(.system(size: 22.resize, weight: .semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                    .frame(width: 44.resize, height: 44.resize)
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())

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

            ZStack(alignment: .topTrailing) {
                Button(action: onNotificationsAction) {
                    Image(systemName: "bell")
                        .font(.system(size: 20.resize, weight: .semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(width: 44.resize, height: 44.resize)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(localizedKey(AccessL10nKey.homeShellNotifications))

                if hasNotificationIndicator {
                    Circle()
                        .fill(tokens.colors.feedbackError)
                        .frame(width: 9.resize, height: 9.resize)
                        .padding(.top, 9.resize)
                        .padding(.trailing, 9.resize)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 52.resize)
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

            HStack(spacing: tokens.spacing.sm) {
                summaryField(
                    titleKey: AccessL10nKey.homeDashboardProducer,
                    value: display.producerName
                )
                .frame(maxWidth: .infinity)
                summaryField(
                    titleKey: AccessL10nKey.homeDashboardDelivery,
                    value: display.deliveryLabel
                )
                .frame(width: 104.resize)
            }

            HStack(spacing: tokens.spacing.sm) {
                summaryField(
                    titleKey: AccessL10nKey.homeDashboardResponsible,
                    value: display.responsibleName,
                    secondary: String(
                        format: NSLocalizedString(AccessL10nKey.homeDashboardHelperFormat, comment: ""),
                        display.helperName
                    )
                )
                .frame(maxWidth: .infinity)
                orderStatePill(display.orderState)
                    .frame(width: 104.resize)
            }
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
        .overlay(RoundedRectangle(cornerRadius: tokens.radius.sm).stroke(tokens.colors.borderSubtle, lineWidth: 1))
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
        .overlay(RoundedRectangle(cornerRadius: tokens.radius.sm).stroke(color, lineWidth: 1))
    }
}

struct HomeActionRowView: View {
    let tokens: ReguertaDesignTokens
    let myOrderFreshnessState: MyOrderFreshnessState
    let canOpenReceivedOrders: Bool
    let orderState: HomeOrderStateDisplay
    let onOpenMyOrder: () -> Void
    let onOpenReceivedOrders: () -> Void
    let onRetryFreshness: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            HStack(spacing: tokens.spacing.sm) {
                actionTile(
                    titleKey: AccessL10nKey.myOrder,
                    subtitleKey: orderState.myOrderSubtitleKey,
                    primary: true,
                    enabled: myOrderFreshnessState == .ready,
                    action: onOpenMyOrder
                )
                if canOpenReceivedOrders {
                    actionTile(
                        titleKey: AccessL10nKey.homeShellActionReceivedOrders,
                        subtitleKey: AccessL10nKey.homeDashboardReceivedOrdersSubtitle,
                        primary: false,
                        enabled: true,
                        action: onOpenReceivedOrders
                    )
                }
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

    private func actionTile(
        titleKey: String,
        subtitleKey: String,
        primary: Bool,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        let accessibilityIdentifier = titleKey == AccessL10nKey.myOrder
            ? "home.module.myOrder"
            : "home.module.receivedOrders"

        return Button(action: action) {
            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
                Text(localizedKey(subtitleKey))
                    .font(tokens.typography.label)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 82.resize, alignment: .leading)
            .padding(tokens.spacing.md)
            .foregroundStyle(primary ? tokens.colors.actionOnPrimary : tokens.colors.actionPrimary)
            .background(primary ? tokens.colors.actionPrimary : tokens.colors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(primary ? Color.clear : tokens.colors.actionPrimary, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
            .opacity(enabled ? 1 : 0.55)
        }
        .disabled(!enabled)
        .buttonStyle(.plain)
        .accessibilityIdentifier(accessibilityIdentifier)
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
    let onViewAll: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.homeShellNewsTitle))
                    .font(tokens.typography.titleCard)
                if latestNews.isEmpty {
                    Text(localizedKey(AccessL10nKey.newsEmptyState))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                } else {
                    ForEach(latestNews) { article in
                        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                            Text(article.title)
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.textPrimary)
                            Text(article.body)
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                                .lineLimit(3)
                        }
                    }
                }
                ReguertaButton(localizedKey(AccessL10nKey.newsViewAll), variant: .text, action: onViewAll)
            }
        }
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

struct HomeDrawerContentView: View {
    let tokens: ReguertaDesignTokens
    let currentMember: Member?
    let sharedProfile: SharedProfile?
    let currentDestination: HomeDestination
    let installedVersion: String
    let isDevelopBuild: Bool
    let onNavigate: (HomeDestination) -> Void
    let onCloseDrawer: () -> Void
    let onSignOut: () -> Void

    private var canManageProductCatalog: Bool {
        guard let currentMember else { return false }
        return currentMember.canManageProductCatalog
    }

    private var isProducer: Bool {
        currentMember?.canAccessReceivedOrders == true
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    private func l10n(_ key: String, _ argument: String) -> LocalizedStringKey {
        LocalizedStringKey("\(key) \(argument)")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            homeDrawerHeader

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    homeDrawerProfile
                    homeDrawerNavigationSections
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Divider()

            homeDrawerFooter
        }
    }

    private var homeDrawerHeader: some View {
        HStack {
            Button(action: onCloseDrawer) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 20.resize, weight: .semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                    .frame(width: 36.resize, height: 36.resize)
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())
            Spacer()
        }
    }

    @ViewBuilder
    private var homeDrawerProfile: some View {
        VStack(spacing: tokens.spacing.md) {
            homeDrawerAvatar

            if let currentMember {
                Text(sharedProfile?.familyNames.isEmpty == false ? sharedProfile!.familyNames : currentMember.displayName)
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                Text(currentMember.normalizedEmail)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, tokens.spacing.sm)
    }

    @ViewBuilder
    private var homeDrawerAvatar: some View {
        if let rawUrl = sharedProfile?.photoUrl, let url = URL(string: rawUrl), rawUrl.isEmpty == false {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                Image("brand_logo")
                    .resizable()
                    .scaledToFit()
                    .padding(tokens.spacing.sm)
            }
            .frame(width: 76.resize, height: 76.resize)
            .clipShape(Circle())
            .overlay(Circle().stroke(tokens.colors.actionPrimary.opacity(0.36), lineWidth: 1))
            .accessibilityLabel(localizedKey(AccessL10nKey.homeShellProfilePlaceholder))
        } else {
            Image("brand_logo")
                .resizable()
                .scaledToFit()
                .padding(tokens.spacing.sm)
                .frame(width: 76.resize, height: 76.resize)
                .background(tokens.colors.actionPrimary.opacity(0.14))
                .clipShape(Circle())
                .overlay(Circle().stroke(tokens.colors.actionPrimary.opacity(0.36), lineWidth: 1))
                .accessibilityLabel(localizedKey(AccessL10nKey.homeShellProfilePlaceholder))
        }
    }

    @ViewBuilder
    private var homeDrawerNavigationSections: some View {
        homeDrawerItem("house.fill", titleKey: AccessL10nKey.homeTitle, destination: .dashboard)
        homeDrawerItem("cart.fill", titleKey: AccessL10nKey.myOrder, destination: .myOrder)
        homeDrawerItem("doc.text.fill", titleKey: AccessL10nKey.myOrders, destination: .myOrders)
        homeDrawerItem("calendar", titleKey: AccessL10nKey.shifts, destination: .shifts)
        homeDrawerItem("doc.text.magnifyingglass", titleKey: AccessL10nKey.homeShellActionBylaws, destination: .bylaws)
        homeDrawerItem("newspaper.fill", titleKey: AccessL10nKey.homeShellNewsTitle, destination: .news)
        homeDrawerItem("bell", titleKey: AccessL10nKey.homeShellNotifications, destination: .notifications)
        homeDrawerItem("person.3.fill", titleKey: AccessL10nKey.homeShellActionProfile, destination: .profile)
        homeDrawerItem("gearshape.fill", titleKey: AccessL10nKey.homeShellActionSettings, destination: .settings)

        if canManageProductCatalog || isProducer {
            drawerDivider
        }
        if canManageProductCatalog {
            homeDrawerItem("shippingbox.fill", titleKey: AccessL10nKey.homeShellActionProducts, destination: .products)
        }
        if isProducer {
            homeDrawerItem("tray.full.fill", titleKey: AccessL10nKey.homeShellActionReceivedOrders, destination: .receivedOrders)
        }

        if currentMember?.canManageMembers == true ||
            currentMember?.canPublishNews == true ||
            currentMember?.canSendAdminNotifications == true {
            drawerDivider
            if currentMember?.canManageMembers == true {
                homeDrawerItem("person.3.fill", titleKey: AccessL10nKey.homeShellActionUsers, destination: .users)
            }
            if currentMember?.canPublishNews == true {
                homeDrawerItem("plus.square.fill", titleKey: AccessL10nKey.homeShellActionPublishNews, destination: .publishNews)
            }
            if currentMember?.canSendAdminNotifications == true {
                homeDrawerItem("megaphone.fill", titleKey: AccessL10nKey.homeShellActionAdminBroadcast, destination: .adminBroadcast)
            }
        }
    }

    private var homeDrawerFooter: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Button(action: onSignOut) {
                HStack(spacing: tokens.spacing.md) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 18.resize, weight: .semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
                        .frame(width: 24.resize)
                    Text(localizedKey(AccessL10nKey.signOut))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textPrimary)
                    Spacer(minLength: tokens.spacing.sm)
                }
                .padding(.vertical, tokens.spacing.xs + 2)
                .padding(.horizontal, tokens.spacing.sm)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("home.drawer.signOutButton")

            HStack(spacing: tokens.spacing.sm) {
                Text(l10n(AccessL10nKey.homeShellVersionIOS, installedVersion))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                if isDevelopBuild {
                    Text(localizedKey(AccessL10nKey.homeShellDevMarker))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionOnPrimary)
                        .padding(.horizontal, tokens.spacing.sm)
                        .padding(.vertical, 2.resize)
                        .background(tokens.colors.feedbackWarning)
                        .clipShape(Capsule())
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    private var drawerDivider: some View {
        Divider()
            .overlay(tokens.colors.borderSubtle.opacity(0.55))
            .padding(.vertical, tokens.spacing.xs)
    }

    private func homeDrawerItem(
        _ systemImage: String,
        titleKey: String,
        destination: HomeDestination
    ) -> some View {
        HStack(spacing: tokens.spacing.md) {
            Image(systemName: systemImage)
                .font(.system(size: 18.resize, weight: .semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .frame(width: 24.resize)
            Text(localizedKey(titleKey))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
            Spacer(minLength: tokens.spacing.sm)
        }
        .padding(.vertical, tokens.spacing.xs + 2)
        .padding(.horizontal, tokens.spacing.sm)
        .background(
            currentDestination == destination
            ? tokens.colors.actionPrimary.opacity(0.10)
            : Color.clear
        )
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
        .contentShape(Rectangle())
        .onTapGesture {
            onNavigate(destination)
        }
    }
}
