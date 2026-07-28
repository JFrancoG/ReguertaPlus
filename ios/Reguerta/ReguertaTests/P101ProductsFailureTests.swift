import Foundation
import Testing

@testable import Reguerta

@MainActor
struct P101ProductsFailureTests {
    @Test
    func productsViewModelPreservesCatalogWhenRefreshFails() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let originalProduct = regularProduct(
            id: "tomato",
            vendorId: currentProducer.id,
            name: "Tomates"
        )
        let repository = ControlledProductRepository(
            items: [originalProduct],
            rejectsReads: true
        )
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.catalogProducts = [originalProduct]

        await viewModel.refreshCatalog()

        #expect(viewModel.catalogProducts == [originalProduct])
        #expect(viewModel.isLoadingCatalog == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test
    func productsViewModelDoesNotShowFailureFeedbackForCancelledRefresh() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let originalProduct = regularProduct(
            id: "tomato",
            vendorId: currentProducer.id,
            name: "Tomates"
        )
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: CancellingProductRepository()
        )
        viewModel.catalogProducts = [originalProduct]

        await viewModel.refreshCatalog()

        #expect(viewModel.catalogProducts == [originalProduct])
        #expect(viewModel.isLoadingCatalog == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test
    func productsViewModelCompletesConfirmedSaveWithoutReadBack() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let originalProduct = regularProduct(
            id: "tomato",
            vendorId: currentProducer.id,
            name: "Tomates"
        )
        let repository = ControlledProductRepository(
            items: [originalProduct],
            rejectsReads: true
        )
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.catalogProducts = [originalProduct]
        viewModel.startEditing(productId: originalProduct.id)
        viewModel.updateDraft { $0.name = "Tomates cherry" }

        let saved = await viewModel.save()

        #expect(saved)
        #expect(viewModel.editingProductId == nil)
        #expect(viewModel.draft == ProductDraft())
        #expect(viewModel.catalogProducts.first?.name == "Tomates cherry")
        #expect(repository.readCount == 0)
    }

    @Test
    func productsViewModelReusesStableIdAfterAmbiguousCreateFailure() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let repository = AmbiguousCreateProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.startCreating()
        viewModel.updateDraft { draft in
            draft.name = "Tomates"
            draft.price = "3"
            draft.unitName = "unidad"
            draft.unitPlural = "unidades"
        }
        let originalDraft = viewModel.draft

        let firstAttempt = await viewModel.save()
        let draftAfterFirstAttempt = viewModel.draft
        let pendingIdAfterFirstAttempt = viewModel.pendingNewProductId
        let secondAttempt = await viewModel.save()

        #expect(firstAttempt == false)
        #expect(secondAttempt)
        #expect(repository.attemptedProductIds.count == 2)
        #expect(Set(repository.attemptedProductIds).count == 1)
        #expect(repository.storedProductCount == 1)
        #expect(draftAfterFirstAttempt == originalDraft)
        #expect(pendingIdAfterFirstAttempt?.isEmpty == false)
    }

    @Test
    func productsViewModelCompletesConfirmedArchiveWithoutReadBack() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let product = regularProduct(id: "tomato", vendorId: currentProducer.id, name: "Tomates")
        let repository = ControlledProductRepository(items: [product], rejectsReads: true)
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.catalogProducts = [product]

        await viewModel.archive(productId: product.id)

        #expect(viewModel.activeProducts.isEmpty)
        #expect(viewModel.archivedProducts.map(\.id) == [product.id])
        #expect(repository.readCount == 0)
    }

    @Test
    func productsViewModelPreservesOrderingSnapshotWhenCommitmentReadFails() async {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producer = producer(id: "producer_even", parity: .even)
        let product = regularProduct(id: "visible", vendorId: producer.id, name: "Visible")
        let commitment = seasonalCommitment(productId: product.id, fixedQtyPerOfferedWeek: 1)
        let viewModel = await makeProductsViewModel(
            currentMember: currentMember,
            members: [currentMember, producer],
            productRepository: InMemoryProductRepository(items: [product]),
            seasonalCommitmentRepository: RejectingSeasonalCommitmentRepository(),
            nowMillis: testMillis(year: 2026, month: 5, day: 14)
        )
        viewModel.myOrderProducts = [product]
        viewModel.myOrderSeasonalCommitments = [commitment]
        viewModel.hasLoadedOrderingProducts = true

        await viewModel.refreshOrderingProducts()

        #expect(viewModel.myOrderProducts == [product])
        #expect(viewModel.myOrderSeasonalCommitments == [commitment])
        #expect(viewModel.hasLoadedOrderingProducts)
        #expect(viewModel.isLoadingOrderingProducts == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test
    func confirmedVacationChangeSurvivesSecondaryRefreshFailure() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let memberRepository = ConfirmingVisibilityMemberRepository(member: currentProducer)
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            memberRepository: memberRepository
        )

        await viewModel.setVacationModeEnabled(true)

        guard case .authorized(let session) = viewModel.sessionViewModel.mode else {
            Issue.record("Expected authorized session")
            return
        }
        #expect(session.member.producerCatalogEnabled == false)
        #expect(viewModel.currentMember?.producerCatalogEnabled == false)
        #expect(viewModel.isUpdatingCatalogVisibility == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test
    func staleSaveFromPreviousLoginPublishesNothing() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let repository = SuspendedProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.startCreating()
        viewModel.updateDraft { draft in
            draft.name = "Tomates"
            draft.price = "3"
            draft.unitName = "unidad"
            draft.unitPlural = "unidades"
        }

        let saveTask = Task { await viewModel.save() }
        await repository.waitUntilWriteStarts()
        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)
        let reloggedSession = AuthorizedSession(
            principal: AuthPrincipal(
                uid: "auth_\(currentProducer.id)",
                email: currentProducer.normalizedEmail
            ),
            authenticatedMember: currentProducer,
            member: currentProducer,
            members: [currentProducer],
            environment: .develop
        )
        viewModel.sessionViewModel.mode = .authorized(reloggedSession)
        viewModel.handleSessionModeChange(.authorized(reloggedSession))
        repository.completeWrite()

        #expect(await saveTask.value == false)
        #expect(viewModel.catalogProducts.isEmpty)
        #expect(viewModel.draft == ProductDraft())
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test
    func sameIdentityAuthRefreshDoesNotInvalidateConfirmedSave() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let repository = SuspendedProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.startCreating()
        viewModel.updateDraft { draft in
            draft.name = "Tomates"
            draft.price = "3"
            draft.unitName = "unidad"
            draft.unitPlural = "unidades"
        }

        let saveTask = Task { await viewModel.save() }
        await repository.waitUntilWriteStarts()
        _ = viewModel.sessionViewModel.invalidateSessionOperation()
        repository.completeWrite()

        #expect(await saveTask.value)
        #expect(viewModel.catalogProducts.map(\.name) == ["Tomates"])
        #expect(viewModel.isSaving == false)
    }

    @Test
    func cancelledNonCooperativeSavePreservesDraftAndPublishesNothing() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let repository = SuspendedProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.startCreating()
        configureValidDraft(in: viewModel, name: "Tomates")
        let originalDraft = viewModel.draft

        let saveTask = Task { await viewModel.save() }
        await repository.waitUntilWriteStarts()
        saveTask.cancel()
        repository.completeWrite()

        #expect(await saveTask.value == false)
        #expect(viewModel.catalogProducts.isEmpty)
        #expect(viewModel.draft == originalDraft)
        #expect(viewModel.isSaving == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test
    func confirmedOldEditorSaveUpdatesCatalogWithoutClobberingNewEditor() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let firstProduct = regularProduct(id: "first", vendorId: currentProducer.id, name: "Primero")
        let secondProduct = regularProduct(id: "second", vendorId: currentProducer.id, name: "Segundo")
        let repository = SuspendedProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.catalogProducts = [firstProduct, secondProduct]
        viewModel.startEditing(productId: firstProduct.id)
        viewModel.updateDraft { $0.name = "Primero guardado" }

        let saveTask = Task { await viewModel.save() }
        await repository.waitUntilWriteStarts()
        viewModel.startEditing(productId: secondProduct.id)
        let secondDraft = viewModel.draft
        repository.completeWrite()

        #expect(await saveTask.value == false)
        #expect(viewModel.catalogProducts.first { $0.id == firstProduct.id }?.name == "Primero guardado")
        #expect(viewModel.editingProductId == secondProduct.id)
        #expect(viewModel.draft == secondDraft)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test
    func confirmedSavePreservesNewerDraftRevisionForSameProduct() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let product = regularProduct(id: "first", vendorId: currentProducer.id, name: "Primero")
        let repository = SuspendedProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        viewModel.catalogProducts = [product]
        viewModel.startEditing(productId: product.id)
        viewModel.updateDraft { $0.name = "Versión enviada" }

        let saveTask = Task { await viewModel.save() }
        await repository.waitUntilWriteStarts()
        viewModel.updateDraft { $0.name = "Versión más nueva" }
        let newerDraft = viewModel.draft
        let secondAttempt = await viewModel.save()
        repository.completeWrite()

        #expect(await saveTask.value == false)
        #expect(secondAttempt == false)
        #expect(repository.writeCount == 1)
        #expect(viewModel.catalogProducts.first?.name == "Versión enviada")
        #expect(viewModel.editingProductId == product.id)
        #expect(viewModel.draft == newerDraft)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test
    func staleUploadCleanupDoesNotClobberNewerDraftOrBlockEditor() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let pipeline = SuspendedImagePipelineManager()
        let repository = ControlledProductRepository(items: [], rejectsReads: false)
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository,
            imagePipelineManager: pipeline
        )
        viewModel.startCreating()
        viewModel.updateDraft { draft in
            draft.name = "Tomates"
            draft.price = "3"
            draft.unitName = "unidad"
            draft.unitPlural = "unidades"
        }

        let uploadTask = Task { await viewModel.uploadImage(Data([1, 2, 3])) }
        await pipeline.waitUntilUploadStarts()
        guard let refreshedSession = viewModel.currentSession else {
            Issue.record("Expected authorized session")
            return
        }
        viewModel.handleSessionModeChange(.authorized(refreshedSession))
        #expect(viewModel.isUploadingImage)
        viewModel.updateDraft { $0.name = "Tomates nuevos" }
        await viewModel.uploadImage(Data([4, 5, 6]))
        let saveWhileUploading = await viewModel.save()
        await pipeline.completeUpload(downloadURL: "https://cdn.reguerta.test/old.jpg")
        await uploadTask.value

        #expect(await pipeline.uploadCount == 1)
        #expect(saveWhileUploading == false)
        #expect(repository.writeCount == 0)
        #expect(viewModel.isUploadingImage == false)
        #expect(viewModel.draft.name == "Tomates nuevos")
        #expect(viewModel.draft.productImageUrl.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test
    func newIdentityCanSaveWhileOldIdentityWriteRemainsSuspended() async {
        let oldProducer = producer(id: "producer_old", parity: .even)
        let newProducer = producer(id: "producer_new", parity: .odd)
        let repository = MultiSuspendedProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: oldProducer,
            members: [oldProducer],
            productRepository: repository
        )
        viewModel.startCreating()
        configureValidDraft(in: viewModel, name: "Producto antiguo")

        let oldSaveTask = Task { await viewModel.save() }
        await repository.waitUntilWriteCount(1)

        let newSession = AuthorizedSession(
            principal: AuthPrincipal(uid: "auth_\(newProducer.id)", email: newProducer.normalizedEmail),
            authenticatedMember: newProducer,
            member: newProducer,
            members: [newProducer],
            environment: .develop
        )
        viewModel.sessionViewModel.mode = .authorized(newSession)
        viewModel.handleSessionModeChange(.authorized(newSession))
        viewModel.startCreating()
        configureValidDraft(in: viewModel, name: "Producto nuevo")
        let newProductId = viewModel.pendingNewProductId

        let newSaveTask = Task { await viewModel.save() }
        await repository.waitUntilWriteCount(2)
        repository.completeWrite(at: 1)
        #expect(await newSaveTask.value)
        repository.completeWrite(at: 0)
        #expect(await oldSaveTask.value == false)

        #expect(viewModel.catalogProducts.map(\.id) == [newProductId])
        #expect(viewModel.isSaving == false)
        #expect(viewModel.isUploadingImage == false)
        #expect(viewModel.isUpdatingCatalogVisibility == false)
    }

    private func configureValidDraft(in viewModel: ProductsRouteViewModel, name: String) {
        viewModel.updateDraft { draft in
            draft.name = name
            draft.price = "3"
            draft.unitName = "unidad"
            draft.unitPlural = "unidades"
        }
    }
}

