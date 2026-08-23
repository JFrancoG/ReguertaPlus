import Testing

@testable import Reguerta

@MainActor
private func controlledRoleSuccessor(
    for drift: ControlledShiftSwapRoleDrift,
    in viewModel: ShiftsFeatureViewModel,
    member: Member
) throws -> AuthorizedSession {
    let successorMember = replacingRoles(in: member, with: drift.successorRoles)
    var successor = try #require(viewModel.currentSession)
    successor.authenticatedMember = successorMember
    successor.member = successorMember
    successor.members = [successorMember]
    return successor
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationAuthorizationRaceTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ControlledShiftSwapRoleDrift.allCases)
    func unhandledRoleDriftPreservesKnownSuccessUntilTheSessionHandler(
        _ kind: ControlledShiftSwapMutationKind,
        _ drift: ControlledShiftSwapRoleDrift
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(
            repository: repository,
            memberRoles: drift.initialRoles
        )
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let suffix = "_unhandled_role_success"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        let mutationTask = try #require(fixture.viewModel.startShiftSwapMutation(intent, context: context))
        try await repository.waitUntilTransitionStarts()

        let successor = try controlledRoleSuccessor(for: drift, in: fixture.viewModel, member: fixture.member)
        fixture.viewModel.sessionViewModel.mode = .authorized(successor)
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )

        #expect(await mutationTask.value)
        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId(suffix)] ==
                expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: suffix)
        )
        #expect(fixture.viewModel.shiftsRefreshTask == nil)

        fixture.viewModel.handleSessionModeChange(.authorized(successor))
        await fixture.viewModel.shiftsRefreshTask?.value
        #expect(fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId(suffix)] != nil)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ControlledShiftSwapRoleDrift.allCases)
    func unhandledRoleDriftPreservesAmbiguousQuarantineUntilTheSessionHandler(
        _ kind: ControlledShiftSwapMutationKind,
        _ drift: ControlledShiftSwapRoleDrift
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(
            repository: repository,
            memberRoles: drift.initialRoles
        )
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let suffix = "_unhandled_role_ambiguity"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        let mutationTask = try #require(fixture.viewModel.startShiftSwapMutation(intent, context: context))
        try await repository.waitUntilTransitionStarts()

        let successor = try controlledRoleSuccessor(for: drift, in: fixture.viewModel, member: fixture.member)
        fixture.viewModel.sessionViewModel.mode = .authorized(successor)
        await repository.completeTransition(with: .failure(.unavailable))

        #expect(await mutationTask.value == false)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        #expect(fixture.viewModel.startShiftSwapMutation(intent, context: context) == nil)
        #expect(fixture.viewModel.shiftsRefreshTask == nil)

        fixture.viewModel.handleSessionModeChange(.authorized(successor))
        await fixture.viewModel.shiftsRefreshTask?.value
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
    }
}
