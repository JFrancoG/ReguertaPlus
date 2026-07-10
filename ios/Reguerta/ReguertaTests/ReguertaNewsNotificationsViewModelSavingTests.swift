import Testing

@testable import Reguerta

@MainActor
struct ReguertaNewsNotificationsViewModelSavingTests {
    @Test
    func newsViewModelSavesNewAndEditedNewsWithExistingMetadataRules() async throws {
        let admin = savingTestAdminMember(displayName: "Ana Admin")
        let repository = InMemoryNewsRepository(items: [])
        let viewModel = makeSavingNewsViewModel(
            currentMember: admin,
            members: [admin],
            repository: repository,
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
        let created = try #require(articles.first)
        #expect(created.title == "Nueva noticia")
        #expect(created.body == "Cuerpo")
        #expect(created.active == false)
        #expect(created.publishedBy == "Ana Admin")
        #expect(created.publishedAtMillis == 123)
        #expect(created.urlImage == "https://cdn.test/news.jpg")
        let originalId = created.id
        #expect(viewModel.pendingNewsSaveConfirmation == NewsSaveConfirmation(newsId: originalId, isNew: true))
        #expect(viewModel.feedbackCenter.messageKey == nil)

        #expect(viewModel.closeNewsSaveConfirmation() == originalId)
        #expect(viewModel.highlightedNewsId == originalId)
        #expect(viewModel.editingNewsId == nil)
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
        #expect(viewModel.pendingNewsSaveConfirmation == NewsSaveConfirmation(newsId: originalId, isNew: false))
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }
}

@MainActor
private func makeSavingNewsViewModel(
    currentMember: Member,
    members: [Member],
    repository: InMemoryNewsRepository,
    nowMillis: Int64
) -> NewsNotificationsFeatureViewModel {
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
        newsRepository: repository,
        notificationRepository: InMemoryNotificationRepository(items: []),
        pushNotificationPermissionProvider: FixedPushNotificationPermissionProvider(isActive: true),
        imagePipelineManager: NoOpImagePipelineManager(),
        nowMillisProvider: { nowMillis }
    )
    viewModel.currentSession = session
    viewModel.currentMember = currentMember
    return viewModel
}

@MainActor
private func savingTestAdminMember(displayName: String) -> Member {
    Member(
        id: "admin",
        displayName: displayName,
        normalizedEmail: "admin@reguerta.test",
        authUid: "auth_admin",
        roles: [.member, .admin],
        isActive: true,
        producerCatalogEnabled: true
    )
}
