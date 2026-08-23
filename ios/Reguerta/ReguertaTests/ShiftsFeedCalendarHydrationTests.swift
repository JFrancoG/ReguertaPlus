import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftsFeedCalendarHydrationTests {
    @Test func authorizedEntryStartsCalendarOnlyAfterTheAtomicFeedFinishes() async throws {
        let member = shiftMember(id: "member_calendar_sequence", displayName: "Carmen")
        let repository = ControlledShiftsFeedRepository(pairCount: 1)
        let calendarRepository = CountingDeliveryCalendarRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository,
            deliveryCalendarRepository: calendarRepository
        )

        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        try await repository.waitUntilPairStarts(0)
        #expect(await calendarRepository.readCount == 0)

        await repository.completePair(0, shifts: [], requests: [])
        try await calendarRepository.waitForReadCount(2)
        #expect(await calendarRepository.readCount == 2)
    }

    @Test func sameContextSuccessorInheritsPendingCalendarHydration() async throws {
        let member = shiftMember(id: "member_calendar_successor", displayName: "Carmen")
        let repository = ControlledShiftsFeedRepository(pairCount: 2)
        let calendarRepository = CountingDeliveryCalendarRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository,
            deliveryCalendarRepository: calendarRepository
        )

        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        try await repository.waitUntilPairStarts(0)
        viewModel.requestShiftsRefresh()
        try await repository.waitUntilPairStarts(1)

        await repository.completePair(0, shifts: [], requests: [])
        try await repository.waitUntilPairResolves(0)
        #expect(await calendarRepository.readCount == 0)
        #expect(viewModel.pendingInitialCalendarHydration?.feedOperationId == viewModel.activeShiftsRefreshOperationId)

        await repository.completeShifts(1, shifts: [])
        try await repository.waitUntilShiftReadResolves(1)
        #expect(await calendarRepository.readCount == 0)

        await repository.completeRequests(1, requests: [])
        try await calendarRepository.waitForReadCount(2)
        #expect(await calendarRepository.readCount == 2)
        #expect(viewModel.pendingInitialCalendarHydration == nil)
    }

    @Test func staleFeedCannotHydrateTheSuccessorCalendarContext() async throws {
        let member = shiftMember(id: "member_calendar_context", displayName: "Carmen")
        let environment = ShiftsEnvironmentBox(.develop)
        let repository = ControlledShiftsFeedRepository(pairCount: 2)
        let calendarRepository = CountingDeliveryCalendarRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository,
            deliveryCalendarRepository: calendarRepository,
            environmentProvider: { environment.value }
        )

        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        try await repository.waitUntilPairStarts(0)
        environment.value = .production
        let successor = authorizedShiftsSession(member: member, environment: environment.value)
        viewModel.sessionViewModel.mode = .authorized(successor)
        viewModel.handleSessionModeChange(.authorized(successor))
        try await repository.waitUntilPairStarts(1)

        await repository.completePair(0, shifts: [], requests: [])
        try await repository.waitUntilPairResolves(0)
        #expect(await calendarRepository.readCount == 0)

        await repository.completeShifts(1, shifts: [])
        try await repository.waitUntilShiftReadResolves(1)
        #expect(await calendarRepository.readCount == 0)

        await repository.completeRequests(1, requests: [])
        try await calendarRepository.waitForReadCount(2)
        #expect(await calendarRepository.readEnvironments == [.production, .production])
    }

    @Test func currentCallerCancellationDoesNotOrphanInheritedCalendarHydration() async throws {
        let member = shiftMember(id: "member_calendar_cancellation", displayName: "Carmen")
        let repository = ControlledShiftsFeedRepository(pairCount: 2)
        let calendarRepository = CountingDeliveryCalendarRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository,
            deliveryCalendarRepository: calendarRepository
        )

        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        try await repository.waitUntilPairStarts(0)
        let successor = Task { await viewModel.refreshShifts() }
        try await repository.waitUntilPairStarts(1)
        successor.cancel()

        await repository.completePair(0, shifts: [], requests: [])
        try await repository.waitUntilPairResolves(0)
        #expect(await calendarRepository.readCount == 0)

        await repository.completePair(1, shifts: [], requests: [])
        await successor.value
        try await calendarRepository.waitForReadCount(2)
        #expect(await calendarRepository.readCount == 2)
        #expect(viewModel.pendingInitialCalendarHydration == nil)
    }

    @Test func terminalFeedFailureStillPrecedesInitialCalendarHydration() async throws {
        let member = shiftMember(id: "member_calendar_failure", displayName: "Carmen")
        let repository = ControlledShiftsFeedRepository(pairCount: 2)
        let calendarRepository = CountingDeliveryCalendarRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository,
            deliveryCalendarRepository: calendarRepository,
            shiftsRetrySleeper: { _ in }
        )

        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        try await repository.waitUntilPairStarts(0)
        await repository.failShifts(0)
        await repository.completeRequests(0, requests: [])
        try await repository.waitUntilPairStarts(1)
        #expect(await calendarRepository.readCount == 0)

        await repository.failShifts(1)
        await repository.completeRequests(1, requests: [])
        try await calendarRepository.waitForReadCount(2)
        #expect(repository.readCounts() == (shifts: 2, swaps: 2))
        #expect(await calendarRepository.readCount == 2)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }
}
