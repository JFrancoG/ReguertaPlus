import Foundation
import Observation

@MainActor
@Observable
final class ProductsRouteViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
    @ObservationIgnored let productRepository: any ProductRepository
    @ObservationIgnored let memberRepository: any MemberRepository
    @ObservationIgnored let seasonalCommitmentRepository: any SeasonalCommitmentRepository
    @ObservationIgnored let imagePipelineManager: any ImagePipelineManager
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64

    var currentSession: AuthorizedSession?
    var currentMember: Member?
    var catalogProducts: [Product] = []
    var myOrderProducts: [Product] = []
    var myOrderSeasonalCommitments: [SeasonalCommitment] = []
    var draft = ProductDraft()
    var editingProductId: String?
    var isLoadingCatalog = false
    var isLoadingOrderingProducts = false
    var hasLoadedOrderingProducts = false
    var isSaving = false
    var isUploadingImage = false
    var isUpdatingCatalogVisibility = false
    var highlightedProductId: String?

    var activeProducts: [Product] {
        catalogProducts.filter { !$0.archived }
    }

    var archivedProducts: [Product] {
        catalogProducts.filter(\.archived)
    }

    var isEditing: Bool {
        editingProductId != nil
    }

    var isProducer: Bool {
        currentMember?.isProducer == true
    }

    var canManageEcoBasket: Bool {
        isProducer
    }

    var canManageCommonPurchase: Bool {
        currentMember?.isCommonPurchaseManager == true && !isProducer
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        productRepository: any ProductRepository,
        memberRepository: any MemberRepository,
        seasonalCommitmentRepository: any SeasonalCommitmentRepository,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.productRepository = productRepository
        self.memberRepository = memberRepository
        self.seasonalCommitmentRepository = seasonalCommitmentRepository
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
    }
}

