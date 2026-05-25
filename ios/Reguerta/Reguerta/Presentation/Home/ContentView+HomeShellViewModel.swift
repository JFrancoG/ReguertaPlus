import SwiftUI

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

    var homeContentWidth: CGFloat {
        358.resize
    }

    var homeDrawerWidth: CGFloat {
        304.resize
    }

    var homeTopSpacing: CGFloat {
        4.resizeStatusBarSize
    }

    var homeBottomSpacing: CGFloat {
        homeDestination == .dashboard || homeDestination == .myOrder ? 0 : 16.resizeBottomSize
    }

    var homeShellRouteSpacing: CGFloat {
        if isMyOrderCartOverlayVisible {
            return 0
        }
        if homeDestination == .myOrder {
            return 18.resize
        }
        return 12.resize
    }

    var homeShellTopBarHorizontalPadding: CGFloat {
        homeDestination == .myOrder ? 8.resize : 0
    }

    var isHomeDrawerPresented: Bool {
        isHomeDrawerOpen || homeDrawerDragOffset > 0
    }

    var isMyOrderCartOverlayVisible: Bool {
        guard homeDestination == .myOrder else { return false }
        return myOrderViewModel.isCartVisible && !myOrderViewModel.isReadOnlyMode
    }

    var shouldShowHomeFeedbackMessage: Bool {
        feedbackCenter.messageKey != nil
    }

    var homeDrawerProgress: CGFloat {
        resolvedHomeDrawerProgress(drawerWidth: homeDrawerWidth)
    }

    var homeDrawerOffset: CGFloat {
        -homeDrawerWidth * (1 - homeDrawerProgress)
    }

    var homeLayerOffset: CGFloat {
        homeDrawerWidth * homeDrawerProgress
    }

    var homeDrawerAnimation: Animation {
        .easeInOut(duration: 0.45)
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

    func showSharedProfileSavedDialog() {
        showsSharedProfileSavedDialog = true
    }

    func dismissSharedProfileSavedDialog() {
        showsSharedProfileSavedDialog = false
    }

    var homeShellHeaderViewModel: ReguertaScreenHeaderViewModel {
        ReguertaScreenHeaderViewModel(
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
            homeDestination = .notifications
        case .shiftSwapRequest:
            shiftsViewModel.clearShiftSwapDraft()
            homeDestination = .shifts
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
        homeDestination = .dashboard
        sessionViewModel.signOut()
        dispatchShell(.signedOut)
    }

    func handleHomeDashboardMyOrderAction() {
        myOrderViewModel.resetCartOverlayForRouteEntry()
        homeDestination = .myOrder
        Task { await productsViewModel.refreshOrderingProducts() }
    }

    func handleHomeDashboardReceivedOrdersAction() {
        homeDestination = .receivedOrders
    }

    func handleHomeDashboardFreshnessRetry() {
        myOrderFreshnessViewModel.retry(currentMode: sessionViewModel.mode)
    }

    func handleHomeOpenDrawerDragChanged(_ translationWidth: CGFloat) {
        homeDrawerDragOffset = max(0, min(homeDrawerWidth, translationWidth))
    }

    func handleHomeOpenDrawerDragEnded(_ translationWidth: CGFloat) {
        if translationWidth > 48.resize {
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
        if translationWidth < -56.resize {
            closeHomeDrawer()
        } else {
            withAnimation(homeDrawerAnimation) {
                homeDrawerDragOffset = 0
            }
        }
    }

    func openHomeDrawer() {
        withAnimation(homeDrawerAnimation) {
            isHomeDrawerOpen = true
            homeDrawerDragOffset = 0
        }
    }

    func closeHomeDrawer() {
        withAnimation(homeDrawerAnimation) {
            isHomeDrawerOpen = false
            homeDrawerDragOffset = 0
        }
    }

    func homeWeeklySummary(for session: AuthorizedSession) -> HomeWeeklySummaryDisplay {
        let nowMillis = shiftsViewModel.currentNowMillis
        let baseline = resolveHomeWeeklySummaryDisplay(
            nowMillis: nowMillis,
            defaultDeliveryDayOfWeek: shiftsViewModel.defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: shiftsViewModel.deliveryCalendarOverrides,
            shifts: shiftsViewModel.shiftsFeed,
            members: session.members
        )
        return HomeWeeklySummaryDisplay(
            weekKey: baseline.weekKey,
            orderWeekKey: baseline.orderWeekKey,
            weekRangeLabel: baseline.weekRangeLabel,
            weekBadgeLabel: baseline.weekBadgeLabel,
            producerName: baseline.producerName,
            deliveryLabel: baseline.deliveryLabel,
            responsibleName: baseline.responsibleName,
            helperName: baseline.helperName,
            marketLabel: baseline.marketLabel,
            marketResponsibleNames: baseline.marketResponsibleNames,
            orderState: resolveHomeOrderState(memberId: session.member.id, weekKey: baseline.orderWeekKey),
            isConsultaPhase: baseline.isConsultaPhase
        )
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
                accessibilityLabel: .verbatim("Ver carrito"),
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
                return myOrderViewModel.isCartVisible ? "Mi carrito" : "Lista de productos"
            }
            return myOrderViewModel.shouldShowDatabaseOrderSummary ? "Mi último pedido" : "Mi pedido"
        case .receivedOrders:
            return "Pedidos a preparar"
        case .myOrders:
            return myOrdersHistoryTitleOverride ?? myOrdersHistoryViewModel.selectedWeek?.orderTitle ?? "Pedido"
        case .bylaws:
            return l10n(AccessL10nKey.bylawsTitle)
        case .news:
            return l10n(AccessL10nKey.homeShellActionNews)
        case .settings:
            return l10n(AccessL10nKey.settingsTitle)
        case .products:
            return l10n(AccessL10nKey.productsListTitle)
        case .users:
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
        refreshBeforeOpeningHomeDestination(destination)
        homeDestination = destination
    }

    func refreshBeforeOpeningHomeDestination(_ destination: HomeDestination) {
        homeDestinationPreparations[destination]?()
    }

    func resolvedHomeDrawerProgress(drawerWidth: CGFloat) -> CGFloat {
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
                Task { await self.productsViewModel.refreshOrderingProducts() }
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
