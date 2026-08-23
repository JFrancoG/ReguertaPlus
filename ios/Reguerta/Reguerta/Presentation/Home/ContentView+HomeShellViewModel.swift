import SwiftUI

enum HomeShellLayoutContract {
    static let maximumDrawerWidth: CGFloat = 304
    static let openDrawerThreshold: CGFloat = 48
    static let closeDrawerThreshold: CGFloat = 56

    static func drawerWidth(containerWidth: CGFloat, minimumEdgeReveal: CGFloat) -> CGFloat {
        min(maximumDrawerWidth, max(0, containerWidth - minimumEdgeReveal))
    }

    static func shouldRecognizeDrawerOpeningGesture(startLocationX: CGFloat, edgeWidth: CGFloat) -> Bool {
        startLocationX >= 0 && startLocationX <= edgeWidth
    }

    static func clampedOpenTranslation(_ translationWidth: CGFloat, drawerWidth: CGFloat) -> CGFloat {
        max(0, min(drawerWidth, translationWidth))
    }

    static func shouldOpenDrawer(translationWidth: CGFloat) -> Bool {
        translationWidth > openDrawerThreshold
    }

    static func shouldCloseDrawer(translationWidth: CGFloat) -> Bool {
        translationWidth < -closeDrawerThreshold
    }
}

private struct HomeMyOrderEntryIntent {
    let generation: UInt64
    let freshnessContext: MyOrderFreshnessSessionContext
}

extension AccessRootViewModel {
    var currentHomeSession: AuthorizedSession? {
        switch sessionViewModel.mode {
        case .authorized(let session):
            return session
        case .signedOut, .unauthorized:
            return nil
        }
    }

    var currentHomeMember: Member? {
        currentHomeSession?.member
    }

    var currentHomeSharedProfile: SharedProfile? {
        sharedProfileViewModel.profiles.first { $0.userId == currentHomeMember?.id }
    }

    var isHomeDrawerPresented: Bool {
        isHomeDrawerOpen || homeDrawerDragOffset > 0
    }

    var isMyOrderCartOverlayVisible: Bool {
        guard homeDestination == .myOrder else { return false }
        return myOrderViewModel.isCartVisible && !myOrderViewModel.isReadOnlyMode
    }

    func homeDrawerProgress(drawerWidth: CGFloat) -> CGFloat {
        resolvedHomeDrawerProgress(drawerWidth: drawerWidth)
    }

    func homeDrawerOffset(drawerWidth: CGFloat) -> CGFloat {
        -drawerWidth * (1 - homeDrawerProgress(drawerWidth: drawerWidth))
    }

    func homeLayerOffset(drawerWidth: CGFloat) -> CGFloat {
        drawerWidth * homeDrawerProgress(drawerWidth: drawerWidth)
    }

    var homeDashboardPresentation: HomeDashboardPresentation {
        HomeDashboardPresentation(
            content: homeDashboardContent
        )
    }

    func setSharedProfileTitleOverride(_ title: String?) {
        sharedProfileTitleOverride = title
    }

    func setMyOrdersHistoryTitleOverride(_ title: String?) {
        myOrdersHistoryTitleOverride = title
    }

    func setReceivedOrdersHistoryTitleOverride(_ title: String?) {
        receivedOrdersHistoryTitleOverride = title
    }

    func showSharedProfileSavedDialog() {
        showsSharedProfileSavedDialog = true
    }

    func dismissSharedProfileSavedDialog() {
        showsSharedProfileSavedDialog = false
    }

    var homeShellHeaderConfiguration: ReguertaScreenHeaderConfiguration {
        ReguertaScreenHeaderConfiguration(
            title: homeHeaderTitle,
            leadingAction: homeHeaderLeadingAction,
            leadingText: homeHeaderLeadingText,
            trailingAction: homeHeaderTrailingAction
        )
    }