@MainActor
private final class ConfirmingVisibilityMemberRepository: MemberRepository {
    private let memberValue: Member

    init(member: Member) {
        memberValue = member
    }

    func member(id: String) async -> Member? {
        id == memberValue.id ? memberValue : nil
    }

    func members(visibleTo _: Member) async throws -> [Member] {
        throw ProductReadTestError.rejected
    }

    func updateOwnProducerCatalogEnabled(member: Member, enabled: Bool) async -> Member {
        member.copy(producerCatalogEnabled: enabled)
    }
}

@MainActor
private final class SuspendedProductRepository: ProductRepository {
    private var continuation: CheckedContinuation<Product, Never>?
    private var submittedProduct: Product?
    private(set) var writeCount = 0

    func allProducts() async -> [Product] { [] }

    func products(vendorId _: String) async -> [Product] { [] }

    func upsert(product: Product) async -> Product {
        writeCount += 1
        submittedProduct = product
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilWriteStarts() async {
        while continuation == nil {
            await Task.yield()
        }
    }

    func completeWrite() {
        guard let submittedProduct, let continuation else { return }
        self.continuation = nil
        continuation.resume(returning: submittedProduct)
    }
}

@MainActor
private final class MultiSuspendedProductRepository: ProductRepository {
    private var continuations: [CheckedContinuation<Product, Never>?] = []
    private var submittedProducts: [Product] = []

