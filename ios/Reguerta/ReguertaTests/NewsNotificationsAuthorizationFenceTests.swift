import Foundation
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct NewsNotificationsAuthorizationFenceTests {
    @Test func revokedPrincipalCannotStartRepositoryOrMediaWorkWithoutHandler() async {
        let authenticatedMember = safetyMember(id: "authenticated_member", roles: [.member, .admin])
        let currentMember = safetyMember(id: "current_member", roles: [.member, .admin])
        let newsRepository = EntryGuardNewsRepository()
        let notificationRepository = EntryGuardNotificationRepository()
        let imagePipeline = EntryGuardNewsImagePipeline()
        let viewModel = makeNewsNotificationsAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            newsRepository: newsRepository,
            notificationRepository: notificationRepository,
            imagePipelineManager: imagePipeline
        )
        viewModel.updateNewsDraft {
            $0.title = "Pending news"
            $0.body = "Must remain local"
        }
        viewModel.updateNotificationDraft {
            $0.title = "Pending notification"
            $0.body = "Must remain local"
        }

        var revokedSession = newsNotificationsAuthorizationSession(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember
        )
        revokedSession.principal = AuthPrincipal(uid: "revoked_principal", email: "revoked@reguerta.test")
        viewModel.sessionViewModel.mode = .authorized(revokedSession)

        #expect(await viewModel.saveNews() == false)
        #expect(await viewModel.sendNotification() == false)
        await viewModel.refreshNews()
        await viewModel.refreshNotifications()
        await viewModel.uploadNewsImage(Data([1]))

        #expect(await newsRepository.invocationCount() == 0)
        #expect(await notificationRepository.invocationCount() == 0)
        #expect(await imagePipeline.invocationCount() == 0)
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.pendingNewsSaveConfirmation == nil)
        #expect(viewModel.isNotificationSendConfirmationPresented == false)
        #expect(viewModel.isLoadingNews == false)
        #expect(viewModel.isSavingNews == false)
        #expect(viewModel.isUploadingNewsImage == false)
        #expect(viewModel.isLoadingNotifications == false)
        #expect(viewModel.isSendingNotification == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func lateFeedReadPublishesNothingWhenCurrentMemberBecomesInactiveBeforeHandler() async throws {
        let authenticatedMember = safetyMember(id: "authenticated_member", roles: [.member, .admin])
        let currentMember = safetyMember(id: "current_member", roles: [.member, .admin])
        let existing = safetyNewsArticle(id: "existing")
        let repository = NewsNotificationsAuthorizationNewsRepository(
            articles: [safetyNewsArticle(id: "stale")]
        )
        let viewModel = makeNewsNotificationsAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            newsRepository: repository
        )
        viewModel.newsFeed = [existing]
        viewModel.latestNews = [existing]

        let refreshTask = Task { await viewModel.refreshNews() }
        defer {
            refreshTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilReadStarts()
        let inactiveCurrentMember = replacingNewsNotificationsAuthorizationMember(currentMember, isActive: false)
        viewModel.sessionViewModel.mode = .authorized(
            newsNotificationsAuthorizationSession(
                authenticatedMember: authenticatedMember,
                currentMember: inactiveCurrentMember
            )
        )

        repository.completeRead()
        await refreshTask.value

        #expect(viewModel.newsFeed == [existing])
        #expect(viewModel.latestNews == [existing])
        #expect(viewModel.isLoadingNews == false)
        #expect(viewModel.activeNewsRefreshOperationId == nil)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func lateSendPublishesNothingWhenAuthenticatedMemberLosesAdminBeforeHandler() async throws {
        let authenticatedMember = safetyMember(id: "authenticated_member", roles: [.member, .admin])
        let currentMember = safetyMember(id: "current_member", roles: [.member, .admin])
        let repository = AuthorizationFenceNotificationRepository()
        let viewModel = makeNewsNotificationsAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            notificationRepository: repository
        )
        #expect(viewModel.startCreatingNotification())
        viewModel.updateNotificationDraft {
            $0.title = "Pending"
            $0.body = "Must remain local"
        }
        let pendingDraft = viewModel.notificationDraft

        let sendTask = Task { await viewModel.sendNotification() }
        defer {
            sendTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilSendStarts()
        let demotedAuthenticatedMember = replacingNewsNotificationsAuthorizationMember(
            authenticatedMember,
            roles: [.member]
        )
        viewModel.sessionViewModel.mode = .authorized(
            newsNotificationsAuthorizationSession(
                authenticatedMember: demotedAuthenticatedMember,
                currentMember: currentMember
            )
        )

        repository.completeSend()

        #expect(await sendTask.value == false)
        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.notificationDraft == pendingDraft)
        #expect(viewModel.isNotificationSendConfirmationPresented == false)
        #expect(viewModel.isSendingNotification == false)
        #expect(viewModel.activeNotificationMutationOperationId == nil)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func lateUploadPublishesNothingWhenCurrentMemberLosesAdminBeforeHandler() async throws {
        let authenticatedMember = safetyMember(id: "authenticated_member", roles: [.member, .admin])
        let currentMember = safetyMember(id: "current_member", roles: [.member, .admin])
        let imagePipeline = NewsNotificationsAuthorizationImagePipeline()
        let viewModel = makeNewsNotificationsAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            imagePipelineManager: imagePipeline
        )
        #expect(viewModel.startCreatingNews())
        viewModel.updateNewsDraft {
            $0.title = "Pending"
            $0.body = "Must remain local"
        }
        let pendingDraft = viewModel.newsDraft

        let uploadTask = Task { await viewModel.uploadNewsImage(Data([1])) }
        defer {
            uploadTask.cancel()
            imagePipeline.cancelAll()
        }
        try await imagePipeline.waitUntilUploadStarts()
        let demotedCurrentMember = replacingNewsNotificationsAuthorizationMember(currentMember, roles: [.member])
        viewModel.sessionViewModel.mode = .authorized(
            newsNotificationsAuthorizationSession(
                authenticatedMember: authenticatedMember,
                currentMember: demotedCurrentMember
            )
        )

        imagePipeline.completeUpload()
        await uploadTask.value

        #expect(viewModel.newsDraft == pendingDraft)
        #expect(viewModel.isUploadingNewsImage == false)
        #expect(viewModel.activeNewsImageUploadOperationId == nil)
        #expect(viewModel.feedbackCenter.messageKey == nil)

        try await assertStaleUploadCleanupCannotClearSuccessor()
    }

    private func assertStaleUploadCleanupCannotClearSuccessor() async throws {
        let authenticatedMember = safetyMember(id: "authenticated_member", roles: [.member, .admin])
        let currentMember = safetyMember(id: "current_member", roles: [.member, .admin])
        let imagePipeline = NewsNotificationsAuthorizationImagePipeline()
        let viewModel = makeNewsNotificationsAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            imagePipelineManager: imagePipeline
        )
        #expect(viewModel.startCreatingNews())

        let staleUploadTask = Task { await viewModel.uploadNewsImage(Data([1])) }
        defer {
            staleUploadTask.cancel()
            imagePipeline.cancelAll()
        }
        try await imagePipeline.waitUntilUploadStarts(0)

        let successorAuthenticatedMember = safetyMember(
            id: "successor_authenticated_member",
            roles: [.member, .admin]
        )
        let successorCurrentMember = safetyMember(id: "successor_current_member", roles: [.member, .admin])
        let successorSession = newsNotificationsAuthorizationSession(
            authenticatedMember: successorAuthenticatedMember,
            currentMember: successorCurrentMember
        )
        viewModel.sessionViewModel.mode = .authorized(successorSession)
        viewModel.handleSessionModeChange(.authorized(successorSession))
        #expect(viewModel.startCreatingNews())
        let successorUploadTask = Task { await viewModel.uploadNewsImage(Data([2])) }
        defer { successorUploadTask.cancel() }
        try await imagePipeline.waitUntilUploadStarts(1)
        let successorOperationID = viewModel.activeNewsImageUploadOperationId

        imagePipeline.completeUpload(0)
        await staleUploadTask.value

        #expect(viewModel.isUploadingNewsImage)
        #expect(viewModel.activeNewsImageUploadOperationId == successorOperationID)
        #expect(viewModel.newsDraft.urlImage.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == nil)

        imagePipeline.completeUpload(1)
        await successorUploadTask.value

        #expect(viewModel.newsDraft.urlImage == "https://current.test/news.jpg")
        #expect(viewModel.isUploadingNewsImage == false)
        #expect(viewModel.activeNewsImageUploadOperationId == nil)
    }
}
