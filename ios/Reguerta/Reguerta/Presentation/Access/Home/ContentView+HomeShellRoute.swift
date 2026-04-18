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
                    .disabled(isHomeDrawerOpen)
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
                    .disabled(isHomeDrawerOpen)
                }

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

    func homeDrawerPanel(drawerWidth: CGFloat) -> some View {
        let drawerOffset = resolvedHomeDrawerOffset(drawerWidth: drawerWidth)

        return HStack(spacing: 0) {
            HomeDrawerContentView(
                tokens: tokens,
                currentMember: currentHomeMember,
                currentDestination: homeDestination,
                installedVersion: installedVersion,
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

    func handleHomeDrawerNavigation(_ destination: HomeDestination) {
        switch destination {
        case .publishNews:
            viewModel.startCreatingNews()
        case .adminBroadcast:
            viewModel.startCreatingNotification()
        case .news:
            viewModel.refreshNews()
        case .notifications:
            viewModel.refreshNotifications()
        case .products:
            viewModel.refreshProducts()
        case .myOrder:
            viewModel.refreshMyOrderProducts()
        case .profile:
            viewModel.refreshSharedProfiles()
        case .users:
            viewModel.refreshMembers()
        case .shifts:
            viewModel.refreshShifts()
        case .settings:
            viewModel.refreshDeliveryCalendar()
        default:
            break
        }

        homeDestination = destination
        closeHomeDrawer()
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
