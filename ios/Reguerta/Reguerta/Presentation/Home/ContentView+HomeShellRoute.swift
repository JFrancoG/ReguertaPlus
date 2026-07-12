import SwiftUI

private enum HomeSignOutDialogL10n {
    static let confirm = "common.action.confirm"
    static let message = "access.action.sign_out.confirm.message"
}

extension AccessRootRoutingView {
    @ViewBuilder
    var homeRoute: some View {
        ZStack(alignment: .topLeading) {
            homeDrawerPanel
                .zIndex(1)

            ReguertaScreenScaffold(
                contentWidth: rootViewModel.homeContentWidth,
                headerViewModel: rootViewModel.homeShellHeaderViewModel,
                headerHorizontalPadding: rootViewModel.homeShellTopBarHorizontalPadding,
                headerContentSpacing: rootViewModel.homeShellRouteSpacing,
                showsBottomInset: rootViewModel.shouldShowHomeFeedbackMessage
            ) {
                homeRouteContent
                    .frame(maxHeight: .infinity, alignment: .topLeading)
            } bottomContent: {
                if rootViewModel.shouldShowHomeFeedbackMessage {
                    feedbackMessageRoute
                }
            }
            .disabled(rootViewModel.isHomeDrawerPresented)
            .overlay(alignment: .topLeading) {
                if rootViewModel.isHomeDrawerPresented {
                    homeDrawerHomeScrim
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
            .offset(x: rootViewModel.homeLayerOffset)
            .zIndex(2)
            .animation(rootViewModel.homeDrawerAnimation, value: rootViewModel.isHomeDrawerOpen)
            .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.84), value: rootViewModel.homeDrawerDragOffset)

            if !rootViewModel.isHomeDrawerOpen {
                Color.clear
                    .frame(width: 22.resize)
                    .frame(maxHeight: .infinity)
                    .ignoresSafeArea()
                    .contentShape(Rectangle())
                    .gesture(openHomeDrawerDragGesture)
                    .zIndex(4)
            }
        }
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

    @ViewBuilder
    func homeCheckoutDialog(_ alert: MyOrderCheckoutAlert) -> some View {
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

    var homeDrawerPanel: some View {
        HomeDrawerContentView(
            tokens: tokens,
            currentMember: rootViewModel.currentHomeMember,
            sharedProfile: rootViewModel.currentHomeSharedProfile,
            currentDestination: rootViewModel.homeDestination,
            installedVersion: rootViewModel.installedVersion,
            isDevelopBuild: viewModel.isDevelopImpersonationEnabled,
            onNavigate: rootViewModel.handleHomeDrawerNavigation,
            onCloseDrawer: rootViewModel.closeHomeDrawer,
            onSignOut: rootViewModel.handleHomeDrawerSignOut
        )
        .padding(.top, 8.resizeStatusBarSize)
        .padding(.bottom, 16.resizeBottomSize)
        .padding(.horizontal, 16.resize)
        .frame(width: rootViewModel.homeDrawerWidth)
        .frame(maxHeight: .infinity, alignment: .topLeading)
        .background(tokens.colors.surfacePrimary.ignoresSafeArea())
        .offset(x: rootViewModel.homeDrawerOffset)
        .gesture(closeHomeDrawerDragGesture)
        .ignoresSafeArea(.container, edges: .vertical)
        .allowsHitTesting(rootViewModel.isHomeDrawerPresented)
        .accessibilityHidden(!rootViewModel.isHomeDrawerPresented)
        .animation(rootViewModel.homeDrawerAnimation, value: rootViewModel.isHomeDrawerOpen)
        .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.84), value: rootViewModel.homeDrawerDragOffset)
    }

    var homeDrawerHomeScrim: some View {
        Color.black
            .opacity(0.10 * Double(rootViewModel.homeDrawerProgress))
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .onTapGesture(perform: rootViewModel.closeHomeDrawer)
            .gesture(closeHomeDrawerDragGesture)
    }

    var openHomeDrawerDragGesture: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { gesture in
                rootViewModel.handleHomeOpenDrawerDragChanged(gesture.translation.width)
            }
            .onEnded { gesture in
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
