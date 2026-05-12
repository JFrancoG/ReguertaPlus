import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaNewsNotificationsViewModelTests {
    @Test
    func newsViewModelLoadsNewsByPermissionAndComputesLatestActiveNews() async {
        let admin = newsAdminMember()
        let regular = newsRegularMember()
        let articles = [
            newsArticle(id: "active_1", title: "Active 1", active: true, publishedAtMillis: 10),
            newsArticle(id: "active_2", title: "Active 2", active: true, publishedAtMillis: 20),
            newsArticle(id: "active_3", title: "Active 3", active: true, publishedAtMillis: 30),
            newsArticle(id: "active_4", title: "Active 4", active: true, publishedAtMillis: 40),
            newsArticle(id: "inactive", title: "Inactive", active: false, publishedAtMillis: 50)
        ]
        let adminViewModel = makeNewsNotificationsViewModel(
            currentMember: admin,
            members: [admin],
            newsRepository: InMemoryNewsRepository(items: articles)
        )
        let regularViewModel = makeNewsNotificationsViewModel(
            currentMember: regular,
            members: [regular],
            newsRepository: InMemoryNewsRepository(items: articles)
        )

        await adminViewModel.refreshNews()
        await regularViewModel.refreshNews()

        #expect(adminViewModel.newsFeed.map(\.id) == ["inactive", "active_4", "active_3", "active_2", "active_1"])
        #expect(adminViewModel.latestNews.map(\.id) == ["active_4", "active_3", "active_2"])
        #expect(regularViewModel.newsFeed.map(\.id) == ["active_4", "active_3", "active_2", "active_1"])
    }

    @Test
    func newsNotificationsViewModelResetsStateWhenSessionLeavesAuthorizedMode() {
        let admin = newsAdminMember()
        let viewModel = makeNewsNotificationsViewModel(currentMember: admin, members: [admin])
        viewModel.newsFeed = [newsArticle(id: "news")]
        viewModel.latestNews = [newsArticle(id: "latest")]
        viewModel.notificationsFeed = [notificationEvent(id: "notification", target: "all")]
        viewModel.newsDraft = NewsDraft(title: "Title", body: "Body")
        viewModel.notificationDraft = NotificationDraft(title: "Title", body: "Body", audience: .admins)
        viewModel.editingNewsId = "news"
        viewModel.pendingNewsDeletionId = "news"
        viewModel.isSavingNews = true
        viewModel.isSendingNotification = true

        viewModel.handleSessionModeChange(.signedOut)

        #expect(viewModel.currentSession == nil)
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.latestNews.isEmpty)
        #expect(viewModel.notificationsFeed.isEmpty)
        #expect(viewModel.newsDraft == NewsDraft())
        #expect(viewModel.notificationDraft == NotificationDraft())
        #expect(viewModel.editingNewsId == nil)
        #expect(viewModel.pendingNewsDeletionId == nil)
        #expect(viewModel.isSavingNews == false)
        #expect(viewModel.isSendingNotification == false)
    }

    @Test
    func newsViewModelInitializesEditsNormalizesDraftAndClearsEditor() async {
        let admin = newsAdminMember()
        let article = newsArticle(id: "news_1", title: "Title", body: "Body", urlImage: "https://cdn.test/news.jpg")
        let viewModel = makeNewsNotificationsViewModel(
            currentMember: admin,
            members: [admin],
            newsRepository: InMemoryNewsRepository(items: [article])
        )

        await viewModel.refreshNews()
        #expect(viewModel.startEditingNews(newsId: article.id))
        viewModel.updateNewsDraft { draft in
            draft.title = "  New title  "
            draft.body = "  New body  "
        }

        #expect(viewModel.editingNewsId == article.id)
        #expect(viewModel.newsDraft.normalized.title == "New title")
        #expect(viewModel.newsDraft.normalized.body == "New body")

        viewModel.clearNewsEditor()

        #expect(viewModel.editingNewsId == nil)
        #expect(viewModel.newsDraft == NewsDraft())
    }

    @Test
    func newsViewModelBlocksInvalidSaveInput() async {
        let admin = newsAdminMember()
        let viewModel = makeNewsNotificationsViewModel(currentMember: admin, members: [admin])

        #expect(viewModel.startCreatingNews())
        viewModel.updateNewsDraft { draft in
            draft.title = " "
            draft.body = "Body"
        }
        let saved = await viewModel.saveNews()

        #expect(saved == false)
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackNewsTitleBodyRequired)
    }

    @Test
    func newsViewModelSavesNewAndEditedNewsWithExistingMetadataRules() async {
        let admin = newsAdminMember(displayName: "Ana Admin")
        let repository = InMemoryNewsRepository(items: [])
        let viewModel = makeNewsNotificationsViewModel(
            currentMember: admin,
            members: [admin],
            newsRepository: repository,
            nowMillis: 123
        )

        #expect(viewModel.startCreatingNews())
        viewModel.updateNewsDraft { draft in
            draft.title = "  Nueva noticia  "
            draft.body = "  Cuerpo  "
            draft.active = false
            draft.urlImage = " https://cdn.test/news.jpg "
        }
        #expect(await viewModel.saveNews())

        var articles = await repository.allNews()
        let created = try? #require(articles.first)
        #expect(created?.title == "Nueva noticia")
        #expect(created?.body == "Cuerpo")
        #expect(created?.active == false)
        #expect(created?.publishedBy == "Ana Admin")
        #expect(created?.publishedAtMillis == 123)
        #expect(created?.urlImage == "https://cdn.test/news.jpg")
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackNewsCreated)

        let originalId = created?.id ?? ""
        #expect(viewModel.startEditingNews(newsId: originalId))
        viewModel.updateNewsDraft { draft in
            draft.title = "Actualizada"
            draft.body = "Cuerpo actualizado"
            draft.active = true
        }
        #expect(await viewModel.saveNews())

        articles = await repository.allNews()
        let updated = articles.first(where: { $0.id == originalId })
        #expect(updated?.title == "Actualizada")
        #expect(updated?.publishedBy == "Ana Admin")
        #expect(updated?.publishedAtMillis == 123)
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackNewsUpdated)
    }

    @Test
    func newsViewModelDeletesNewsAndClearsEditorWhenEditingDeletedArticle() async {
        let admin = newsAdminMember()
        let article = newsArticle(id: "delete_me")
        let repository = InMemoryNewsRepository(items: [article])
        let viewModel = makeNewsNotificationsViewModel(
            currentMember: admin,
            members: [admin],
            newsRepository: repository
        )
        await viewModel.refreshNews()
        #expect(viewModel.startEditingNews(newsId: article.id))

        viewModel.requestNewsDeletion(newsId: article.id)
        await viewModel.confirmNewsDeletion()

        #expect((await repository.allNews()).isEmpty)
        #expect(viewModel.newsFeed.isEmpty)
        #expect(viewModel.editingNewsId == nil)
        #expect(viewModel.pendingNewsDeletionId == nil)
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackNewsDeleted)
    }

    @Test
    func newsViewModelUploadsImageAndShowsFeedbackOnFailure() async {
        let admin = newsAdminMember()
        let successViewModel = makeNewsNotificationsViewModel(
            currentMember: admin,
            members: [admin],
            imagePipelineManager: NewsMockImagePipelineManager(result: .success("https://cdn.test/upload.jpg"))
        )

        await successViewModel.uploadNewsImage(Data([1, 2, 3]))

        #expect(successViewModel.newsDraft.urlImage == "https://cdn.test/upload.jpg")

        let failureViewModel = makeNewsNotificationsViewModel(
            currentMember: admin,
            members: [admin],
            imagePipelineManager: NewsMockImagePipelineManager(result: .failure(NewsImagePipelineTestError()))
        )

        await failureViewModel.uploadNewsImage(Data([1, 2, 3]))

        #expect(failureViewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test
    func notificationsViewModelLoadsNotificationsVisibleToCurrentAudience() async {
        let regular = newsRegularMember(id: "member_1")
        let repository = InMemoryNotificationRepository(
            items: [
                notificationEvent(id: "all", target: "all", sentAtMillis: 10),
                notificationEvent(id: "members", target: "segment", targetRole: .member, sentAtMillis: 20),
                notificationEvent(id: "admins", target: "segment", targetRole: .admin, sentAtMillis: 30),
                notificationEvent(id: "user", target: "users", userIds: ["member_1"], sentAtMillis: 40),
                notificationEvent(id: "other_user", target: "users", userIds: ["other"], sentAtMillis: 50)
            ]
        )
        let viewModel = makeNewsNotificationsViewModel(
            currentMember: regular,
            members: [regular],
            notificationRepository: repository
        )

        await viewModel.refreshNotifications()

        #expect(viewModel.notificationsFeed.map(\.id) == ["user", "members", "all"])
    }

    @Test
    func notificationsViewModelBlocksInvalidOrUnauthorizedSend() async {
        let regular = newsRegularMember()
        let regularViewModel = makeNewsNotificationsViewModel(currentMember: regular, members: [regular])

        #expect(await regularViewModel.sendNotification() == false)
        #expect(regularViewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackOnlyAdminSendNotification)

        let admin = newsAdminMember()
        let adminViewModel = makeNewsNotificationsViewModel(currentMember: admin, members: [admin])
        #expect(adminViewModel.startCreatingNotification())
        adminViewModel.updateNotificationDraft { draft in
            draft.title = " "
            draft.body = "Body"
        }

        #expect(await adminViewModel.sendNotification() == false)
        #expect(adminViewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackNotificationTitleBodyRequired)
    }

    @Test
    func notificationsViewModelSendsAdminBroadcastPayloadAndClearsDraft() async {
        let admin = newsAdminMember(id: "admin_1")
        let repository = InMemoryNotificationRepository(items: [])
        let viewModel = makeNewsNotificationsViewModel(
            currentMember: admin,
            members: [admin],
            notificationRepository: repository,
            nowMillis: 999
        )

        #expect(viewModel.startCreatingNotification())
        viewModel.updateNotificationDraft { draft in
            draft.title = "  Aviso  "
            draft.body = "  Cuerpo  "
            draft.audience = .producers
        }
        #expect(await viewModel.sendNotification())

        let sent = try? #require((await repository.allNotifications()).first)
        #expect(sent?.title == "Aviso")
        #expect(sent?.body == "Cuerpo")
        #expect(sent?.type == "admin_broadcast")
        #expect(sent?.target == "segment")
        #expect(sent?.segmentType == "role")
        #expect(sent?.targetRole == .producer)
        #expect(sent?.createdBy == "admin_1")
        #expect(sent?.sentAtMillis == 999)
        #expect(viewModel.notificationDraft == NotificationDraft())
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackNotificationSent)
    }

    @Test
    func previewEnvironmentUsesInMemoryNewsNotificationsDependenciesAndSharesNotificationRepository() async throws {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.newsNotificationsViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.newsNotificationsViewModel.newsRepository is InMemoryNewsRepository)
        #expect(environment.accessRootViewModel.newsNotificationsViewModel.imagePipelineManager is NoOpImagePipelineManager)

        let newsRepository = try #require(
            environment.accessRootViewModel.newsNotificationsViewModel.notificationRepository as? InMemoryNotificationRepository
        )
        let shiftsRepository = try #require(
            environment.accessRootViewModel.shiftsViewModel.notificationRepository as? InMemoryNotificationRepository
        )
        #expect(newsRepository === shiftsRepository)
    }
}

