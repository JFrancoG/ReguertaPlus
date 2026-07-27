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
    @ObservationIgnored let productIDProvider: @MainActor () -> String

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
    var pendingNewProductId: String?
    var editorRevision: UInt64 = 0
    var activeSaveOperationId: UInt64?
    var nextSaveOperationId: UInt64 = 0
    var activeUploadOperationId: UInt64?
    var nextUploadOperationId: UInt64 = 0
    var sessionIdentityEpoch: UInt64 = 0

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
        isProducer && currentMember?.producerParity != nil
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
        nowMillisProvider: @escaping @MainActor () -> Int64,
        productIDProvider: @escaping @MainActor () -> String = {
            UUID().uuidString.lowercased()
        }
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.productRepository = productRepository
        self.memberRepository = memberRepository
        self.seasonalCommitmentRepository = seasonalCommitmentRepository
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
        self.productIDProvider = productIDProvider
    }
}

extension ProductsRouteViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            let identityChanged = currentSession?.principal.uid != session.principal.uid ||
                currentSession?.member.id != session.member.id
            let catalogAccessRevoked = currentMember?.canManageProductCatalog == true &&
                !session.member.canManageProductCatalog
            let shouldInvalidateEditor = identityChanged || catalogAccessRevoked
            if shouldInvalidateEditor {
                sessionIdentityEpoch += 1
                invalidateOperationsForIdentityChange()
            }
            resetOrderingProductsIfSessionChanged(to: session)
            currentSession = session
            currentMember = session.member
            if shouldInvalidateEditor {
                clearEditor()
            }
            if session.member.canManageProductCatalog {
                Task { await refreshCatalog() }
            } else {
                catalogProducts = []
            }
        case .signedOut, .unauthorized:
            sessionIdentityEpoch += 1
            reset()
        }
    }

    func handleNowOverrideChange() {
        guard currentSession != nil else { return }
        Task { await refreshOrderingProducts() }
    }

    func refreshCatalog() async {
        guard let context = authorizedSessionContext else {
            catalogProducts = []
            isLoadingCatalog = false
            return
        }
        let session = context.session
        guard session.member.canManageProductCatalog else {
            catalogProducts = []
            isLoadingCatalog = false
            return
        }

        isLoadingCatalog = true
        let products: [Product]
        do {
            products = try await productRepository.products(vendorId: session.member.id)
            try Task.checkCancellation()
        } catch is CancellationError {
            if isCurrentSession(context) {
                isLoadingCatalog = false
            }
            return
        } catch {
            if isCurrentSession(context) {
                isLoadingCatalog = false
                showUnableLoadFeedback()
            }
            return
        }
        guard isCurrentSession(context) else { return }
        catalogProducts = products
        isLoadingCatalog = false
    }

    func refreshOrderingProducts() async {
        guard let context = authorizedSessionContext else {
            myOrderProducts = []
            myOrderSeasonalCommitments = []
            isLoadingOrderingProducts = false
            hasLoadedOrderingProducts = false
            return
        }
        let session = context.session

        isLoadingOrderingProducts = true
        do {
            let refreshedMembers = try await memberRepository.members(visibleTo: session.member)
            let effectiveMembers = refreshedMembers.isEmpty ? session.members : refreshedMembers
            let membersById = Dictionary(uniqueKeysWithValues: effectiveMembers.map { ($0.id, $0) })
            let refreshedCurrentMember = membersById[session.member.id] ?? session.member
            let currentWeekParity = producerParityForISOWeek(nowMillis: nowMillisProvider())
            let commitments = try await loadSeasonalCommitments(for: refreshedCurrentMember)
            let visibleProducts = try await productRepository.allProducts()
                .filter { product in
                    product.isVisibleInOrdering &&
                        membersById[product.vendorId].isVisibleForOrdering &&
                        product.matchesCurrentProducerWeek(
                            membersById: membersById,
                            currentWeekParity: currentWeekParity
                        )
                }
                .sorted(by: sortProductsForOrdering)
            try Task.checkCancellation()
            guard isCurrentSession(context) else { return }
            sessionViewModel.applyRefreshedAuthorizedMembers(effectiveMembers)
            syncCurrentSessionFromSessionViewModel()
            myOrderProducts = visibleProducts
            myOrderSeasonalCommitments = commitments
            hasLoadedOrderingProducts = true
            isLoadingOrderingProducts = false
        } catch is CancellationError {
            if isCurrentSession(context) {
                isLoadingOrderingProducts = false
            }
        } catch {
            if isCurrentSession(context) {
                isLoadingOrderingProducts = false
                showUnableLoadFeedback()
            }
        }
    }

    func startCreating() {
        guard canManageCatalog else {
            showUnableSaveFeedback()
            return
        }
        draft = ProductDraft()
        editingProductId = ""
        pendingNewProductId = productIDProvider()
        editorRevision += 1
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
        pendingNewProductId = nil
        editorRevision += 1
        isUploadingImage = false
    }

    func updateDraft(_ update: (inout ProductDraft) -> Void) {
        var updatedDraft = draft
        update(&updatedDraft)
        draft = updatedDraft
        editorRevision += 1
    }

    func clearEditor() {
        draft = ProductDraft()
        editingProductId = nil
        pendingNewProductId = nil
        editorRevision += 1
        isUploadingImage = false
    }

    func uploadImage(_ imageData: Data) async {
        guard let context = authorizedSessionContext else { return }
        let session = context.session
        guard session.member.canManageProductCatalog else {
            showUnableSaveFeedback()
            return
        }
        guard activeUploadOperationId == nil, !isUploadingImage, !isSaving else { return }

        nextUploadOperationId += 1
        let uploadOperationId = nextUploadOperationId
        activeUploadOperationId = uploadOperationId
        isUploadingImage = true
        let editorProductId = editingProductId
        let editorPendingProductId = pendingNewProductId
        let uploadEditorRevision = editorRevision
        defer { finishUploadOperation(uploadOperationId, context: context) }
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
            try Task.checkCancellation()
            guard isCurrentEditor(
                context,
                editingProductId: editorProductId,
                pendingProductId: editorPendingProductId,
                revision: uploadEditorRevision
            ) else { return }
            draft.productImageUrl = uploaded.downloadURL
            editorRevision += 1
        } catch is CancellationError {
            return
        } catch {
            if isCurrentEditor(
                context,
                editingProductId: editorProductId,
                pendingProductId: editorPendingProductId,
                revision: uploadEditorRevision
            ) {
                showUnableSaveFeedback()
            }
        }
    }

    func clearImage() {
        updateDraft { draft in
            draft.productImageUrl = ""
        }
    }

    @discardableResult
    func save() async -> Bool {
        guard let context = authorizedSessionContext else { return false }
        let session = context.session
        guard session.member.canManageProductCatalog else {
            showUnableSaveFeedback()
            return false
        }
        guard activeSaveOperationId == nil, !isSaving else { return false }
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
        let newProductId = input.existing == nil ? resolvePendingNewProductId() : ""
        let editorProductId = editingProductId
        let editorPendingProductId = pendingNewProductId
        let saveEditorRevision = editorRevision

        let saveOperationId = beginSaveOperation()
        defer { finishSaveOperation(saveOperationId, context: context) }

        do {
            guard try await canSaveEcoBasketProduct(
                sessionMember: session.member,
                draft: input.draft,
                price: input.price,
                existingProduct: input.existing
            ) else {
                if isCurrentEditor(
                    context,
                    editingProductId: editorProductId,
                    pendingProductId: editorPendingProductId,
                    revision: saveEditorRevision
                ) {
                    showUnableSaveFeedback()
                }
                return false
            }
            try Task.checkCancellation()
        } catch is CancellationError {
            return false
        } catch {
            if isCurrentEditor(
                context,
                editingProductId: editorProductId,
                pendingProductId: editorPendingProductId,
                revision: saveEditorRevision
            ) {
                showUnableLoadFeedback()
            }
            return false
        }

        guard isCurrentEditor(
            context,
            editingProductId: editorProductId,
            pendingProductId: editorPendingProductId,
            revision: saveEditorRevision
        ) else { return false }

        let saved: Product
        do {
            saved = try await productRepository.upsert(
                product: buildProductToSave(
                    sessionMember: session.member,
                    input: input,
                    newProductId: newProductId
                )
            )
            try Task.checkCancellation()
        } catch is CancellationError {
            return false
        } catch {
            if isCurrentEditor(
                context,
                editingProductId: editorProductId,
                pendingProductId: editorPendingProductId,
                revision: saveEditorRevision
            ) {
                showUnableSaveFeedback()
            }
            return false
        }
        guard isCurrentSession(context) else { return false }
        applyConfirmedProductToCatalog(saved)
        guard isCurrentEditor(
            context,
            editingProductId: editorProductId,
            pendingProductId: editorPendingProductId,
            revision: saveEditorRevision
        ) else { return false }
        draft = ProductDraft()
        editingProductId = nil
        pendingNewProductId = nil
        editorRevision += 1
        highlightProduct(saved.id)
        return true
    }

    func archive(productId: String) async {
        guard let context = authorizedSessionContext else { return }
        let session = context.session
        guard session.member.canManageProductCatalog else { return }
        guard activeSaveOperationId == nil, !isSaving else { return }
        guard let product = catalogProducts.first(where: { $0.id == productId }) else { return }

        let saveOperationId = beginSaveOperation()
        defer { finishSaveOperation(saveOperationId, context: context) }
        let archivedProduct: Product
        do {
            archivedProduct = try await productRepository.upsert(
                product: product.archivedCopy(nowMillis: nowMillisProvider())
            )
            try Task.checkCancellation()
        } catch is CancellationError {
            return
        } catch {
            if isCurrentSession(context) {
                showUnableSaveFeedback()
            }
            return
        }
        guard isCurrentSession(context) else { return }
        applyConfirmedProductToCatalog(archivedProduct)
        if editingProductId == productId {
            clearEditor()
        }
        highlightProduct(productId)
    }

    func setVacationModeEnabled(_ isEnabled: Bool) async {
        guard let context = authorizedSessionContext else { return }
        let session = context.session
        guard session.member.isProducer else { return }
        let catalogEnabled = !isEnabled
        guard session.member.producerCatalogEnabled != catalogEnabled else { return }

        isUpdatingCatalogVisibility = true
        defer {
            if isCurrentSession(context) {
                isUpdatingCatalogVisibility = false
            }
        }
        let updatedMember: Member
        do {
            updatedMember = try await memberRepository.updateOwnProducerCatalogEnabled(
                member: session.member,
                enabled: catalogEnabled
            )
            try Task.checkCancellation()
        } catch is CancellationError {
            return
        } catch {
            if isCurrentSession(context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
            return
        }
        guard isCurrentSession(context) else { return }
        let locallyUpdatedMembers = session.members.map { member in
            member.id == updatedMember.id ? updatedMember : member
        }
        sessionViewModel.applyUpdatedAuthorizedMember(updatedMember, members: locallyUpdatedMembers)
        syncCurrentSessionFromSessionViewModel()
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

    func showUnableLoadFeedback() {
        feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
    }

    func showCameraPermissionRequiredFeedback() {
        feedbackCenter.show(AccessL10nKey.feedbackCameraPermissionRequired)
    }

    func showCameraUnavailableFeedback() {
        feedbackCenter.show(AccessL10nKey.feedbackCameraUnavailable)
    }
}

private extension ProductsRouteViewModel {
    struct SessionContext {
        let session: AuthorizedSession
        let generation: UInt64
    }

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

    private var authorizedSessionContext: SessionContext? {
        guard let session = authorizedSession else { return nil }
        return SessionContext(
            session: session,
            generation: sessionIdentityEpoch
        )
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
        pendingNewProductId = nil
        editorRevision += 1
        activeSaveOperationId = nil
        activeUploadOperationId = nil
    }

    private func invalidateOperationsForIdentityChange() {
        activeSaveOperationId = nil
        activeUploadOperationId = nil
        isSaving = false
        isUploadingImage = false
        isUpdatingCatalogVisibility = false
        isLoadingCatalog = false
        isLoadingOrderingProducts = false
        catalogProducts = []
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

    private func isCurrentSession(_ context: SessionContext) -> Bool {
        guard let latestSession = authorizedSession else { return false }
        return sessionIdentityEpoch == context.generation &&
            latestSession.principal.uid == context.session.principal.uid &&
            latestSession.member.id == context.session.member.id
    }

    private func isCurrentEditor(
        _ context: SessionContext,
        editingProductId: String?,
        pendingProductId: String?,
        revision: UInt64
    ) -> Bool {
        isCurrentSession(context) &&
            self.editingProductId == editingProductId &&
            pendingNewProductId == pendingProductId &&
            editorRevision == revision
    }

    private func loadSeasonalCommitments(for member: Member) async throws -> [SeasonalCommitment] {
        var seasonalCommitmentsById: [String: SeasonalCommitment] = [:]
        let lookupKeys = member.seasonalCommitmentLookupKeys
        let commitmentRepository = seasonalCommitmentRepository
        let commitmentsByLookup = try await withThrowingTaskGroup(of: [SeasonalCommitment].self) { group in
            for lookupKey in lookupKeys {
                group.addTask {
                    try await commitmentRepository.activeCommitments(userId: lookupKey)
                }
            }
            var collected: [SeasonalCommitment] = []
            for try await commitments in group {
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

    private func applyConfirmedProductToCatalog(_ product: Product) {
        catalogProducts.removeAll { $0.id == product.id }
        catalogProducts.append(product)
        catalogProducts.sort { lhs, rhs in
            if lhs.archived != rhs.archived {
                return !lhs.archived && rhs.archived
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private func beginSaveOperation() -> UInt64 {
        nextSaveOperationId += 1
        activeSaveOperationId = nextSaveOperationId
        isSaving = true
        return nextSaveOperationId
    }

    private func finishSaveOperation(_ operationId: UInt64, context: SessionContext) {
        guard activeSaveOperationId == operationId else { return }
        activeSaveOperationId = nil
        guard isCurrentSession(context) else { return }
        isSaving = false
    }

    private func finishUploadOperation(_ operationId: UInt64, context: SessionContext) {
        guard activeUploadOperationId == operationId else { return }
        activeUploadOperationId = nil
        guard isCurrentSession(context) else { return }
        isUploadingImage = false
    }

    private func resolvePendingNewProductId() -> String {
        if let pendingNewProductId {
            return pendingNewProductId
        }
        let productId = productIDProvider()
        pendingNewProductId = productId
        return productId
    }

    private func canSaveEcoBasketProduct(
        sessionMember: Member,
        draft: ProductDraft,
        price: Double,
        existingProduct: Product?
    ) async throws -> Bool {
        guard sessionMember.isProducer, draft.isEcoBasket else {
            return true
        }
        let allProducts = try await productRepository.allProducts()
        let activeEcoBasketPrice = allProducts
            .first(where: { $0.isEcoBasket && !$0.archived && $0.id != existingProduct?.id })?
            .price
        return activeEcoBasketPrice == nil || activeEcoBasketPrice == price
    }
}
