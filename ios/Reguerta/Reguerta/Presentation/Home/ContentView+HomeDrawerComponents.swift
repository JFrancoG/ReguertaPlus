import SwiftUI

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

    private var homeDrawerVersionText: String {
        let version = l10n(AccessL10nKey.homeShellVersion, installedVersion).lowercased()
        return isDevelopBuild ? "\(version) dev" : version
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            homeDrawerHeader
                .padding(.bottom, tokens.spacing.xs)

            homeDrawerProfile
                .padding(.bottom, tokens.spacing.sm)

            Divider()
                .overlay(tokens.colors.borderSubtle.opacity(0.55))

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    homeDrawerNavigationSections
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, tokens.spacing.sm)
            }

            Divider()
                .overlay(tokens.colors.borderSubtle.opacity(0.55))

            homeDrawerFooter
                .padding(.top, tokens.spacing.sm)
        }
    }

    private var homeDrawerHeader: some View {
        HStack {
            ReguertaGlassIconButton(
                iconAction: ReguertaHeaderAction(
                    systemImageName: "chevron.left",
                    accessibilityLabel: .localized(AccessL10nKey.commonClose),
                    accessibilityIdentifier: "home.drawer.closeButton",
                    action: onCloseDrawer
                )
            )
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
        homeDrawerItem("doc.text.fill", titleKey: AccessL10nKey.myOrders, destination: .myOrders)
        homeDrawerItem("calendar", titleKey: AccessL10nKey.shifts, destination: .shifts)
        homeDrawerItem("doc.text.magnifyingglass", titleKey: AccessL10nKey.homeShellActionBylaws, destination: .bylaws)
        homeDrawerItem("newspaper.fill", titleKey: AccessL10nKey.homeShellActionNews, destination: .news)
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

            Text(homeDrawerVersionText)
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
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
        Button {
            onNavigate(destination)
        } label: {
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
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("home.drawer.item.\(destination.rawValue)")
    }
}
