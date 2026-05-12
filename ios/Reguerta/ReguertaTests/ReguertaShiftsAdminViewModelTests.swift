import Testing

@testable import Reguerta

@MainActor
struct ReguertaShiftsAdminViewModelTests {
    @Test
    func shiftsViewModelConfirmsSwapAndRecomputesDeliveryHelper() async {
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
        #expect(updatedRequestedShift?.assignedUserIds == [scenario.candidate.id])
        #expect(updatedRequestedShift?.helperUserId == scenario.requester.id)
        #expect(updatedCandidateShift?.assignedUserIds == [scenario.requester.id])
        #expect(updatedCandidateShift?.helperUserId == nil)
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

        adminViewModel.selectCalendarWeek(delivery.weekKey)
        adminViewModel.selectedDeliveryCalendarWeekday = .friday
        await adminViewModel.saveDeliveryCalendarOverride()

        var overrides = await calendarRepository.allOverrides()
        #expect(adminViewModel.defaultDeliveryDayOfWeek == .wednesday)
        #expect(overrides.first?.weekKey == delivery.weekKey)
        #expect(overrides.first?.deliveryDateMillis.deliveryWeekday == .friday)

        adminViewModel.selectCalendarWeek(delivery.weekKey)
        await adminViewModel.deleteDeliveryCalendarOverride()

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
