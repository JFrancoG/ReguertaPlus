import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationReadBackTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func successfulButUnreflectedReadBackKeepsAcknowledgementAndBlocksRetry(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let shiftRepository = ControlledShiftsFeedRepository(pairCount: 2)
        let repository = ControlledShiftSwapMutationRepository(readOperationCount: 2)
        let fixture = makeControlledShiftSwapMutationFixture(
            repository: repository,
            shiftRepository: shiftRepository
        )
        let suffix = "_successful_unreflected"
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        let mutationTask = try #require(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix))
        try await repository.waitUntilTransitionStarts()

        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )
        #expect(await mutationTask.value)
        try await shiftRepository.waitUntilShiftReadStarts(0)
        try await repository.waitUntilSwapReadStarts(0)
        let unreflectedRefreshTask = try #require(fixture.viewModel.shiftsRefreshTask)
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
        await unreflectedRefreshTask.value

        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId(suffix)] ==
                expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: suffix)
        )
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        #expect(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix) == nil)
        #expect(repository.records().map(\.kind) == [kind])

        fixture.viewModel.requestShiftsRefresh()
        try await shiftRepository.waitUntilShiftReadStarts(1)
        try await repository.waitUntilSwapReadStarts(1)
        let reflectedRefreshTask = try #require(fixture.viewModel.shiftsRefreshTask)
        let reflectedRequest = controlledReflectedShiftSwapRequest(kind, member: fixture.member, suffix: suffix)
        await shiftRepository.completeShifts(1, shifts: [])
        await repository.completeSwapRead(1, with: .success([reflectedRequest]))
        await reflectedRefreshTask.value

        #expect(fixture.viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(fixture.viewModel.shiftSwapRequests == [reflectedRequest])
        #expect(repository.records().map(\.kind) == [kind])
    }
}
