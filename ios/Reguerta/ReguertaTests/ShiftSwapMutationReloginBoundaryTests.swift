import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationReloginBoundaryTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ControlledShiftSwapLateCompletion.allCases)
    func staleCompletionCannotReleaseReloggedSuccessor(
        _ staleKind: ControlledShiftSwapMutationKind,
        _ staleCompletion: ControlledShiftSwapLateCompletion
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository(operationCount: 2)
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let staleContext = try #require(fixture.viewModel.authorizedSessionContext)
        let staleIntent = controlledShiftSwapIntent(staleKind, member: fixture.member, suffix: "_stale")
        let staleTask = try #require(
            fixture.viewModel.startShiftSwapMutation(staleIntent, context: staleContext)
        )
        try await repository.waitUntilTransitionStarts(0)

        fixture.viewModel.sessionViewModel.mode = .signedOut
        fixture.viewModel.handleSessionModeChange(.signedOut)
        let reloggedSession = authorizedShiftsSession(member: fixture.member)
        fixture.viewModel.sessionViewModel.mode = .authorized(reloggedSession)
        fixture.viewModel.handleSessionModeChange(.authorized(reloggedSession))
        let successorContext = try #require(fixture.viewModel.authorizedSessionContext)
        let successorIntent = controlledShiftSwapIntent(.cancel, member: fixture.member, suffix: "_successor")
        let successorTask = try #require(
            fixture.viewModel.startShiftSwapMutation(successorIntent, context: successorContext)
        )
        try await repository.waitUntilTransitionStarts(1)
        let successorOperationId = fixture.viewModel.activeShiftSwapMutationOperationId

        await repository.completeTransition(
            0,
            with: controlledLateOutcome(staleCompletion, kind: staleKind, suffix: "_stale")
        )
        #expect(await staleTask.value == false)
        #expect(fixture.viewModel.activeShiftSwapMutationOperationId == successorOperationId)
        #expect(fixture.viewModel.isUpdatingShiftSwapRequest)
        #expect(fixture.viewModel.shiftSwapMutationTask != nil)
        #expect(fixture.viewModel.feedbackCenter.messageKey == nil)
        #expect(repository.wasTransitionCancelled(1) == false)

        await repository.completeTransition(
            1,
            with: .success(controlledShiftSwapResult(.cancel, suffix: "_successor"))
        )
        #expect(await successorTask.value)
        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId("_successor")] == .cancel
        )
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }
}