    func handleHomePrimaryAction() {
        switch homeDestination {
        case .dashboard:
            openHomeDrawer()
        case .publishNews:
            newsNotificationsViewModel.clearNewsEditor()
            homeDestination = .news
        case .adminBroadcast:
            newsNotificationsViewModel.clearNotificationEditor()
            homeDestination = .dashboard
        case .shiftSwapRequest:
            shiftsViewModel.clearShiftSwapDraft()
            homeDestination = .shifts
        case .products:
            if productsViewModel.isEditing {
                productsViewModel.clearEditor()
            } else {
                homeDestination = .dashboard
            }
        case .users:
            if usersViewModel.isEditorOpen {
                usersViewModel.clearEditor()
            } else {
                homeDestination = .dashboard
            }
        case .myOrder:
            myOrderViewModel.resetCartOverlayForRouteEntry()
            homeDestination = .dashboard
        default:
            homeDestination = .dashboard
        }
    }

    func handleHomeNotificationsAction() {
        navigateHome(to: .notifications)
    }

    func handleHomeCartAction() {
        myOrderCartOpenRequests += 1
    }

    func handleHomeDrawerNavigation(_ destination: HomeDestination) {
        navigateHome(to: destination)
        closeHomeDrawer()
    }

    func handleHomeDrawerSignOut() {
        closeHomeDrawer()
        showsHomeSignOutDialog = true
    }

    func dismissHomeDrawerSignOutDialog() {
        showsHomeSignOutDialog = false
    }

    func confirmHomeDrawerSignOut() {
        showsHomeSignOutDialog = false
        homeDestination = .dashboard
        sessionViewModel.signOut()
        dispatchShell(.signedOut)
    }

    func handleHomeDashboardMyOrderAction() {
        guard let intent = beginHomeMyOrderEntryIntent() else { return }
        let freshnessViewModel = myOrderFreshnessViewModel
        myOrderEntryTask = Task { @MainActor [weak self, freshnessViewModel] in
            await freshnessViewModel.revalidateForEntry(context: intent.freshnessContext) { [weak self] in
                guard let self,
                      canCommitHomeMyOrderEntryAfterFreshnessAcknowledgement(intent) else { return }
                myOrderViewModel.resetCartOverlayForRouteEntry()
                homeDestination = .myOrder
            }
            guard let self else { return }
            finishHomeMyOrderEntryIntent(intent)
        }
    }

    private func beginHomeMyOrderEntryIntent() -> HomeMyOrderEntryIntent? {
        invalidateHomeMyOrderEntryIntent()
        guard homeDestination == .dashboard,
              let session = currentHomeSession else { return nil }
        let freshnessContext = MyOrderFreshnessSessionContext(
            session: session,
            sessionStateRevision: sessionViewModel.sessionStateRevision
        )
        guard freshnessContext.representsActiveAuthorization else { return nil }
        return HomeMyOrderEntryIntent(
            generation: myOrderEntryGeneration,
            freshnessContext: freshnessContext
        )
    }

    func invalidateHomeMyOrderEntryIntent() {
        myOrderEntryGeneration &+= 1
        myOrderEntryTask?.cancel()
        myOrderEntryTask = nil
    }

    private func canCommitHomeMyOrderEntryAfterFreshnessAcknowledgement(_ intent: HomeMyOrderEntryIntent) -> Bool {
        guard !Task.isCancelled,
              intent.generation == myOrderEntryGeneration,
              homeDestination == .dashboard,
              let session = currentHomeSession,
              session.representsActiveAuthorization else { return false }
        return intent.freshnessContext.matchesAuthorization(of: session)
    }

    private func finishHomeMyOrderEntryIntent(_ intent: HomeMyOrderEntryIntent) {
        guard intent.generation == myOrderEntryGeneration else { return }
        myOrderEntryTask = nil
    }

    func handleHomeDashboardReceivedOrdersAction() {
        homeDestination = .receivedOrders
    }

    func handleHomeOpenDrawerDragChanged(_ translationWidth: CGFloat, drawerWidth: CGFloat) {
        homeDrawerDragOffset = HomeShellLayoutContract.clampedOpenTranslation(
            translationWidth,
            drawerWidth: drawerWidth
        )
    }

    func handleHomeOpenDrawerDragEnded(_ translationWidth: CGFloat) {
        if HomeShellLayoutContract.shouldOpenDrawer(translationWidth: translationWidth) {
            openHomeDrawer()
        } else {
            homeDrawerDragOffset = 0
        }
    }

