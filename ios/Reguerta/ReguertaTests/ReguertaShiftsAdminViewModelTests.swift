import Testing

@testable import Reguerta

@MainActor
struct ReguertaShiftsAdminViewModelTests {
    @Test func completedActivationRefreshesShiftsExactlyOnceForRepeatedObservation() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let shiftRepository = CountingPlanningShiftRepository()
        let planningRepository = ControlledPlanningObservationRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftRepository: shiftRepository,
            shiftPlanningRequestRepository: planningRepository
        )
        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await planningRepository.waitUntilObserved()
        await awaitCurrentShiftsRefresh(in: viewModel)
        let initialReadCount = await shiftRepository.readCount

        await planningRepository.emit(completedActivationObservation())
        await waitForCondition {
            viewModel.shiftPlanningObservation?.id == "activate-request" &&
                !viewModel.isRefreshingShiftsAfterActivation
        }
        await planningRepository.emit(completedActivationObservation())
        await Task.yield()

        #expect(await shiftRepository.readCount == initialReadCount + 1)
    }

    @Test func revokedAdminSessionCannotPublishLaterPlanningObservation() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let shiftRepository = CountingPlanningShiftRepository()
        let planningRepository = ControlledPlanningObservationRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftRepository: shiftRepository,
            shiftPlanningRequestRepository: planningRepository
        )
        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await planningRepository.waitUntilObserved()
        await awaitCurrentShiftsRefresh(in: viewModel)
        let initialReadCount = await shiftRepository.readCount

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)
        await planningRepository.emit(completedActivationObservation())
        await Task.yield()

        #expect(viewModel.shiftPlanningObservation == nil)
        #expect(await shiftRepository.readCount == initialReadCount)
    }

    @Test func shiftsViewModelConfirmsSwapWithoutDirectShiftWrites() async {
        let scenario = await makeConfirmShiftSwapTestScenario()

        scenario.viewModel.confirmShiftSwapRequest(
            requestId: "swap_1",
            candidateShiftId: scenario.candidateShift.id
        )
        await waitForCondition {
            scenario.viewModel.shiftSwapRequests.first?.status == .applied
        }

        let storedShifts = await scenario.shiftRepository.allShifts(environment: .develop)
        let updatedRequestedShift = storedShifts.first { $0.id == scenario.requestedShift.id }
        let updatedCandidateShift = storedShifts.first { $0.id == scenario.candidateShift.id }
        let storedRequests = await scenario.requestRepository.allShiftSwapRequests(environment: .develop)

        #expect(storedRequests.first?.status == .applied)
        #expect(updatedRequestedShift == scenario.requestedShift)
        #expect(updatedCandidateShift == scenario.candidateShift)
    }

    @Test func shiftsViewModelLoadsDeliveryCalendarForActiveMember() async throws {
        let regularMember = shiftMember(id: "member_1", displayName: "Carmen")
        let existingOverride = try #require(
            DeliveryCalendarOverride.weeklyException(
                weekKey: "2026-W19",
                weekday: .friday,
                updatedByUserId: "admin_1",
                updatedAtMillis: 1
            )
        )
        let calendarRepository = InMemoryDeliveryCalendarRepository(defaultDay: .wednesday)
        _ = await calendarRepository.upsertOverride(existingOverride, environment: .develop)
        let viewModel = makeShiftsViewModel(
            currentMember: regularMember,
            members: [regularMember],
            deliveryCalendarRepository: calendarRepository
        )

        await viewModel.refreshDeliveryCalendar()

        #expect(viewModel.defaultDeliveryDayOfWeek == .wednesday)
        #expect(viewModel.deliveryCalendarOverrides == [existingOverride])
    }

    @Test func regularMemberCannotMutateDeliveryCalendarOrSubmitPlanningRequest() async {
        let regularMember = shiftMember(id: "member_1", displayName: "Carmen")
        let calendarRepository = InMemoryDeliveryCalendarRepository(defaultDay: .wednesday)
        let planningRepository = RecordingShiftPlanningRequestRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: regularMember,
            members: [regularMember],
            shiftPlanningRequestRepository: planningRepository,
            deliveryCalendarRepository: calendarRepository
        )
        viewModel.selectCalendarWeekForEditing("2026-W19")
        viewModel.selectedDeliveryCalendarWeekday = .friday

        await viewModel.saveDeliveryCalendarOverride()
        viewModel.requestShiftPlanning(.delivery)
        await viewModel.confirmShiftPlanningRequest()

        #expect(await calendarRepository.allOverrides(environment: .develop).isEmpty)
        #expect(await planningRepository.submittedRequests().isEmpty)
    }

    @Test func shiftsViewModelMutatesDeliveryCalendarForAdmin() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let delivery = shift(
            id: "delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 6),
            assignedUserIds: [admin.id]
        )
        let calendarRepository = InMemoryDeliveryCalendarRepository(defaultDay: .wednesday)
        let adminViewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftRepository: InMemoryShiftRepository(items: [delivery]),
            deliveryCalendarRepository: calendarRepository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )
        await adminViewModel.refreshShifts()
        await adminViewModel.refreshDeliveryCalendar()

        adminViewModel.selectCalendarWeekForEditing(delivery.weekKey)
        #expect(adminViewModel.hasDeliveryCalendarDayChange == false)
        adminViewModel.selectedDeliveryCalendarWeekday = .friday
        #expect(adminViewModel.hasDeliveryCalendarDayChange)
        await adminViewModel.saveDeliveryCalendarOverride()

        var overrides = await calendarRepository.allOverrides(environment: .develop)
        #expect(adminViewModel.defaultDeliveryDayOfWeek == .wednesday)
        #expect(overrides.first?.weekKey == delivery.weekKey)
        #expect(overrides.first?.deliveryDateMillis.deliveryWeekday == .friday)

        adminViewModel.selectCalendarWeekForEditing(delivery.weekKey)
        adminViewModel.selectedDeliveryCalendarWeekday = .wednesday
        #expect(adminViewModel.hasDeliveryCalendarDayChange)
        await adminViewModel.saveDeliveryCalendarOverride()

        overrides = await calendarRepository.allOverrides(environment: .develop)
        #expect(overrides.isEmpty)
    }

    @Test func shiftsViewModelDoesNotPersistTheDefaultWeekWithoutAnException() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let calendarRepository = RecordingDeliveryCalendarRepository(defaultDay: .wednesday)
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            deliveryCalendarRepository: calendarRepository,
            nowMillisProvider: { 42 }
        )
        await viewModel.refreshDeliveryCalendar()
        viewModel.selectCalendarWeekForEditing("2026-W20")

        await viewModel.saveDeliveryCalendarOverride()

        #expect(await calendarRepository.allOverrides(environment: .develop).isEmpty)
        let writeCallCounts = await calendarRepository.writeCallCounts()
        #expect(writeCallCounts.upserts == 0)
        #expect(writeCallCounts.deletes == 0)
    }

    @Test func shiftsViewModelDoesNotRewriteAnUnchangedException() async throws {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let existingOverride = try #require(
            DeliveryCalendarOverride.weeklyException(
                weekKey: "2026-W20",
                weekday: .friday,
                updatedByUserId: admin.id,
                updatedAtMillis: 1
            )
        )
        let calendarRepository = RecordingDeliveryCalendarRepository(
            defaultDay: .wednesday,
            items: [existingOverride]
        )
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            deliveryCalendarRepository: calendarRepository,
            nowMillisProvider: { 42 }
        )
        await viewModel.refreshDeliveryCalendar()
        viewModel.selectCalendarWeekForEditing(existingOverride.weekKey)

        await viewModel.saveDeliveryCalendarOverride()

        #expect(await calendarRepository.allOverrides(environment: .develop) == [existingOverride])
        let writeCallCounts = await calendarRepository.writeCallCounts()
        #expect(writeCallCounts.upserts == 0)
        #expect(writeCallCounts.deletes == 0)
    }

    @Test func shiftsViewModelSubmitsAdminPlanningRequestAndClearsPendingState() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let planningRepository = RecordingShiftPlanningRequestRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: planningRepository,
            nowMillisProvider: { 123 }
        )

        viewModel.requestShiftPlanning(.market)
        await viewModel.confirmShiftPlanningRequest()

        let submitted = await planningRepository.submittedRequests()
        #expect(submitted.map(\.type) == [.market])
        #expect(submitted.first?.requestedByUserId == admin.id)
        #expect(submitted.first?.requestedAtMillis == 123)
        #expect(viewModel.pendingShiftPlanningType == nil)
    }

    @Test func shiftsViewModelRetainsCalendarEditorWhenRepositoryRejectsMutation() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let delivery = shift(
            id: "delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 6),
            assignedUserIds: [admin.id]
        )
        let repository = RejectingDeliveryCalendarRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftRepository: InMemoryShiftRepository(items: [delivery]),
            deliveryCalendarRepository: repository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )
        await viewModel.refreshShifts()
        await viewModel.refreshDeliveryCalendar()
        viewModel.selectCalendarWeekForEditing(delivery.weekKey)
        viewModel.selectedDeliveryCalendarWeekday = .friday
        viewModel.isDeliveryCalendarWeekPickerPresented = true

        await viewModel.saveDeliveryCalendarOverride()

        #expect(viewModel.selectedDeliveryCalendarWeekKey == delivery.weekKey)
        #expect(viewModel.selectedDeliveryCalendarWeekday == .friday)
        #expect(viewModel.isDeliveryCalendarWeekPickerPresented)
        #expect(viewModel.deliveryCalendarOverrides.isEmpty)
        #expect(viewModel.isSavingDeliveryCalendar == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test func shiftsViewModelRetainsCalendarEditorWhenRepositoryRejectsDelete() async throws {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let delivery = shift(
            id: "delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 6),
            assignedUserIds: [admin.id]
        )
        let existingOverride = try #require(
            DeliveryCalendarOverride.weeklyException(
                weekKey: delivery.weekKey,
                weekday: .friday,
                updatedByUserId: admin.id,
                updatedAtMillis: 1
            )
        )
        let repository = RejectingDeliveryCalendarRepository(items: [existingOverride])
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftRepository: InMemoryShiftRepository(items: [delivery]),
            deliveryCalendarRepository: repository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )
        await viewModel.refreshShifts()
        await viewModel.refreshDeliveryCalendar()
        viewModel.selectCalendarWeekForEditing(delivery.weekKey)
        viewModel.selectedDeliveryCalendarWeekday = .wednesday
        viewModel.isDeliveryCalendarWeekPickerPresented = true

        await viewModel.saveDeliveryCalendarOverride()

        #expect(viewModel.selectedDeliveryCalendarWeekKey == delivery.weekKey)
        #expect(viewModel.selectedDeliveryCalendarWeekday == .wednesday)
        #expect(viewModel.isDeliveryCalendarWeekPickerPresented)
        #expect(viewModel.deliveryCalendarOverrides == [existingOverride])
        #expect(viewModel.isSavingDeliveryCalendar == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test func shiftsViewModelRetainsPendingPlanningRequestWhenRepositoryRejectsSubmit() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: RejectingShiftPlanningRequestRepository()
        )
        viewModel.requestShiftPlanning(.market)

        await viewModel.confirmShiftPlanningRequest()

        #expect(viewModel.pendingShiftPlanningType == .market)
        #expect(viewModel.isSubmittingShiftPlanningRequest == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test func previewEnvironmentUsesInMemoryShiftsDependenciesAndSharesRootSession() {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.shiftsViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.shiftsViewModel.shiftRepository is InMemoryShiftRepository)
        #expect(
            environment.accessRootViewModel.shiftsViewModel.shiftSwapRequestRepository
                is InMemoryShiftSwapRequestRepository
        )
        #expect(
            environment.accessRootViewModel.shiftsViewModel.shiftPlanningRequestRepository
                is InMemoryShiftPlanningRequestRepository
        )
        #expect(
            environment.accessRootViewModel.shiftsViewModel.deliveryCalendarRepository
                is InMemoryDeliveryCalendarRepository
        )
    }
}

