import SwiftUI

extension AccessRootRoutingView {
    @ViewBuilder
    var homeRoute: some View {
        let drawerWidth = 304.resize
        let usesShellScroll =
            homeDestination != .dashboard &&
            homeDestination != .myOrder &&
            homeDestination != .receivedOrders &&
            homeDestination != .users
        let isDrawerPresented = isHomeDrawerOpen || homeDrawerDragOffset > 0
        let drawerProgress = resolvedHomeDrawerProgress(drawerWidth: drawerWidth)

        ZStack(alignment: .topLeading) {
            homeDrawerPanel(drawerWidth: drawerWidth)
                .zIndex(1)

            ZStack(alignment: .topLeading) {
                Group {
                    if usesShellScroll {
                        ScrollView(.vertical, showsIndicators: false) {
                            VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                                homeShellTopBar
                                    .padding(.horizontal, homeShellTopBarHorizontalPadding)
                                    .zIndex(1)
                                homeRouteContent

                                if feedbackCenter.messageKey != nil {
                                    feedbackMessageRoute
                                }
                            }
                            .padding(.top, 0)
                            .padding(.bottom, tokens.spacing.xxl)
                        }
                        .scrollDismissesKeyboard(.interactively)
                    } else {
                        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                            homeShellTopBar
                                .padding(.horizontal, homeShellTopBarHorizontalPadding)
                                .zIndex(1)
                            homeRouteContent
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                            if feedbackCenter.messageKey != nil {
                                feedbackMessageRoute
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .padding(.top, 0)
                        .padding(.bottom, tokens.spacing.xxl)
                    }
                }
                .disabled(isDrawerPresented)
                .padding(tokens.spacing.lg)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(tokens.colors.surfacePrimary.ignoresSafeArea())

                if isDrawerPresented {
                    homeDrawerHomeScrim(progress: drawerProgress, drawerWidth: drawerWidth)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .ignoresSafeArea(.container, edges: .bottom)
            .offset(x: resolvedHomeLayerOffset(drawerWidth: drawerWidth))
            .zIndex(2)
            .animation(homeDrawerAnimation, value: isHomeDrawerOpen)
            .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.84), value: homeDrawerDragOffset)

            if !isHomeDrawerOpen {
                Color.clear
                    .frame(width: 22.resize)
                    .frame(maxHeight: .infinity)
                    .ignoresSafeArea()
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
                    .zIndex(4)
            }
        }
    }

    var homeShellTopBar: some View {
        HomeShellTopBarView(
            tokens: tokens,
            titleKey: homeDestination.titleKey,
            titleOverride: homeShellTitleOverride,
            showsBack: homeDestination != .dashboard,
            showsNotificationsAction: homeDestination == .dashboard,
            hasNotificationIndicator: !rootViewModel.newsNotificationsViewModel.notificationsFeed.isEmpty,
            showsCartAction: homeDestination == .myOrder && !myOrderReadOnlyMode,
            cartUnits: myOrderCartUnits,
            showsCartBadge: homeDestination != .myOrder,
            onPrimaryAction: {
                if homeDestination == .dashboard {
                    openHomeDrawer()
                } else if homeDestination == .publishNews {
                    rootViewModel.newsNotificationsViewModel.clearNewsEditor()
                    homeDestination = .news
                } else if homeDestination == .adminBroadcast {
                    rootViewModel.newsNotificationsViewModel.clearNotificationEditor()
                    homeDestination = .notifications
                } else if homeDestination == .shiftSwapRequest {
                    rootViewModel.shiftsViewModel.clearShiftSwapDraft()
                    homeDestination = .shifts
                } else {
                    homeDestination = .dashboard
                }
            },
            onNotificationsAction: {
                homeDestination = .notifications
                Task { await rootViewModel.newsNotificationsViewModel.refreshNotifications() }
            },
            onCartAction: {
                myOrderCartOpenRequests += 1
            }
        )
    }

    var homeShellTitleOverride: String? {
        if homeDestination == .dashboard {
            return formatHomeTopBarDate(nowMillis: rootViewModel.shiftsViewModel.currentNowMillis)
        }
        if homeDestination == .myOrder {
            return "Pedido"
        }
        return nil
    }

    var homeShellTopBarHorizontalPadding: CGFloat {
        homeDestination == .myOrder ? tokens.spacing.lg : 0
    }

