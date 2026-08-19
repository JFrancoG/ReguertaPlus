import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ProductsOrderingRefreshGenerationTests {
    @Test("Un refresco nuevo de catalogo invalida el reintento inicial anterior")
    func newerCatalogRefreshInvalidatesOlderRetryFence() async throws {
        let currentProducer = producer(id: "producer_catalog", parity: .even)
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer]
        )
        let context = try #require(viewModel.authorizedSessionContext)

        let initialGeneration = viewModel.beginCatalogRefresh()
        #expect(viewModel.isCurrentCatalogRefresh(context, generation: initialGeneration))

        let newerGeneration = viewModel.beginCatalogRefresh()

        #expect(!viewModel.isCurrentCatalogRefresh(context, generation: initialGeneration))
        #expect(viewModel.isCurrentCatalogRefresh(context, generation: newerGeneration))
    }

    @Test("La carga ordinaria antigua no sobrescribe el snapshot del barrier")
    func olderOrdinaryRefreshCannotOverwriteFreshnessSnapshot() async throws {
        let currentMember = member(id: "member_refresh", ecoCommitmentMode: .weekly)
        let vendor = producer(id: "producer_even", parity: .even)
        let oldProduct = regularProduct(id: "old", vendorId: vendor.id, name: "Antiguo")
        let freshProduct = regularProduct(id: "fresh", vendorId: vendor.id, name: "Fresco")
        let newestProduct = regularProduct(id: "newest", vendorId: vendor.id, name: "Nuevo")
        let repository = ControlledOrderingProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentMember,
            members: [currentMember, vendor],
            productRepository: repository,
            nowMillis: testMillis(year: 2026, month: 5, day: 14)
        )
        let scope = try #require(refreshScope(in: viewModel))

        let oldTask = Task { @MainActor in
            await viewModel.refreshOrderingProducts()
        }
        await repository.waitForReadCount(1)

        let freshnessTask = Task { @MainActor in
            try await viewModel.refreshOrderingProductsForFreshness(
                scope: scope,
                payload: CriticalDataRefreshPayload()
            )
        }
        await repository.waitForReadCount(2)
        repository.completeRead(at: 1, with: [freshProduct])
        try await freshnessTask.value

        #expect(viewModel.myOrderProducts.map(\.id) == [freshProduct.id])
        #expect(viewModel.isOrderingStateCurrentForFreshness(scope: scope))

        let newestTask = Task { @MainActor in
            await viewModel.refreshOrderingProducts()
        }
        await repository.waitForReadCount(3)
        #expect(!viewModel.isOrderingStateCurrentForFreshness(scope: scope))
        repository.completeRead(at: 2, with: [newestProduct])
        await newestTask.value

        repository.completeRead(at: 0, with: [oldProduct])
        await oldTask.value

        #expect(viewModel.myOrderProducts.map(\.id) == [newestProduct.id])
        #expect(viewModel.isLoadingOrderingProducts == false)
    }

    @Test("Un barrier desplazado por una carga nueva termina con error recuperable")
    func supersededFreshnessRefreshFailsRecoverably() async throws {
        let currentMember = member(id: "member_superseded", ecoCommitmentMode: .weekly)
        let vendor = producer(id: "producer_even", parity: .even)
        let staleProduct = regularProduct(id: "stale", vendorId: vendor.id, name: "Antiguo")
        let currentProduct = regularProduct(id: "current", vendorId: vendor.id, name: "Actual")
        let repository = ControlledOrderingProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: currentMember,
            members: [currentMember, vendor],
            productRepository: repository,
            nowMillis: testMillis(year: 2026, month: 5, day: 14)
        )
        let scope = try #require(refreshScope(in: viewModel))

        let freshnessTask = Task { @MainActor in
            try await viewModel.refreshOrderingProductsForFreshness(
                scope: scope,
                payload: CriticalDataRefreshPayload()
            )
        }
        await repository.waitForReadCount(1)
        let currentTask = Task { @MainActor in
            await viewModel.refreshOrderingProducts()
        }
        await repository.waitForReadCount(2)

        repository.completeRead(at: 0, with: [staleProduct])
        do {
            try await freshnessTask.value
            Issue.record("El barrier desplazado no debe completar con exito")
        } catch let error as RepositoryError {
            #expect(error == .unavailable(resource: "criticalData.orderingState.superseded"))
        } catch {
            Issue.record("Error inesperado: \(error)")
        }

        #expect(!viewModel.isOrderingStateCurrentForFreshness(scope: scope))
        repository.completeRead(at: 1, with: [currentProduct])
        await currentTask.value

        #expect(viewModel.myOrderProducts.map(\.id) == [currentProduct.id])
        #expect(viewModel.isLoadingOrderingProducts == false)
    }

    @Test("El miembro server-only actualizado invalida el scope antes del ACK")
    func serverSelectedMemberCapabilityChangeRequiresNewScope() async throws {
        let currentMember = member(id: "member_promoted", ecoCommitmentMode: .weekly)
        let promotedMember = memberCopy(currentMember, roles: currentMember.roles.union([.admin]))
        let vendor = producer(id: "producer_even", parity: .even)
        let staleProduct = regularProduct(id: "stale", vendorId: vendor.id, name: "Antiguo")
        let freshProduct = regularProduct(id: "fresh", vendorId: vendor.id, name: "Fresco")
        let viewModel = await makeProductsViewModel(
            currentMember: currentMember,
            members: [currentMember, vendor],
            productRepository: InMemoryProductRepository(items: [staleProduct]),
            nowMillis: testMillis(year: 2026, month: 5, day: 14)
        )
        let oldScope = try #require(refreshScope(in: viewModel))
        let payload = CriticalDataRefreshPayload(
            authenticatedMember: promotedMember,
            selectedMember: promotedMember,
            members: [promotedMember, vendor],
            products: [freshProduct],
            seasonalCommitments: []
        )

        await #expect(
            throws: RepositoryError.unavailable(
                resource: "criticalData.orderingState.accessScopeChanged"
            )
        ) {
            try await viewModel.refreshOrderingProductsForFreshness(
                scope: oldScope,
                payload: payload
            )
        }

        guard case .authorized(let promotedSession) = viewModel.sessionViewModel.mode else {
            Issue.record("Se esperaba conservar una sesion autorizada")
            return
        }
        #expect(promotedSession.authenticatedMember.canManageMembers)
        #expect(!viewModel.isOrderingStateCurrentForFreshness(scope: oldScope))
        #expect(viewModel.myOrderProducts.isEmpty)

        let newScope = try #require(refreshScope(in: viewModel))
        #expect(newScope.canManageMembers)
        try await viewModel.refreshOrderingProductsForFreshness(
            scope: newScope,
            payload: payload
        )

        #expect(viewModel.isOrderingStateCurrentForFreshness(scope: newScope))
        #expect(viewModel.myOrderProducts.map(\.id) == [freshProduct.id])
        #expect(viewModel.myOrderSeasonalCommitments.isEmpty)
    }

    @Test("Una democion durante impersonacion vuelve al miembro autenticado")
    func serverAuthenticatedMemberDemotionClearsImpersonationBeforeRetry() async throws {
        let authenticatedMember = memberCopy(
            member(id: "admin_demoted", ecoCommitmentMode: .weekly),
            roles: [.member, .admin]
        )
        let demotedMember = memberCopy(authenticatedMember, roles: [.member])
        let impersonatedMember = member(id: "impersonated_member", ecoCommitmentMode: .weekly)
        let vendor = producer(id: "producer_even", parity: .even)
        let freshProduct = regularProduct(id: "fresh", vendorId: vendor.id, name: "Fresco")
        let viewModel = await makeProductsViewModel(
            currentMember: impersonatedMember,
            authenticatedMember: authenticatedMember,
            members: [authenticatedMember, impersonatedMember, vendor],
            productRepository: InMemoryProductRepository(),
            nowMillis: testMillis(year: 2026, month: 5, day: 14)
        )
        let oldScope = try #require(refreshScope(in: viewModel))

        await #expect(
            throws: RepositoryError.unavailable(
                resource: "criticalData.orderingState.accessScopeChanged"
            )
        ) {
            try await viewModel.refreshOrderingProductsForFreshness(
                scope: oldScope,
                payload: CriticalDataRefreshPayload(authenticatedMember: demotedMember)
            )
        }

        guard case .authorized(let demotedSession) = viewModel.sessionViewModel.mode else {
            Issue.record("Se esperaba conservar una sesion autorizada")
            return
        }
        #expect(!demotedSession.authenticatedMember.canManageMembers)
        #expect(demotedSession.member.id == demotedMember.id)
        #expect(demotedSession.members.map(\.id) == [demotedMember.id])
        #expect(!viewModel.isOrderingStateCurrentForFreshness(scope: oldScope))

        let retryScope = try #require(refreshScope(in: viewModel))
        #expect(retryScope.authenticatedMemberID == demotedMember.id)
        #expect(retryScope.memberID == demotedMember.id)
        #expect(!retryScope.canManageMembers)
        try await viewModel.refreshOrderingProductsForFreshness(
            scope: retryScope,
            payload: CriticalDataRefreshPayload(
                authenticatedMember: demotedMember,
                selectedMember: demotedMember,
                members: [demotedMember, vendor],
                products: [freshProduct],
                seasonalCommitments: []
            )
        )

        #expect(viewModel.isOrderingStateCurrentForFreshness(scope: retryScope))
        #expect(viewModel.myOrderProducts.map(\.id) == [freshProduct.id])
    }

    @Test("Un relink server-only del miembro autenticado falla cerrado")
    func serverAuthenticatedMemberRelinkCannotReachAcknowledgement() async throws {
        let currentMember = member(id: "member_relinked", ecoCommitmentMode: .weekly)
        let relinkedMember = Member(
            id: currentMember.id,
            displayName: currentMember.displayName,
            normalizedEmail: currentMember.normalizedEmail,
            authUid: "another_principal",
            roles: currentMember.roles,
            isActive: true,
            producerCatalogEnabled: currentMember.producerCatalogEnabled,
            ecoCommitmentMode: currentMember.ecoCommitmentMode
        )
        let freshProduct = regularProduct(
            id: "must_not_apply",
            vendorId: currentMember.id,
            name: "No aplicar"
        )
        let viewModel = await makeProductsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            productRepository: InMemoryProductRepository()
        )
        let scope = try #require(refreshScope(in: viewModel))

        await #expect(
            throws: RepositoryError.permissionDenied(
                resource: "criticalData.orderingState.authenticatedMemberLink"
            )
        ) {
            try await viewModel.refreshOrderingProductsForFreshness(
                scope: scope,
                payload: CriticalDataRefreshPayload(
                    authenticatedMember: relinkedMember,
                    selectedMember: relinkedMember,
                    members: [relinkedMember],
                    products: [freshProduct],
                    seasonalCommitments: []
                )
            )
        }

        #expect(!viewModel.isOrderingStateCurrentForFreshness(scope: scope))
        #expect(viewModel.myOrderProducts.isEmpty)
    }

    @Test("Un writer de sesion stale invalida el receipt antes del ACK")
    func staleSameScopeSessionWriterInvalidatesFreshnessReceipt() async throws {
        let staleMember = member(id: "member_session_writer", ecoCommitmentMode: .weekly)
        let freshMember = Member(
            id: staleMember.id,
            displayName: "Perfil fresco",
            normalizedEmail: staleMember.normalizedEmail,
            authUid: staleMember.authUid,
            roles: staleMember.roles,
            isActive: true,
            producerCatalogEnabled: staleMember.producerCatalogEnabled,
            ecoCommitmentMode: staleMember.ecoCommitmentMode
        )
        let viewModel = await makeProductsViewModel(
            currentMember: staleMember,
            members: [staleMember],
            productRepository: InMemoryProductRepository()
        )
        let scope = try #require(refreshScope(in: viewModel))
        try await viewModel.refreshOrderingProductsForFreshness(
            scope: scope,
            payload: CriticalDataRefreshPayload(
                authenticatedMember: freshMember,
                selectedMember: freshMember,
                members: [freshMember],
                products: [],
                seasonalCommitments: []
            )
        )
        #expect(viewModel.isOrderingStateCurrentForFreshness(scope: scope))

        viewModel.sessionViewModel.applyRefreshedAuthorizedMembers([staleMember])

        #expect(!viewModel.isOrderingStateCurrentForFreshness(scope: scope))
    }
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ProductsOrderingEquivalentMemberRefreshTests {
    @Test("Una lista de miembros equivalente conserva orden revision y receipt")
    func equivalentFreshnessMembersDoNotInvalidateReceipt() async throws {
        let firstMember = Member(
            id: "member_first",
            displayName: "Ana",
            normalizedEmail: "ana@example.com",
            authUid: "auth_member_first",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: false,
            ecoCommitmentMode: .weekly
        )
        let authenticatedMember = member(id: "member_middle", ecoCommitmentMode: .weekly)
        let lastMember = Member(
            id: "member_last",
            displayName: "Zoe",
            normalizedEmail: "zoe@example.com",
            authUid: "auth_member_last",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: false,
            ecoCommitmentMode: .weekly
        )
        let sortedMembers = [firstMember, authenticatedMember, lastMember]
        let viewModel = await makeProductsViewModel(
            currentMember: authenticatedMember,
            members: sortedMembers,
            productRepository: InMemoryProductRepository()
        )
        let scope = try #require(refreshScope(in: viewModel))
        let revisionBeforeRefresh = viewModel.sessionViewModel.sessionStateRevision

        try await viewModel.refreshOrderingProductsForFreshness(
            scope: scope,
            payload: CriticalDataRefreshPayload(
                authenticatedMember: authenticatedMember,
                selectedMember: authenticatedMember,
                members: sortedMembers,
                products: [],
                seasonalCommitments: []
            )
        )

        guard case .authorized(let refreshedSession) = viewModel.sessionViewModel.mode else {
            Issue.record("Se esperaba conservar una sesion autorizada")
            return
        }
        #expect(refreshedSession.members.map(\.id) == sortedMembers.map(\.id))
        #expect(viewModel.sessionViewModel.sessionStateRevision == revisionBeforeRefresh)
        #expect(viewModel.isOrderingStateCurrentForFreshness(scope: scope))

        viewModel.sessionViewModel.applyRefreshedAuthorizedMembers(sortedMembers)

        #expect(viewModel.sessionViewModel.sessionStateRevision == revisionBeforeRefresh)
        #expect(viewModel.isOrderingStateCurrentForFreshness(scope: scope))
    }
}

