import Foundation

private struct ProductSaveInput {
    let draft: ProductDraft
    let existing: Product?
    let price: Double
    let unitQty: Double
    let stockQty: Double?
    let packContainerQty: Double?
    let nowMillis: Int64
}

extension SessionViewModel {
    func updateProductDraft(_ update: (inout ProductDraft) -> Void) {
        var draft = productDraft
        update(&draft)
        productDraft = draft
    }

    func refreshProducts() {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canManageProductCatalog else { return }
        isLoadingProducts = true
        Task { @MainActor in
            productsFeed = await productRepository.products(vendorId: session.member.id)
            isLoadingProducts = false
        }
    }

    func refreshMyOrderProducts() {
        guard case .authorized(let session) = mode else { return }
        isLoadingMyOrderProducts = true
        Task { @MainActor in
            let currentWeekParity = producerParityForISOWeek(nowMillis: nowMillisProvider())
            var seasonalCommitmentsById: [String: SeasonalCommitment] = [:]
            let lookupKeys = session.member.seasonalCommitmentLookupKeys
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
            let visibleProducts = await productRepository.allProducts()
                .filter { product in
                    product.isVisibleInOrdering &&
                        session.membersById[product.vendorId].isVisibleForOrdering &&
                        product.matchesCurrentProducerWeek(
                            membersById: session.membersById,
                            currentWeekParity: currentWeekParity
                        )
                }
                .sorted { lhs, rhs in
                    if lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) != .orderedSame {
                        return lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) == .orderedAscending
                    }
                    return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                }
            guard case .authorized(let latestSession) = mode, latestSession.principal.uid == session.principal.uid else {
                isLoadingMyOrderProducts = false
                return
            }
            myOrderProductsFeed = visibleProducts
            myOrderSeasonalCommitmentsFeed = seasonalCommitmentsById.values.sorted { lhs, rhs in
                if lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) != .orderedSame {
                    return lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) == .orderedAscending
                }
                return lhs.productId.localizedCaseInsensitiveCompare(rhs.productId) == .orderedAscending
            }
            isLoadingMyOrderProducts = false
        }
    }

    func startCreatingProduct() {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canManageProductCatalog else {
            feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
            return
        }
        productDraft = ProductDraft()
        editingProductId = ""
    }

    func startEditingProduct(productId: String) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canManageProductCatalog else {
            feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
            return
        }
        guard let product = productsFeed.first(where: { $0.id == productId }) else { return }
        productDraft = product.toDraft()
        editingProductId = product.id
    }

    func clearProductEditor() {
        productDraft = ProductDraft()
        editingProductId = nil
        isSavingProduct = false
    }

    func saveProduct(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canManageProductCatalog else {
            feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
            return
        }
        guard let saveInput = resolveProductSaveInput(
            existingProductId: editingProductId,
            nowMillis: nowMillisProvider()
        ) else {
            feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
            return
        }

        isSavingProduct = true
        Task { @MainActor in
            let canSaveEcoBasket = await canSaveEcoBasketProduct(
                sessionMember: session.member,
                draft: saveInput.draft,
                price: saveInput.price,
                existingProduct: saveInput.existing
            )
            if !canSaveEcoBasket {
                isSavingProduct = false
                feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
                return
            }
            let saved = await productRepository.upsert(
                product: buildProductToSave(sessionMember: session.member, input: saveInput)
            )
            await finalizeSavedProduct(
                saved,
                vendorId: session.member.id,
                onSuccess: onSuccess
            )
        }
    }

    func archiveProduct(productId: String, onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canManageProductCatalog else { return }
        guard let product = productsFeed.first(where: { $0.id == productId }) else { return }
        isSavingProduct = true
        Task { @MainActor in
            _ = await productRepository.upsert(
                product: Product(
                    id: product.id,
                    vendorId: product.vendorId,
                    companyName: product.companyName,
                    name: product.name,
                    description: product.description,
                    productImageUrl: product.productImageUrl,
                    price: product.price,
                    pricingMode: product.pricingMode,
                    unitName: product.unitName,
                    unitAbbreviation: product.unitAbbreviation,
                    unitPlural: product.unitPlural,
                    unitQty: product.unitQty,
                    packContainerName: product.packContainerName,
                    packContainerAbbreviation: product.packContainerAbbreviation,
                    packContainerPlural: product.packContainerPlural,
                    packContainerQty: product.packContainerQty,
                    isAvailable: product.isAvailable,
                    stockMode: product.stockMode,
                    stockQty: product.stockQty,
                    isEcoBasket: product.isEcoBasket,
                    isCommonPurchase: product.isCommonPurchase,
                    commonPurchaseType: product.commonPurchaseType,
                    archived: true,
                    createdAtMillis: product.createdAtMillis,
                    updatedAtMillis: nowMillisProvider()
                )
            )
            productsFeed = await productRepository.products(vendorId: session.member.id)
            if editingProductId == productId {
                productDraft = ProductDraft()
                editingProductId = nil
            }
            isSavingProduct = false
            onSuccess()
        }
    }

    func setOwnProducerCatalogVisibility(isEnabled: Bool, onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isProducer else { return }
        guard session.member.producerCatalogEnabled != isEnabled else {
            onSuccess()
            return
        }

        isUpdatingProducerCatalogVisibility = true
        Task { @MainActor in
            let updatedMember = await repository.upsert(
                member: Member(
                    id: session.member.id,
                    displayName: session.member.displayName,
                    companyName: session.member.companyName,
                    phoneNumber: session.member.phoneNumber,
                    normalizedEmail: session.member.normalizedEmail,
                    authUid: session.member.authUid,
                    roles: session.member.roles,
                    isActive: session.member.isActive,
                    producerCatalogEnabled: isEnabled,
                    isCommonPurchaseManager: session.member.isCommonPurchaseManager,
                    producerParity: session.member.producerParity,
                    ecoCommitmentMode: session.member.ecoCommitmentMode,
                    ecoCommitmentParity: session.member.ecoCommitmentParity
                )
            )
            let members = await repository.allMembers()
            productsFeed = await productRepository.products(vendorId: updatedMember.id)
            mode = .authorized(
                AuthorizedSession(
                    principal: session.principal,
                    authenticatedMember: session.authenticatedMember.id == updatedMember.id ? updatedMember : session.authenticatedMember,
                    member: updatedMember,
                    members: members
                )
            )
            isUpdatingProducerCatalogVisibility = false
            onSuccess()
        }
    }

    private func resolveProductSaveInput(
        existingProductId: String?,
        nowMillis: Int64
    ) -> ProductSaveInput? {
        let draft = productDraft.normalized
        let existing = productsFeed.first(where: { $0.id == existingProductId })
        guard let price = draft.price.toPositiveDouble,
              let unitQty = draft.unitQty.toPositiveDouble,
              !draft.name.isEmpty,
              !draft.unitName.isEmpty,
              !draft.unitPlural.isEmpty else {
            return nil
        }
        let stockQty = draft.stockMode == .finite ? draft.stockQty.toNonNegativeDouble : nil
        guard draft.stockMode != .finite || stockQty != nil else {
            return nil
        }
        let packContainerQty = draft.packContainerName.isEmpty ? nil : draft.packContainerQty.toPositiveDouble
        guard draft.packContainerName.isEmpty || packContainerQty != nil else {
            return nil
        }

        return ProductSaveInput(
            draft: draft,
            existing: existing,
            price: price,
            unitQty: unitQty,
            stockQty: stockQty,
            packContainerQty: packContainerQty,
            nowMillis: nowMillis
        )
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

    private func buildProductToSave(sessionMember: Member, input: ProductSaveInput) -> Product {
        let canManageCommonPurchase = sessionMember.isCommonPurchaseManager && !sessionMember.isProducer
        return Product(
            id: input.existing?.id ?? "",
            vendorId: input.existing?.vendorId ?? sessionMember.id,
            companyName: input.existing?.companyName ?? sessionMember.displayName,
            name: input.draft.name,
            description: input.draft.description,
            productImageUrl: input.draft.productImageUrl.isEmpty ? nil : input.draft.productImageUrl,
            price: input.price,
            pricingMode: .fixed,
            unitName: input.draft.unitName,
            unitAbbreviation: input.draft.unitAbbreviation.isEmpty ? nil : input.draft.unitAbbreviation,
            unitPlural: input.draft.unitPlural,
            unitQty: input.unitQty,
            packContainerName: input.draft.packContainerName.isEmpty ? nil : input.draft.packContainerName,
            packContainerAbbreviation: input.draft.packContainerAbbreviation.isEmpty ? nil : input.draft.packContainerAbbreviation,
            packContainerPlural: input.draft.packContainerPlural.isEmpty ? nil : input.draft.packContainerPlural,
            packContainerQty: input.packContainerQty,
            isAvailable: input.draft.isAvailable,
            stockMode: input.draft.stockMode,
            stockQty: input.stockQty,
            isEcoBasket: sessionMember.isProducer ? input.draft.isEcoBasket : false,
            isCommonPurchase: canManageCommonPurchase ? input.draft.isCommonPurchase : false,
            commonPurchaseType: (canManageCommonPurchase && input.draft.isCommonPurchase) ? input.draft.commonPurchaseType : nil,
            archived: input.existing?.archived ?? false,
            createdAtMillis: input.existing?.createdAtMillis ?? input.nowMillis,
            updatedAtMillis: input.nowMillis
        )
    }

    private func finalizeSavedProduct(
        _ saved: Product,
        vendorId: String,
        onSuccess: @escaping @MainActor () -> Void
    ) async {
        productsFeed = await productRepository.products(vendorId: vendorId)
        productDraft = saved.toDraft()
        editingProductId = saved.id
        isSavingProduct = false
        onSuccess()
    }
}