    func allProducts() async -> [Product] { [] }

    func products(vendorId _: String) async -> [Product] { [] }

    func upsert(product: Product) async -> Product {
        let index = submittedProducts.count
        submittedProducts.append(product)
        continuations.append(nil)
        return await withCheckedContinuation { continuation in
            continuations[index] = continuation
        }
    }

    func waitUntilWriteCount(_ expectedCount: Int) async {
        while submittedProducts.count < expectedCount || continuations[expectedCount - 1] == nil {
            await Task.yield()
        }
    }

    func completeWrite(at index: Int) {
        guard submittedProducts.indices.contains(index),
              continuations.indices.contains(index),
              let continuation = continuations[index] else { return }
        continuations[index] = nil
        continuation.resume(returning: submittedProducts[index])
    }
}

private actor SuspendedImagePipelineManager: ImagePipelineManager {
    private var continuation: CheckedContinuation<ImageUploadResult, Never>?
    private(set) var uploadCount = 0

    func processAndUpload(
        imageData _: Data,
        request _: ImageUploadRequest
    ) async throws -> ImageUploadResult {
        uploadCount += 1
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilUploadStarts() async {
        while continuation == nil {
            await Task.yield()
        }
    }

    func completeUpload(downloadURL: String) {
        guard let continuation else { return }
        self.continuation = nil
        continuation.resume(
            returning: ImageUploadResult(
                downloadURL: downloadURL,
                widthPx: 1,
                heightPx: 1,
                byteSize: 1,
                mimeType: "image/jpeg"
            )
        )
    }
}

@MainActor
private final class ControlledProductRepository: ProductRepository {
    private var itemsById: [String: Product]
    private let rejectsReads: Bool
    private(set) var readCount = 0
    private(set) var writeCount = 0

    init(items: [Product], rejectsReads: Bool) {
        itemsById = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
        self.rejectsReads = rejectsReads
    }

    func allProducts() async throws -> [Product] {
        readCount += 1
        try rejectReadIfNeeded()
        return Array(itemsById.values)
    }

    func products(vendorId: String) async throws -> [Product] {
        readCount += 1
        try rejectReadIfNeeded()
        return itemsById.values.filter { $0.vendorId == vendorId }
    }

    func upsert(product: Product) async -> Product {
        writeCount += 1
        itemsById[product.id] = product
        return product
    }

    private func rejectReadIfNeeded() throws {
        if rejectsReads {
            throw ProductReadTestError.rejected
        }
    }
}

@MainActor
private final class RejectingSeasonalCommitmentRepository: SeasonalCommitmentRepository {
    func activeCommitments(userId _: String) async throws -> [SeasonalCommitment] {
        throw ProductReadTestError.rejected
    }
}

private enum ProductReadTestError: Error {
    case rejected
}

@MainActor
private final class AmbiguousCreateProductRepository: ProductRepository {
    private var itemsById: [String: Product] = [:]
    private(set) var attemptedProductIds: [String] = []

    var storedProductCount: Int {
        itemsById.count
    }

    func allProducts() async -> [Product] {
        Array(itemsById.values)
    }

    func products(vendorId: String) async -> [Product] {
        itemsById.values.filter { $0.vendorId == vendorId }
    }

    func upsert(product: Product) async throws -> Product {
        attemptedProductIds.append(product.id)
        itemsById[product.id] = product
        if attemptedProductIds.count == 1 {
            throw ProductReadTestError.rejected
        }
        return product
    }
}

@MainActor
private final class CancellingProductRepository: ProductRepository {
    func allProducts() async throws -> [Product] {
        throw CancellationError()
    }

    func products(vendorId _: String) async throws -> [Product] {
        throw CancellationError()
    }

    func upsert(product: Product) async -> Product {
        product
    }
}
