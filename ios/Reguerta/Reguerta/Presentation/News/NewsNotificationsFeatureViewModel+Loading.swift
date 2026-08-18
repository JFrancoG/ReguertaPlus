import Foundation

extension NewsNotificationsFeatureViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        invalidateCommunityHydration()
        switch mode {
        case .authorized(let session):
            let environment = environmentProvider()
            let contextChanged = !storedContextMatches(
                session,
                environment: environment
            )
            if contextChanged {
                sessionIdentityEpoch &+= 1
                clearCommunityContextState()
            }
            currentSession = session
            currentMember = session.member
            currentEnvironment = session.environment
            guard environment == session.environment else {
                if !contextChanged {
                    sessionIdentityEpoch &+= 1
                    clearCommunityContextState()
                }
                currentSession = nil
                currentMember = nil
                currentEnvironment = environment
                return
            }
            startCommunityHydration()
        case .signedOut, .unauthorized:
            sessionIdentityEpoch &+= 1
            clearCommunityContextState()
            currentSession = nil
            currentMember = nil
            currentEnvironment = nil
        }
    }

    func handleEnvironmentRoutingTransition(_ transition: SessionEnvironmentRoutingTransition) {
        guard transition.generation > environmentRoutingGeneration else { return }
        environmentRoutingGeneration = transition.generation
        sessionIdentityEpoch &+= 1
        invalidateCommunityHydration()
        clearCommunityContextState()
        currentSession = nil
        currentMember = nil
        currentEnvironment = transition.environment
    }

    func refreshNews(
        failureFeedbackOwnership: NewsConvergenceFeedbackOwnership? = nil,
        recoversInitialFailure: Bool = false
    ) async {
        guard let context = captureAuthorizedSessionContext() else { return }

        let operationId = beginNewsRefreshOperation()
        do {
            let allNews = try await performInitialLoadWithRecovery(
                enabled: recoversInitialFailure,
                shouldRetry: { self.isCurrentNewsRefresh(operationId, context: context) },
                operation: { try await newsRepository.news(visibleTo: context.session.member) }
            )
            try Task.checkCancellation()
            guard isCurrentNewsRefresh(operationId, context: context) else { return }
            applyNewsSnapshot(allNews, member: context.session.member)
        } catch is CancellationError {
            finishNewsRefreshOperation(operationId, context: context)
            return
        } catch {
            if isCurrentNewsRefresh(operationId, context: context),
               failureFeedbackOwnership.map({
                   canPublishNewsConvergenceFeedback(for: $0)
               }) ?? true {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
        finishNewsRefreshOperation(operationId, context: context)
    }

    func refreshNotifications(
        failureFeedbackOwnership: NotificationMutationEditorOwnership? = nil,
        recoversInitialFailure: Bool = false
    ) async {
        guard let context = captureAuthorizedSessionContext() else { return }

        let operationId = beginNotificationsRefreshOperation()
        do {
            let (allNotifications, readNotificationIDs) = try await performInitialLoadWithRecovery(
                enabled: recoversInitialFailure,
                shouldRetry: { self.isCurrentNotificationsRefresh(operationId, context: context) },
                operation: {
                    async let notifications = notificationRepository.notifications(
                        visibleTo: context.session.member
                    )
                    async let readIDs = notificationRepository.readNotificationIds(
                        memberId: context.memberID
                    )
                    return try await (notifications, readIDs)
                }
            )
            try Task.checkCancellation()
            guard isCurrentNotificationsRefresh(operationId, context: context) else { return }
            applyNotificationsSnapshot(
                allNotifications,
                readNotificationIDs: readNotificationIDs,
                member: context.session.member
            )
        } catch is CancellationError {
            finishNotificationsRefreshOperation(operationId, context: context)
            return
        } catch {
            if isCurrentNotificationsRefresh(operationId, context: context),
               failureFeedbackOwnership.map({
                   isCurrentNotificationMutationEditor($0)
               }) ?? true {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
        finishNotificationsRefreshOperation(operationId, context: context)
    }

    func prepareNotificationsRoute() async {
        guard let context = captureAuthorizedSessionContext() else { return }
        let routeOperationId = beginNotificationsRouteOperation()
        didDismissPushNotificationPermissionDialogForVisit = false

        await refreshNotifications()
        guard isCurrentNotificationsRoute(routeOperationId, context: context) else { return }
        await refreshPushNotificationPermission(
            showDialogIfInactive: true,
            context: context
        )
        finishNotificationsRouteOperation(routeOperationId, context: context)
    }

    func refreshPushNotificationPermission(showDialogIfInactive: Bool) async {
        guard let context = captureAuthorizedSessionContext() else { return }
        await refreshPushNotificationPermission(
            showDialogIfInactive: showDialogIfInactive,
            context: context
        )
    }

    func markVisibleNotificationsReadOnExit() async {
        guard let context = captureAuthorizedSessionContext() else { return }
        let unreadIDs = notificationsFeed
            .map(\.id)
            .filter { !readNotificationIds.contains($0) }
        guard !unreadIDs.isEmpty else { return }

        let operationId = beginMarkReadOperation()
        do {
            try await notificationRepository.markNotificationsRead(
                memberId: context.memberID,
                notificationIds: unreadIDs,
                readAtMillis: nowMillisProvider()
            )
            try Task.checkCancellation()
        } catch is CancellationError {
            finishMarkReadOperation(operationId, context: context)
            return
        } catch {
            if isCurrentMarkRead(operationId, context: context) {
                feedbackCenter.show(AccessL10nKey.authErrorNetwork)
            }
            finishMarkReadOperation(operationId, context: context)
            return
        }
        guard isCurrentMarkRead(operationId, context: context) else {
            finishMarkReadOperation(operationId, context: context)
            return
        }
        pendingConfirmedReadNotificationIds.formUnion(unreadIDs)
        readNotificationIds.formUnion(pendingConfirmedReadNotificationIds)
        notificationsStateRevision &+= 1
        finishMarkReadOperation(operationId, context: context)
    }
}

extension NewsNotificationsFeatureViewModel {
    var authorizedSession: AuthorizedSession? {
        switch sessionViewModel.mode {
        case .authorized(let session):
            session
        case .signedOut, .unauthorized:
            nil
        }
    }

    func captureAuthorizedSessionContext() -> SessionContext? {
        guard let latestSession = authorizedSession else {
            if currentSession != nil || currentMember != nil || currentEnvironment != nil {
                sessionIdentityEpoch &+= 1
                reset()
            }
            return nil
        }

        let runtimeEnvironment = environmentProvider()
        guard runtimeEnvironment == latestSession.environment else {
            if currentSession != nil || currentMember != nil || currentEnvironment != runtimeEnvironment {
                sessionIdentityEpoch &+= 1
                invalidateCommunityHydration()
                clearCommunityContextState()
                currentSession = nil
                currentMember = nil
                currentEnvironment = runtimeEnvironment
            }
            return nil
        }

        if !storedContextMatches(latestSession, environment: runtimeEnvironment) {
            sessionIdentityEpoch &+= 1
            invalidateCommunityHydration()
            clearCommunityContextState()
        }
        currentSession = latestSession
        currentMember = latestSession.member
        currentEnvironment = runtimeEnvironment
        return makeSessionContext(latestSession)
    }

    func isCurrentSession(_ context: SessionContext) -> Bool {
        guard let latestSession = authorizedSession,
              let currentSession,
              let currentMember else {
            return false
        }
        return sessionIdentityEpoch == context.epoch &&
            environmentRoutingGeneration == context.environmentRoutingGeneration &&
            context.principalUID == latestSession.principal.uid &&
            context.principalUID == currentSession.principal.uid &&
            context.memberID == latestSession.member.id &&
            context.memberID == currentSession.member.id &&
            context.memberRoles == latestSession.member.roles &&
            context.memberRoles == currentSession.member.roles &&
            context.memberRoles == currentMember.roles &&
            context.canPublishNews == latestSession.member.canPublishNews &&
            context.canPublishNews == currentSession.member.canPublishNews &&
            context.canSendAdminNotifications == latestSession.member.canSendAdminNotifications &&
            context.canSendAdminNotifications == currentSession.member.canSendAdminNotifications &&
            context.environment == latestSession.environment &&
            context.environment == currentSession.environment &&
            context.environment == currentEnvironment &&
            context.environment == environmentProvider()
    }

    func reset() {
        invalidateCommunityHydration()
        clearCommunityContextState()
        currentSession = nil
        currentMember = nil
        currentEnvironment = nil
    }

}

private extension NewsNotificationsFeatureViewModel {
    func storedContextMatches(_ session: AuthorizedSession, environment: SessionEnvironment) -> Bool {
        guard let currentSession,
              let currentMember,
              let currentEnvironment else {
            return false
        }
        return currentSession.principal.uid == session.principal.uid &&
            currentSession.member.id == session.member.id &&
            currentMember.id == session.member.id &&
            currentSession.member.roles == session.member.roles &&
            currentMember.roles == session.member.roles &&
            currentSession.member.canPublishNews == session.member.canPublishNews &&
            currentMember.canPublishNews == session.member.canPublishNews &&
            currentSession.member.canSendAdminNotifications == session.member.canSendAdminNotifications &&
            currentMember.canSendAdminNotifications == session.member.canSendAdminNotifications &&
            currentSession.environment == session.environment &&
            currentEnvironment == environment
    }

    func makeSessionContext(_ session: AuthorizedSession) -> SessionContext {
        SessionContext(
            session: session,
            epoch: sessionIdentityEpoch,
            principalUID: session.principal.uid,
            memberID: session.member.id,
            memberRoles: session.member.roles,
            canPublishNews: session.member.canPublishNews,
            canSendAdminNotifications: session.member.canSendAdminNotifications,
            environment: session.environment,
            environmentRoutingGeneration: environmentRoutingGeneration
        )
    }

    func invalidateCommunityHydration() {
        communityHydrationGeneration &+= 1
        activeCommunityHydrationTask?.cancel()
        activeCommunityHydrationTask = nil
    }

    func startCommunityHydration() {
        let generation = communityHydrationGeneration
        activeCommunityHydrationTask = Task { [weak self] in
            guard let self else { return }
            await self.refreshNews(recoversInitialFailure: true)
            guard self.isCurrentCommunityHydration(generation) else { return }
            await self.refreshNotifications(recoversInitialFailure: true)
            self.finishCommunityHydration(generation)
        }
    }

    func isCurrentCommunityHydration(_ generation: UInt64) -> Bool {
        !Task.isCancelled && communityHydrationGeneration == generation
    }

    func finishCommunityHydration(_ generation: UInt64) {
        guard communityHydrationGeneration == generation else { return }
        activeCommunityHydrationTask = nil
    }

    func clearCommunityContextState() {
        resetNewsFeed()
        resetNotificationsFeed()
        newsDraft = NewsDraft()
        notificationDraft = NotificationDraft()
        editingNewsId = nil
        pendingNewsDeletionId = nil
        pendingNewsSaveConfirmation = nil
        isNotificationSendConfirmationPresented = false
        highlightedNewsId = nil
        isSavingNews = false
        isUploadingNewsImage = false
        newsEditorRevision &+= 1
        newsDraftRevision &+= 1
        notificationEditorRevision &+= 1
        notificationDraftRevision &+= 1
        newsDeletionRevision &+= 1
        activeNewsImageUploadOperationId = nil
        isSendingNotification = false
        activeNotificationsRouteOperationId = nil
        activePermissionRefreshOperationId = nil
        activeMarkReadOperationId = nil
        activeNewsMutationOperationId = nil
        activeNotificationMutationOperationId = nil
    }

    func beginNewsRefreshOperation() -> UInt64 {
        nextNewsRefreshOperationId &+= 1
        activeNewsRefreshOperationId = nextNewsRefreshOperationId
        isLoadingNews = true
        return nextNewsRefreshOperationId
    }

    func isCurrentNewsRefresh(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeNewsRefreshOperationId == operationId && isCurrentSession(context)
    }

    func finishNewsRefreshOperation(_ operationId: UInt64, context: SessionContext) {
        guard isCurrentNewsRefresh(operationId, context: context) else { return }
        activeNewsRefreshOperationId = nil
        isLoadingNews = false
    }

    func beginNotificationsRefreshOperation() -> UInt64 {
        nextNotificationsRefreshOperationId &+= 1
        activeNotificationsRefreshOperationId = nextNotificationsRefreshOperationId
        isLoadingNotifications = true
        return nextNotificationsRefreshOperationId
    }

    func isCurrentNotificationsRefresh(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeNotificationsRefreshOperationId == operationId && isCurrentSession(context)
    }

    func finishNotificationsRefreshOperation(_ operationId: UInt64, context: SessionContext) {
        guard isCurrentNotificationsRefresh(operationId, context: context) else { return }
        activeNotificationsRefreshOperationId = nil
        isLoadingNotifications = false
    }

    func beginNotificationsRouteOperation() -> UInt64 {
        nextNotificationsRouteOperationId &+= 1
        activeNotificationsRouteOperationId = nextNotificationsRouteOperationId
        return nextNotificationsRouteOperationId
    }

    func isCurrentNotificationsRoute(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeNotificationsRouteOperationId == operationId && isCurrentSession(context)
    }

    func finishNotificationsRouteOperation(_ operationId: UInt64, context: SessionContext) {
        guard isCurrentNotificationsRoute(operationId, context: context) else { return }
        activeNotificationsRouteOperationId = nil
    }

    func refreshPushNotificationPermission(showDialogIfInactive: Bool, context: SessionContext) async {
        nextPermissionRefreshOperationId &+= 1
        let operationId = nextPermissionRefreshOperationId
        activePermissionRefreshOperationId = operationId
        let isActive = await pushNotificationPermissionProvider.isPushNotificationPermissionActive()
        guard !Task.isCancelled,
              activePermissionRefreshOperationId == operationId,
              isCurrentSession(context) else {
            return
        }
        isPushNotificationPermissionActive = isActive
        if showDialogIfInactive, !isActive, !didDismissPushNotificationPermissionDialogForVisit {
            showsPushNotificationPermissionDialog = true
        }
        activePermissionRefreshOperationId = nil
    }

    func beginMarkReadOperation() -> UInt64 {
        nextMarkReadOperationId &+= 1
        activeMarkReadOperationId = nextMarkReadOperationId
        return nextMarkReadOperationId
    }

    func isCurrentMarkRead(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeMarkReadOperationId == operationId && isCurrentSession(context)
    }

    func finishMarkReadOperation(_ operationId: UInt64, context: SessionContext) {
        guard isCurrentMarkRead(operationId, context: context) else { return }
        activeMarkReadOperationId = nil
    }
}
