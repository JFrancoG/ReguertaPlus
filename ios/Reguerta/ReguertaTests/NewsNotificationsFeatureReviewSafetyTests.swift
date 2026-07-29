import Foundation
import Testing

@testable import Reguerta

@MainActor
@Suite("Community audience and operation review safety")
struct NewsNotificationsAudienceReviewTests {
    @Test(
        "Revoking producer audience fences a stale Notification result or error",
        arguments: [
            ReviewStaleNotificationOutcome.success,
            ReviewStaleNotificationOutcome.failure
        ]
    )
    func roleAudienceChangeFencesStaleRefresh(
        _ outcome: ReviewStaleNotificationOutcome
    ) async {
        let initial = safetyMember(roles: [.member, .producer, .admin])
        let revoked = safetyMember(roles: [.member, .admin])
        #expect(initial.canPublishNews == revoked.canPublishNews)
        #expect(initial.canSendAdminNotifications == revoked.canSendAdminNotifications)

        let repository = ReviewControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(
            member: initial,
            notificationRepository: repository
        )
        viewModel.notificationsFeed = [reviewNotification(id: "private", targetRole: .producer)]

        let staleRefresh = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(1)
        await repository.waitForReadIDCount(1)

        let replacement = safetySession(member: revoked, environment: .develop)
        viewModel.sessionViewModel.mode = .authorized(replacement)
        _ = viewModel.captureAuthorizedSessionContext()
        #expect(viewModel.notificationsFeed.isEmpty)

        switch outcome {
        case .success:
            await repository.completeNotification(
                0,
                with: .success([reviewNotification(id: "stale", targetRole: .producer)])
            )
        case .failure:
            await repository.completeNotification(
                0,
                with: .failure(.permissionDenied(resource: "notificationInbox"))
            )
        }
        await repository.completeReadIDs(0, with: .success([]))
        await staleRefresh.value

        #expect(viewModel.currentMember?.roles == revoked.roles)
        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test("Current Notification cancellation ends loading without failure feedback")
    func currentNotificationCancellationHasNoFeedback() async {
        let repository = SequencedNotificationRepository(
            notificationOutcomes: [.cancellation],
            readOutcomes: [.success([])]
        )
        let viewModel = makeSafetyViewModel(notificationRepository: repository)

        await viewModel.refreshNotifications()

        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.isLoadingNotifications == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test("Obsolete Notification cancellation cannot stop the newer loader")
    func obsoleteNotificationCancellationCannotFinishNewerLoader() async {
        let repository = ReviewControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(notificationRepository: repository)
        let current = reviewNotification(id: "current")

        let first = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(1)
        await repository.waitForReadIDCount(1)
        let second = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(2)
        await repository.waitForReadIDCount(2)

        await repository.cancelNotification(0)
        await repository.completeReadIDs(0, with: .success([]))
        await first.value
        #expect(viewModel.isLoadingNotifications)
        #expect(viewModel.feedbackCenter.messageKey == nil)

        await repository.completeNotification(1, with: .success([current]))
        await repository.completeReadIDs(1, with: .success([]))
        await second.value
        #expect(viewModel.notificationsFeed == [current])
        #expect(viewModel.isLoadingNotifications == false)
    }
}

@MainActor
@Suite("Notification read acknowledgement review safety")
struct NewsNotificationsReadAcknowledgementReviewTests {
    @Test("A refresh that finishes before mark-read ACK cannot consume that ACK")
    func refreshThenMarkReadPreservesAcknowledgement() async {
        let event = reviewNotification(id: "event")
        let repository = ReviewControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(notificationRepository: repository)
        viewModel.notificationsFeed = [event]

        let markRead = Task { await viewModel.markVisibleNotificationsReadOnExit() }
        await repository.waitForMarkCount(1)
        let refresh = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(1)
        await repository.waitForReadIDCount(1)
        await repository.completeNotification(0, with: .success([event]))
        await repository.completeReadIDs(0, with: .success([]))
        await refresh.value

        await repository.completeMark(0, with: .success(()))
        await markRead.value

        #expect(viewModel.readNotificationIds == [event.id])
        #expect(viewModel.activeMarkReadOperationId == nil)
    }

    @Test("An older successful refresh cannot erase a completed mark-read ACK")
    func markReadThenRefreshPreservesAcknowledgement() async {
        let event = reviewNotification(id: "event")
        let repository = ReviewControlledNotificationRepository()
        let viewModel = makeSafetyViewModel(notificationRepository: repository)
        viewModel.notificationsFeed = [event]

        let refresh = Task { await viewModel.refreshNotifications() }
        await repository.waitForNotificationCount(1)
        await repository.waitForReadIDCount(1)
        let markRead = Task { await viewModel.markVisibleNotificationsReadOnExit() }
        await repository.waitForMarkCount(1)
        await repository.completeMark(0, with: .success(()))
        await markRead.value
        #expect(viewModel.readNotificationIds == [event.id])

        await repository.completeNotification(0, with: .success([event]))
        await repository.completeReadIDs(0, with: .success([]))
        await refresh.value

        #expect(viewModel.readNotificationIds == [event.id])
        #expect(viewModel.activeMarkReadOperationId == nil)
    }
}

@MainActor
@Suite("News image upload review safety")
struct NewsNotificationsImageUploadReviewTests {
    @Test(
        "Creating, editing or clearing invalidates a stale image upload",
        arguments: ReviewEditorTransition.allCases
    )
    func editorTransitionInvalidatesStaleUpload(
        _ transition: ReviewEditorTransition
    ) async {
        let admin = safetyMember(roles: [.member, .admin])
        let article = safetyNewsArticle(id: "article")
        let pipeline = ReviewControlledImagePipelineManager()
        let viewModel = makeSafetyViewModel(
            member: admin,
            imagePipelineManager: pipeline
        )
        viewModel.newsFeed = [article]
        #expect(viewModel.startCreatingNews())

        let upload = Task { await viewModel.uploadNewsImage(Data([1])) }
        await pipeline.waitForRequestCount(1)
        switch transition {
        case .create:
            #expect(viewModel.startCreatingNews())
        case .edit:
            #expect(viewModel.startEditingNews(newsId: article.id))
        case .clear:
            viewModel.clearNewsEditor()
        }

        await pipeline.complete(0, downloadURL: "https://cdn.test/stale.jpg")
        await upload.value

        #expect(viewModel.newsDraft.urlImage.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isUploadingNewsImage == false)
    }

    @Test("A stale upload cannot publish feedback or finish a newer upload")
    func staleUploadCannotMutateNewEditorOperation() async {
        let pipeline = ReviewControlledImagePipelineManager()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            imagePipelineManager: pipeline
        )
        #expect(viewModel.startCreatingNews())

        let stale = Task { await viewModel.uploadNewsImage(Data([1])) }
        await pipeline.waitForRequestCount(1)
        #expect(viewModel.startCreatingNews())
        let current = Task { await viewModel.uploadNewsImage(Data([2])) }
        await pipeline.waitForRequestCount(2)

        await pipeline.fail(0)
        await stale.value
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isUploadingNewsImage)

        await pipeline.complete(1, downloadURL: "https://cdn.test/current.jpg")
        await current.value
        #expect(viewModel.newsDraft.urlImage == "https://cdn.test/current.jpg")
        #expect(viewModel.isUploadingNewsImage == false)
    }

    @Test("A News refresh never lowers the image upload flag")
    func refreshDoesNotFinishImageUpload() async {
        let pipeline = ReviewControlledImagePipelineManager()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            imagePipelineManager: pipeline
        )

        let upload = Task { await viewModel.uploadNewsImage(Data([1])) }
        await pipeline.waitForRequestCount(1)
        await viewModel.refreshNews()
        #expect(viewModel.isUploadingNewsImage)

        await pipeline.complete(0, downloadURL: "https://cdn.test/current.jpg")
        await upload.value
        #expect(viewModel.isUploadingNewsImage == false)
    }
}
