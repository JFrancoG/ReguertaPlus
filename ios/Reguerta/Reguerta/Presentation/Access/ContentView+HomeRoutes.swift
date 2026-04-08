import SwiftUI

extension ContentView {
    var homeRoute: some View {
        GeometryReader { proxy in
            let drawerWidth = min(320.resize, proxy.size.width * 0.78)

            ZStack(alignment: .leading) {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                        homeShellTopBar
                        homeRouteContent

                        if viewModel.feedbackMessageKey != nil {
                            feedbackMessageRoute
                        }
                    }
                    .padding(.vertical, tokens.spacing.lg)
                }
                .scrollDismissesKeyboard(.interactively)
                .disabled(isHomeDrawerOpen)

                if isHomeDrawerOpen {
                    Color.black.opacity(0.18)
                        .ignoresSafeArea()
                        .contentShape(Rectangle())
                        .onTapGesture {
                            closeHomeDrawer()
                        }
                }

                homeDrawerPanel(drawerWidth: drawerWidth)

                if !isHomeDrawerOpen {
                    Color.clear
                        .frame(width: 22.resize)
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 12)
                                .onChanged { gesture in
                                    homeDrawerDragOffset = max(0, min(drawerWidth, gesture.translation.width))
                                }
                                .onEnded { gesture in
                                    if gesture.translation.width > 48.resize {
                                        openHomeDrawer()
                                    } else {
                                        homeDrawerDragOffset = 0
                                    }
                                }
                        )
                }
            }
        }
    }

    @ViewBuilder
    var homeRouteContent: some View {
        switch homeDestination {
        case .dashboard:
            dashboardRoute
        case .shifts:
            shiftsRoute
        case .shiftSwapRequest:
            shiftSwapRequestRoute
        case .news:
            newsListRoute
        case .notifications:
            notificationsListRoute
        case .products:
            productsRoute
        case .profile:
            sharedProfileRoute
        case .settings:
            settingsRoute
        case .publishNews:
            newsEditorRoute
        case .adminBroadcast:
            notificationEditorRoute
        default:
            placeholderRoute(
                titleKey: homeDestination.titleKey,
                subtitleKey: homeDestination.subtitleKey
            )
        }
    }

    @ViewBuilder
    var dashboardRoute: some View {
        nextShiftsCard

        switch viewModel.mode {
        case .signedOut:
            cardContainer {
                Text(localizedKey(AccessL10nKey.signedOutHint))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        case .unauthorized:
            EmptyView()
        case .authorized(let session):
            authorizedHome(session: session)
        }

        latestNewsCard
    }

    var homeShellTopBar: some View {
        HomeShellTopBarView(
            tokens: tokens,
            titleKey: homeDestination.titleKey,
            showsBack: homeDestination != .dashboard,
            onPrimaryAction: {
                if homeDestination == .dashboard {
                    openHomeDrawer()
                } else if homeDestination == .publishNews {
                    viewModel.clearNewsEditor()
                    homeDestination = .news
                } else if homeDestination == .adminBroadcast {
                    viewModel.clearNotificationEditor()
                    homeDestination = .notifications
                } else if homeDestination == .shiftSwapRequest {
                    viewModel.clearShiftSwapDraft()
                    homeDestination = .shifts
                } else {
                    homeDestination = .dashboard
                }
            },
            onNotificationsAction: {
                homeDestination = .notifications
                viewModel.refreshNotifications()
            }
        )
    }

    @ViewBuilder
    func authorizedHome(session: AuthorizedSession) -> some View {
        operationalModules(
            modulesEnabled: true,
            canOpenProducts: session.member.roles.contains(.producer) || session.member.isCommonPurchaseManager,
            myOrderFreshnessState: viewModel.myOrderFreshnessState
        )

        if session.member.isAdmin {
            adminToolsCard(session: session)
        }
    }
    var nextShiftsCard: some View {
        NextShiftsCardView(
            tokens: tokens,
            isLoading: viewModel.isLoadingShifts,
            nextDeliverySummary: viewModel.nextDeliveryShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            nextMarketSummary: viewModel.nextMarketShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            onViewAll: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            }
        )
    }

    var latestNewsCard: some View {
        LatestNewsCardView(
            tokens: tokens,
            latestNews: viewModel.latestNews,
            onViewAll: {
                homeDestination = .news
                viewModel.refreshNews()
            }
        )
    }

    @ViewBuilder
    func operationalModules(
        modulesEnabled: Bool,
        canOpenProducts: Bool,
        myOrderFreshnessState: MyOrderFreshnessState,
        disabledMessageKey: String? = nil
    ) -> some View {
        OperationalModulesCardView(
            tokens: tokens,
            modulesEnabled: modulesEnabled,
            canOpenProducts: canOpenProducts,
            myOrderFreshnessState: myOrderFreshnessState,
            disabledMessageKey: disabledMessageKey,
            onOpenMyOrder: {},
            onOpenProducts: {
                homeDestination = .products
                viewModel.refreshProducts()
            },
            onOpenShifts: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            },
            onRetryFreshness: {
                viewModel.refreshMyOrderFreshness()
            }
        )
    }

    @ViewBuilder
    var shiftsRoute: some View {
        ShiftsRouteView(
            tokens: tokens,
            selectedShiftSegment: $selectedShiftSegment,
            isLoadingShifts: viewModel.isLoadingShifts,
            shiftsFeed: viewModel.shiftsFeed,
            shiftSwapRequests: viewModel.shiftSwapRequests,
            dismissedShiftSwapRequestIds: viewModel.dismissedShiftSwapRequestIds,
            currentMemberId: currentHomeMember?.id,
            currentSession: currentHomeSession,
            shiftSwapCopy: shiftSwapCopy,
            nextShiftsIsLoading: viewModel.isLoadingShifts,
            nextDeliverySummary: viewModel.nextDeliveryShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            nextMarketSummary: viewModel.nextMarketShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            onRefreshShifts: viewModel.refreshShifts,
            onRefreshFromNextShifts: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            },
            onStartSwapRequestForShift: { shiftId in
                viewModel.startCreatingShiftSwap(shiftId: shiftId)
                homeDestination = .shiftSwapRequest
            },
            onAcceptIncomingCandidate: { requestId, candidateShiftId in
                viewModel.acceptShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onRejectIncomingCandidate: { requestId, candidateShiftId in
                viewModel.rejectShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onConfirmResponse: { requestId, candidateShiftId in
                viewModel.confirmShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onCancelOwnRequest: { requestId in
                viewModel.cancelShiftSwapRequest(requestId: requestId)
            },
            onDismissAppliedRequest: { requestId in
                viewModel.dismissShiftSwapActivity(requestId: requestId)
            },
            shiftBoardLines: shiftLeftBoardLines,
            shiftSwapDisplayLabel: shiftSwapDisplayLabel,
            displayNameForSwap: displayNameForSwap,
            shiftSwapStatusLabel: shiftSwapStatusLabel,
            canRequestSwapForShift: canRequestSwapForShift
        )
    }

    var shiftSwapRequestRoute: some View {
        let shift = viewModel.shiftsFeed.first(where: { $0.id == viewModel.shiftSwapDraft.shiftId })
        let shiftDisplayLabel = shift.map {
            shiftSwapDisplayLabel($0, memberId: $0.assignedUserIds.first ?? $0.helperUserId)
        } ?? viewModel.shiftSwapDraft.shiftId

        return ShiftSwapRequestRouteView(
            tokens: tokens,
            shift: shift,
            shiftSwapDraftShiftId: viewModel.shiftSwapDraft.shiftId,
            shiftSwapReason: Binding(
                get: { viewModel.shiftSwapDraft.reason },
                set: { newValue in
                    viewModel.updateShiftSwapDraft { $0.reason = newValue }
                }
            ),
            isSavingShiftSwapRequest: viewModel.isSavingShiftSwapRequest,
            shiftSwapCopy: shiftSwapCopy,
            shiftDisplayLabel: shiftDisplayLabel,
            onSave: {
                viewModel.saveShiftSwapRequest {
                    homeDestination = .shifts
                }
            },
            onBack: {
                viewModel.clearShiftSwapDraft()
                homeDestination = .shifts
            }
        )
    }
    var newsListRoute: some View {
        NewsListRouteView(
            tokens: tokens,
            isLoadingNews: viewModel.isLoadingNews,
            newsFeed: viewModel.newsFeed,
            isAdmin: currentHomeMember?.isAdmin == true,
            newsMetaText: { article in
                l10n(AccessL10nKey.newsMetaFormat, article.publishedBy)
            },
            onCreateNews: {
                viewModel.startCreatingNews()
                homeDestination = .publishNews
            },
            onRefreshNews: viewModel.refreshNews,
            onEditNews: { newsId in
                viewModel.startEditingNews(newsId: newsId)
                homeDestination = .publishNews
            },
            onDeleteNews: { newsId in
                pendingNewsDeletionId = newsId
            }
        )
    }

    var newsEditorRoute: some View {
        NewsEditorRouteView(
            tokens: tokens,
            editingNewsId: viewModel.editingNewsId,
            newsTitle: newsTitleBinding,
            newsUrlImage: newsUrlImageBinding,
            newsBody: newsBodyBinding,
            newsActive: newsActiveBinding,
            isSavingNews: viewModel.isSavingNews,
            onSave: {
                viewModel.saveNews {
                    homeDestination = .news
                }
            },
            onBack: {
                viewModel.clearNewsEditor()
                homeDestination = .news
            }
        )
    }

    var productsRoute: some View {
        ProductsRouteView(
            tokens: tokens,
            viewModel: viewModel,
            currentHomeMember: currentHomeMember,
            pendingProducerCatalogVisibility: $pendingProducerCatalogVisibility
        )
    }

    var notificationsListRoute: some View {
        NotificationsListRouteView(
            tokens: tokens,
            isLoadingNotifications: viewModel.isLoadingNotifications,
            notificationsFeed: viewModel.notificationsFeed,
            isAdmin: currentHomeMember?.isAdmin == true,
            notificationMetaText: { notification in
                l10n(
                    AccessL10nKey.notificationsMetaFormat,
                    localizedDateTime(notification.sentAtMillis)
                )
            },
            onCreateNotification: {
                viewModel.startCreatingNotification()
                homeDestination = .adminBroadcast
            },
            onRefreshNotifications: viewModel.refreshNotifications
        )
    }

    @ViewBuilder
    var sharedProfileRoute: some View {
        if let session = currentHomeSession {
            SharedProfileHubRoute(
                session: session,
                profiles: viewModel.sharedProfiles,
                draft: Binding(
                    get: { viewModel.sharedProfileDraft },
                    set: { viewModel.sharedProfileDraft = $0 }
                ),
                isLoading: viewModel.isLoadingSharedProfiles,
                isSaving: viewModel.isSavingSharedProfile,
                isDeleting: viewModel.isDeletingSharedProfile,
                onRefresh: viewModel.refreshSharedProfiles,
                onSave: viewModel.saveSharedProfile,
                onDelete: viewModel.deleteSharedProfile,
                displayName: { displayName(for: $0, session: session) }
            )
        }
    }

    var notificationEditorRoute: some View {
        NotificationEditorRouteView(
            tokens: tokens,
            notificationTitle: notificationTitleBinding,
            notificationBody: notificationBodyBinding,
            notificationAudience: notificationAudienceBinding,
            isSendingNotification: viewModel.isSendingNotification,
            onSend: {
                viewModel.sendNotification {
                    homeDestination = .notifications
                }
            },
            onBack: {
                viewModel.clearNotificationEditor()
                homeDestination = .notifications
            }
        )
    }

    @ViewBuilder
    func adminToolsCard(session: AuthorizedSession) -> some View {
        AdminToolsCardView(
            tokens: tokens,
            session: session,
            isExpanded: $isAdminToolsExpanded,
            memberDraft: memberDraftBinding,
            onCreateMember: viewModel.createAuthorizedMember,
            onToggleAdmin: { memberId in
                viewModel.toggleAdmin(memberId: memberId)
            },
            onToggleActive: { memberId in
                viewModel.toggleActive(memberId: memberId)
            }
        )
    }

    func homeDrawerPanel(drawerWidth: CGFloat) -> some View {
        let drawerOffset = resolvedHomeDrawerOffset(drawerWidth: drawerWidth)

        return HStack(spacing: 0) {
            HomeDrawerContentView(
                tokens: tokens,
                currentMember: currentHomeMember,
                currentDestination: homeDestination,
                installedVersion: installedVersion,
                onNavigate: { destination in
                    if destination == .publishNews {
                        viewModel.startCreatingNews()
                    }
                    if destination == .adminBroadcast {
                        viewModel.startCreatingNotification()
                    }
                    if destination == .news {
                        viewModel.refreshNews()
                    }
                    if destination == .notifications {
                        viewModel.refreshNotifications()
                    }
                    if destination == .products {
                        viewModel.refreshProducts()
                    }
                    if destination == .profile {
                        viewModel.refreshSharedProfiles()
                    }
                    if destination == .shifts {
                        viewModel.refreshShifts()
                    }
                    if destination == .settings {
                        viewModel.refreshDeliveryCalendar()
                    }
                    homeDestination = destination
                    closeHomeDrawer()
                },
                onCloseDrawer: closeHomeDrawer,
                onSignOut: {
                    closeHomeDrawer()
                    homeDestination = .dashboard
                    viewModel.signOut()
                    dispatchShell(.signedOut)
                }
            )
            .padding(tokens.spacing.lg)
            .frame(width: drawerWidth)
            .frame(maxHeight: .infinity, alignment: .topLeading)
            .background(tokens.colors.surfacePrimary)
            .overlay(alignment: .trailing) {
                Rectangle()
                    .fill(tokens.colors.borderSubtle.opacity(0.4))
                    .frame(width: 1)
            }
            .offset(x: drawerOffset)
            .gesture(
                DragGesture(minimumDistance: 12)
                    .onChanged { gesture in
                        if isHomeDrawerOpen {
                            homeDrawerDragOffset = min(0, gesture.translation.width)
                        }
                    }
                    .onEnded { gesture in
                        guard isHomeDrawerOpen else { return }
                        if gesture.translation.width < -56.resize {
                            closeHomeDrawer()
                        } else {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
                                homeDrawerDragOffset = 0
                            }
                        }
                    }
            )

            Spacer(minLength: 0)
        }
        .ignoresSafeArea()
        .allowsHitTesting(isHomeDrawerOpen)
        .animation(.spring(response: 0.28, dampingFraction: 0.82), value: isHomeDrawerOpen)
        .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.84), value: homeDrawerDragOffset)
    }

    @ViewBuilder
    var settingsRoute: some View {
        SettingsRouteView(
            tokens: tokens,
            session: currentHomeSession,
            isDevelopImpersonationEnabled: viewModel.isDevelopImpersonationEnabled,
            isImpersonationExpanded: $isImpersonationExpanded,
            isLoadingDeliveryCalendar: viewModel.isLoadingDeliveryCalendar,
            defaultDeliveryDayOfWeek: viewModel.defaultDeliveryDayOfWeek,
            shiftsFeed: viewModel.shiftsFeed,
            deliveryCalendarOverrides: viewModel.deliveryCalendarOverrides,
            isDeliveryCalendarEditorPresented: $isDeliveryCalendarEditorPresented,
            isDeliveryCalendarWeekPickerPresented: $isDeliveryCalendarWeekPickerPresented,
            selectedDeliveryCalendarWeekKey: $selectedDeliveryCalendarWeekKey,
            isSavingDeliveryCalendar: viewModel.isSavingDeliveryCalendar,
            isSubmittingShiftPlanningRequest: viewModel.isSubmittingShiftPlanningRequest,
            pendingShiftPlanningType: $pendingShiftPlanningType,
            onClearImpersonation: viewModel.clearImpersonation,
            onImpersonate: { memberId in
                viewModel.impersonate(memberId: memberId)
            },
            onRefreshDeliveryCalendar: viewModel.refreshDeliveryCalendar,
            onSaveDeliveryCalendarOverride: { weekKey, weekday, updatedByUserId in
                viewModel.saveDeliveryCalendarOverride(
                    weekKey: weekKey,
                    weekday: weekday,
                    updatedByUserId: updatedByUserId
                )
            },
            onDeleteDeliveryCalendarOverride: { weekKey in
                viewModel.deleteDeliveryCalendarOverride(weekKey: weekKey)
            },
            onSubmitShiftPlanningRequest: { type, completion in
                viewModel.submitShiftPlanningRequest(type: type, onSuccess: completion)
            }
        )
    }

    @ViewBuilder
    func placeholderRoute(titleKey: String, subtitleKey: String) -> some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleSection)
                Text(localizedKey(subtitleKey))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                ReguertaButton(localizedKey(AccessL10nKey.commonBack)) {
                    homeDestination = .dashboard
                }
            }
        }
    }

    @ViewBuilder
    func cardContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(tokens.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tokens.colors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(tokens.colors.borderSubtle, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }
    func resolvedHomeDrawerOffset(drawerWidth: CGFloat) -> CGFloat {
        if isHomeDrawerOpen {
            return min(0, homeDrawerDragOffset)
        }
        return -drawerWidth + max(0, homeDrawerDragOffset)
    }

    func openHomeDrawer() {
        withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
            isHomeDrawerOpen = true
            homeDrawerDragOffset = 0
        }
    }

    func closeHomeDrawer() {
        withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
            isHomeDrawerOpen = false
            homeDrawerDragOffset = 0
        }
    }
}
