import Testing

@testable import Reguerta

@MainActor
private func startWeaklyOwnedPublicMutation(
    _ kind: ControlledShiftSwapMutationKind,
    viewModel: ShiftsFeatureViewModel?,
    member: Member,
    suffix: String
) throws -> Task<Bool, Never> {
    let viewModel = try #require(viewModel)
    seedControlledPublicMutationState(kind, viewModel: viewModel, member: member, suffix: suffix)
    return try #require(
        startControlledPublicMutation(kind, viewModel: viewModel, member: member, suffix: suffix)
    )
}

@MainActor
private func completeControlledDecoyReadBack(
    _ kind: ControlledShiftSwapMutationKind,
    fixture: ControlledShiftSwapMutationFixture,
    shiftRepository: ControlledShiftsFeedRepository,
    repository: ControlledShiftSwapMutationRepository,
    suffix: String
) async {
    let sameKeyUnreflected = controlledUnreflectedShiftSwapRequest(
        kind,
        member: fixture.member,
        suffix: suffix
    )
    let wrongKeyDecoy = controlledWrongKeyShiftSwapRequest(
        kind,
        member: fixture.member,
        suffix: suffix
    )
    await shiftRepository.completeShifts(0, shifts: [])
    await repository.completeSwapRead(0, with: .success([sameKeyUnreflected, wrongKeyDecoy]))
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationLifecycleTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func publicMutationEntrypointDoesNotRetainTheViewModel(_ kind: ControlledShiftSwapMutationKind) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let member = shiftMember(id: "member_weak_owner", displayName: "Carmen")
        var viewModel: ShiftsFeatureViewModel? = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftSwapRequestRepository: repository
        )
        let suffix = "_weak_owner"
        let mutationTask = try startWeaklyOwnedPublicMutation(
            kind,
            viewModel: viewModel,
            member: member,
            suffix: suffix
        )
        try await repository.waitUntilTransitionStarts()
        let weakViewModel = WeakShiftsOwnershipReference(viewModel)

        viewModel = nil

        #expect(weakViewModel.value == nil)
        #expect(repository.wasTransitionCancelled())
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )
        #expect(await mutationTask.value == false)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func acknowledgementPrecedesReadBackAndTheFeedDoesNotHoldTheMutationLane(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let shiftRepository = ControlledShiftsFeedRepository(pairCount: 1)
        let repository = ControlledShiftSwapMutationRepository(operationCount: 2, readOperationCount: 1)
        let fixture = makeControlledShiftSwapMutationFixture(
            repository: repository,
            shiftRepository: shiftRepository
        )
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: "_readback")
        let mutationTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts(0)
        await repository.completeTransition(
            0,
            with: .success(controlledShiftSwapResult(kind, suffix: "_readback"))
        )
        #expect(await mutationTask.value)
        try await shiftRepository.waitUntilShiftReadStarts()
        try await repository.waitUntilSwapReadStarts()
        let refreshTask = try #require(fixture.viewModel.shiftsRefreshTask)

        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId("_readback")] ==
                expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: "_readback")
        )
        #expect(fixture.viewModel.isLoadingShifts)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)

        let successorIntent = controlledShiftSwapIntent(.cancel, member: fixture.member, suffix: "_while_reading")
        let successorTask = try #require(
            fixture.viewModel.startShiftSwapMutation(successorIntent, context: context)
        )
        try await repository.waitUntilTransitionStarts(1)
        await repository.completeTransition(
            1,
            with: .failure(.conflict(code: "definitive_test_rejection"))
        )
        #expect(await successorTask.value == false)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)

        let reflectedRequest = controlledReflectedShiftSwapRequest(kind, member: fixture.member, suffix: "_readback")
        await shiftRepository.completeShifts(0, shifts: [])
        await repository.completeSwapRead(with: .success([reflectedRequest]))
        await refreshTask.value

        #expect(fixture.viewModel.shiftSwapRequests == [reflectedRequest])
        #expect(fixture.viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(fixture.viewModel.isLoadingShifts == false)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func failedReadBackKeepsAcknowledgementAndBlocksAmbiguousResubmission(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let shiftRepository = ControlledShiftsFeedRepository(pairCount: 1)
        let repository = ControlledShiftSwapMutationRepository(readOperationCount: 1)
        let fixture = makeControlledShiftSwapMutationFixture(
            repository: repository,
            shiftRepository: shiftRepository
        )
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: "_read_failure")
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: "_read_failure")
        let mutationTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts()
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: "_read_failure"))
        )
        #expect(await mutationTask.value)
        try await shiftRepository.waitUntilShiftReadStarts()
        try await repository.waitUntilSwapReadStarts()
        let refreshTask = try #require(fixture.viewModel.shiftsRefreshTask)

        await shiftRepository.failShifts(0)
        await repository.completeSwapRead(with: .success([]))
        await refreshTask.value

        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId("_read_failure")] ==
                expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: "_read_failure")
        )
        #expect(startControlledPublicMutation(kind, fixture: fixture, suffix: "_read_failure") == nil)
        #expect(repository.records().count == 1)
        #expect(fixture.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func ambiguousFailureBlocksSameKeyRetryAndOnlyExactKeyedStateReconciles(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let shiftRepository = ControlledShiftsFeedRepository(pairCount: 2)
        let repository = ControlledShiftSwapMutationRepository(readOperationCount: 2)
        let fixture = makeControlledShiftSwapMutationFixture(
            repository: repository,
            shiftRepository: shiftRepository
        )
        let suffix = "_ambiguous"
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        let mutationTask = try #require(fixture.viewModel.startShiftSwapMutation(intent, context: context))
        try await repository.waitUntilTransitionStarts()

        await repository.completeTransition(with: .failure(.unavailable))
        #expect(await mutationTask.value == false)
        try await shiftRepository.waitUntilShiftReadStarts(0)
        try await repository.waitUntilSwapReadStarts(0)
        let decoyRefreshTask = try #require(fixture.viewModel.shiftsRefreshTask)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        #expect(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix) == nil)

        await completeControlledDecoyReadBack(
            kind,
            fixture: fixture,
            shiftRepository: shiftRepository,
            repository: repository,
            suffix: suffix
        )
        await decoyRefreshTask.value
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        #expect(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix) == nil)

        fixture.viewModel.requestShiftsRefresh()
        try await shiftRepository.waitUntilShiftReadStarts(1)
        try await repository.waitUntilSwapReadStarts(1)
        let reflectedRefreshTask = try #require(fixture.viewModel.shiftsRefreshTask)
        let reflectedRequest = controlledReflectedShiftSwapRequest(kind, member: fixture.member, suffix: suffix)
        await shiftRepository.completeShifts(1, shifts: [])
        await repository.completeSwapRead(1, with: .success([reflectedRequest]))
        await reflectedRefreshTask.value

        if kind == .create {
            #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        } else {
            #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] == nil)
        }
        #expect(fixture.viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(fixture.viewModel.shiftSwapRequests == [reflectedRequest])
        #expect(repository.records().map(\.kind) == [kind])
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func definitiveFailureReleasesTheLaneForExplicitRetry(_ kind: ControlledShiftSwapMutationKind) async throws {
        let repository = ControlledShiftSwapMutationRepository(operationCount: 2)
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: "_retry")
        let firstTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts(0)
        await repository.completeTransition(0, with: .failure(.conflict(code: "definitive_test_rejection")))
        #expect(await firstTask.value == false)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] == nil)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)

        fixture.viewModel.feedbackCenter.clear()
        let retryTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts(1)
        await repository.completeTransition(
            1,
            with: .success(controlledShiftSwapResult(kind, suffix: "_retry"))
        )

        #expect(await retryTask.value)
        #expect(repository.records().map(\.kind) == [kind, kind])
        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId("_retry")] ==
                expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: "_retry")
        )
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }
}