private func completedActivationObservation() -> ShiftPlanningRequestObservation {
    ShiftPlanningRequestObservation(
        id: "activate-request",
        bundleId: "bundle-2026",
        requestedByUserId: "admin_1",
        requestedAtMillis: 1,
        mode: .activate,
        status: .completed,
        completedSummary: nil,
        failure: nil,
        candidateReference: nil
    )
}

private actor ControlledPlanningObservationRepository: ShiftPlanningRequestRepository {
    private var continuation: AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>.Continuation?
    private var observationWaiters: [CheckedContinuation<Void, Never>] = []

    func submit(request: ShiftPlanningRequest, environment _: SessionEnvironment) async -> ShiftPlanningRequest {
        request
    }

    func observeLatestV2Request(
        environment _: SessionEnvironment
    ) async -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error> {
        let pair = AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>.makeStream()
        continuation = pair.continuation
        observationWaiters.forEach { $0.resume() }
        observationWaiters.removeAll()
        return pair.stream
    }

    func emit(_ observation: ShiftPlanningRequestObservation?) {
        continuation?.yield(observation)
    }

    func waitUntilObserved() async {
        guard continuation == nil else { return }
        await withCheckedContinuation { continuation in
            observationWaiters.append(continuation)
        }
    }
}

private actor CountingPlanningShiftRepository: ShiftRepository {
    private(set) var readCount = 0

    func allShifts(environment _: SessionEnvironment) -> [ShiftAssignment] {
        readCount += 1
        return []
    }

}

