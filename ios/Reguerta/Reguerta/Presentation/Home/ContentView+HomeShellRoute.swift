import SwiftUI

private enum HomeSignOutDialogL10n {
    static let confirm = "common.action.confirm"
    static let message = "access.action.sign_out.confirm.message"
}

extension HomeShellView {
    @ViewBuilder
    var homeRoute: some View {
        GeometryReader { proxy in
            homeRoute(containerWidth: proxy.size.width)
        }
    }

    @ViewBuilder
    private func homeRoute(containerWidth: CGFloat) -> some View {
        let drawerWidth = HomeShellLayoutContract.drawerWidth(
            containerWidth: containerWidth,
            minimumEdgeReveal: tokens.layout.minimumTouchTarget
        )

        ZStack(alignment: .topLeading) {
            homeDrawerPanel(drawerWidth: drawerWidth)
                .zIndex(1)
            homeScaffold(drawerWidth: drawerWidth)
        }
    }

    private func homeScaffold(drawerWidth: CGFloat) -> some View {
        ReguertaScreenScaffold(
            contentWidth: tokens.layout.readableContentMaximumWidth,
            headerConfiguration: rootViewModel.homeShellHeaderConfiguration,
            headerHorizontalPadding: homeShellTopBarHorizontalPadding,
            headerContentSpacing: homeShellRouteSpacing
        ) {
            homeRouteContent
                .frame(maxHeight: .infinity, alignment: .topLeading)
        }
        .disabled(rootViewModel.isHomeDrawerPresented)
        .overlay(alignment: .topLeading) {
            if rootViewModel.isHomeDrawerPresented {
                homeDrawerHomeScrim(drawerWidth: drawerWidth)
            }
        }
        .overlay {
            homeCheckoutDialogOverlay
        }
        .overlay {
            homePushNotificationPermissionDialogOverlay
        }
        .overlay {
            homeSharedProfileSavedDialogOverlay
        }
        .overlay {
            homeSignOutConfirmationDialogOverlay
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .offset(x: rootViewModel.homeLayerOffset(drawerWidth: drawerWidth))
        .zIndex(2)
        .simultaneousGesture(openHomeDrawerDragGesture(drawerWidth: drawerWidth))
        .animation(homeDrawerAnimation, value: rootViewModel.isHomeDrawerOpen)
        .animation(
            homeDrawerDragAnimation,
            value: rootViewModel.homeDrawerDragOffset
        )
    }

    private var homeShellRouteSpacing: CGFloat {
        if rootViewModel.isMyOrderCartOverlayVisible {
            return 0
        }
        if rootViewModel.homeDestination == .myOrder {
            return tokens.spacing.lg + tokens.spacing.xs / 2
        }
        return tokens.spacing.md
    }

    private var homeShellTopBarHorizontalPadding: CGFloat {
        rootViewModel.homeDestination == .myOrder ? tokens.spacing.sm : 0
    }

    @ViewBuilder
    var homeSharedProfileSavedDialogOverlay: some View {
        if rootViewModel.showsSharedProfileSavedDialog {
            reguertaDialog(
                type: .info,
                title: l10n(AccessL10nKey.profileSharedSavedDialogTitle),
                message: l10n(AccessL10nKey.profileSharedSavedDialogMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.commonAccept),
                    action: rootViewModel.dismissSharedProfileSavedDialog
                ),
                onDismiss: rootViewModel.dismissSharedProfileSavedDialog
            )
        }
    }

