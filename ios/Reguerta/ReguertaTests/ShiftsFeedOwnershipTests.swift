import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftsFeedOwnershipTests {
    @Test func authorizedRootRouteEntryStartsOwnedFeedWithoutRetainingReplacedRoot() async throws {
        let member = shiftMember(id: "member_root_entry", displayName: "Carmen")
        let sessionViewModel = SessionViewModel(dependencies: .preview())
        sessionViewModel.mode = .authorized(authorizedShiftsSession(member: member))
        let repository = ControlledShiftsFeedRepository(pairCount: 1)
        var rootViewModel: AccessRootViewModel? = makeShiftsOwnershipRootViewModel(
            sessionViewModel: sessionViewModel,
            repository: repository
        )
        let weakRootViewModel = WeakShiftsOwnershipReference(rootViewModel)

        #expect(rootViewModel?.shiftsViewModel.currentMember == member)
        rootViewModel?.handleHomeDrawerNavigation(.shifts)
        try await repository.waitUntilPairStarts(0)

        #expect(rootViewModel?.shiftsViewModel.shiftsRefreshTask != nil)
        rootViewModel = nil
        #expect(weakRootViewModel.value == nil)

        await repository.completePair(0, shifts: [], requests: [])
        try await repository.waitUntilPairResolves(0)
    }

    @Test func callerCancellationCancelsTheExactOwnedFeedRead() async throws {
        let member = shiftMember(id: "member_caller_cancel", displayName: "Carmen")
        let repository = ControlledShiftsFeedRepository(pairCount: 1)
        let staleShift = shift(id: "stale", type: .market, dateMillis: 10, assignedUserIds: [member.id])
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository
        )

        let refresh = Task { await viewModel.refreshShifts() }
        try await repository.waitUntilPairStarts(0)
        refresh.cancel()

        #expect(repository.wasShiftReadCancelled(0))
        #expect(repository.wasSwapReadCancelled(0))

        await repository.completePair(0, shifts: [staleShift], requests: [])
        await refresh.value

        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.shiftsRefreshTask == nil)
        #expect(viewModel.activeShiftsRefreshOperationId == nil)
        #expect(viewModel.isLoadingShifts == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func signOutCancelsOwnedFeedReadEvenWhenRepositoryDoesNotCooperate() async throws {
        let member = shiftMember(id: "member_sign_out", displayName: "Carmen")
        let repository = ControlledShiftsFeedRepository(pairCount: 1)
        let staleShift = shift(id: "stale", type: .market, dateMillis: 10, assignedUserIds: [member.id])
        let staleRequest = ownershipSwapRequest(id: "stale_request", shift: staleShift, member: member)
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository
        )

        let refresh = Task { await viewModel.refreshShifts() }
        try await repository.waitUntilPairStarts(0)
        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)
        await repository.completePair(0, shifts: [staleShift], requests: [staleRequest])
        await refresh.value

        #expect(repository.wasShiftReadCancelled(0))
        #expect(repository.wasSwapReadCancelled(0))
        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.shiftSwapRequests.isEmpty)
        #expect(viewModel.nextDeliveryShift == nil)
        #expect(viewModel.nextMarketShift == nil)
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(viewModel.isLoadingShifts == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test(arguments: ShiftsAuthorizationDrift.allCases)
    func authorizationBoundaryCancelsBothFeedReadsAndRejectsLateCompletion(
        _ drift: ShiftsAuthorizationDrift
    ) async throws {
        let scenario = shiftsAuthorizationScenario(for: drift)
        let member = scenario.initial.member
        let repository = ControlledShiftsFeedRepository(pairCount: 2)
        let staleShift = shift(id: "stale", type: .market, dateMillis: 10, assignedUserIds: [member.id])
        let viewModel = makeShiftsViewModel(
            session: scenario.initial,
            shiftRepository: repository,
            shiftSwapRequestRepository: repository,
            environmentProvider: { scenario.environment.value }
        )
        seedAuthorizationBoundaryState(in: viewModel, shift: staleShift)

        let staleRefresh = Task { await viewModel.refreshShifts() }
        try await repository.waitUntilPairStarts(0)
        scenario.environment.value = scenario.successor.environment
        viewModel.sessionViewModel.mode = .authorized(scenario.successor)
        viewModel.handleSessionModeChange(.authorized(scenario.successor))

        #expect(repository.wasShiftReadCancelled(0))
        #expect(repository.wasSwapReadCancelled(0))
        #expect(viewModel.shiftSwapDraft.shiftId.isEmpty)
        #expect(viewModel.selectedShiftSegment == .delivery)
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(viewModel.dismissedShiftSwapRequestIds.isEmpty)
        #expect(viewModel.activeSwapSaveOperationId == nil)
        #expect(viewModel.isSavingShiftSwapRequest == false)
        #expect(viewModel.activePlanningSubmissionOperationId == nil)
        #expect(viewModel.isSubmittingShiftPlanningRequest == false)
        try await repository.waitUntilPairStarts(1)

        guard let successorRefresh = viewModel.shiftsRefreshTask else {
            Issue.record("Expected the successor authorization to own the feed")
            return
        }
        await repository.completePair(1, shifts: [], requests: [])
        _ = await successorRefresh.value
        if drift == .principalAuthentication {
            await repository.failShifts(0)
            await repository.completeRequests(0, requests: [])
        } else {
            await repository.completePair(0, shifts: [staleShift], requests: [])
        }
        await staleRefresh.value

        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.shiftSwapRequests.isEmpty)
        #expect(viewModel.isLoadingShifts == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func reentryCancelsStaleReadAndLatestAtomicPairOwnsPublicationAndCleanup() async throws {
        let member = shiftMember(id: "member_reentry", displayName: "Carmen")
        let repository = ControlledShiftsFeedRepository(pairCount: 2)
        let baselineShift = shift(id: "baseline", type: .market, dateMillis: 5, assignedUserIds: [member.id])
        let staleShift = shift(id: "stale", type: .market, dateMillis: 10, assignedUserIds: [member.id])
        let currentShift = shift(id: "current", type: .market, dateMillis: 20, assignedUserIds: [member.id])
        let baselineRequest = ownershipSwapRequest(id: "baseline_request", shift: baselineShift, member: member)
        let staleRequest = ownershipSwapRequest(id: "stale_request", shift: staleShift, member: member)
        let currentRequest = ownershipSwapRequest(id: "current_request", shift: currentShift, member: member)
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository
        )
        viewModel.shiftsFeed = [baselineShift]
        viewModel.shiftSwapRequests = [baselineRequest]
        viewModel.shiftSwapAcknowledgements[staleRequest.id] = .create(requestedShiftId: staleShift.id)

        let staleRefresh = Task { await viewModel.refreshShifts() }
        try await repository.waitUntilPairStarts(0)
        let currentRefresh = Task { await viewModel.refreshShifts() }
        try await repository.waitUntilPairStarts(1)
        let currentOperationId = viewModel.activeShiftsRefreshOperationId

        await repository.completeShifts(1, shifts: [currentShift])
        try await repository.waitUntilShiftReadResolves(1)
        #expect(viewModel.shiftsFeed == [baselineShift])
        #expect(viewModel.shiftSwapRequests == [baselineRequest])
        #expect(viewModel.isLoadingShifts)

        await repository.completePair(0, shifts: [staleShift], requests: [staleRequest])
        await staleRefresh.value
        #expect(repository.wasShiftReadCancelled(0))
        #expect(repository.wasSwapReadCancelled(0))
        #expect(viewModel.shiftsRefreshTask != nil)
        #expect(viewModel.activeShiftsRefreshOperationId == currentOperationId)
        #expect(viewModel.isLoadingShifts)
        #expect(viewModel.shiftsFeed == [baselineShift])
        #expect(viewModel.shiftSwapRequests == [baselineRequest])

        await repository.completeRequests(1, requests: [currentRequest])
        await currentRefresh.value
        #expect(viewModel.shiftsFeed == [currentShift])
        #expect(viewModel.shiftSwapRequests == [currentRequest])
        #expect(viewModel.nextMarketShift == currentShift)
        #expect(viewModel.shiftSwapAcknowledgements[staleRequest.id] != nil)
        #expect(viewModel.isLoadingShifts == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func roleCapabilityDriftResetsOnlyTheFeedBeforeStartingItsSuccessor() async throws {
        let member = shiftMember(id: "member_role_drift", displayName: "Carmen")
        let producer = replacingRoles(in: member, with: [.member, .producer])
        let repository = ControlledShiftsFeedRepository(pairCount: 2)
        let staleShift = shift(id: "stale", type: .market, dateMillis: 10, assignedUserIds: [member.id])
        let staleRequest = ownershipSwapRequest(id: "stale_request", shift: staleShift, member: member)
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository
        )
        seedRoleDriftState(in: viewModel, shift: staleShift, request: staleRequest)

        let staleRefresh = Task { await viewModel.refreshShifts() }
        try await repository.waitUntilPairStarts(0)
        let successorSession = authorizedShiftsSession(member: producer)
        viewModel.sessionViewModel.mode = .authorized(successorSession)
        viewModel.handleSessionModeChange(.authorized(successorSession))

        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.shiftSwapRequests.isEmpty)
        #expect(viewModel.shiftSwapAcknowledgements[staleRequest.id] != nil)
        #expect(viewModel.dismissedShiftSwapRequestIds.contains(staleRequest.id))
        #expect(viewModel.shiftSwapDraft.shiftId == staleShift.id)
        #expect(viewModel.activeSwapSaveOperationId == 41)
        #expect(viewModel.isSavingShiftSwapRequest)
        #expect(viewModel.activePlanningSubmissionOperationId == 42)
        #expect(viewModel.isSubmittingShiftPlanningRequest)
        #expect(viewModel.isLoadingShifts)

        try await repository.waitUntilPairStarts(1)
        guard let successorRefresh = viewModel.shiftsRefreshTask else {
            Issue.record("Expected the role successor to own a feed refresh")
            return
        }
        await repository.completePair(1, shifts: [], requests: [])
        _ = await successorRefresh.value
        await repository.completePair(0, shifts: [staleShift], requests: [staleRequest])
        await staleRefresh.value

        #expect(repository.wasShiftReadCancelled(0))
        #expect(repository.wasSwapReadCancelled(0))
        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.shiftSwapRequests.isEmpty)
        #expect(viewModel.shiftSwapAcknowledgements[staleRequest.id] != nil)
        #expect(viewModel.dismissedShiftSwapRequestIds.contains(staleRequest.id))
        #expect(viewModel.activeSwapSaveOperationId == 41)
        #expect(viewModel.activePlanningSubmissionOperationId == 42)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func successorCancelsTheOwnedInitialRetryBeforeStartingItsRead() async throws {
        let member = shiftMember(id: "member_retry", displayName: "Carmen")
        let repository = ControlledShiftsFeedRepository(pairCount: 2)
        let retrySleeper = ControlledShiftsRetrySleeper()
        let currentShift = shift(id: "current", type: .market, dateMillis: 20, assignedUserIds: [member.id])
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            shiftSwapRequestRepository: repository,
            shiftsRetrySleeper: { duration in try await retrySleeper.sleep(for: duration) }
        )

        let staleRefresh = Task { await viewModel.refreshShifts(recoversInitialFailure: true) }
        try await repository.waitUntilPairStarts(0)
        await repository.failShifts(0)
        await repository.completeRequests(0, requests: [])
        try await retrySleeper.waitUntilStarted()

        viewModel.requestShiftsRefresh()
        try await retrySleeper.waitUntilCancelled()
        try await repository.waitUntilPairStarts(1)

        guard let successorRefresh = viewModel.shiftsRefreshTask else {
            Issue.record("Expected the retry successor to own the feed")
            return
        }
        await repository.completePair(1, shifts: [currentShift], requests: [])
        _ = await successorRefresh.value
        await staleRefresh.value

        #expect(viewModel.shiftsFeed == [currentShift])
        #expect(viewModel.nextMarketShift == currentShift)
        #expect(viewModel.shiftsRefreshTask == nil)
        #expect(viewModel.isLoadingShifts == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

}
