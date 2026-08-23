import Foundation
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ProductsMutationOwnershipTests {
    @Test(arguments: ProductUnsynchronizedSessionScenario.allCases)
    func unsynchronizedSessionChangesCannotPersistThePreviousEditor(
        _ scenario: ProductUnsynchronizedSessionScenario
    ) async throws {
        let producer = producer(id: "producer_unsynchronized_save", parity: .even)
        let product = regularProduct(id: "tomato_unsynchronized", vendorId: producer.id, name: "Tomates")
        let repository = RecordingProductsMutationRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: producer,
            members: [producer],
            productRepository: repository
        )
        viewModel.catalogProducts = [product]
        viewModel.startEditing(productId: product.id)
        viewModel.updateDraft { $0.name = "Edición de la sesión anterior" }
        let previousSession = try #require(viewModel.currentSession)
        let previousDraft = viewModel.draft

        switch scenario {
        case .environmentSuccessor:
            viewModel.sessionViewModel.mode = .authorized(
                productsAuthorizedSession(member: producer, environment: .production)
            )
        case .sameSessionRelogin:
            viewModel.sessionViewModel.mode = .signedOut
            viewModel.sessionViewModel.mode = .authorized(previousSession)
        }

        #expect(viewModel.authorizedSessionContext == nil)
        #expect(await viewModel.save() == false)
        #expect(repository.upsertCount == 0)
        #expect(repository.upsertEnvironments.isEmpty)
        #expect(viewModel.currentSession == previousSession)
        #expect(viewModel.editingProductId == product.id)
        #expect(viewModel.draft == previousDraft)
    }

    @Test func sameSessionReloginHandlerInvalidatesThePreviousEditorRevision() async throws {
        let producer = producer(id: "producer_relogin_handler", parity: .even)
        let product = regularProduct(id: "tomato_relogin_handler", vendorId: producer.id, name: "Tomates")
        let viewModel = await makeProductsViewModel(currentMember: producer, members: [producer])
        viewModel.catalogProducts = [product]
        viewModel.startEditing(productId: product.id)
        viewModel.updateDraft { $0.name = "Editor anterior al relogin" }
        let previousSession = try #require(viewModel.currentSession)

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.sessionViewModel.mode = .authorized(previousSession)
        #expect(viewModel.authorizedSessionContext == nil)

        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)

        #expect(viewModel.authorizedSessionContext != nil)
        #expect(viewModel.editingProductId == nil)
        #expect(viewModel.draft == ProductDraft())
    }

    @Test func directDraftMutationDuringSuspendedSavePreservesTheNewerEditorRevision() async throws {
        let producer = producer(id: "producer_direct_draft", parity: .even)
        let product = regularProduct(id: "tomato", vendorId: producer.id, name: "Tomates")
        let repository = SessionRevisionProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: producer,
            members: [producer],
            productRepository: repository
        )
        viewModel.catalogProducts = [product]
        viewModel.startEditing(productId: product.id)
        viewModel.updateDraft { $0.name = "Versión enviada" }

        let saveTask = Task { await viewModel.save() }
        defer {
            saveTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilSaveStarts()

        let submittedRevision = viewModel.editorRevision
        viewModel.draft.name = "Versión más nueva"
        let newerDraft = viewModel.draft
        repository.completeSave()

        #expect(viewModel.editorRevision != submittedRevision)
        #expect(await saveTask.value == false)
        #expect(viewModel.catalogProducts.first?.name == "Versión enviada")
        #expect(viewModel.editingProductId == product.id)
        #expect(viewModel.draft == newerDraft)
        #expect(viewModel.activeSaveOperationId == nil)
        #expect(viewModel.isSaving == false)
    }

    @Test(arguments: ProductUploadInvalidationScenario.allCases)
    func uploadInvalidationCancelsItsOwnerAndAllowsASuccessor(
        _ scenario: ProductUploadInvalidationScenario
    ) async throws {
        let originalProducer = producer(id: "producer_upload_predecessor", parity: .even)
        let pipeline = ControlledProductsImagePipelineManager()
        let viewModel = await makeProductsViewModel(
            currentMember: originalProducer,
            members: [originalProducer],
            imagePipelineManager: pipeline
        )
        viewModel.startCreating()

        let predecessor = Task { await viewModel.uploadImage(Data([1, 2, 3])) }
        defer {
            predecessor.cancel()
            pipeline.cancelAll()
        }
        try await pipeline.waitUntilFirstUploadStarts()

        invalidateUpload(scenario, in: viewModel, originalProducer: originalProducer)
        #expect(viewModel.activeUploadOperationId == nil)
        #expect(viewModel.productImageUploadTask == nil)
        #expect(viewModel.isUploadingImage == false)

        viewModel.startCreating()
        await viewModel.uploadImage(Data([4, 5, 6]))
        pipeline.completeFirstUpload()
        await predecessor.value

        #expect(pipeline.uploadCount == 2)
        #expect(pipeline.cancellationCount == 1)
        #expect(viewModel.draft.productImageUrl == pipeline.successorURL)
        #expect(viewModel.activeUploadOperationId == nil)
        #expect(viewModel.productImageUploadTask == nil)
        #expect(viewModel.isUploadingImage == false)
    }

    @Test func delayedArchiveDoesNotCloseAnEditorOpenedAfterSubmission() async throws {
        let producer = producer(id: "producer_archive_owner", parity: .even)
        let product = regularProduct(id: "tomato_archive", vendorId: producer.id, name: "Tomates")
        let repository = SessionRevisionProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: producer,
            members: [producer],
            productRepository: repository
        )
        viewModel.catalogProducts = [product]

        let archiveTask = Task { await viewModel.archive(productId: product.id) }
        defer {
            archiveTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilSaveStarts()

        viewModel.startEditing(productId: product.id)
        viewModel.draft.name = "Edición sucesora"
        let successorDraft = viewModel.draft
        repository.completeSave()
        await archiveTask.value

        #expect(viewModel.archivedProducts.map(\.id) == [product.id])
        #expect(viewModel.editingProductId == product.id)
        #expect(viewModel.draft == successorDraft)
        #expect(viewModel.activeSaveOperationId == nil)
        #expect(viewModel.isSaving == false)
    }

    @Test func staleCatalogVisibilityResultAfterSessionRevisionPublishesNothingAndCleansItsOwner() async throws {
        let producer = producer(id: "producer_visibility_revision", parity: .even)
        let repository = ControlledProductsVisibilityMemberRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: producer,
            members: [producer],
            memberRepository: repository
        )

        let visibilityTask = Task { await viewModel.setVacationModeEnabled(true) }
        defer {
            visibilityTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilMutationStarts(0)

        let revisedProducer = replacingDisplayName(in: producer, with: "Productor revisado")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(revisedProducer, members: [revisedProducer])
        repository.completeMutation(0)
        await visibilityTask.value

        guard case .authorized(let session) = viewModel.sessionViewModel.mode else {
            Issue.record("Expected an authorized session")
            return
        }
        #expect(session.member == revisedProducer)
        #expect(session.member.producerCatalogEnabled)
        #expect(viewModel.currentMember?.producerCatalogEnabled == true)
        #expect(viewModel.activeCatalogVisibilityOperationId == nil)
        #expect(viewModel.isUpdatingCatalogVisibility == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func staleVisibilityCleanupFromPreviousEnvironmentDoesNotClobberItsSuccessor() async throws {
        let originalProducer = producer(id: "producer_visibility_old", parity: .even)
        let replacementProducer = producer(id: "producer_visibility_new", parity: .odd)
        let repository = ControlledProductsVisibilityMemberRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: originalProducer,
            members: [originalProducer],
            memberRepository: repository
        )

        let predecessor = Task { await viewModel.setVacationModeEnabled(true) }
        defer {
            predecessor.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilMutationStarts(0)

        let replacement = productsAuthorizedSession(member: replacementProducer, environment: .production)
        viewModel.sessionViewModel.mode = .authorized(replacement)
        viewModel.handleSessionModeChange(.authorized(replacement))
        let successor = Task { await viewModel.setVacationModeEnabled(true) }
        defer { successor.cancel() }
        try await repository.waitUntilMutationStarts(1)
        let successorOperationId = viewModel.activeCatalogVisibilityOperationId

        repository.completeMutation(0)
        await predecessor.value
        #expect(successorOperationId != nil)
        #expect(viewModel.activeCatalogVisibilityOperationId == successorOperationId)
        #expect(viewModel.isUpdatingCatalogVisibility)

        repository.completeMutation(1)
        await successor.value

        guard case .authorized(let session) = viewModel.sessionViewModel.mode else {
            Issue.record("Expected the replacement authorized session")
            return
        }
        #expect(repository.mutationEnvironments == [.develop, .production])
        #expect(session.principal.uid == replacementProducer.authUid)
        #expect(session.environment == .production)
        #expect(session.member.producerCatalogEnabled == false)
        #expect(viewModel.currentMember?.producerCatalogEnabled == false)
        #expect(viewModel.activeCatalogVisibilityOperationId == nil)
        #expect(viewModel.isUpdatingCatalogVisibility == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    private func invalidateUpload(
        _ scenario: ProductUploadInvalidationScenario,
        in viewModel: ProductsRouteViewModel,
        originalProducer: Member
    ) {
        switch scenario {
        case .clearEditor:
            viewModel.clearEditor()
        case .signedOutReset:
            viewModel.sessionViewModel.mode = .signedOut
            viewModel.handleSessionModeChange(.signedOut)
            let replacement = productsAuthorizedSession(member: originalProducer, environment: .develop)
            viewModel.sessionViewModel.mode = .authorized(replacement)
            viewModel.handleSessionModeChange(.authorized(replacement))
        case .identityAndEnvironmentChange:
            let replacementProducer = producer(id: "producer_upload_successor", parity: .odd)
            let replacement = productsAuthorizedSession(member: replacementProducer, environment: .production)
            viewModel.sessionViewModel.mode = .authorized(replacement)
            viewModel.handleSessionModeChange(.authorized(replacement))
        }
    }
}
