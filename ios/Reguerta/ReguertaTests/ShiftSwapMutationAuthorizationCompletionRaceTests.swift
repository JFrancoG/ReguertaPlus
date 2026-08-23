import Testing

@testable import Reguerta

struct ControlledShiftSwapCompletionRaceScenario {
    let kind: ControlledShiftSwapMutationKind
    let drift: ControlledShiftSwapAdminAccessDrift

    static let cases = ControlledShiftSwapMutationKind.allCases.flatMap { kind in
        ControlledShiftSwapAdminAccessDrift.allCases.map { drift in
            Self(kind: kind, drift: drift)
        }
    }
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationCompletionRaceTests {
    @Test(
        arguments: ControlledShiftSwapCompletionRaceScenario.cases,
        ControlledShiftSwapHandlerOrder.allCases
    )
    func resolvedSuccessBeforeHandlersPreservesSameScopeUncertainty(
        _ scenario: ControlledShiftSwapCompletionRaceScenario,
        _ order: ControlledShiftSwapHandlerOrder
    ) async throws {
        let kind = scenario.kind
        let drift = scenario.drift
        let shiftRepository = ControlledShiftsFeedRepository(pairCount: 1)
        let repository = ControlledShiftSwapMutationRepository(readOperationCount: 1)
        let member = replacingRoles(
            in: shiftMember(id: "member_same_scope_race", displayName: "Carmen"),
            with: drift.initialRoles
        )
        let rootViewModel = makeShiftSwapOwnershipRootViewModel(
            member: member,
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: repository
        )
        let viewModel = rootViewModel.shiftsViewModel
        let initialSession = try #require(viewModel.currentSession)
        let successor = controlledAdminAccessSuccessor(from: initialSession, drift: drift)
        let initialMode = SessionMode.authorized(initialSession)
        let successorMode = SessionMode.authorized(successor)
        let suffix = "_same_scope_completion_race"
        let intent = controlledShiftSwapIntent(kind, member: member, suffix: suffix)
        seedControlledPublicMutationState(kind, viewModel: viewModel, member: member, suffix: suffix)
        let mutationTask = try #require(
            startControlledPublicMutation(kind, viewModel: viewModel, member: member, suffix: suffix)
        )
        try await repository.waitUntilTransitionStarts()
        let operationId = try #require(viewModel.activeShiftSwapMutationOperationId)

        viewModel.sessionViewModel.mode = successorMode
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )
        #expect(await mutationTask.value == false)
        #expect(viewModel.pendingShiftSwapAuthorizationBoundaryReceipt?.operationId == operationId)

        order.handle(rootViewModel: rootViewModel, from: initialMode, to: successorMode)
        #expect(repository.wasTransitionCancelled() == false)
        #expect(viewModel.currentSession == successor)
        #expect(viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey]?.operationId == operationId)
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        expectControlledShiftSwapOwnerIsReleased(viewModel)

        try await shiftRepository.waitUntilShiftReadStarts()
        try await repository.waitUntilSwapReadStarts()
        let refreshTask = try #require(viewModel.shiftsRefreshTask)
        await shiftRepository.completeShifts(0, shifts: [])
        await repository.completeSwapRead(with: .success([]))
        await refreshTask.value

        #expect(viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey]?.operationId == operationId)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: suffix) == false)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: "_other_scope_key"))
        #expect(repository.records().map(\.kind) == [kind])
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func staleDefinitiveFailureCannotRemoveHomonymousSuccessorUncertainty(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let member = shiftMember(id: "member_uncertainty_provenance", displayName: "Carmen")
        let rootViewModel = makeShiftSwapOwnershipRootViewModel(
            member: member,
            shiftSwapRequestRepository: repository
        )
        let viewModel = rootViewModel.shiftsViewModel
        let initialSession = try #require(viewModel.currentSession)
        let initialMode = SessionMode.authorized(initialSession)
        let successor = controlledAdminAccessSuccessor(from: initialSession, drift: .grantAdmin)
        let suffix = "_uncertainty_provenance"
        let intent = controlledShiftSwapIntent(kind, member: member, suffix: suffix)
        seedControlledPublicMutationState(kind, viewModel: viewModel, member: member, suffix: suffix)
        let mutationTask = try #require(
            startControlledPublicMutation(kind, viewModel: viewModel, member: member, suffix: suffix)
        )
        try await repository.waitUntilTransitionStarts()
        let staleOperationId = try #require(viewModel.activeShiftSwapMutationOperationId)

        viewModel.sessionViewModel.mode = .authorized(successor)
        rootViewModel.handleShiftSwapAuthorizationBoundaryChange()
        #expect(repository.wasTransitionCancelled())
        #expect(
            viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey]?.operationId ==
                staleOperationId
        )
        let successorOperationId = staleOperationId &+ 100
        viewModel.recordUncertainShiftSwapMutation(intent, operationId: successorOperationId)

        await repository.completeTransition(
            with: .failure(.conflict(code: "definitive_stale_owner"))
        )

        #expect(await mutationTask.value == false)
        #expect(
            viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey]?.operationId ==
                successorOperationId
        )
        #expect(viewModel.pendingShiftSwapAuthorizationBoundaryReceipt == nil)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: suffix) == false)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: "_successor_key") == false)

        rootViewModel.handleSessionModeChange(from: initialMode, to: .authorized(successor))

        #expect(
            viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey]?.operationId ==
                successorOperationId
        )
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: "_successor_key"))
        #expect(repository.records().map(\.kind) == [kind])
        expectControlledShiftSwapOwnerIsReleased(viewModel)
    }
}
