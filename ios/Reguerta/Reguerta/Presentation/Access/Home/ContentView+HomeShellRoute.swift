import SwiftUI

extension ContentView {
    var homeRoute: some View {
        GeometryReader { proxy in
            let drawerWidth = min(320.resize, proxy.size.width * 0.78)
            let usesShellScroll =
                homeDestination != .myOrder &&
                homeDestination != .receivedOrders &&
                homeDestination != .users

            ZStack(alignment: .leading) {
                homeDrawerPanel(drawerWidth: drawerWidth)

                Group {
                    if usesShellScroll {
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
                    } else {
                        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                            homeShellTopBar
                            homeRouteContent
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                            if viewModel.feedbackMessageKey != nil {
                                feedbackMessageRoute
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .padding(.vertical, tokens.spacing.lg)
                    }
                }
                .disabled(isHomeDrawerOpen)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(tokens.colors.surfacePrimary)
                .offset(x: resolvedHomeLayerOffset(drawerWidth: drawerWidth))
                .shadow(color: .black.opacity(isHomeDrawerOpen ? 0.22 : 0), radius: 14.resize, x: -4.resize, y: 0)
                .animation(.spring(response: 0.28, dampingFraction: 0.82), value: isHomeDrawerOpen)
                .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.84), value: homeDrawerDragOffset)
                .overlay {
                    if isHomeDrawerOpen {
                        Color.black.opacity(0.08)
                            .contentShape(Rectangle())
                            .onTapGesture { closeHomeDrawer() }
                    }
                }
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

    var homeShellTopBar: some View {
        HomeShellTopBarView(
            tokens: tokens,
            titleKey: homeDestination.titleKey,
            titleOverride: homeDestination == .dashboard
                ? formatHomeTopBarDate(nowMillis: viewModel.nowOverrideMillis ?? Int64(Date().timeIntervalSince1970 * 1_000))
                : nil,
            showsBack: homeDestination != .dashboard,
            hasNotificationIndicator: !viewModel.notificationsFeed.isEmpty,
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

    func homeDrawerPanel(drawerWidth: CGFloat) -> some View {
        HStack(spacing: 0) {
            HomeDrawerContentView(
                tokens: tokens,
                currentMember: currentHomeMember,
                sharedProfile: viewModel.sharedProfiles.first(where: { $0.userId == currentHomeMember?.id }),
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
            .padding(tokens.spacing.lg)
            .frame(width: drawerWidth)
            .frame(maxHeight: .infinity, alignment: .topLeading)
            .background(tokens.colors.surfacePrimary)
            .overlay(alignment: .trailing) {
                Rectangle()
                    .fill(tokens.colors.borderSubtle.opacity(0.4))
                    .frame(width: 1)
            }

            Spacer(minLength: 0)
        }
        .ignoresSafeArea()
        .allowsHitTesting(isHomeDrawerOpen || homeDrawerDragOffset > 0)
        .animation(.spring(response: 0.28, dampingFraction: 0.82), value: isHomeDrawerOpen)
        .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.84), value: homeDrawerDragOffset)
    }

    func handleHomeDrawerNavigation(_ destination: HomeDestination) {
        refreshBeforeOpeningHomeDestination(destination)
        homeDestination = destination
        closeHomeDrawer()
    }

    func refreshBeforeOpeningHomeDestination(_ destination: HomeDestination) {
        let refreshActions: [(HomeDestination, () -> Void)] = [
            (.publishNews, { viewModel.startCreatingNews() }),
            (.adminBroadcast, { viewModel.startCreatingNotification() }),
            (.news, { viewModel.refreshNews() }),
            (.notifications, { viewModel.refreshNotifications() }),
            (.products, { viewModel.refreshProducts() }),
            (.myOrder, { viewModel.refreshMyOrderProducts() }),
            (.profile, { viewModel.refreshSharedProfiles() }),
            (.users, { viewModel.refreshMembers() }),
            (.shifts, { viewModel.refreshShifts() }),
            (.settings, { viewModel.refreshDeliveryCalendar() })
        ]

        refreshActions.first { action in action.0 == destination }?.1()
    }

    func resolvedHomeDrawerOffset(drawerWidth: CGFloat) -> CGFloat {
        resolvedHomeLayerOffset(drawerWidth: drawerWidth) - drawerWidth
    }

    func resolvedHomeLayerOffset(drawerWidth: CGFloat) -> CGFloat {
        if isHomeDrawerOpen {
            return max(0, drawerWidth + homeDrawerDragOffset)
        }
        return max(0, min(drawerWidth, homeDrawerDragOffset))
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
