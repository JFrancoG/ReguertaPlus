import Testing

@testable import Reguerta

@MainActor
struct ReguertaShiftsAdminViewModelTests {
    @Test
    func shiftsViewModelConfirmsSwapWithoutDirectShiftWrites() async {
        let scenario = await makeConfirmShiftSwapTestScenario()

        scenario.viewModel.confirmShiftSwapRequest(
            requestId: "swap_1",
            candidateShiftId: scenario.candidateShift.id
        )
        await waitForCondition {
            scenario.viewModel.shiftSwapRequests.first?.status == .applied
        }

        let storedShifts = await scenario.shiftRepository.allShifts()
        let updatedRequestedShift = storedShifts.first { $0.id == scenario.requestedShift.id }
        let updatedCandidateShift = storedShifts.first { $0.id == scenario.candidateShift.id }
        let storedRequests = await scenario.requestRepository.allShiftSwapRequests()

        #expect(storedRequests.first?.status == .applied)
        #expect(updatedRequestedShift == scenario.requestedShift)
        #expect(updatedCandidateShift == scenario.candidateShift)
    }

    @Test
    func shiftsViewModelLoadsAndMutatesDeliveryCalendarOnlyForAdmins() async {
        let regularMember = shiftMember(id: "member_1", displayName: "Carmen")
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let delivery = shift(
            id: "delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 6),
            assignedUserIds: [admin.id]
        )
        let calendarRepository = InMemoryDeliveryCalendarRepository(defaultDay: .wednesday)
        let regularViewModel = makeShiftsViewModel(
            currentMember: regularMember,
            members: [regularMember],
            deliveryCalendarRepository: calendarRepository
        )

        await regularViewModel.refreshDeliveryCalendar()

        #expect(regularViewModel.defaultDeliveryDayOfWeek == nil)
        #expect(regularViewModel.deliveryCalendarOverrides.isEmpty)

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

        var overrides = await calendarRepository.allOverrides()
        #expect(adminViewModel.defaultDeliveryDayOfWeek == .wednesday)
        #expect(overrides.first?.weekKey == delivery.weekKey)
        #expect(overrides.first?.deliveryDateMillis.deliveryWeekday == .friday)

        adminViewModel.selectCalendarWeekForEditing(delivery.weekKey)
        adminViewModel.selectedDeliveryCalendarWeekday = .wednesday
        #expect(adminViewModel.hasDeliveryCalendarDayChange)
        await adminViewModel.saveDeliveryCalendarOverride()

        overrides = await calendarRepository.allOverrides()
        #expect(overrides.isEmpty)
    }

    @Test
    func shiftsViewModelSubmitsAdminPlanningRequestAndClearsPendingState() async {
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

    @Test
    func shiftsViewModelRetainsCalendarEditorWhenRepositoryRejectsMutation() async {
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

    @Test
    func shiftsViewModelRetainsCalendarEditorWhenRepositoryRejectsDelete() async throws {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let delivery = shift(
            id: "delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 6),
            assignedUserIds: [admin.id]
        )
        let existingOverride = try #require(
            buildDeliveryCalendarOverride(
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

    @Test
    func shiftsViewModelRetainsPendingPlanningRequestWhenRepositoryRejectsSubmit() async {
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

    @Test
    func chainedShiftRepositoryPropagatesPrimaryRejectionWithoutMutatingFallback() async {
        let fallback = InMemoryShiftRepository()
        let repository = ChainedShiftRepository(
            primary: RejectingShiftRepository(),
            fallback: fallback
        )
        let assignment = shift(
            id: "delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 6),
            assignedUserIds: ["admin_1"]
        )

        await #expect(throws: ShiftsMutationTestError.rejected) {
            try await repository.upsert(shift: assignment)
        }
        #expect(await fallback.allShifts().isEmpty)
    }

    @Test
    func previewEnvironmentUsesInMemoryShiftsDependenciesAndSharesRootSession() {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.shiftsViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.shiftsViewModel.shiftRepository is InMemoryShiftRepository)
        #expect(environment.accessRootViewModel.shiftsViewModel.shiftSwapRequestRepository is InMemoryShiftSwapRequestRepository)
        #expect(environment.accessRootViewModel.shiftsViewModel.shiftPlanningRequestRepository is InMemoryShiftPlanningRequestRepository)
        #expect(environment.accessRootViewModel.shiftsViewModel.deliveryCalendarRepository is InMemoryDeliveryCalendarRepository)
        #expect(environment.accessRootViewModel.shiftsViewModel.notificationRepository is InMemoryNotificationRepository)
    }
}

@MainActor
private final class RejectingDeliveryCalendarRepository: DeliveryCalendarRepository {
    private let items: [DeliveryCalendarOverride]

    init(items: [DeliveryCalendarOverride] = []) {
        self.items = items
    }

    func defaultDeliveryDayOfWeek() async -> DeliveryWeekday? {
        .wednesday
    }

    func allOverrides() async -> [DeliveryCalendarOverride] {
        items
    }

    func upsertOverride(_ override: DeliveryCalendarOverride) async throws -> DeliveryCalendarOverride {
        throw ShiftsMutationTestError.rejected
    }

    func deleteOverride(weekKey _: String) async throws {
        throw ShiftsMutationTestError.rejected
    }
}

@MainActor
private final class RejectingShiftPlanningRequestRepository: ShiftPlanningRequestRepository {
    func submit(request _: ShiftPlanningRequest) async throws -> ShiftPlanningRequest {
        throw ShiftsMutationTestError.rejected
    }
}

@MainActor
private final class RejectingShiftRepository: ShiftRepository {
    func allShifts() async -> [ShiftAssignment] {
        []
    }

    func upsert(shift _: ShiftAssignment) async throws -> ShiftAssignment {
        throw ShiftsMutationTestError.rejected
    }
}

private enum ShiftsMutationTestError: Error, Equatable {
    case rejected
}
