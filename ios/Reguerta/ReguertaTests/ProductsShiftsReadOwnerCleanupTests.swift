import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ProductsShiftsReadOwnerCleanupTests {
    @Test func benignSessionRevisionReleasesTheCatalogRefreshWithoutRouteHandler() async throws {
        let producer = producer(id: "producer_catalog_read", parity: .even)
        let repository = SessionRevisionProductReadRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: producer,
            members: [producer],
            productRepository: repository
        )
        let refresh = Task { await viewModel.refreshCatalog() }
        defer {
            refresh.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilCatalogReadStarts()

        let refreshedProducer = replacingDisplayName(in: producer, with: "Productor actualizado")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(refreshedProducer, members: [refreshedProducer])
        repository.completeCatalogRead()
        await refresh.value

        #expect(viewModel.isLoadingCatalog == false)
        #expect(viewModel.catalogProducts.isEmpty)
    }

    @Test func benignSessionRevisionReleasesTheOrderingRefreshWithoutRouteHandler() async throws {
        let member = member(id: "member_ordering_read", ecoCommitmentMode: .weekly)
        let repository = SessionRevisionProductReadRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: member,
            members: [member],
            productRepository: repository
        )
        let refresh = Task { await viewModel.refreshOrderingProducts() }
        defer {
            refresh.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilOrderingReadStarts()

        let refreshedMember = replacingDisplayName(in: member, with: "Socia actualizada")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(refreshedMember, members: [refreshedMember])
        repository.completeOrderingRead()
        await refresh.value

        #expect(viewModel.isLoadingOrderingProducts == false)
        #expect(viewModel.myOrderProducts.isEmpty)
    }

    @Test func benignSessionRevisionReleasesTheFreshnessRefreshWithoutRouteHandler() async throws {
        let member = member(id: "member_freshness_read", ecoCommitmentMode: .weekly)
        let repository = SessionRevisionProductReadRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: member,
            members: [member],
            productRepository: repository
        )
        guard case .authorized(let session) = viewModel.sessionViewModel.mode else {
            Issue.record("Expected an authorized session")
            return
        }
        let freshnessContext = MyOrderFreshnessSessionContext(
            session: session,
            sessionStateRevision: viewModel.sessionViewModel.sessionStateRevision
        )
        let refresh = Task {
            try await viewModel.refreshOrderingProductsForFreshness(
                context: freshnessContext,
                payload: CriticalDataRefreshPayload()
            )
        }
        defer {
            refresh.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilOrderingReadStarts()

        let refreshedMember = replacingDisplayName(in: member, with: "Socia actualizada")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(refreshedMember, members: [refreshedMember])
        repository.completeOrderingRead()
        do {
            try await refresh.value
            Issue.record("Expected the stale freshness refresh to be cancelled")
        } catch is CancellationError {
            // Expected: a stale owner may not publish after the session revision changes.
        }

        #expect(viewModel.isLoadingOrderingProducts == false)
        #expect(viewModel.myOrderProducts.isEmpty)
    }

    @Test func benignSessionRevisionReleasesTheShiftsRefreshWithoutRouteHandler() async throws {
        let member = shiftMember(id: "member_shifts_read", displayName: "Carmen")
        let repository = SessionRevisionShiftReadRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository
        )
        let refresh = Task { await viewModel.refreshShifts() }
        defer {
            refresh.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilReadStarts()

        let refreshedMember = replacingDisplayName(in: member, with: "Carmen actualizada")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(refreshedMember, members: [refreshedMember])
        repository.completeRead()
        await refresh.value

        #expect(viewModel.isLoadingShifts == false)
        #expect(viewModel.activeShiftsRefreshOperationId == nil)
    }

    @Test func benignSessionRevisionReleasesTheCalendarRefreshWithoutRouteHandler() async throws {
        let admin = adminMember(id: "admin_calendar_read", displayName: "Admin")
        let repository = SessionRevisionCalendarReadRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            deliveryCalendarRepository: repository
        )
        let refresh = Task { await viewModel.refreshDeliveryCalendar() }
        defer {
            refresh.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilReadStarts()

        let refreshedAdmin = replacingDisplayName(in: admin, with: "Admin actualizada")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(refreshedAdmin, members: [refreshedAdmin])
        repository.completeRead()
        await refresh.value

        #expect(viewModel.isLoadingDeliveryCalendar == false)
        #expect(viewModel.activeCalendarRefreshOperationId == nil)
    }

    @Test func liveAdminRevocationRejectsNewCalendarAndPlanningCallsWithoutRouteHandler() async {
        let admin = adminMember(id: "admin_entry_guard", displayName: "Admin")
        let calendarRepository = EntryCountingDeliveryCalendarRepository()
        let planningRepository = RecordingShiftPlanningRequestRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: planningRepository,
            deliveryCalendarRepository: calendarRepository
        )

        let revokedAdmin = replacingRoles(in: admin, with: [.member])
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(revokedAdmin, members: [revokedAdmin])
        await viewModel.refreshDeliveryCalendar()
        viewModel.shiftPlanningDeliverySeasonInput = "2026"
        viewModel.shiftPlanningMarketSeasonInput = "2027"
        viewModel.requestShiftPlanningPreview()
        await viewModel.confirmShiftPlanningRequest()

        #expect(await calendarRepository.readCount() == 0)
        #expect(await planningRepository.submittedRequests().isEmpty)
        #expect(viewModel.pendingShiftPlanningRequest == nil)
    }

    @Test func lateShiftsOwnerCannotClearTheActiveSuccessorProgress() async throws {
        let member = shiftMember(id: "member_shifts_successor", displayName: "Carmen")
        let repository = SessionRevisionShiftReadRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository
        )
        let staleRefresh = Task { await viewModel.refreshShifts() }
        var successorRefresh: Task<Void, Never>?
        defer {
            staleRefresh.cancel()
            successorRefresh?.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilReadStarts()

        let refreshedMember = replacingDisplayName(in: member, with: "Carmen actualizada")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(refreshedMember, members: [refreshedMember])
        successorRefresh = Task { await viewModel.refreshShifts() }
        try await repository.waitUntilReadStarts(1)

        repository.completeRead()
        await staleRefresh.value
        #expect(viewModel.isLoadingShifts)
        #expect(viewModel.activeShiftsRefreshOperationId != nil)

        repository.completeRead(1)
        await successorRefresh?.value
        #expect(viewModel.isLoadingShifts == false)
        #expect(viewModel.activeShiftsRefreshOperationId == nil)
    }
}