    func homeDrawerPanel(drawerWidth: CGFloat) -> some View {
        HomeDrawerContentView(
            tokens: tokens,
            currentMember: currentHomeMember,
            sharedProfile: rootViewModel.sharedProfileViewModel.profiles.first {
                $0.userId == currentHomeMember?.id
            },
            currentDestination: homeDestination,
            installedVersion: installedVersion,
            isDevelopBuild: viewModel.isDevelopImpersonationEnabled,
            onNavigate: handleHomeDrawerNavigation,
            onCloseDrawer: closeHomeDrawer,
            onSignOut: {
                closeHomeDrawer()
                homeDestination = .dashboard
                viewModel.signOut()
                dispatchShell(.signedOut)
            }
        )
        .padding(.top, 8.resizeStatusBarSize)
        .padding(.bottom, 16.resizeBottomSize)
        .padding(.horizontal, 16.resize)
        .frame(width: drawerWidth)
        .frame(maxHeight: .infinity, alignment: .topLeading)
        .background(tokens.colors.surfacePrimary.ignoresSafeArea())
        .offset(x: resolvedHomeDrawerOffset(drawerWidth: drawerWidth))
        .gesture(closeHomeDrawerDragGesture(drawerWidth: drawerWidth))
        .ignoresSafeArea(.container, edges: .vertical)
        .allowsHitTesting(isHomeDrawerOpen || homeDrawerDragOffset > 0)
        .accessibilityHidden(!isHomeDrawerOpen && homeDrawerDragOffset <= 0)
        .animation(homeDrawerAnimation, value: isHomeDrawerOpen)
        .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.84), value: homeDrawerDragOffset)
    }

    func homeDrawerHomeScrim(progress: CGFloat, drawerWidth: CGFloat) -> some View {
        Color.black
            .opacity(0.10 * Double(progress))
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .onTapGesture { closeHomeDrawer() }
            .gesture(closeHomeDrawerDragGesture(drawerWidth: drawerWidth))
    }

    func handleHomeDrawerNavigation(_ destination: HomeDestination) {
        refreshBeforeOpeningHomeDestination(destination)
        homeDestination = destination
        closeHomeDrawer()
    }

    func refreshBeforeOpeningHomeDestination(_ destination: HomeDestination) {
        let refreshActions: [(HomeDestination, () -> Void)] = [
            (.publishNews, { _ = rootViewModel.newsNotificationsViewModel.startCreatingNews() }),
            (.adminBroadcast, { _ = rootViewModel.newsNotificationsViewModel.startCreatingNotification() }),
            (.news, { Task { await rootViewModel.newsNotificationsViewModel.refreshNews() } }),
            (.notifications, { Task { await rootViewModel.newsNotificationsViewModel.refreshNotifications() } }),
            (.products, { Task { await rootViewModel.productsViewModel.refreshCatalog() } }),
            (.myOrder, { Task { await rootViewModel.productsViewModel.refreshOrderingProducts() } }),
            (.profile, { Task { await rootViewModel.sharedProfileViewModel.refreshProfiles() } }),
            (.users, { Task { await rootViewModel.usersViewModel.refreshMembers() } }),
            (.shifts, { Task { await rootViewModel.shiftsViewModel.refreshShifts() } }),
            (.settings, { Task { await rootViewModel.shiftsViewModel.refreshDeliveryCalendar() } })
        ]

        refreshActions.first { action in action.0 == destination }?.1()
    }

    func resolvedHomeDrawerOffset(drawerWidth: CGFloat) -> CGFloat {
        -drawerWidth * (1 - resolvedHomeDrawerProgress(drawerWidth: drawerWidth))
    }

    func resolvedHomeLayerOffset(drawerWidth: CGFloat) -> CGFloat {
        drawerWidth * resolvedHomeDrawerProgress(drawerWidth: drawerWidth)
    }

    func resolvedHomeDrawerProgress(drawerWidth: CGFloat) -> CGFloat {
        if isHomeDrawerOpen {
            return max(0, min(1, (drawerWidth + homeDrawerDragOffset) / drawerWidth))
        }
        return max(0, min(1, homeDrawerDragOffset / drawerWidth))
    }

    func closeHomeDrawerDragGesture(drawerWidth: CGFloat) -> some Gesture {
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
                    withAnimation(homeDrawerAnimation) {
                        homeDrawerDragOffset = 0
                    }
                }
            }
    }

    var homeDrawerAnimation: Animation {
        .easeInOut(duration: 0.45)
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
}