@MainActor
private func makeNewsNotificationsViewModel(
    currentMember: Member,
    members: [Member],
    newsRepository: InMemoryNewsRepository? = nil,
    notificationRepository: InMemoryNotificationRepository? = nil,
    imagePipelineManager: any ImagePipelineManager = NewsMockImagePipelineManager(result: .success("https://cdn.test/news.jpg")),
    nowMillis: Int64 = 100
) -> NewsNotificationsFeatureViewModel {
    let newsRepository = newsRepository ?? InMemoryNewsRepository(items: [])
    let notificationRepository = notificationRepository ?? InMemoryNotificationRepository(items: [])
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let session = AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_\(currentMember.id)", email: currentMember.normalizedEmail),
        authenticatedMember: currentMember,
        member: currentMember,
        members: members
    )
    sessionViewModel.mode = .authorized(session)
    let viewModel = NewsNotificationsFeatureViewModel(
        sessionViewModel: sessionViewModel,
        newsRepository: newsRepository,
        notificationRepository: notificationRepository,
        imagePipelineManager: imagePipelineManager,
        nowMillisProvider: { nowMillis }
    )
    viewModel.currentSession = session
    viewModel.currentMember = currentMember
    return viewModel
}

@MainActor
private func newsAdminMember(
    id: String = "admin",
    displayName: String = "Admin"
) -> Member {
    Member(
        id: id,
        displayName: displayName,
        normalizedEmail: "\(id)@reguerta.test",
        authUid: "auth_\(id)",
        roles: [.member, .admin],
        isActive: true,
        producerCatalogEnabled: true
    )
}

