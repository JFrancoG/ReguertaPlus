import Testing

@testable import Reguerta

@MainActor
struct ReguertaShiftsAdminViewModelTests {
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
            buildDeliveryCalendarOverride(
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
        #expect(
            environment.accessRootViewModel.shiftsViewModel.notificationRepository
                is InMemoryNotificationRepository
        )
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