    func handleHomeCloseDrawerDragChanged(_ translationWidth: CGFloat) {
        if isHomeDrawerOpen {
            homeDrawerDragOffset = min(0, translationWidth)
        }
    }

    func handleHomeCloseDrawerDragEnded(_ translationWidth: CGFloat) {
        guard isHomeDrawerOpen else { return }
        if HomeShellLayoutContract.shouldCloseDrawer(translationWidth: translationWidth) {
            closeHomeDrawer()
        } else {
            homeDrawerDragOffset = 0
        }
    }

    func openHomeDrawer() {
        isHomeDrawerOpen = true
        homeDrawerDragOffset = 0
    }

    func closeHomeDrawer() {
        isHomeDrawerOpen = false
        homeDrawerDragOffset = 0
    }

}

private extension AccessRootViewModel {
    var homeHeaderTitleText: ReguertaHeaderText {
        if let titleOverride = homeShellTitleOverride {
            return .verbatim(titleOverride)
        }
        return .localized(homeDestination.titleKey)
    }

    var homeHeaderTitle: ReguertaHeaderText? {
        homeDestination == .dashboard ? nil : homeHeaderTitleText
    }

    var homeHeaderLeadingText: ReguertaHeaderText? {
        homeDestination == .dashboard ? homeHeaderTitleText : nil
    }

    var homeHeaderLeadingAction: ReguertaHeaderAction {
        ReguertaHeaderAction(
            systemImageName: homeDestination == .dashboard ? "line.3.horizontal" : "chevron.left",
            accessibilityLabel: .localized(
                homeDestination == .dashboard ? AccessL10nKey.homeShellMenu : AccessL10nKey.commonBack
            ),
            accessibilityIdentifier: homeDestination == .dashboard
                ? "home.topBar.menuButton"
                : "home.topBar.backButton",
            action: { [weak self] in
                self?.handleHomePrimaryAction()
            }
        )
    }

    var homeHeaderTrailingAction: ReguertaHeaderAction? {
        if homeDestination == .dashboard {
            return ReguertaHeaderAction(
                systemImageName: "bell",
                accessibilityLabel: .localized(AccessL10nKey.homeShellNotifications),
                accessibilityIdentifier: "home.topBar.notificationsButton",
                badge: newsNotificationsViewModel.hasUnreadNotifications ? .dot : nil,
                action: { [weak self] in
                    self?.handleHomeNotificationsAction()
                }
            )
        }

        if homeDestination == .myOrder && !myOrderReadOnlyMode {
            return ReguertaHeaderAction(
                systemImageName: "cart",
                accessibilityLabel: .localized(AccessL10nKey.myOrderCartViewAction),
                accessibilityIdentifier: "home.topBar.cartButton",
                isEnabled: myOrderCartUnits > 0,
                badge: myOrderCartUnits > 0 ? .count(myOrderCartUnits) : nil,
                action: { [weak self] in
                    self?.handleHomeCartAction()
                }
            )
        }

        return nil
    }

