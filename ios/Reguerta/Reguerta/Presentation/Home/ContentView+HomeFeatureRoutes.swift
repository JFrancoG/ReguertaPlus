import SwiftUI

extension AccessRootRoutingView {
    @ViewBuilder
    var shiftsRoute: some View {
        ShiftsRouteView(
            tokens: tokens,
            viewModel: rootViewModel.shiftsViewModel,
            onRefreshFromNextShifts: {
                homeDestination = .shifts
                Task { await rootViewModel.shiftsViewModel.refreshShifts() }
            },
            onStartSwapRequestForShift: { shiftId in
                rootViewModel.shiftsViewModel.startCreatingShiftSwap(shiftId: shiftId)
                homeDestination = .shiftSwapRequest
            }
        )
    }

    var shiftSwapRequestRoute: some View {
        let shiftsViewModel = rootViewModel.shiftsViewModel
        let shift = shiftsViewModel.shiftsFeed.first(where: { $0.id == shiftsViewModel.shiftSwapDraft.shiftId })
        let shiftDisplayLabel = shift.map {
            shiftsViewModel.shiftSwapDisplayLabel($0, memberId: $0.assignedUserIds.first ?? $0.helperUserId)
        } ?? shiftsViewModel.shiftSwapDraft.shiftId

        return ShiftSwapRequestRouteView(
            tokens: tokens,
            viewModel: shiftsViewModel,
            shift: shift,
            shiftDisplayLabel: shiftDisplayLabel,
            onSave: {
                Task {
                    if await shiftsViewModel.saveShiftSwapRequest() {
                        homeDestination = .shifts
                    }
                }
            },
            onBack: {
                shiftsViewModel.clearShiftSwapDraft()
                homeDestination = .shifts
            }
        )
    }

    var newsListRoute: some View {
        let newsNotificationsViewModel = rootViewModel.newsNotificationsViewModel
        return NewsListRouteView(
            tokens: tokens,
            viewModel: newsNotificationsViewModel,
            newsMetaText: { article in
                l10n(AccessL10nKey.newsMetaFormat, article.publishedBy)
            },
            onCreateNews: {
                homeDestination = .publishNews
            },
            onEditNews: {
                homeDestination = .publishNews
            }
        )
    }

    var newsEditorRoute: some View {
        NewsEditorRouteView(
            tokens: tokens,
            viewModel: rootViewModel.newsNotificationsViewModel,
            onSaveSuccess: {
                homeDestination = .news
            },
            onBack: {
                homeDestination = .news
            }
        )
    }

    var productsRoute: some View {
        ProductsRouteView(
            tokens: tokens,
            viewModel: rootViewModel.productsViewModel
        )
    }

    @ViewBuilder
    var usersRoute: some View {
        UsersRouteView(
            tokens: tokens,
            viewModel: rootViewModel.usersViewModel
        )
    }

    var myOrderRoute: some View {
        MyOrderRouteView(
            tokens: tokens,
            viewModel: rootViewModel.myOrderViewModel,
            context: MyOrderRouteContext(
                products: rootViewModel.productsViewModel.myOrderProducts,
                seasonalCommitments: rootViewModel.productsViewModel.myOrderSeasonalCommitments,
                shifts: rootViewModel.shiftsViewModel.shiftsFeed,
                defaultDeliveryDayOfWeek: rootViewModel.shiftsViewModel.defaultDeliveryDayOfWeek,
                deliveryCalendarOverrides: rootViewModel.shiftsViewModel.deliveryCalendarOverrides,
                nowMillis: rootViewModel.shiftsViewModel.currentNowMillis,
                isLoading: rootViewModel.productsViewModel.isLoadingOrderingProducts ||
                    !rootViewModel.productsViewModel.hasLoadedOrderingProducts,
                currentMember: currentHomeMember,
                members: currentHomeSession?.members ?? []
            ),
            cartOpenRequests: myOrderCartOpenRequests,
            onCartUnitsChange: { units in
                myOrderCartUnits = units
            },
            onReadOnlyModeChange: { isReadOnly in
                myOrderReadOnlyMode = isReadOnly
            },
            onCheckoutSuccessAcknowledge: {
                homeDestination = .dashboard
            }
        )
    }

    var receivedOrdersRoute: some View {
        ReceivedOrdersRouteView(
            tokens: tokens,
            viewModel: rootViewModel.receivedOrdersViewModel,
            context: ReceivedOrdersRouteContext(
                currentMember: currentHomeMember,
                shifts: rootViewModel.shiftsViewModel.shiftsFeed,
                defaultDeliveryDayOfWeek: rootViewModel.shiftsViewModel.defaultDeliveryDayOfWeek,
                deliveryCalendarOverrides: rootViewModel.shiftsViewModel.deliveryCalendarOverrides,
                nowMillis: rootViewModel.shiftsViewModel.currentNowMillis
            )
        )
    }

    var notificationsListRoute: some View {
        let newsNotificationsViewModel = rootViewModel.newsNotificationsViewModel
        return NotificationsListRouteView(
            tokens: tokens,
            viewModel: newsNotificationsViewModel,
            notificationMetaText: { notification in
                l10n(
                    AccessL10nKey.notificationsMetaFormat,
                    localizedDateTime(notification.sentAtMillis)
                )
            },
            onCreateNotification: {
                homeDestination = .adminBroadcast
            }
        )
    }

    @ViewBuilder
    var sharedProfileRoute: some View {
        if let session = currentHomeSession {
            SharedProfileHubRoute(
                tokens: tokens,
                session: session,
                viewModel: rootViewModel.sharedProfileViewModel,
                displayName: { displayName(for: $0, session: session) }
            )
        }
    }

    var notificationEditorRoute: some View {
        NotificationEditorRouteView(
            tokens: tokens,
            viewModel: rootViewModel.newsNotificationsViewModel,
            onSendSuccess: {
                homeDestination = .notifications
            },
            onBack: {
                homeDestination = .notifications
            }
        )
    }

    @ViewBuilder
    var settingsRoute: some View {
        SettingsRouteView(
            tokens: tokens,
            session: currentHomeSession,
            shiftsViewModel: rootViewModel.shiftsViewModel,
            isDevelopImpersonationEnabled: viewModel.isDevelopImpersonationEnabled,
            isImpersonationExpanded: rootBinding(\.isImpersonationExpanded),
            nowOverrideMillis: rootViewModel.nowOverrideMillis,
            onClearImpersonation: viewModel.clearImpersonation,
            onImpersonate: { memberId in
                viewModel.impersonate(memberId: memberId)
            },
            onSetNowOverrideMillis: rootViewModel.setNowOverrideMillis,
            onShiftNowByDays: rootViewModel.shiftNowByDays
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
}
