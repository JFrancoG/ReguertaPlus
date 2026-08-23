import Testing

@testable import Reguerta

extension ProductsOrderingRefreshGenerationTests {
    @Test("La democion invalida el catalogo y editor del miembro impersonado")
    func serverDemotionInvalidatesTheImpersonatedCatalogOwner() async throws {
        let producerAdmin = memberCopy(
            producer(id: "admin_producer_demoted", parity: .even),
            roles: [.member, .producer, .admin]
        )
        let demotedProducer = memberCopy(producerAdmin, roles: [.member, .producer])
        let impersonatedProducer = producer(id: "impersonated_producer", parity: .odd)
        let previousProduct = regularProduct(
            id: "impersonated_product",
            vendorId: impersonatedProducer.id,
            name: "Producto de la identidad anterior"
        )
        let repository = RecordingProductsMutationRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: impersonatedProducer,
            authenticatedMember: producerAdmin,
            members: [producerAdmin, impersonatedProducer],
            productRepository: repository
        )
        viewModel.catalogProducts = [previousProduct]
        viewModel.startEditing(productId: previousProduct.id)
        viewModel.updateDraft { $0.name = "Editor de la identidad anterior" }
        #expect(viewModel.editingProductId == previousProduct.id)
        #expect(viewModel.draft != ProductDraft())
        let previousEpoch = viewModel.sessionIdentityEpoch
        let oldScope = try #require(refreshScope(in: viewModel))

        await #expect(
            throws: RepositoryError.unavailable(resource: "criticalData.orderingState.accessScopeChanged")
        ) {
            try await viewModel.refreshOrderingProductsForFreshness(
                context: oldScope,
                payload: CriticalDataRefreshPayload(authenticatedMember: demotedProducer)
            )
        }

        let retryScope = try #require(refreshScope(in: viewModel))
        #expect(retryScope.refreshScope.memberID == demotedProducer.id)
        #expect(viewModel.sessionIdentityEpoch != previousEpoch)
        #expect(viewModel.catalogProducts.isEmpty)
        #expect(viewModel.editingProductId == nil)
        #expect(viewModel.draft == ProductDraft())
        #expect(await viewModel.save() == false)
        #expect(repository.upsertCount == 0)
    }
}
