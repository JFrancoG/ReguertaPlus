import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaProductsViewModelTests {
    @Test
    func productsViewModelLoadsCatalogOnlyForCatalogManagersAndSplitsArchivedProducts() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let activeProduct = regularProduct(id: "active", vendorId: currentProducer.id, name: "Acelgas")
        let archivedProduct = regularProduct(id: "archived", vendorId: currentProducer.id, name: "Berenjenas")
            .archivedCopy(nowMillis: 2)
        let otherProduct = regularProduct(id: "other", vendorId: "other_producer", name: "Calabaza")
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: InMemoryProductRepository(items: [activeProduct, archivedProduct, otherProduct])
        )

        await viewModel.refreshCatalog()

        #expect(viewModel.activeProducts.map(\.id) == [activeProduct.id])
        #expect(viewModel.archivedProducts.map(\.id) == [archivedProduct.id])

        let regularMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let regularViewModel = await makeProductsViewModel(
            currentMember: regularMember,
            members: [regularMember],
            productRepository: InMemoryProductRepository(items: [activeProduct])
        )
        await regularViewModel.refreshCatalog()
        #expect(regularViewModel.catalogProducts.isEmpty)
    }

    @Test
    func productsViewModelInitializesEditsNormalizesDraftAndClearsEditor() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let product = regularProduct(id: "tomato", vendorId: currentProducer.id, name: "Tomates")
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: InMemoryProductRepository(items: [product])
        )
        await viewModel.refreshCatalog()

        viewModel.startEditing(productId: product.id)
        viewModel.updateDraft { draft in
            draft.name = " Tomates cherry "
            draft.price = " 3,5 "
        }

        #expect(viewModel.editingProductId == product.id)
        #expect(viewModel.draft.normalized.name == "Tomates cherry")
        #expect(viewModel.draft.normalized.price == "3,5")

        viewModel.clearEditor()

        #expect(viewModel.editingProductId == nil)
        #expect(viewModel.draft == ProductDraft())
    }

    @Test
    func productEditorUsesAsymmetricStockStepsWithoutGoingBelowZero() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer]
        )

        viewModel.startCreating()
        viewModel.setUnlimitedStock(false)
        viewModel.increaseFiniteStock()
        #expect(viewModel.finiteStockQuantity == 10)
        #expect(viewModel.draft.stockQty == "10")

        viewModel.decreaseFiniteStock()
        #expect(viewModel.finiteStockQuantity == 9)

        viewModel.updateDraft { $0.stockQty = "0" }
        viewModel.decreaseFiniteStock()
        #expect(viewModel.finiteStockQuantity == 0)
        #expect(viewModel.draft.stockQty == "0")
    }

    @Test
    func productsHeaderAndBackActionFollowEditorState() {
        let rootViewModel = ReguertaAppEnvironment.preview().accessRootViewModel
        rootViewModel.homeDestination = .products
        rootViewModel.productsViewModel.editingProductId = ""

        guard case .verbatim(let title)? = rootViewModel.homeShellHeaderViewModel.title else {
            Issue.record("Expected a verbatim product editor title")
            return
        }
        #expect(title == l10n(AccessL10nKey.productsEditorTitleNew))

        rootViewModel.handleHomePrimaryAction()

        #expect(rootViewModel.homeDestination == .products)
        #expect(rootViewModel.productsViewModel.editingProductId == nil)

        rootViewModel.handleHomePrimaryAction()
        #expect(rootViewModel.homeDestination == .dashboard)
    }

    @Test
    func productsViewModelBlocksInvalidSaveInput() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let viewModel = await makeProductsViewModel(currentMember: currentProducer, members: [currentProducer])

        viewModel.startCreating()
        viewModel.selectContainer(.ecoBasket)
        viewModel.updateDraft { draft in
            draft.name = ""
            draft.price = "abc"
        }
        await viewModel.save()

        #expect(viewModel.catalogProducts.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test
    func productsViewModelSavesProducerProductWithEcoBasketRules() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let repository = InMemoryProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository,
            nowMillis: 100
        )

        viewModel.startCreating()
        viewModel.selectContainer(.ecoBasket)
        viewModel.updateDraft { draft in
            draft.name = "Ecocesta"
            draft.price = "12"
            draft.unitName = "cesta"
            draft.unitPlural = "cestas"
        }
        await viewModel.save()

        let products = await repository.products(vendorId: currentProducer.id)
        #expect(products.count == 1)
        #expect(products.first?.vendorId == currentProducer.id)
        #expect(products.first?.isEcoBasket == true)
        #expect(products.first?.createdAtMillis == 100)
    }

    @Test
    func productsViewModelSavesCommonPurchaseOnlyForCommonPurchaseManagers() async {
        let currentMember = Member(
            id: "common_manager",
            displayName: "Compra comun",
            normalizedEmail: "common@reguerta.app",
            authUid: nil,
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true,
            isCommonPurchaseManager: true
        )
        let repository = InMemoryProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            productRepository: repository
        )

        viewModel.startCreating()
        viewModel.updateDraft { draft in
            draft.name = "Arroz"
            draft.price = "4"
            draft.unitName = "saco"
            draft.unitPlural = "sacos"
            draft.isCommonPurchase = true
            draft.commonPurchaseType = .seasonal
        }
        await viewModel.save()

        let products = await repository.products(vendorId: currentMember.id)
        #expect(products.first?.isCommonPurchase == true)
        #expect(products.first?.commonPurchaseType == .seasonal)
        #expect(products.first?.isEcoBasket == false)
    }

    @Test
    func productsViewModelBlocksEcoBasketWithIncompatiblePrice() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let existingEcoBasket = ecoBasketProduct(id: "eco_existing", vendorId: "other_producer", price: 10)
        let repository = InMemoryProductRepository(items: [existingEcoBasket])
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )

        viewModel.startCreating()
        viewModel.selectContainer(.ecoBasket)
        viewModel.updateDraft { draft in
            draft.name = "Ecocesta nueva"
            draft.price = "12"
            draft.unitName = "cesta"
            draft.unitPlural = "cestas"
        }
        await viewModel.save()

        let products = await repository.products(vendorId: currentProducer.id)
        #expect(products.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test
    func productsViewModelArchivesProductAndUpdatesLocalSnapshot() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let product = regularProduct(id: "tomato", vendorId: currentProducer.id, name: "Tomates")
        let repository = InMemoryProductRepository(items: [product])
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            productRepository: repository
        )
        await viewModel.refreshCatalog()

        await viewModel.archive(productId: product.id)

        #expect(viewModel.activeProducts.isEmpty)
        #expect(viewModel.archivedProducts.map(\.id) == [product.id])
    }

    @Test
    func productsViewModelUploadsImageAndShowsFeedbackOnFailure() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let successPipeline = MockImagePipelineManager(result: .success("https://cdn.reguerta.test/product.jpg"))
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            imagePipelineManager: successPipeline
        )

        await viewModel.uploadImage(Data([1, 2, 3]))

        #expect(viewModel.draft.productImageUrl == "https://cdn.reguerta.test/product.jpg")

        let failurePipeline = MockImagePipelineManager(result: .failure(ImagePipelineError.uploadFailed))
        let failingViewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer],
            imagePipelineManager: failurePipeline
        )

        await failingViewModel.uploadImage(Data([1, 2, 3]))

        #expect(failingViewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test
    func productsViewModelEnablesVacationModeAndUpdatesSessionMember() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let memberRepository = InMemoryMemberRepository()
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
        #expect(viewModel.currentMember?.producerCatalogEnabled == false)
        #expect(session.member.producerCatalogEnabled == false)
    }

    @Test
    func productsViewModelLoadsMyOrderFeedWithVisibilityParityAndCommitments() async {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let evenProducer = producer(id: "producer_even", parity: .even)
        let oddProducer = producer(id: "producer_odd", parity: .odd)
        let disabledProducer = Member(
            id: "producer_disabled",
            displayName: "Disabled",
            normalizedEmail: "disabled@reguerta.app",
            authUid: nil,
            roles: [.producer],
            isActive: true,
            producerCatalogEnabled: false,
            producerParity: .even
        )
        let visibleProduct = regularProduct(id: "visible", vendorId: evenProducer.id, name: "Visible")
        let oddProduct = regularProduct(id: "odd", vendorId: oddProducer.id, name: "Odd")
        let hiddenProduct = regularProduct(id: "hidden", vendorId: disabledProducer.id, name: "Hidden")
        let archivedProduct = regularProduct(id: "archived", vendorId: evenProducer.id, name: "Archived")
            .archivedCopy(nowMillis: 2)
        let repository = InMemoryProductRepository(items: [visibleProduct, oddProduct, hiddenProduct, archivedProduct])
        let commitmentRepository = InMemorySeasonalCommitmentRepository(
            items: [
                seasonalCommitment(productId: visibleProduct.id, fixedQtyPerOfferedWeek: 1),
                SeasonalCommitment(
                    id: "inactive",
                    userId: currentMember.id,
                    productId: "inactive",
                    seasonKey: "2026",
                    fixedQtyPerOfferedWeek: 2,
                    active: false,
                    createdAtMillis: 1,
                    updatedAtMillis: 1
                )
            ]
        )
        let viewModel = await makeProductsViewModel(
            currentMember: currentMember,
            members: [currentMember, evenProducer, oddProducer, disabledProducer],
            productRepository: repository,
            seasonalCommitmentRepository: commitmentRepository,
            nowMillis: testMillis(year: 2026, month: 5, day: 14)
        )

        await viewModel.refreshOrderingProducts()

        #expect(viewModel.myOrderProducts.map(\.id) == [visibleProduct.id])
        #expect(viewModel.myOrderSeasonalCommitments.map(\.productId) == [visibleProduct.id])
    }

    @Test
    func previewEnvironmentUsesInMemoryProductsDependenciesAndSharesRootSession() {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.productsViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.productsViewModel.productRepository is InMemoryProductRepository)
        #expect(environment.accessRootViewModel.productsViewModel.memberRepository is InMemoryMemberRepository)
        #expect(environment.accessRootViewModel.productsViewModel.seasonalCommitmentRepository is InMemorySeasonalCommitmentRepository)
        #expect(environment.accessRootViewModel.productsViewModel.imagePipelineManager is NoOpImagePipelineManager)
    }
}

