import Foundation
import Testing

@testable import Reguerta

@MainActor
@Suite("Community mutation editor ownership")
struct NewsNotificationsMutationOwnershipTests {
    @Test(
        "An old News write cannot own a reopened editor",
        arguments: ReviewMutationCompletion.allCases
    )
    func oldNewsWriteCannotOwnReopenedEditor(
        _ completion: ReviewMutationCompletion
    ) async {
        let repository = ReviewControlledNewsWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository
        )
        prepareNewsDraft(viewModel, title: "Old")
        let firstSave = Task { await viewModel.saveNews() }
        await repository.waitForUpsertCount(1)
        let firstToken = viewModel.activeNewsMutationOperationId

        viewModel.clearNewsEditor()
        prepareNewsDraft(viewModel, title: "New")
        #expect(viewModel.isSavingNews)
        #expect(viewModel.activeNewsMutationOperationId == firstToken)
        #expect(await viewModel.saveNews() == false)
        #expect(await repository.upsertCount() == 1)

        let saved = safetyNewsArticle(id: "old-ack")
        await repository.completeUpsert(
            0,
            with: completion == .success
                ? .success(saved)
                : .failure(.unavailable(resource: "news"))
        )
        #expect(await firstSave.value == false)

        #expect(viewModel.newsFeed == (completion == .success ? [saved] : []))
        expectNewNewsEditorIsUntouched(viewModel)
    }

    @Test(
        "An old Notification write cannot own a reopened editor",
        arguments: ReviewMutationCompletion.allCases
    )
    func oldNotificationWriteCannotOwnReopenedEditor(
        _ completion: ReviewMutationCompletion
    ) async {
        let repository = ReviewControlledNotificationWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            notificationRepository: repository
        )
        prepareNotificationDraft(viewModel, title: "Old")
        let firstSend = Task { await viewModel.sendNotification() }
        await repository.waitForSendCount(1)
        let firstToken = viewModel.activeNotificationMutationOperationId

        viewModel.clearNotificationEditor()
        prepareNotificationDraft(viewModel, title: "New")
        #expect(viewModel.isSendingNotification)
        #expect(viewModel.activeNotificationMutationOperationId == firstToken)
        #expect(await viewModel.sendNotification() == false)
        #expect(await repository.sendCount() == 1)

        let sent = reviewNotification(id: "old-ack")
        await repository.completeSend(
            0,
            with: completion == .success
                ? .success(sent)
                : .failure(.unavailable(resource: "notificationEvents"))
        )
        #expect(await firstSend.value == false)

        #expect(viewModel.notificationsFeed == (completion == .success ? [sent] : []))
        expectNewNotificationEditorIsUntouched(viewModel)
    }

    @Test("A suspended delete keeps a newer deletion request isolated")
    func oldDeleteCannotOwnNewDeletionRequest() async {
        let firstArticle = safetyNewsArticle(id: "delete-1")
        let secondArticle = safetyNewsArticle(id: "delete-2")
        let repository = ReviewControlledNewsWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository
        )
        viewModel.newsFeed = [firstArticle, secondArticle]
        viewModel.requestNewsDeletion(newsId: firstArticle.id)
        let firstDelete = Task { await viewModel.confirmNewsDeletion() }
        await repository.waitForDeleteCount(1)
        let firstToken = viewModel.activeNewsMutationOperationId

        viewModel.clearPendingNewsDeletion()
        viewModel.requestNewsDeletion(newsId: secondArticle.id)
        await viewModel.confirmNewsDeletion()
        #expect(await repository.deleteCount() == 1)
        #expect(viewModel.activeNewsMutationOperationId == firstToken)
        #expect(viewModel.pendingNewsDeletionId == secondArticle.id)

        await repository.completeDelete(0, with: .success(true))
        await firstDelete.value
        #expect(viewModel.newsFeed == [secondArticle])
        #expect(viewModel.pendingNewsDeletionId == secondArticle.id)
        #expect(viewModel.feedbackCenter.messageKey == nil)

        if viewModel.pendingNewsDeletionId != secondArticle.id {
            viewModel.requestNewsDeletion(newsId: secondArticle.id)
        }
        let secondDelete = Task { await viewModel.confirmNewsDeletion() }
        await repository.waitForDeleteCount(2)
        await repository.completeDelete(1, with: .success(true))
        await secondDelete.value
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.pendingNewsDeletionId == nil)
    }

    @Test("A confirmed delete promotes the fourth active latest News")
    func confirmedDeleteRecomputesLatestNews() async {
        let deleted = safetyNewsArticle(id: "delete", publishedAtMillis: 50)
        let archived = NewsArticle(
            id: "archived",
            title: "Archived",
            body: "Body",
            active: false,
            publishedBy: "Admin",
            publishedByUserId: "admin",
            publishedAtMillis: 40,
            urlImage: nil
        )
        let second = safetyNewsArticle(id: "second", publishedAtMillis: 30)
        let third = safetyNewsArticle(id: "third", publishedAtMillis: 20)
        let fourth = safetyNewsArticle(id: "fourth", publishedAtMillis: 10)
        let repository = ReviewControlledNewsWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository
        )
        viewModel.newsFeed = [deleted, archived, second, third, fourth]
        viewModel.latestNews = [deleted, second, third]
        viewModel.requestNewsDeletion(newsId: deleted.id)

        let deletion = Task { await viewModel.confirmNewsDeletion() }
        await repository.waitForDeleteCount(1)
        await repository.completeDelete(0, with: .success(true))
        await deletion.value

        #expect(viewModel.newsFeed == [archived, second, third, fourth])
        #expect(viewModel.latestNews == [second, third, fourth])
    }

    @Test("News save and image upload serialize in both directions") func newsSaveAndImageUploadAreSerialized() async {
        let repository = ReviewControlledNewsWriteRepository()
        let pipeline = ReviewControlledImagePipelineManager()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository,
            imagePipelineManager: pipeline
        )
        prepareNewsDraft(viewModel, title: "Saving")
        let save = Task { await viewModel.saveNews() }
        await repository.waitForUpsertCount(1)

        let blockedUpload = Task { await viewModel.uploadNewsImage(Data([1])) }
        for _ in 0..<100 { await Task.yield() }
        let blockedUploadRequests = await pipeline.requestCount()
        #expect(blockedUploadRequests == 0)
        if blockedUploadRequests > 0 {
            await pipeline.complete(0, downloadURL: "https://cdn.test/obsolete.jpg")
        }
        await blockedUpload.value

        await repository.completeUpsert(0, with: .success(safetyNewsArticle(id: "saved")))
        #expect(await save.value)
        _ = viewModel.closeNewsSaveConfirmation()
        prepareNewsDraft(viewModel, title: "Uploading")
        let revisionBeforeUpload = viewModel.newsDraftRevision
        let upload = Task { await viewModel.uploadNewsImage(Data([2])) }
        let currentUploadIndex = blockedUploadRequests
        await pipeline.waitForRequestCount(currentUploadIndex + 1)

        #expect(await viewModel.saveNews() == false)
        #expect(await repository.upsertCount() == 1)
        await pipeline.complete(
            currentUploadIndex,
            downloadURL: "https://cdn.test/current.jpg"
        )
        await upload.value
        #expect(viewModel.newsDraft.urlImage == "https://cdn.test/current.jpg")
        #expect(viewModel.newsDraftRevision == revisionBeforeUpload + 1)
    }

    @Test("A confirmed News save cannot close a reopened editor") func newsConfirmationCannotOwnReopenedEditor() async {
        let repository = ReviewControlledNewsWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            newsRepository: repository
        )
        prepareNewsDraft(viewModel, title: "Old")
        let save = Task { await viewModel.saveNews() }
        await repository.waitForUpsertCount(1)
        let saved = safetyNewsArticle(id: "confirmed")
        await repository.completeUpsert(0, with: .success(saved))
        #expect(await save.value)
        #expect(viewModel.pendingNewsSaveConfirmation?.newsId == saved.id)

        viewModel.clearNewsEditor()
        prepareNewsDraft(viewModel, title: "New")
        #expect(viewModel.pendingNewsSaveConfirmation == nil)
        #expect(viewModel.closeNewsSaveConfirmation() == nil)
        #expect(viewModel.newsDraft.title == "New")
        #expect(viewModel.newsDraft.body == "Body")
        #expect(viewModel.newsFeed == [saved])
    }

    @Test("A confirmed Notification send cannot close a reopened editor")
    func notificationConfirmationCannotOwnReopenedEditor() async {
        let repository = ReviewControlledNotificationWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: safetyMember(roles: [.member, .admin]),
            notificationRepository: repository
        )
        prepareNotificationDraft(viewModel, title: "Old")
        let send = Task { await viewModel.sendNotification() }
        await repository.waitForSendCount(1)
        let sent = reviewNotification(id: "confirmed")
        await repository.completeSend(0, with: .success(sent))
        #expect(await send.value)
        #expect(viewModel.isNotificationSendConfirmationPresented)

        viewModel.clearNotificationEditor()
        #expect(viewModel.isNotificationSendConfirmationPresented == false)
        prepareNotificationDraft(viewModel, title: "New")
        viewModel.closeNotificationSendConfirmation()
        #expect(viewModel.notificationDraft.title == "New")
        #expect(viewModel.notificationDraft.body == "Body")
        #expect(viewModel.notificationsFeed == [sent])
    }

    private func prepareNewsDraft(_ viewModel: NewsNotificationsFeatureViewModel, title: String) {
        #expect(viewModel.startCreatingNews())
        viewModel.updateNewsDraft {
            $0.title = title
            $0.body = "Body"
        }
    }

    private func prepareNotificationDraft(_ viewModel: NewsNotificationsFeatureViewModel, title: String) {
        #expect(viewModel.startCreatingNotification())
        viewModel.updateNotificationDraft {
            $0.title = title
            $0.body = "Body"
        }
    }

    private func expectNewNewsEditorIsUntouched(_ viewModel: NewsNotificationsFeatureViewModel) {
        #expect(viewModel.newsDraft.title == "New")
        #expect(viewModel.newsDraft.body == "Body")
        #expect(viewModel.editingNewsId == nil)
        #expect(viewModel.pendingNewsSaveConfirmation == nil)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isSavingNews == false)
        #expect(viewModel.activeNewsMutationOperationId == nil)
    }

    private func expectNewNotificationEditorIsUntouched(_ viewModel: NewsNotificationsFeatureViewModel) {
        #expect(viewModel.notificationDraft.title == "New")
        #expect(viewModel.notificationDraft.body == "Body")
        #expect(viewModel.isNotificationSendConfirmationPresented == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isSendingNotification == false)
        #expect(viewModel.activeNotificationMutationOperationId == nil)
    }
}