private extension AuthorizedSession {
    var membersById: [String: Member] {
        Dictionary(uniqueKeysWithValues: members.map { ($0.id, $0) })
    }
}

private extension Member? {
    var isVisibleForOrdering: Bool {
        guard let self else { return true }
        return self.isActive && self.producerCatalogEnabled
    }
}

extension Member {
    var seasonalCommitmentLookupKeys: [String] {
        var keys: [String] = [id]
        if let authUid = authUid?.trimmingCharacters(in: .whitespacesAndNewlines), !authUid.isEmpty {
            keys.append(authUid)
        }
        let emailKey = normalizedEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        if !emailKey.isEmpty {
            keys.append(emailKey)
        }
        return keys
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .reduce(into: [String]()) { acc, key in
                if !acc.contains(key) {
                    acc.append(key)
                }
            }
    }
}

private extension String {
    var toPositiveDouble: Double? {
        let normalized = replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, let value = Double(normalized), value > 0 else {
            return nil
        }
        return value
    }

    var toNonNegativeDouble: Double? {
        let normalized = replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, let value = Double(normalized), value >= 0 else {
            return nil
        }
        return value
    }
}

private extension Product {
    func toDraft() -> ProductDraft {
        ProductDraft(
            name: name,
            description: description,
            productImageUrl: productImageUrl ?? "",
            price: price.uiDecimal,
            unitName: unitName,
            unitAbbreviation: unitAbbreviation ?? "",
            unitPlural: unitPlural,
            unitQty: unitQty.uiDecimal,
            packContainerName: packContainerName ?? "",
            packContainerAbbreviation: packContainerAbbreviation ?? "",
            packContainerPlural: packContainerPlural ?? "",
            packContainerQty: packContainerQty?.uiDecimal ?? "",
            isAvailable: isAvailable,
            stockMode: stockMode,
            stockQty: stockQty?.uiDecimal ?? "",
            isEcoBasket: isEcoBasket,
            isCommonPurchase: isCommonPurchase,
            commonPurchaseType: commonPurchaseType
        )
    }
}

private extension Double {
    var uiDecimal: String {
        truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(self))
            : String(self)
    }
}