@MainActor
func makeProductsViewModel(
    currentMember: Member,
    members: [Member],
    productRepository: InMemoryProductRepository? = nil,
    memberRepository: InMemoryMemberRepository? = nil,
    seasonalCommitmentRepository: InMemorySeasonalCommitmentRepository? = nil,
    imagePipelineManager: any ImagePipelineManager = MockImagePipelineManager(result: .success("https://cdn.reguerta.test/image.jpg")),
    nowMillis: Int64? = nil
) async -> ProductsRouteViewModel {
    let productRepository = productRepository ?? InMemoryProductRepository()
    let memberRepository = memberRepository ?? InMemoryMemberRepository()
    let seasonalCommitmentRepository = seasonalCommitmentRepository ?? InMemorySeasonalCommitmentRepository()
    let nowMillis = nowMillis ?? testMillis(year: 2026, month: 5, day: 14)
    for member in members {
        _ = await memberRepository.upsert(member: member)
    }
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let session = AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_\(currentMember.id)", email: currentMember.normalizedEmail),
        authenticatedMember: currentMember,
        member: currentMember,
        members: members
    )
    sessionViewModel.mode = .authorized(session)
    let viewModel = ProductsRouteViewModel(
        sessionViewModel: sessionViewModel,
        productRepository: productRepository,
        memberRepository: memberRepository,
        seasonalCommitmentRepository: seasonalCommitmentRepository,
        imagePipelineManager: imagePipelineManager,
        nowMillisProvider: { nowMillis }
    )
    viewModel.currentSession = session
    viewModel.currentMember = currentMember
    return viewModel
}

private actor MockImagePipelineManager: ImagePipelineManager {
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
