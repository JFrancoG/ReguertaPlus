import Testing

@testable import Reguerta

@MainActor
@Suite("Confirmed community mutation races")
struct NewsNotificationsFeatureMutationRaceTests {
    @Test("A successful refresh started before save cannot erase the save ACK")
    func preexistingRefreshCannotEraseSave() async {
        let repository = ReviewNewsMutationRepository(mutation: .save)
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository
        )
        let staleRefresh = Task { await viewModel.refreshNews() }
        await repository.waitForReadCount(1)
        #expect(viewModel.startCreatingNews())
        viewModel.updateNewsDraft {
            $0.title = "Saved"
            $0.body = "Body"
        }

        #expect(await viewModel.saveNews())
        await staleRefresh.value
        #expect(viewModel.newsFeed.map(\.id) == ["saved"])

        await repository.waitForReadCount(2)
        let saved = viewModel.newsFeed.first
        await repository.completeRead(1, with: saved.map { [$0] } ?? [])
        await waitForSafetyCondition { viewModel.isLoadingNews == false }
        #expect(viewModel.newsFeed.map(\.id) == ["saved"])
    }

    @Test("A successful refresh started before delete cannot restore the delete ACK")
    func preexistingRefreshCannotRestoreDelete() async {
        let article = safetyNewsArticle(id: "delete")
        let repository = ReviewNewsMutationRepository(
            mutation: .delete,
            staleArticle: article
        )
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository
        )
        viewModel.newsFeed = [article]
        viewModel.latestNews = [article]
        let staleRefresh = Task { await viewModel.refreshNews() }
        await repository.waitForReadCount(1)
        viewModel.requestNewsDeletion(newsId: article.id)

        await viewModel.confirmNewsDeletion()
        await staleRefresh.value
        #expect(viewModel.newsFeed.isEmpty)

        await repository.waitForReadCount(2)
        await repository.completeRead(1, with: [])
        await waitForSafetyCondition { viewModel.isLoadingNews == false }
        #expect(viewModel.newsFeed.isEmpty)
    }

    @Test("Send ACK survives a stale refresh and successful empty pre-fanout snapshots")
    func sentNotificationSurvivesUntilInboxMaterializes() async {
        let repository = ReviewControlledNotificationRepository(
            completesFirstRefreshOnSend: true
        )
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            notificationRepository: repository
        )
        let staleRefresh = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(1)
        await repository.waitForReadIDCount(1)
        #expect(viewModel.startCreatingNotification())
        viewModel.updateNotificationDraft {
            $0.title = "Sent"
            $0.body = "Body"
        }

        #expect(await viewModel.sendNotification())
        await staleRefresh.value
        await repository.waitForNotificationCount(2)
        await repository.waitForReadIDCount(2)
        await repository.completeNotification(1, with: .success([]))
        await repository.completeReadIDs(1, with: .success([]))
        await waitForSafetyCondition { viewModel.isLoadingNotifications == false }
        #expect(viewModel.notificationsFeed.map(\.id) == ["sent"])
        #expect(viewModel.isNotificationSendConfirmationPresented)

        let sent = viewModel.notificationsFeed.first
        let materialized = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(3)
        await repository.waitForReadIDCount(3)
        await repository.completeNotification(
            2,
            with: .success(sent.map { [$0] } ?? [])
        )
        await repository.completeReadIDs(2, with: .success([]))
        await materialized.value
        #expect(viewModel.notificationsFeed.map(\.id) == ["sent"])

        let afterMaterialization = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(4)
        await repository.waitForReadIDCount(4)
        await repository.completeNotification(3, with: .success([]))
        await repository.completeReadIDs(3, with: .success([]))
        await afterMaterialization.value
        #expect(viewModel.notificationsFeed.isEmpty)
    }

    @Test("A confirmed Notification outside the sender audience stays out of its feed")
    func nonVisibleNotificationStaysOutOfFeed() async {
        let repository = ReviewControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            notificationRepository: repository
        )
        #expect(viewModel.startCreatingNotification())
        viewModel.updateNotificationDraft {
            $0.title = "Producers"
            $0.body = "Body"
            $0.audience = .producers
        }

        #expect(await viewModel.sendNotification())
        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.isNotificationSendConfirmationPresented)

        await repository.waitForNotificationCount(1)
        await repository.waitForReadIDCount(1)
        await repository.completeNotification(0, with: .success([]))
        await repository.completeReadIDs(0, with: .success([]))
    }

    @Test("Pending confirmed Notifications are cleared at a session boundary")
    func pendingNotificationIsContextBound() async {
        let member = safetyMember(roles: [.member, .admin])
        let repository = ReviewControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(
            member: member,
            notificationRepository: repository
        )
        #expect(viewModel.startCreatingNotification())
        viewModel.updateNotificationDraft {
            $0.title = "Sent"
            $0.body = "Body"
        }

        #expect(await viewModel.sendNotification())
        await repository.waitForNotificationCount(1)
        await repository.waitForReadIDCount(1)
        await repository.completeNotification(0, with: .success([]))
        await repository.completeReadIDs(0, with: .success([]))
        await waitForSafetyCondition { viewModel.isLoadingNotifications == false }
        #expect(viewModel.notificationsFeed.map(\.id) == ["sent"])

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)
        #expect(viewModel.notificationsFeed.isEmpty)

        let replacement = safetySession(member: member, environment: .develop)
        viewModel.sessionViewModel.mode = .authorized(replacement)
        _ = viewModel.captureAuthorizedSessionContext()
        let refresh = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(2)
        await repository.waitForReadIDCount(2)
        await repository.completeNotification(1, with: .success([]))
        await repository.completeReadIDs(1, with: .success([]))
        await refresh.value
        #expect(viewModel.notificationsFeed.isEmpty)
    }
}
