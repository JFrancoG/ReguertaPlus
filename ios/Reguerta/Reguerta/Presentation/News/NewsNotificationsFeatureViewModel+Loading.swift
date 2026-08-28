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
                operation: {
                    try await newsRepository.news(
                        visibleTo: context.session.member,
                        environment: context.environment
                    )
                }
            )
            try Task.checkCancellation()
            guard isCurrentNewsRefresh(operationId, context: context) else {
                finishNewsRefreshOperation(operationId)
                return
            }
            applyNewsSnapshot(allNews, member: context.session.member)
        } catch is CancellationError {
            finishNewsRefreshOperation(operationId)
            return
        } catch {
            if isCurrentNewsRefresh(operationId, context: context),
               failureFeedbackOwnership.map({
                   canPublishNewsConvergenceFeedback(for: $0)
               }) ?? true {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
        finishNewsRefreshOperation(operationId)
    }

    func refreshNotifications(
        failureFeedbackOwnership: NotificationMutationEditorOwnership? = nil,
        recoversInitialFailure: Bool = false
    ) async {
        clearNotificationShiftDetail()
        guard let context = captureAuthorizedSessionContext() else { return }

        let operationId = beginNotificationsRefreshOperation()
        do {
            let (allNotifications, readNotificationIDs) = try await performInitialLoadWithRecovery(
                enabled: recoversInitialFailure,
                shouldRetry: { self.isCurrentNotificationsRefresh(operationId, context: context) },
                operation: {
                    async let notifications = notificationRepository.notifications(
                        visibleTo: context.session.member,
                        environment: context.environment
                    )
                    async let readIDs = notificationRepository.readNotificationIds(
                        memberId: context.memberID,
                        environment: context.environment
                    )
                    return try await (notifications, readIDs)
                }
            )
            try Task.checkCancellation()
            guard isCurrentNotificationsRefresh(operationId, context: context) else {
                finishNotificationsRefreshOperation(operationId)
                return
            }
            applyNotificationsSnapshot(
                allNotifications,
                readNotificationIDs: readNotificationIDs,
                member: context.session.member
            )
        } catch is CancellationError {
            finishNotificationsRefreshOperation(operationId)
            return
        } catch {
            if isCurrentNotificationsRefresh(operationId, context: context),
               failureFeedbackOwnership.map({
                   isCurrentNotificationMutationEditor($0)
               }) ?? true {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
        finishNotificationsRefreshOperation(operationId)
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
        finishNotificationsRouteOperation(routeOperationId)
    }

    func refreshPushNotificationPermission(showDialogIfInactive: Bool) async {
        guard let context = captureAuthorizedSessionContext() else { return }
        await refreshPushNotificationPermission(
            showDialogIfInactive: showDialogIfInactive,
            context: context
        )
    }

    func markVisibleNotificationsReadOnExit() async {
        clearNotificationShiftDetail()
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
                readAtMillis: nowMillisProvider(),
                environment: context.environment
            )
            try Task.checkCancellation()
        } catch is CancellationError {
            finishMarkReadOperation(operationId)
            return
        } catch {
            if isCurrentMarkRead(operationId, context: context) {
                feedbackCenter.show(AccessL10nKey.authErrorNetwork)
            }
            finishMarkReadOperation(operationId)
            return
        }
        guard isCurrentMarkRead(operationId, context: context) else {
            finishMarkReadOperation(operationId)
            return
        }
        pendingConfirmedReadNotificationIds.formUnion(unreadIDs)
        readNotificationIds.formUnion(pendingConfirmedReadNotificationIds)
        notificationsStateRevision &+= 1
        finishMarkReadOperation(operationId)
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
        guard latestSession.representsActiveAuthorization else {
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
        let expectedSignature = context.authorizationSignature
        return sessionIdentityEpoch == context.epoch &&
            environmentRoutingGeneration == context.environmentRoutingGeneration &&
            authorizationSignature(for: latestSession) == expectedSignature &&
            authorizationSignature(for: currentSession) == expectedSignature &&
            memberAuthorizationSignature(for: currentMember) == expectedSignature.currentMember &&
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
        return authorizationSignature(for: currentSession) == authorizationSignature(for: session) &&
            memberAuthorizationSignature(for: currentMember) == memberAuthorizationSignature(for: session.member) &&
            currentEnvironment == environment
    }

    func makeSessionContext(_ session: AuthorizedSession) -> SessionContext {
        SessionContext(
            session: session,
            epoch: sessionIdentityEpoch,
            authorizationSignature: authorizationSignature(for: session),
            canPublishNews: session.member.canPublishNews,
            canSendAdminNotifications: session.member.canSendAdminNotifications,
            environmentRoutingGeneration: environmentRoutingGeneration
        )
    }

    func authorizationSignature(for session: AuthorizedSession) -> SessionAuthorizationSignature {
        SessionAuthorizationSignature(
            principalUID: session.principal.uid,
            authenticatedMember: memberAuthorizationSignature(for: session.authenticatedMember),
            currentMember: memberAuthorizationSignature(for: session.member),
            environment: session.environment
        )
    }

    func memberAuthorizationSignature(for member: Member) -> MemberAuthorizationSignature {
        MemberAuthorizationSignature(
            id: member.id,
            authUID: member.authUid,
            roles: member.roles,
            isActive: member.isActive
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
        newsHighlightTask?.cancel()
        newsHighlightTask = nil
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

    func finishNewsRefreshOperation(_ operationId: UInt64) {
        guard activeNewsRefreshOperationId == operationId else { return }
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

    func finishNotificationsRefreshOperation(_ operationId: UInt64) {
        guard activeNotificationsRefreshOperationId == operationId else { return }
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

    func finishNotificationsRouteOperation(_ operationId: UInt64) {
        guard activeNotificationsRouteOperationId == operationId else { return }
        activeNotificationsRouteOperationId = nil
    }

    func refreshPushNotificationPermission(showDialogIfInactive: Bool, context: SessionContext) async {
        nextPermissionRefreshOperationId &+= 1
        let operationId = nextPermissionRefreshOperationId
        activePermissionRefreshOperationId = operationId
        let isActive = await pushNotificationPermissionProvider.isPushNotificationPermissionActive()
        guard activePermissionRefreshOperationId == operationId else { return }
        defer { activePermissionRefreshOperationId = nil }
        guard !Task.isCancelled,
              isCurrentSession(context) else {
            return
        }
        isPushNotificationPermissionActive = isActive
        if showDialogIfInactive, !isActive, !didDismissPushNotificationPermissionDialogForVisit {
            showsPushNotificationPermissionDialog = true
        }
    }

    func beginMarkReadOperation() -> UInt64 {
        nextMarkReadOperationId &+= 1
        activeMarkReadOperationId = nextMarkReadOperationId
        return nextMarkReadOperationId
    }

    func isCurrentMarkRead(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeMarkReadOperationId == operationId && isCurrentSession(context)
    }

    func finishMarkReadOperation(_ operationId: UInt64) {
        guard activeMarkReadOperationId == operationId else { return }
        activeMarkReadOperationId = nil
    }
}