    @ViewBuilder
    var homeSignOutConfirmationDialogOverlay: some View {
        if rootViewModel.showsHomeSignOutDialog {
            reguertaDialog(
                type: .info,
                title: l10n(AccessL10nKey.signOut),
                message: l10n(HomeSignOutDialogL10n.message),
                primaryAction: ReguertaDialogAction(
                    title: l10n(HomeSignOutDialogL10n.confirm),
                    action: rootViewModel.confirmHomeDrawerSignOut
                ),
                secondaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.commonBack),
                    action: rootViewModel.dismissHomeDrawerSignOutDialog
                ),
                onDismiss: rootViewModel.dismissHomeDrawerSignOutDialog
            )
        }
    }

    @ViewBuilder
    var homePushNotificationPermissionDialogOverlay: some View {
        if rootViewModel.homeDestination == .notifications,
           rootViewModel.newsNotificationsViewModel.showsPushNotificationPermissionDialog {
            reguertaDialog(
                type: .info,
                title: l10n(AccessL10nKey.notificationsPushPermissionDialogTitle),
                message: l10n(AccessL10nKey.notificationsPushPermissionDialogMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.notificationsPushPermissionDialogSettings),
                    action: rootViewModel.newsNotificationsViewModel.openPushNotificationSettings
                ),
                secondaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.commonClose),
                    action: rootViewModel.newsNotificationsViewModel.dismissPushNotificationPermissionDialog
                ),
                onDismiss: rootViewModel.newsNotificationsViewModel.dismissPushNotificationPermissionDialog
            )
        }
    }

    @ViewBuilder
    var homeCheckoutDialogOverlay: some View {
        if rootViewModel.homeDestination == .myOrder,
           let checkoutAlert = rootViewModel.myOrderViewModel.checkoutAlert {
            homeCheckoutDialog(checkoutAlert)
        }
    }

    @ViewBuilder func homeCheckoutDialog(_ alert: MyOrderCheckoutAlert) -> some View {
        switch alert {
        case .missingCommitments(let names):
            homeCheckoutErrorDialog(
                title: l10n(AccessL10nKey.myOrderCheckoutMissingTitle),
                message: l10n(
                    AccessL10nKey.myOrderCheckoutMissingMessage,
                    names.formatted(.list(type: .and))
                )
            )
        case .exceededCommitments(let names):
            homeCheckoutErrorDialog(
                title: l10n(AccessL10nKey.myOrderCheckoutExceededTitle),
                message: l10n(
                    AccessL10nKey.myOrderCheckoutExceededMessage,
                    names.formatted(.list(type: .and))
                )
            )
        case .incompatibleCommitments(let names):
            homeCheckoutErrorDialog(
                title: l10n(AccessL10nKey.myOrderCheckoutIncompatibleTitle),
                message: l10n(
                    AccessL10nKey.myOrderCheckoutIncompatibleMessage,
                    names.formatted(.list(type: .and))
                )
            )
        case .ecoBasketPriceMismatch:
            homeCheckoutErrorDialog(
                title: l10n(AccessL10nKey.myOrderCheckoutEcoPriceTitle),
                message: l10n(AccessL10nKey.myOrderCheckoutEcoPriceMessage)
            )
        case .submitFailed:
            homeCheckoutErrorDialog(
                title: l10n(AccessL10nKey.myOrderCheckoutSubmitErrorTitle),
                message: l10n(AccessL10nKey.myOrderCheckoutSubmitErrorMessage)
            )
        case .readyToSubmit(let total, let noPickupEcoBaskets):
            homeReadyToSubmitDialog(total: total, noPickupEcoBaskets: noPickupEcoBaskets)
        }
    }

    func homeReadyToSubmitDialog(total: Double, noPickupEcoBaskets: Int) -> some View {
        reguertaDialog(
            type: .info,
            title: l10n(AccessL10nKey.myOrderCheckoutSuccessTitle),
            message: noPickupEcoBaskets > 0
                ? l10n(
                    AccessL10nKey.myOrderCheckoutSuccessWithNoPickupMessage,
                    total.euroCurrencyText()
                )
                : l10n(
                    AccessL10nKey.myOrderCheckoutSuccessMessage,
                    total.euroCurrencyText()
                ),
            primaryAction: ReguertaDialogAction(
                title: l10n(AccessL10nKey.commonAccept),
                action: handleHomeCheckoutSuccessAcknowledged
            ),
            dismissible: false
        )
    }

    func homeCheckoutErrorDialog(title: String, message: String) -> some View {
        reguertaDialog(
            type: .error,
            title: title,
            message: message,
            primaryAction: ReguertaDialogAction(
                title: l10n(AccessL10nKey.commonAccept),
                action: rootViewModel.myOrderViewModel.dismissCheckoutAlert
            ),
            onDismiss: rootViewModel.myOrderViewModel.dismissCheckoutAlert
        )
    }

    func handleHomeCheckoutSuccessAcknowledged() {
        rootViewModel.myOrderViewModel.acknowledgeCheckoutSuccess()
        rootViewModel.homeDestination = .dashboard
    }

    func homeDrawerPanel(drawerWidth: CGFloat) -> some View {
        HomeDrawerContentView(
            tokens: tokens,
            currentMember: rootViewModel.currentHomeMember,
            sharedProfile: rootViewModel.currentHomeSharedProfile,
            currentDestination: rootViewModel.homeDestination,
            installedVersion: rootViewModel.installedVersion,
            isDevelopBuild: sessionViewModel.isDevelopImpersonationEnabled,
            onNavigate: rootViewModel.handleHomeDrawerNavigation,
            onCloseDrawer: rootViewModel.closeHomeDrawer,
            onSignOut: rootViewModel.handleHomeDrawerSignOut
        )
        .padding(.horizontal, tokens.layout.compactHorizontalPadding)
        .safeAreaPadding(.top, tokens.spacing.sm)
        .safeAreaPadding(.bottom, tokens.spacing.lg)
        .frame(width: drawerWidth)
        .frame(maxHeight: .infinity, alignment: .topLeading)
        .background(tokens.colors.surfacePrimary.ignoresSafeArea())
        .offset(x: rootViewModel.homeDrawerOffset(drawerWidth: drawerWidth))
        .gesture(closeHomeDrawerDragGesture)
        .allowsHitTesting(rootViewModel.isHomeDrawerPresented)
        .accessibilityHidden(!rootViewModel.isHomeDrawerPresented)
        .animation(homeDrawerAnimation, value: rootViewModel.isHomeDrawerOpen)
        .animation(homeDrawerDragAnimation, value: rootViewModel.homeDrawerDragOffset)
    }

    func homeDrawerHomeScrim(drawerWidth: CGFloat) -> some View {
        Color.black
            .opacity(0.10 * Double(rootViewModel.homeDrawerProgress(drawerWidth: drawerWidth)))
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .onTapGesture(perform: rootViewModel.closeHomeDrawer)
            .gesture(closeHomeDrawerDragGesture)
    }

    func openHomeDrawerDragGesture(drawerWidth: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { gesture in
                guard HomeShellLayoutContract.shouldRecognizeDrawerOpeningGesture(
                    startLocationX: gesture.startLocation.x,
                    edgeWidth: tokens.layout.minimumTouchTarget
                ) else { return }
                rootViewModel.handleHomeOpenDrawerDragChanged(
                    gesture.translation.width,
                    drawerWidth: drawerWidth
                )
            }
            .onEnded { gesture in
                guard HomeShellLayoutContract.shouldRecognizeDrawerOpeningGesture(
                    startLocationX: gesture.startLocation.x,
                    edgeWidth: tokens.layout.minimumTouchTarget
                ) else { return }
                rootViewModel.handleHomeOpenDrawerDragEnded(gesture.translation.width)
            }
    }

    var closeHomeDrawerDragGesture: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { gesture in
                rootViewModel.handleHomeCloseDrawerDragChanged(gesture.translation.width)
            }
            .onEnded { gesture in
                rootViewModel.handleHomeCloseDrawerDragEnded(gesture.translation.width)
            }
    }
}