extension ProductsRouteViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            resetOrderingProductsIfSessionChanged(to: session)
            currentSession = session
            currentMember = session.member
            clearEditor()
            if session.member.canManageProductCatalog {
                Task { await refreshCatalog() }
            } else {
                catalogProducts = []
            }
        case .signedOut, .unauthorized:
            reset()
        }
    }

    func handleNowOverrideChange() {
        guard currentSession != nil else { return }
        Task { await refreshOrderingProducts() }
    }

    func refreshCatalog() async {
        guard let session = authorizedSession else {
            catalogProducts = []
            isLoadingCatalog = false
            return
        }
        guard session.member.canManageProductCatalog else {
            catalogProducts = []
            isLoadingCatalog = false
            return
        }

        isLoadingCatalog = true
        let products = await productRepository.products(vendorId: session.member.id)
        guard isCurrentSession(session) else {
            isLoadingCatalog = false
            return
        }
        catalogProducts = products
        isLoadingCatalog = false
    }

    func refreshOrderingProducts() async {
        guard let session = authorizedSession else {
            myOrderProducts = []
            myOrderSeasonalCommitments = []
            isLoadingOrderingProducts = false
            hasLoadedOrderingProducts = false
            return
        }

        isLoadingOrderingProducts = true
        let refreshedMembers = await memberRepository.allMembers()
        let effectiveMembers = refreshedMembers.isEmpty ? session.members : refreshedMembers
        let membersById = Dictionary(uniqueKeysWithValues: effectiveMembers.map { ($0.id, $0) })
        let refreshedCurrentMember = membersById[session.member.id] ?? session.member
        let currentWeekParity = producerParityForISOWeek(nowMillis: nowMillisProvider())
        let commitments = await loadSeasonalCommitments(for: refreshedCurrentMember)
        let visibleProducts = await productRepository.allProducts()
            .filter { product in
                product.isVisibleInOrdering &&
                    membersById[product.vendorId].isVisibleForOrdering &&
                    product.matchesCurrentProducerWeek(
                        membersById: membersById,
                        currentWeekParity: currentWeekParity
                    )
            }
            .sorted(by: sortProductsForOrdering)
        guard isCurrentSession(session) else {
            isLoadingOrderingProducts = false
            return
        }
        sessionViewModel.applyRefreshedAuthorizedMembers(effectiveMembers)
        syncCurrentSessionFromSessionViewModel()
        myOrderProducts = visibleProducts
        myOrderSeasonalCommitments = commitments
        hasLoadedOrderingProducts = true
        isLoadingOrderingProducts = false
    }

    func startCreating() {
        guard canManageCatalog else {
            showUnableSaveFeedback()
            return
        }
        draft = ProductDraft()
        editingProductId = ""
        isUploadingImage = false
    }

    func startEditing(productId: String) {
        guard canManageCatalog else {
            showUnableSaveFeedback()
            return
        }
        guard let product = catalogProducts.first(where: { $0.id == productId }) else { return }
        draft = product.toDraft()
        editingProductId = product.id
        isUploadingImage = false
    }

    func updateDraft(_ update: (inout ProductDraft) -> Void) {
        var updatedDraft = draft
        update(&updatedDraft)
        draft = updatedDraft
    }

    func clearEditor() {
        draft = ProductDraft()
        editingProductId = nil
        isSaving = false
        isUploadingImage = false
    }

    func uploadImage(_ imageData: Data) async {
        guard let session = authorizedSession else { return }
        guard session.member.canManageProductCatalog else {
            showUnableSaveFeedback()
            return
        }

        isUploadingImage = true
        defer { isUploadingImage = false }
        let entityId = editingProductId?.isEmpty == false ? editingProductId : nil

        do {
            let uploaded = try await imagePipelineManager.processAndUpload(
                imageData: imageData,
                request: ImageUploadRequest(
                    ownerId: session.member.id,
                    namespace: .products,
                    entityId: entityId,
                    nameHint: draft.name
                )
            )
            draft.productImageUrl = uploaded.downloadURL
        } catch {
            showUnableSaveFeedback()
        }
    }

    func clearImage() {
        updateDraft { draft in
            draft.productImageUrl = ""
        }
    }

    @discardableResult
    func save() async -> Bool {
        guard let session = authorizedSession else { return false }
        guard session.member.canManageProductCatalog else {
            showUnableSaveFeedback()
            return false
        }
        guard !isUploadingImage else { return false }
        let existing = catalogProducts.first { $0.id == editingProductId }
        guard let input = resolveProductSaveInput(
            draft: draft,
            existing: existing,
            nowMillis: nowMillisProvider()
        ) else {
            showUnableSaveFeedback()
            return false
        }

        isSaving = true
        defer { isSaving = false }

        guard await canSaveEcoBasketProduct(
            sessionMember: session.member,
            draft: input.draft,
            price: input.price,
            existingProduct: input.existing
        ) else {
            showUnableSaveFeedback()
            return false
        }

        let saved = await productRepository.upsert(
            product: buildProductToSave(sessionMember: session.member, input: input)
        )
        let products = await productRepository.products(vendorId: session.member.id)
        guard isCurrentSession(session) else { return false }
        catalogProducts = products
        draft = ProductDraft()
        editingProductId = nil
        highlightProduct(saved.id)
        return true
    }

    func archive(productId: String) async {
        guard let session = authorizedSession else { return }
        guard session.member.canManageProductCatalog else { return }
        guard let product = catalogProducts.first(where: { $0.id == productId }) else { return }

        isSaving = true
        defer { isSaving = false }
        _ = await productRepository.upsert(
            product: product.archivedCopy(nowMillis: nowMillisProvider())
        )
        let products = await productRepository.products(vendorId: session.member.id)
        guard isCurrentSession(session) else { return }
        catalogProducts = products
        if editingProductId == productId {
            clearEditor()
        }
        highlightProduct(productId)
    }

    func setVacationModeEnabled(_ isEnabled: Bool) async {
        guard let session = authorizedSession else { return }
        guard session.member.isProducer else { return }
        let catalogEnabled = !isEnabled
        guard session.member.producerCatalogEnabled != catalogEnabled else { return }

        isUpdatingCatalogVisibility = true
        defer { isUpdatingCatalogVisibility = false }
        let updatedMember = await memberRepository.upsert(
            member: session.member.copy(producerCatalogEnabled: catalogEnabled)
        )
        let members = await memberRepository.allMembers()
        sessionViewModel.applyUpdatedAuthorizedMember(updatedMember, members: members)
        syncCurrentSessionFromSessionViewModel()
        catalogProducts = await productRepository.products(vendorId: updatedMember.id)
        await refreshOrderingProducts()
    }

    func highlightProduct(_ productId: String) {
        highlightedProductId = productId
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_600_000_000)
            await MainActor.run {
                if self?.highlightedProductId == productId {
                    self?.highlightedProductId = nil
                }
            }
        }
    }

    func showUnableSaveFeedback() {
        feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
    }

    func showCameraPermissionRequiredFeedback() {
        feedbackCenter.show(AccessL10nKey.feedbackCameraPermissionRequired)
    }

    func showCameraUnavailableFeedback() {
        feedbackCenter.show(AccessL10nKey.feedbackCameraUnavailable)
    }
}

