import Foundation

private struct ProductSaveRequest {
    let context: ProductsRouteSessionContext
    let input: ProductSaveInput
    let newProductId: String
    let editorProductId: String?
    let editorPendingProductId: String?
    let editorRevision: UInt64
}

@MainActor
extension ProductsRouteViewModel {
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

    func updateDraft(
        _ update: (inout ProductDraft) -> Void
    ) {
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

    @discardableResult func save() async -> Bool {
        guard let request = prepareSaveRequest() else { return false }
        let saveOperationId = beginSaveOperation()
        defer { finishSaveOperation(saveOperationId, context: request.context) }

        guard await validateSaveRequest(request) else { return false }
        guard isCurrentEditor(request) else { return false }
        guard let saved = await persistProduct(for: request) else { return false }
        guard isCurrentSession(request.context) else { return false }
        applyConfirmedProductToCatalog(saved)
        guard isCurrentEditor(request) else { return false }
        finishEditorAfterSave(saved)
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

@MainActor
private extension ProductsRouteViewModel {
    var canManageCatalog: Bool {
        authorizedSessionContext?.session.member.canManageProductCatalog == true
    }

    func prepareSaveRequest() -> ProductSaveRequest? {
        guard let context = authorizedSessionContext else { return nil }
        let session = context.session
        guard session.member.canManageProductCatalog else {
            showUnableSaveFeedback()
            return nil
        }
        guard activeSaveOperationId == nil, !isSaving, !isUploadingImage else { return nil }
        let existing = catalogProducts.first { $0.id == editingProductId }
        guard let input = resolveProductSaveInput(
            draft: draft,
            existing: existing,
            nowMillis: nowMillisProvider()
        ) else {
            showUnableSaveFeedback()
            return nil
        }
        let newProductId = input.existing == nil ? resolvePendingNewProductId() : ""
        return ProductSaveRequest(
            context: context,
            input: input,
            newProductId: newProductId,
            editorProductId: editingProductId,
            editorPendingProductId: pendingNewProductId,
            editorRevision: editorRevision
        )
    }

    func validateSaveRequest(_ request: ProductSaveRequest) async -> Bool {
        do {
            let canSave = try await canSaveEcoBasketProduct(
                sessionMember: request.context.session.member,
                draft: request.input.draft,
                price: request.input.price,
                existingProduct: request.input.existing
            )
            try Task.checkCancellation()
            guard canSave else {
                if isCurrentEditor(request) {
                    showUnableSaveFeedback()
                }
                return false
            }
            return true
        } catch is CancellationError {
            return false
        } catch {
            if isCurrentEditor(request) {
                showUnableLoadFeedback()
            }
            return false
        }
    }

    func persistProduct(for request: ProductSaveRequest) async -> Product? {
        do {
            let saved = try await productRepository.upsert(
                product: buildProductToSave(
                    sessionMember: request.context.session.member,
                    input: request.input,
                    newProductId: request.newProductId
                )
            )
            try Task.checkCancellation()
            return saved
        } catch is CancellationError {
            return nil
        } catch {
            if isCurrentEditor(request) {
                showUnableSaveFeedback()
            }
            return nil
        }
    }

    func isCurrentEditor(_ request: ProductSaveRequest) -> Bool {
        isCurrentEditor(
            request.context,
            editingProductId: request.editorProductId,
            pendingProductId: request.editorPendingProductId,
            revision: request.editorRevision
        )
    }

    func isCurrentEditor(
        _ context: ProductsRouteSessionContext,
        editingProductId: String?,
        pendingProductId: String?,
        revision: UInt64
    ) -> Bool {
        isCurrentSession(context) &&
            self.editingProductId == editingProductId &&
            pendingNewProductId == pendingProductId &&
            editorRevision == revision
    }

    func finishEditorAfterSave(_ saved: Product) {
        draft = ProductDraft()
        editingProductId = nil
        pendingNewProductId = nil
        editorRevision += 1
        highlightProduct(saved.id)
    }

    func applyConfirmedProductToCatalog(_ product: Product) {
        catalogProducts.removeAll { $0.id == product.id }
        catalogProducts.append(product)
        catalogProducts.sort { lhs, rhs in
            if lhs.archived != rhs.archived {
                return !lhs.archived && rhs.archived
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    func beginSaveOperation() -> UInt64 {
        nextSaveOperationId += 1
        activeSaveOperationId = nextSaveOperationId
        isSaving = true
        return nextSaveOperationId
    }

    func finishSaveOperation(_ operationId: UInt64, context: ProductsRouteSessionContext) {
        guard activeSaveOperationId == operationId else { return }
        activeSaveOperationId = nil
        guard isCurrentSession(context) else { return }
        isSaving = false
    }

    func finishUploadOperation(_ operationId: UInt64, context: ProductsRouteSessionContext) {
        guard activeUploadOperationId == operationId else { return }
        activeUploadOperationId = nil
        guard isCurrentSession(context) else { return }
        isUploadingImage = false
    }

    func resolvePendingNewProductId() -> String {
        if let pendingNewProductId {
            return pendingNewProductId
        }
        let productId = productIDProvider()
        pendingNewProductId = productId
        return productId
    }

    func canSaveEcoBasketProduct(
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