@MainActor private func refreshScope(in viewModel: ProductsRouteViewModel) -> CriticalDataRefreshScope? {
    guard case .authorized(let session) = viewModel.sessionViewModel.mode else { return nil }
    return CriticalDataRefreshScope(
        principalUID: session.principal.uid,
        authenticatedMemberID: session.authenticatedMember.id,
        memberID: session.member.id,
        environment: session.environment,
        canManageMembers: session.authenticatedMember.canManageMembers
    )
}

private func memberCopy(_ source: Member, roles: Set<MemberRole>) -> Member {
    Member(
        id: source.id,
        displayName: source.displayName,
        companyName: source.companyName,
        phoneNumber: source.phoneNumber,
        normalizedEmail: source.normalizedEmail,
        authUid: source.authUid,
        roles: roles,
        isActive: source.isActive,
        producerCatalogEnabled: source.producerCatalogEnabled,
        isCommonPurchaseManager: source.isCommonPurchaseManager,
        producerParity: source.producerParity,
        ecoCommitmentMode: source.ecoCommitmentMode,
        ecoCommitmentParity: source.ecoCommitmentParity
    )
}

@MainActor
private final class ControlledOrderingProductRepository: ProductRepository {
    private var readContinuations: [CheckedContinuation<[Product], Never>?] = []

    nonisolated func allProducts() async -> [Product] {
        await suspendRead()
    }

    nonisolated func products(vendorId _: String) async -> [Product] { [] }

    nonisolated func upsert(product: Product) async -> Product { product }

    private func suspendRead() async -> [Product] {
        let index = readContinuations.count
        readContinuations.append(nil)
        return await withCheckedContinuation { continuation in
            readContinuations[index] = continuation
        }
    }

    func waitForReadCount(_ expectedCount: Int) async {
        while readContinuations.count < expectedCount || readContinuations[expectedCount - 1] == nil {
            await Task.yield()
        }
    }

    func completeRead(at index: Int, with products: [Product]) {
        guard readContinuations.indices.contains(index),
              let continuation = readContinuations[index]
        else {
            return
        }
        readContinuations[index] = nil
        continuation.resume(returning: products)
    }
}