private extension ProductsRouteViewModel {
    private var authorizedSession: AuthorizedSession? {
        switch sessionViewModel.mode {
        case .authorized(let session):
            return session
        case .signedOut, .unauthorized:
            return nil
        }
    }

    private var canManageCatalog: Bool {
        authorizedSession?.member.canManageProductCatalog == true
    }

    private func reset() {
        currentSession = nil
        currentMember = nil
        catalogProducts = []
        myOrderProducts = []
        myOrderSeasonalCommitments = []
        hasLoadedOrderingProducts = false
        draft = ProductDraft()
        editingProductId = nil
        isLoadingCatalog = false
        isLoadingOrderingProducts = false
        isSaving = false
        isUploadingImage = false
        isUpdatingCatalogVisibility = false
        highlightedProductId = nil
    }

    private func syncCurrentSessionFromSessionViewModel() {
        guard let session = authorizedSession else {
            reset()
            return
        }
        resetOrderingProductsIfSessionChanged(to: session)
        currentSession = session
        currentMember = session.member
    }

    private func resetOrderingProductsIfSessionChanged(to session: AuthorizedSession) {
        guard let currentSession else { return }
        guard currentSession.principal.uid != session.principal.uid ||
            currentSession.member.id != session.member.id else {
            return
        }
        myOrderProducts = []
        myOrderSeasonalCommitments = []
        hasLoadedOrderingProducts = false
        isLoadingOrderingProducts = false
    }

    private func isCurrentSession(_ session: AuthorizedSession) -> Bool {
        guard let latestSession = authorizedSession else { return false }
        return latestSession.principal.uid == session.principal.uid &&
            latestSession.member.id == session.member.id
    }

    private func loadSeasonalCommitments(for member: Member) async -> [SeasonalCommitment] {
        var seasonalCommitmentsById: [String: SeasonalCommitment] = [:]
        let lookupKeys = member.seasonalCommitmentLookupKeys
        let commitmentRepository = seasonalCommitmentRepository
        let commitmentsByLookup = await withTaskGroup(of: [SeasonalCommitment].self) { group in
            for lookupKey in lookupKeys {
                group.addTask {
                    await commitmentRepository.activeCommitments(userId: lookupKey)
                }
            }
            var collected: [SeasonalCommitment] = []
            for await commitments in group {
                collected.append(contentsOf: commitments)
            }
            return collected
        }
        for commitment in commitmentsByLookup {
            seasonalCommitmentsById[commitment.id] = commitment
        }
        return seasonalCommitmentsById.values.sorted { lhs, rhs in
            if lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) != .orderedSame {
                return lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) == .orderedAscending
            }
            return lhs.productId.localizedCaseInsensitiveCompare(rhs.productId) == .orderedAscending
        }
    }

    private func sortProductsForOrdering(lhs: Product, rhs: Product) -> Bool {
        if lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) != .orderedSame {
            return lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) == .orderedAscending
        }
        return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
    }

    private func canSaveEcoBasketProduct(
        sessionMember: Member,
        draft: ProductDraft,
        price: Double,
        existingProduct: Product?
    ) async -> Bool {
        guard sessionMember.isProducer, draft.isEcoBasket else {
            return true
        }
        let allProducts = await productRepository.allProducts()
        let activeEcoBasketPrice = allProducts
            .first(where: { $0.isEcoBasket && !$0.archived && $0.id != existingProduct?.id })?
            .price
        return activeEcoBasketPrice == nil || activeEcoBasketPrice == price
    }
}

private extension Member {
    func copy(producerCatalogEnabled: Bool) -> Member {
        Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            phoneNumber: phoneNumber,
            normalizedEmail: normalizedEmail,
            authUid: authUid,
            roles: roles,
            isActive: isActive,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }
}
