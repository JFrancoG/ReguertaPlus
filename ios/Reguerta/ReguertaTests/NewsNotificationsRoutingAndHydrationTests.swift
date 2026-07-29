import Testing

@testable import Reguerta

@MainActor
@Suite("Community routing and hydration ownership")
struct NewsNotificationsRoutingAndHydrationTests {
    @Test("A router transition clears and fences feeds before SessionMode changes")
    func routerTransitionImmediatelyInvalidatesCommunityContext() async {
        let member = safetyMember()
        let environment = MutableSafetyEnvironment(.develop)
        let router = FixedSessionEnvironmentRouter(
            baseEnvironment: .develop,
            onApply: { environment.value = $0 },
            onReset: { environment.value = .develop }
        )
        let newsRepository = ReviewHydrationNewsRepository()
        let notificationRepository = ReviewControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(
            member: member,
            newsRepository: newsRepository,
            notificationRepository: notificationRepository,
            environmentProvider: { environment.value },
            environmentRoutingSignal: router.transitionSignal
        )
        viewModel.newsFeed = [safetyNewsArticle(id: "published")]
        viewModel.notificationsFeed = [reviewNotification(id: "published")]

        let newsTask = Task { await viewModel.refreshNews() }
        let notificationsTask = Task { await viewModel.refreshNotifications() }
        await newsRepository.waitForRequestCount(1)
        await notificationRepository.waitForNotificationCount(1)
        await notificationRepository.waitForReadIDCount(1)
        #expect(viewModel.isLoadingNews)
        #expect(viewModel.isLoadingNotifications)

        router.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())

        expectInvalidatedCommunityContext(viewModel, environment: .production)

        await newsRepository.complete(0, with: [safetyNewsArticle(id: "stale")])
        await notificationRepository.completeNotification(
            0,
            with: .failure(.unavailable(resource: "notificationEvents"))
        )
        await notificationRepository.completeReadIDs(0, with: .success([]))
        await newsTask.value
        await notificationsTask.value

        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isLoadingNews == false)
        #expect(viewModel.isLoadingNotifications == false)
    }

    @Test("An obsolete hydration suspended in News never starts Notifications")
    func obsoleteHydrationCannotRecaptureNotifications() async {
        let initial = safetyMember(id: "member_1")
        let replacement = safetyMember(id: "member_2")
        let currentNotification = reviewNotification(id: "current")
        let newsRepository = ReviewHydrationNewsRepository()
        let notificationRepository = ReviewControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(
            member: initial,
            newsRepository: newsRepository,
            notificationRepository: notificationRepository
        )

        let initialSession = safetySession(member: initial, environment: .develop)
        viewModel.sessionViewModel.mode = .authorized(initialSession)
        viewModel.handleSessionModeChange(.authorized(initialSession))
        await newsRepository.waitForRequestCount(1)

        let replacementSession = safetySession(member: replacement, environment: .develop)
        viewModel.sessionViewModel.mode = .authorized(replacementSession)
        viewModel.handleSessionModeChange(.authorized(replacementSession))
        await newsRepository.waitForRequestCount(2)
        await newsRepository.complete(1, with: [])
        await notificationRepository.waitForNotificationCount(1)
        await notificationRepository.waitForReadIDCount(1)

        await newsRepository.complete(0, with: [safetyNewsArticle(id: "stale")])
        await newsRepository.waitForReturnedRead(0)
        for _ in 0..<100 {
            await Task.yield()
        }

        await notificationRepository.completeNotification(
            0,
            with: .success([currentNotification])
        )
        await notificationRepository.completeReadIDs(0, with: .success([]))
        for _ in 0..<100 {
            await Task.yield()
        }

        let notificationRequests = await notificationRepository.notificationRequestCount()
        #expect(notificationRequests == 1)
        #expect(viewModel.notificationsFeed == [currentNotification])
        #expect(viewModel.isLoadingNotifications == false)

        if notificationRequests > 1 {
            await notificationRepository.completeNotification(
                1,
                with: .success([currentNotification])
            )
            await notificationRepository.completeReadIDs(1, with: .success([]))
        }
    }

    private func expectInvalidatedCommunityContext(
        _ viewModel: NewsNotificationsFeatureViewModel,
        environment: SessionEnvironment
    ) {
        let modeRemainsAuthorized = if case .authorized = viewModel.sessionViewModel.mode {
            true
        } else {
            false
        }
        #expect(modeRemainsAuthorized)
        #expect(viewModel.currentSession == nil)
        #expect(viewModel.currentMember == nil)
        #expect(viewModel.currentEnvironment == environment)
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.isLoadingNews == false)
        #expect(viewModel.isLoadingNotifications == false)
    }
}
