import Testing

@testable import Reguerta

@MainActor
private func startDistinctScopePublicMutation(
    _ kind: ControlledShiftSwapMutationKind,
    viewModel: ShiftsFeatureViewModel,
    member: Member,
    suffix: String
) throws -> Task<Bool, Never> {
    seedControlledPublicMutationState(kind, viewModel: viewModel, member: member, suffix: suffix)
    return try #require(
        startControlledPublicMutation(kind, viewModel: viewModel, member: member, suffix: suffix)
    )
}

@MainActor
private func expectDistinctScopeMutationLaneIsAvailable(
    _ kind: ControlledShiftSwapMutationKind,
    viewModel: ShiftsFeatureViewModel,
    suffix: String
) {
    #expect(viewModel.authorizedSessionContext != nil)
    #expect(
        viewModel.handledShiftSwapAuthorizationBoundaryRevision ==
            viewModel.sessionViewModel.shiftSwapAuthorizationBoundaryRevision
    )
    expectControlledShiftSwapOwnerIsReleased(viewModel)
    #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: suffix))
}

@MainActor
private func handleDistinctScopeBoundaryUntilStable(
    _ order: ControlledShiftSwapHandlerOrder,
    rootViewModel: AccessRootViewModel,
    from initialMode: SessionMode,
    to successorMode: SessionMode
) {
    order.handle(rootViewModel: rootViewModel, from: initialMode, to: successorMode)
    let stabilizedMode = rootViewModel.sessionViewModel.mode
    guard stabilizedMode != successorMode else { return }

    #expect(rootViewModel.shiftsViewModel.authorizedSessionContext == nil)
    order.handle(rootViewModel: rootViewModel, from: successorMode, to: stabilizedMode)
}

struct ControlledShiftSwapDistinctScopeRaceScenario {
    let kind: ControlledShiftSwapMutationKind
    let drift: ControlledShiftSwapDistinctScopeDrift

    static let cases = ControlledShiftSwapMutationKind.allCases.flatMap { kind in
        ControlledShiftSwapDistinctScopeDrift.allCases.map { drift in
            Self(kind: kind, drift: drift)
        }
    }
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationDistinctScopeRaceTests {
    @Test(
        arguments: ControlledShiftSwapDistinctScopeRaceScenario.cases,
        ControlledShiftSwapHandlerOrder.allCases
    )
    func resolvedSuccessBeforeHandlersDropsDistinctScopeUncertainty(
        _ raceScenario: ControlledShiftSwapDistinctScopeRaceScenario,
        _ order: ControlledShiftSwapHandlerOrder
    ) async throws {
        let kind = raceScenario.kind
        let scenario = shiftsAuthorizationScenario(for: raceScenario.drift.authorizationDrift)
        let shiftRepository = ControlledShiftsFeedRepository(pairCount: 1)
        let repository = ControlledShiftSwapMutationRepository(readOperationCount: 1)
        let rootViewModel = makeShiftSwapOwnershipRootViewModel(
            member: scenario.initial.member,
            session: scenario.initial,
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: repository,
            environmentProvider: { scenario.environment.value }
        )
        let viewModel = rootViewModel.shiftsViewModel
        let initialMode = SessionMode.authorized(scenario.initial)
        let successorMode = SessionMode.authorized(scenario.successor)
        let suffix = "_distinct_scope_completion_race"
        let mutationTask = try startDistinctScopePublicMutation(
            kind,
            viewModel: viewModel,
            member: scenario.initial.member,
            suffix: suffix
        )
        try await repository.waitUntilTransitionStarts()
        let operationId = try #require(viewModel.activeShiftSwapMutationOperationId)

        scenario.environment.value = scenario.successor.environment
        viewModel.sessionViewModel.mode = successorMode
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )
        #expect(await mutationTask.value == false)
        #expect(viewModel.pendingShiftSwapAuthorizationBoundaryReceipt?.operationId == operationId)

        handleDistinctScopeBoundaryUntilStable(
            order,
            rootViewModel: rootViewModel,
            from: initialMode,
            to: successorMode
        )
        #expect(repository.wasTransitionCancelled() == false)
        #expect(viewModel.currentSession == viewModel.authorizedSession)
        #expect(viewModel.uncertainShiftSwapMutationIntents.isEmpty)
        #expect(viewModel.pendingShiftSwapAuthorizationBoundaryReceipt == nil)
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        expectControlledShiftSwapOwnerIsReleased(viewModel)

        let refreshTask = try #require(viewModel.shiftsRefreshTask)
        try await shiftRepository.waitUntilShiftReadStarts()
        try await repository.waitUntilSwapReadStarts()
        await shiftRepository.completeShifts(0, shifts: [])
        await repository.completeSwapRead(with: .success([]))
        await refreshTask.value

        expectDistinctScopeMutationLaneIsAvailable(kind, viewModel: viewModel, suffix: suffix)
        #expect(repository.records().map(\.kind) == [kind])
    }
}