private actor RecordingDeliveryCalendarRepository: DeliveryCalendarRepository {
    private let defaultDay: DeliveryWeekday
    private var items: [String: DeliveryCalendarOverride]
    private var upsertCallCount = 0
    private var deleteCallCount = 0

    init(defaultDay: DeliveryWeekday, items: [DeliveryCalendarOverride] = []) {
        self.defaultDay = defaultDay
        self.items = Dictionary(uniqueKeysWithValues: items.map { ($0.weekKey, $0) })
    }

    func defaultDeliveryDayOfWeek(environment _: SessionEnvironment) async -> DeliveryWeekday { defaultDay }

    func allOverrides(environment _: SessionEnvironment) async -> [DeliveryCalendarOverride] {
        items.values.sorted { $0.weekKey < $1.weekKey }
    }

    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment _: SessionEnvironment
    ) async -> DeliveryCalendarOverride {
        upsertCallCount += 1
        items[override.weekKey] = override
        return override
    }

    func deleteOverride(weekKey: String, environment _: SessionEnvironment) async {
        deleteCallCount += 1
        items.removeValue(forKey: weekKey)
    }

    func writeCallCounts() -> (upserts: Int, deletes: Int) {
        (upsertCallCount, deleteCallCount)
    }
}

@MainActor
private final class RejectingDeliveryCalendarRepository: DeliveryCalendarRepository {
    private let items: [DeliveryCalendarOverride]

