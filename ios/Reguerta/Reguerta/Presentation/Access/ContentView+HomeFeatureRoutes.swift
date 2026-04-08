import SwiftUI

extension ContentView {
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
}