@MainActor
private func newsRegularMember(id: String = "member") -> Member {
    Member(
        id: id,
        displayName: "Member",
        normalizedEmail: "\(id)@reguerta.test",
        authUid: "auth_\(id)",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

private func newsArticle(
    id: String,
    title: String = "Title",
    body: String = "Body",
    active: Bool = true,
    publishedBy: String = "Publisher",
    publishedAtMillis: Int64 = 1,
    urlImage: String? = nil
) -> NewsArticle {
    NewsArticle(
        id: id,
        title: title,
        body: body,
        active: active,
        publishedBy: publishedBy,
        publishedAtMillis: publishedAtMillis,
        urlImage: urlImage
    )
}

private func notificationEvent(
    id: String,
    title: String = "Title",
    body: String = "Body",
    target: String,
    userIds: [String] = [],
    segmentType: String? = "role",
    targetRole: MemberRole? = nil,
    createdBy: String = "system",
    sentAtMillis: Int64 = 1
) -> NotificationEvent {
    NotificationEvent(
        id: id,
        title: title,
        body: body,
        type: "admin_broadcast",
        target: target,
        userIds: userIds,
        segmentType: target == "segment" ? segmentType : nil,
        targetRole: targetRole,
        createdBy: createdBy,
        sentAtMillis: sentAtMillis,
        weekKey: nil
    )
}

private struct NewsImagePipelineTestError: Error {}

private actor NewsMockImagePipelineManager: ImagePipelineManager {
    enum ResultMode {
        case success(String)
        case failure(any Error)
    }

    private let result: ResultMode

    init(result: ResultMode) {
        self.result = result
    }

    func processAndUpload(
        imageData _: Data,
        request _: ImageUploadRequest
    ) async throws -> ImageUploadResult {
        switch result {
        case .success(let downloadURL):
            ImageUploadResult(
                downloadURL: downloadURL,
                widthPx: 1,
                heightPx: 1,
                byteSize: 1,
                mimeType: "image/jpeg"
            )
        case .failure(let error):
            throw error
        }
    }
}