    init(items: [DeliveryCalendarOverride] = []) {
        self.items = items
    }

    func defaultDeliveryDayOfWeek(environment _: SessionEnvironment) async -> DeliveryWeekday {
        .wednesday
    }

    func allOverrides(environment _: SessionEnvironment) async -> [DeliveryCalendarOverride] {
        items
    }

    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment _: SessionEnvironment
    ) async throws -> DeliveryCalendarOverride {
        throw ShiftsMutationTestError.rejected
    }

    func deleteOverride(weekKey _: String, environment _: SessionEnvironment) async throws {
        throw ShiftsMutationTestError.rejected
    }
}

@MainActor
private final class RejectingShiftPlanningRequestRepository: ShiftPlanningRequestRepository {
    func submit(
        request _: ShiftPlanningRequest,
        environment _: SessionEnvironment
    ) async throws -> ShiftPlanningRequest {
        throw ShiftsMutationTestError.rejected
    }
}

@MainActor
private final class RejectingShiftRepository: ShiftRepository {
    func allShifts(environment _: SessionEnvironment) async -> [ShiftAssignment] {
        []
    }

    func upsert(shift _: ShiftAssignment, environment _: SessionEnvironment) async throws -> ShiftAssignment {
        throw ShiftsMutationTestError.rejected
    }
}

private enum ShiftsMutationTestError: Error, Equatable {
    case rejected
}
