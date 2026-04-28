import SwiftUI

struct HomeShellTopBarView: View {
    let tokens: ReguertaDesignTokens
    let titleKey: String
    let showsBack: Bool
    let onPrimaryAction: () -> Void
    let onNotificationsAction: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        ReguertaCard {
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

                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)

                Spacer()

                Button(action: onNotificationsAction) {
                    Image(systemName: "bell")
                        .font(.system(size: 20.resize, weight: .semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(width: 44.resize, height: 44.resize)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(localizedKey(AccessL10nKey.homeShellNotifications))
            }
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
    let currentDestination: HomeDestination
    let installedVersion: String
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
            Circle()
                .fill(tokens.colors.actionPrimary.opacity(0.14))
                .frame(width: 76.resize, height: 76.resize)
                .overlay {
                    Image(systemName: "person.fill")
                        .font(.system(size: 30.resize, weight: .semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
                }

            if let currentMember {
                Text(currentMember.displayName)
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .multilineTextAlignment(.center)
                Text(currentMember.normalizedEmail)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, tokens.spacing.sm)
    }

    @ViewBuilder
    private var homeDrawerNavigationSections: some View {
        drawerSection(titleKey: AccessL10nKey.homeShellSectionCommon)
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
            drawerSection(titleKey: AccessL10nKey.homeShellSectionProducer)
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
            drawerSection(titleKey: AccessL10nKey.homeShellSectionAdmin)
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
            ReguertaButton(
                localizedKey(AccessL10nKey.signOut),
                accessibilityIdentifier: "home.drawer.signOutButton",
                action: onSignOut
            )
                .padding(.top, tokens.spacing.xs)

            Text(l10n(AccessL10nKey.homeShellVersion, installedVersion))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func drawerSection(titleKey: String) -> some View {
        Text(localizedKey(titleKey))
            .font(tokens.typography.label)
            .foregroundStyle(tokens.colors.actionPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, tokens.spacing.xs)
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
