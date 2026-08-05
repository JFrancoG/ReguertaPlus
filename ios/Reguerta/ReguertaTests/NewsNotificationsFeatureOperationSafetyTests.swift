import Testing

@testable import Reguerta

@MainActor
@Suite("News and notification operation safety")
struct NewsNotificationsFeatureOperationSafetyTests {
    @Test(
        "Same-context News failures preserve the complete snapshot and finish loading",
        arguments: [
            RepositoryError.unavailable(resource: "news"),
            RepositoryError.permissionDenied(resource: "news"),
            RepositoryError.invalidData(resource: "news/broken")
        ]
    )
    func newsFailuresPreserveSnapshot(_ error: RepositoryError) async {
        let old = safetyNewsArticle(id: "old")
        let repository = SequencedNewsRepository(outcomes: [.failure(error)])
        let viewModel = makeSafetyViewModel(newsRepository: repository)
        viewModel.latestNews = [old]
        viewModel.newsFeed = [old]

        await viewModel.refreshNews()

        #expect(viewModel.latestNews == [old])
        #expect(viewModel.newsFeed == [old])
        #expect(viewModel.isLoadingNews == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test("A valid News retry atomically replaces the preserved snapshot") func newsRetryReplacesSnapshot() async {
        let old = safetyNewsArticle(id: "old")
        let current = safetyNewsArticle(id: "current", publishedAtMillis: 2)
        let repository = SequencedNewsRepository(
            outcomes: [
                .failure(.unavailable(resource: "news")),
                .success([current])
            ]
        )
        let viewModel = makeSafetyViewModel(newsRepository: repository)
        viewModel.latestNews = [old]
        viewModel.newsFeed = [old]

        await viewModel.refreshNews()
        viewModel.feedbackCenter.clear()
        await viewModel.refreshNews()

        #expect(viewModel.latestNews == [current])
        #expect(viewModel.newsFeed == [current])
        #expect(viewModel.isLoadingNews == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test("Notification failure preserves feed and read state inside one context")
    func notificationFailurePreservesSnapshot() async {
        let old = safetyNotification(id: "old")
        let repository = SequencedNotificationRepository(
            notificationOutcomes: [.failure(.permissionDenied(resource: "notificationInbox"))],
            readOutcomes: [.success(["old"])]
        )
        let viewModel = makeSafetyViewModel(notificationRepository: repository)
        viewModel.notificationsFeed = [old]
        viewModel.readNotificationIds = ["old"]

        await viewModel.refreshNotifications()

        #expect(viewModel.notificationsFeed == [old])
        #expect(viewModel.readNotificationIds == ["old"])
        #expect(viewModel.isLoadingNotifications == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test("An authorized update inside the same context never clears the previous snapshot")
    func sameContextSessionUpdatePreservesSnapshot() async {
        let member = safetyMember()
        let old = safetyNewsArticle(id: "old")
        let repository = SequencedNewsRepository(
            outcomes: [.failure(.unavailable(resource: "news"))]
        )
        let viewModel = makeSafetyViewModel(member: member, newsRepository: repository)
        viewModel.newsFeed = [old]
        viewModel.latestNews = [old]

        let refreshedMember = Member(
            id: member.id,
            displayName: "Updated display name",
            normalizedEmail: member.normalizedEmail,
            authUid: member.authUid,
            roles: member.roles,
            isActive: member.isActive,
            producerCatalogEnabled: member.producerCatalogEnabled
        )
        let refreshedSession = safetySession(member: refreshedMember, environment: .develop)
        viewModel.sessionViewModel.mode = .authorized(refreshedSession)
        viewModel.handleSessionModeChange(.authorized(refreshedSession))

        #expect(viewModel.newsFeed == [old])
        #expect(viewModel.latestNews == [old])
        await waitForSafetyCondition {
            viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData
        }
        #expect(viewModel.newsFeed == [old])
        #expect(viewModel.latestNews == [old])
    }

    @Test("Latest overlapping News refresh owns state, feedback and loading")
    func latestOverlappingNewsRefreshWins() async {
        let stale = safetyNewsArticle(id: "stale")
        let current = safetyNewsArticle(id: "current", publishedAtMillis: 2)
        let repository = ControlledNewsRepository()
        let viewModel = makeSafetyViewModel(newsRepository: repository)

        let first = Task { await viewModel.refreshNews() }
        await repository.waitForReadCount(1)
        let second = Task { await viewModel.refreshNews() }
        await repository.waitForReadCount(2)

        await repository.completeRead(0, with: .success([stale]))
        await first.value
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.isLoadingNews)
        #expect(viewModel.feedbackCenter.messageKey == nil)

        await repository.completeRead(1, with: .success([current]))
        await second.value
        #expect(viewModel.newsFeed == [current])
        #expect(viewModel.isLoadingNews == false)
    }

    @Test("Obsolete cancellation cannot stop the newer News loader")
    func obsoleteCancellationCannotFinishNewerLoader() async {
        let current = safetyNewsArticle(id: "current")
        let repository = ControlledNewsRepository()
        let viewModel = makeSafetyViewModel(newsRepository: repository)

        let first = Task { await viewModel.refreshNews() }
        await repository.waitForReadCount(1)
        let second = Task { await viewModel.refreshNews() }
        await repository.waitForReadCount(2)

        await repository.cancelRead(0)
        await first.value
        #expect(viewModel.isLoadingNews)
        #expect(viewModel.feedbackCenter.messageKey == nil)

        await repository.completeRead(1, with: .success([current]))
        await second.value
        #expect(viewModel.newsFeed == [current])
        #expect(viewModel.isLoadingNews == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test("Current cancellation ends its loader without failure feedback")
    func cancellationHasNoFailureFeedback() async {
        let repository = SequencedNewsRepository(outcomes: [.cancellation])
        let viewModel = makeSafetyViewModel(newsRepository: repository)

        await viewModel.refreshNews()

        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.isLoadingNews == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test("Relogin with the same UID clears state and fences the previous epoch")
    func sameUIDReloginFencesStaleResult() async {
        let member = safetyMember()
        let stale = safetyNewsArticle(id: "stale")
        let current = safetyNewsArticle(id: "current", publishedAtMillis: 2)
        let repository = ControlledNewsRepository()
        let viewModel = makeSafetyViewModel(member: member, newsRepository: repository)
        viewModel.newsFeed = [stale]
        viewModel.latestNews = [stale]

        let staleRefresh = Task { await viewModel.refreshNews() }
        await repository.waitForReadCount(1)

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.latestNews.isEmpty)

        let relogged = safetySession(member: member, environment: .develop)
        viewModel.sessionViewModel.mode = .authorized(relogged)
        viewModel.handleSessionModeChange(.authorized(relogged))
        await repository.waitForReadCount(2)
        await repository.completeRead(1, with: .success([current]))
        await waitForSafetyCondition { viewModel.newsFeed == [current] }

        await repository.completeRead(0, with: .failure(.invalidData(resource: "news/stale")))
        await staleRefresh.value

        #expect(viewModel.newsFeed == [current])
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test("Principal and selected-member change clears state and fences the old error")
    func principalAndMemberChangeFenceStaleError() async {
        let firstMember = safetyMember(id: "member_1")
        let secondMember = safetyMember(id: "member_2")
        let old = safetyNewsArticle(id: "old")
        let current = safetyNewsArticle(id: "current", publishedAtMillis: 2)
        let repository = ControlledNewsRepository()
        let viewModel = makeSafetyViewModel(member: firstMember, newsRepository: repository)
        viewModel.newsFeed = [old]
        viewModel.latestNews = [old]

        let staleRefresh = Task { await viewModel.refreshNews() }
        await repository.waitForReadCount(1)

        let replacement = safetySession(member: secondMember, environment: .develop)
        viewModel.sessionViewModel.mode = .authorized(replacement)
        viewModel.handleSessionModeChange(.authorized(replacement))
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.latestNews.isEmpty)

        await repository.waitForReadCount(2)
        await repository.completeRead(1, with: .success([current]))
        await waitForSafetyCondition { viewModel.newsFeed == [current] }
        await repository.completeRead(
            0,
            with: .failure(.permissionDenied(resource: "news/old"))
        )
        await staleRefresh.value

        #expect(viewModel.currentMember?.id == secondMember.id)
        #expect(viewModel.newsFeed == [current])
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test("Member capability and environment boundaries clear all community and editor state synchronously")
    func contextBoundariesClearAllState() {
        let regular = safetyMember()
        let environment = MutableSafetyEnvironment(.develop)
        let viewModel = makeSafetyViewModel(
            member: regular,
            environmentProvider: { environment.value }
        )
        seedPrivateCommunityState(viewModel)

        let admin = safetyMember(roles: [.member, .admin])
        let elevated = safetySession(member: admin, environment: .develop)
        viewModel.sessionViewModel.mode = .authorized(elevated)
        viewModel.handleSessionModeChange(.authorized(elevated))
        expectCommunityStateCleared(viewModel)

        seedPrivateCommunityState(viewModel)
        environment.value = .production
        let production = safetySession(member: admin, environment: .production)
        viewModel.sessionViewModel.mode = .authorized(production)
        viewModel.handleSessionModeChange(.authorized(production))

        expectCommunityStateCleared(viewModel)
        #expect(viewModel.currentEnvironment == .production)
    }

    @Test("A stale mark-read failure cannot publish feedback or read state") func markReadIsSessionFenced() async {
        let event = safetyNotification(id: "event")
        let repository = ControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(notificationRepository: repository)
        viewModel.notificationsFeed = [event]

        let markRead = Task { await viewModel.markVisibleNotificationsReadOnExit() }
        await repository.waitForMarkCount(1)
        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)
        await repository.completeMark(with: .failure(.permissionDenied(resource: "notificationReads")))
        await markRead.value

        #expect(viewModel.readNotificationIds.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test("A stale notifications-route permission result cannot cross sign-out")
    func prepareNotificationsRouteIsSessionFenced() async {
        let permissionProvider = ControlledSafetyPermissionProvider()
        let viewModel = makeSafetyViewModel(
            pushNotificationPermissionProvider: permissionProvider
        )

        let prepareRoute = Task { await viewModel.prepareNotificationsRoute() }
        await permissionProvider.waitForRequest()
        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)
        await permissionProvider.complete(isActive: false)
        await prepareRoute.value

        #expect(viewModel.isPushNotificationPermissionActive)
        #expect(viewModel.showsPushNotificationPermissionDialog == false)
        #expect(viewModel.didDismissPushNotificationPermissionDialogForVisit == false)
    }

}

@MainActor
@Suite("Confirmed community mutation convergence")
struct NewsNotificationsFeatureMutationConvergenceTests {
    @Test("Confirmed News save remains successful when convergence refresh fails")
    func confirmedNewsSaveSurvivesFailedRefresh() async {
        let repository = ConfirmedMutationNewsRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository
        )
        #expect(viewModel.startCreatingNews())
        viewModel.updateNewsDraft {
            $0.title = "Saved"
            $0.body = "Body"
        }

        #expect(await viewModel.saveNews())
        #expect(viewModel.newsFeed.map(\.id) == ["saved"])
        #expect(viewModel.pendingNewsSaveConfirmation == .init(newsId: "saved", isNew: true))
        #expect(await repository.upsertCount() == 1)

        await repository.waitForReadCount(1)
        await waitForSafetyCondition {
            viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData
        }
        #expect(viewModel.newsFeed.map(\.id) == ["saved"])
        #expect(await repository.upsertCount() == 1)
    }

    @Test("Confirmed News delete remains applied when convergence refresh fails")
    func confirmedNewsDeleteSurvivesFailedRefresh() async {
        let repository = ConfirmedMutationNewsRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository
        )
        viewModel.newsFeed = [safetyNewsArticle(id: "delete")]
        viewModel.latestNews = viewModel.newsFeed
        viewModel.requestNewsDeletion(newsId: "delete")

        await viewModel.confirmNewsDeletion()

        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.latestNews.isEmpty)
        #expect(viewModel.pendingNewsDeletionId == nil)
        #expect(await repository.deleteCount() == 1)
        await repository.waitForReadCount(1)
        await waitForSafetyCondition {
            viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData
        }
        #expect(await repository.deleteCount() == 1)
    }

    @Test("Confirmed Notification send remains applied when convergence refresh fails")
    func confirmedNotificationSendSurvivesFailedRefresh() async {
        let repository = ConfirmedMutationNotificationRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            notificationRepository: repository
        )
        #expect(viewModel.startCreatingNotification())
        viewModel.updateNotificationDraft {
            $0.title = "Sent"
            $0.body = "Body"
        }

        #expect(await viewModel.sendNotification())
        #expect(viewModel.notificationsFeed.map(\.id) == ["sent"])
        #expect(viewModel.isNotificationSendConfirmationPresented)
        #expect(await repository.sendCount() == 1)

        await repository.waitForReadCount(1)
        await waitForSafetyCondition {
            viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData
        }
        #expect(viewModel.notificationsFeed.map(\.id) == ["sent"])
        #expect(await repository.sendCount() == 1)
    }
}