    var homeShellTitleOverride: String? {
        switch homeDestination {
        case .dashboard:
            return formatHomeTopBarDate(nowMillis: shiftsViewModel.currentNowMillis)
        case .myOrder:
            if !myOrderViewModel.isReadOnlyMode {
                return l10n(
                    myOrderViewModel.isCartVisible
                        ? AccessL10nKey.myOrderCartTitle
                        : AccessL10nKey.myOrderListTitle
                )
            }
            return l10n(
                myOrderViewModel.shouldShowDatabaseOrderSummary
                    ? AccessL10nKey.myOrderPreviousTitle
                    : AccessL10nKey.myOrder
            )
        case .receivedOrders:
            return l10n(AccessL10nKey.receivedOrdersTitle)
        case .myOrders:
            return myOrdersHistoryTitleOverride ?? myOrdersHistoryViewModel.selectedWeek?.orderTitle ?? "Pedido"
        case .receivedOrdersHistory:
            return receivedOrdersHistoryTitleOverride
                ?? l10n(AccessL10nKey.receivedOrdersHistoryTitle)
        case .bylaws:
            return l10n(AccessL10nKey.bylawsTitle)
        case .news:
            return l10n(AccessL10nKey.homeShellActionNews)
        case .settings:
            return l10n(AccessL10nKey.settingsTitle)
        case .products:
            if productsViewModel.isEditing {
                return l10n(
                    productsViewModel.editingProductId?.isEmpty == false
                        ? AccessL10nKey.productsEditorTitleEdit
                        : AccessL10nKey.productsEditorTitleNew
                )
            }
            return l10n(AccessL10nKey.productsListTitle)
        case .users:
            if usersViewModel.isEditorOpen {
                return l10n(
                    usersViewModel.editingMemberId == nil
                        ? AccessL10nKey.usersEditorTitleCreate
                        : AccessL10nKey.usersEditorTitleEdit
                )
            }
            return l10n(AccessL10nKey.usersListTitle)
        case .profile:
            return sharedProfileTitleOverride
        case .shiftSwapRequest:
            return l10n(AccessL10nKey.shiftSwapRequestScreenTitle)
        case .publishNews:
            let editorTitleKey = newsNotificationsViewModel.editingNewsId == nil
                ? AccessL10nKey.newsEditorTitleCreate
                : AccessL10nKey.newsEditorTitleEdit
            return l10n(editorTitleKey)
        case .adminBroadcast:
            return l10n(AccessL10nKey.notificationsEditorTitle)
        default:
            return nil
        }
    }

    var homeDashboardContent: HomeDashboardContent {
        switch sessionViewModel.mode {
        case .signedOut:
            return .signedOut
        case .unauthorized:
            return .unauthorized
        case .authorized(let session):
            let summary = homeWeeklySummary(for: session)
            return .authorized(
                HomeAuthorizedDashboardPresentation(
                    weeklySummary: summary,
                    actionRow: HomeActionRowPresentation(
                        myOrderFreshnessState: myOrderFreshnessViewModel.state,
                        canOpenReceivedOrders: session.member.canAccessReceivedOrders,
                        orderState: summary.orderState,
                        myOrderSubtitleKey: summary.myOrderSubtitleKey
                    )
                )
            )
        }
    }

    func navigateHome(to destination: HomeDestination) {
        if destination == .myOrder {
            handleHomeDashboardMyOrderAction()
            return
        }
        refreshBeforeOpeningHomeDestination(destination)
        homeDestination = destination
    }

    func refreshBeforeOpeningHomeDestination(_ destination: HomeDestination) {
        homeDestinationPreparations[destination]?()
    }

    func resolvedHomeDrawerProgress(drawerWidth: CGFloat) -> CGFloat {
        guard drawerWidth > 0 else { return 0 }
        if isHomeDrawerOpen {
            return max(0, min(1, (drawerWidth + homeDrawerDragOffset) / drawerWidth))
        }
        return max(0, min(1, homeDrawerDragOffset / drawerWidth))
    }

    var homeDestinationPreparations: [HomeDestination: () -> Void] {
        [
            .publishNews: { [weak self] in
                _ = self?.newsNotificationsViewModel.startCreatingNews()
            },
            .adminBroadcast: { [weak self] in
                _ = self?.newsNotificationsViewModel.startCreatingNotification()
            },
            .news: { [weak self] in
                guard let self else { return }
                Task { await self.newsNotificationsViewModel.refreshNews() }
            },
            .products: { [weak self] in
                guard let self else { return }
                Task { await self.productsViewModel.refreshCatalog() }
            },
            .myOrder: { [weak self] in
                guard let self else { return }
                self.myOrderViewModel.resetCartOverlayForRouteEntry()
            },
            .profile: { [weak self] in
                guard let self else { return }
                Task { await self.sharedProfileViewModel.refreshProfiles() }
            },
            .users: { [weak self] in
                guard let self else { return }
                Task { await self.usersViewModel.refreshMembers() }
            },
            .shifts: { [weak self] in
                guard let self else { return }
                Task { await self.shiftsViewModel.refreshShifts() }
            },
            .settings: { [weak self] in
                guard let self else { return }
                Task { await self.shiftsViewModel.refreshDeliveryCalendar() }
            }
        ]
    }
}
