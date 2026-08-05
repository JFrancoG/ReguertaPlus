import Testing

@testable import Reguerta

@MainActor
@Suite("Community mutation context and draft boundaries")
struct NewsNotificationsMutationBoundaryTests {
    @Test(
        "A News write cannot own the same editor after its draft changes",
        arguments: ReviewMutationCompletion.allCases
    )
    func newsDraftRevisionFencesSuspendedWrite(
        _ completion: ReviewMutationCompletion
    ) async {
        let repository = ReviewControlledNewsWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: adminMember(),
            newsRepository: repository
        )
        prepareNewsDraft(viewModel, title: "Old")
        let revisionAtWrite = viewModel.newsDraftRevision
        let save = Task { await viewModel.saveNews() }
        await repository.waitForUpsertCount(1)

        viewModel.updateNewsDraft { $0.title = "New" }
        #expect(viewModel.newsDraftRevision == revisionAtWrite + 1)
        #expect(viewModel.isSavingNews)

        let saved = safetyNewsArticle(id: "old-ack")
        await repository.completeUpsert(
            0,
            with: completion == .success
                ? .success(saved)
                : .failure(.unavailable(resource: "news"))
        )
        #expect(await save.value == false)
        if completion == .success {
            await repository.waitForNewsReadCount(1)
            await waitForSafetyCondition { viewModel.isLoadingNews == false }
        }

        #expect(viewModel.newsFeed == (completion == .success ? [saved] : []))
        #expect(viewModel.newsDraft.title == "New")
        #expect(viewModel.newsDraft.body == "Body")
        #expect(viewModel.pendingNewsSaveConfirmation == nil)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isSavingNews == false)
        #expect(viewModel.activeNewsMutationOperationId == nil)
    }

    @Test(
        "A Notification write cannot own the same editor after its draft changes",
        arguments: ReviewMutationCompletion.allCases
    )
    func notificationDraftRevisionFencesSuspendedWrite(
        _ completion: ReviewMutationCompletion
    ) async {
        let repository = ReviewControlledNotificationWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: adminMember(),
            notificationRepository: repository
        )
        prepareNotificationDraft(viewModel, title: "Old")
        let revisionAtWrite = viewModel.notificationDraftRevision
        let send = Task { await viewModel.sendNotification() }
        await repository.waitForSendCount(1)

        viewModel.updateNotificationDraft { $0.title = "New" }
        #expect(viewModel.notificationDraftRevision == revisionAtWrite + 1)
        #expect(viewModel.isSendingNotification)

        let sent = reviewNotification(id: "old-ack")
        await repository.completeSend(
            0,
            with: completion == .success
                ? .success(sent)
                : .failure(.unavailable(resource: "notificationEvents"))
        )
        #expect(await send.value == false)
        if completion == .success {
            await repository.waitForNotificationReadCount(1)
            await waitForSafetyCondition { viewModel.isLoadingNotifications == false }
        }

        #expect(viewModel.notificationsFeed == (completion == .success ? [sent] : []))
        #expect(viewModel.notificationDraft.title == "New")
        #expect(viewModel.notificationDraft.body == "Body")
        #expect(viewModel.isNotificationSendConfirmationPresented == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isSendingNotification == false)
        #expect(viewModel.activeNotificationMutationOperationId == nil)
    }

    @Test(
        "A replaced context fences an old News write without blocking the new one",
        arguments: ReviewMutationCompletion.allCases
    )
    func contextReplacementFencesSuspendedNewsWrite(
        _ completion: ReviewMutationCompletion
    ) async {
        let repository = ReviewControlledNewsWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: adminMember(),
            newsRepository: repository
        )
        prepareNewsDraft(viewModel, title: "Old")
        let oldSave = Task { await viewModel.saveNews() }
        await repository.waitForUpsertCount(1)
        let oldToken = viewModel.activeNewsMutationOperationId

        replaceAuthorizedContext(in: viewModel)
        #expect(viewModel.activeNewsMutationOperationId == nil)
        #expect(viewModel.isSavingNews == false)
        prepareNewsDraft(viewModel, title: "New")
        let newSave = Task { await viewModel.saveNews() }
        await repository.waitForUpsertCount(2)
        let newToken = viewModel.activeNewsMutationOperationId
        #expect(newToken != nil)
        #expect(newToken != oldToken)

        let oldSaved = safetyNewsArticle(id: "old-ack")
        await repository.completeUpsert(
            0,
            with: completion == .success
                ? .success(oldSaved)
                : .failure(.unavailable(resource: "news"))
        )
        #expect(await oldSave.value == false)
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.newsDraft.title == "New")
        #expect(viewModel.pendingNewsSaveConfirmation == nil)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isSavingNews)
        #expect(viewModel.activeNewsMutationOperationId == newToken)

        let newSaved = safetyNewsArticle(id: "new-ack")
        await repository.completeUpsert(1, with: .success(newSaved))
        #expect(await newSave.value)
        #expect(viewModel.newsFeed == [newSaved])
        #expect(viewModel.pendingNewsSaveConfirmation?.newsId == newSaved.id)
    }

    @Test(
        "A replaced context fences an old Notification write without blocking the new one",
        arguments: ReviewMutationCompletion.allCases
    )
    func contextReplacementFencesSuspendedNotificationWrite(
        _ completion: ReviewMutationCompletion
    ) async {
        let repository = ReviewControlledNotificationWriteRepository()
        let viewModel = makeSafetyViewModel(
            member: adminMember(),
            notificationRepository: repository
        )
        prepareNotificationDraft(viewModel, title: "Old")
        let oldSend = Task { await viewModel.sendNotification() }
        await repository.waitForSendCount(1)
        let oldToken = viewModel.activeNotificationMutationOperationId

        replaceAuthorizedContext(in: viewModel)
        #expect(viewModel.activeNotificationMutationOperationId == nil)
        #expect(viewModel.isSendingNotification == false)
        prepareNotificationDraft(viewModel, title: "New")
        let newSend = Task { await viewModel.sendNotification() }
        await repository.waitForSendCount(2)
        let newToken = viewModel.activeNotificationMutationOperationId
        #expect(newToken != nil)
        #expect(newToken != oldToken)

        let oldSent = reviewNotification(id: "old-ack")
        await repository.completeSend(
            0,
            with: completion == .success
                ? .success(oldSent)
                : .failure(.unavailable(resource: "notificationEvents"))
        )
        #expect(await oldSend.value == false)
        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.notificationDraft.title == "New")
        #expect(viewModel.isNotificationSendConfirmationPresented == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isSendingNotification)
        #expect(viewModel.activeNotificationMutationOperationId == newToken)

        let newSent = reviewNotification(id: "new-ack")
        await repository.completeSend(1, with: .success(newSent))
        #expect(await newSend.value)
        #expect(viewModel.notificationsFeed == [newSent])
        #expect(viewModel.isNotificationSendConfirmationPresented)
    }

    private func adminMember(id: String = "member_1") -> Member {
        safetyMember(id: id, roles: [.member, .admin])
    }

    private func replaceAuthorizedContext(in viewModel: NewsNotificationsFeatureViewModel) {
        let replacement = safetySession(
            member: adminMember(id: "member_2"),
            environment: .develop
        )
        viewModel.sessionViewModel.mode = .authorized(replacement)
        _ = viewModel.captureAuthorizedSessionContext()
        #expect(viewModel.currentMember?.id == replacement.member.id)
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
}
