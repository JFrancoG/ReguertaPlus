import Testing

@testable import Reguerta

enum ControlledShiftSwapPreHandlerDrift: CaseIterable {
    case roleOnly
    case adminAccess

    @MainActor
    func successor(from initialSession: AuthorizedSession, member: Member) -> AuthorizedSession {
        switch self {
        case .roleOnly:
            controlledBenignABASuccessor(from: initialSession, member: member)
        case .adminAccess:
            controlledAdminAccessSuccessor(from: initialSession, drift: .grantAdmin)
        }
    }
}

private struct ControlledShiftSwapReceiptReadBack {
    let kind: ControlledShiftSwapMutationKind
    let member: Member
    let suffix: String
    let shiftRepository: ControlledShiftsFeedRepository
    let repository: ControlledShiftSwapMutationRepository

    @MainActor
    func complete(_ index: Int) async {
        let requestedShift = shift(
            id: controlledRequestedShiftId(suffix),
            type: .delivery,
            dateMillis: 10,
            assignedUserIds: [member.id]
        )
        let unreflectedRequest = controlledUnreflectedShiftSwapRequest(kind, member: member, suffix: suffix)
        await shiftRepository.completeShifts(index, shifts: [requestedShift])
        await repository.completeSwapRead(index, with: .success([unreflectedRequest]))
    }
}

@MainActor
private func startControlledAmbiguousMutation(
    _ kind: ControlledShiftSwapMutationKind,
    viewModel: ShiftsFeatureViewModel,
    member: Member,
    repository: ControlledShiftSwapMutationRepository,
    suffix: String
) async throws -> (intent: ShiftSwapMutationIntent, operationId: UInt64) {
    let intent = controlledShiftSwapIntent(kind, member: member, suffix: suffix)
    seedControlledPublicMutationState(kind, viewModel: viewModel, member: member, suffix: suffix)
    let mutationTask = try #require(
        startControlledPublicMutation(kind, viewModel: viewModel, member: member, suffix: suffix)
    )
    try await repository.waitUntilTransitionStarts()
    let operationId = try #require(viewModel.activeShiftSwapMutationOperationId)
    await repository.completeTransition(with: .failure(.unavailable))
    #expect(await mutationTask.value == false)
    return (intent, operationId)
}

@MainActor
private func completeEmptyReceiptReadBack(
    _ index: Int,
    viewModel: ShiftsFeatureViewModel,
    shiftRepository: ControlledShiftsFeedRepository,
    repository: ControlledShiftSwapMutationRepository
) async throws {
    try await shiftRepository.waitUntilShiftReadStarts(index)
    try await repository.waitUntilSwapReadStarts(index)
    let refreshTask = try #require(viewModel.shiftsRefreshTask)
    await shiftRepository.completeShifts(index, shifts: [])
    await repository.completeSwapRead(index, with: .success([]))
    await refreshTask.value
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationReceiptPreservationTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ControlledShiftSwapAdminAccessDrift.allCases)
    func confirmedAcknowledgementSurvivesSameResourceBoundaryAndUnreflectedReadBack(
        _ kind: ControlledShiftSwapMutationKind,
        _ drift: ControlledShiftSwapAdminAccessDrift
    ) async throws {
        let shiftRepository = ControlledShiftsFeedRepository(pairCount: 2)
        let repository = ControlledShiftSwapMutationRepository(readOperationCount: 2)
        let fixture = makeControlledShiftSwapMutationFixture(
            repository: repository,
            shiftRepository: shiftRepository,
            memberRoles: drift.initialRoles
        )
        let viewModel = fixture.viewModel
        let initialSession = try #require(viewModel.currentSession)
        let suffix = "_ack_boundary"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        let context = try #require(viewModel.authorizedSessionContext)
        let mutationTask = try #require(viewModel.startShiftSwapMutation(intent, context: context))
        try await repository.waitUntilTransitionStarts()
        await repository.completeTransition(with: .success(controlledShiftSwapResult(kind, suffix: suffix)))
        #expect(await mutationTask.value)
        try await shiftRepository.waitUntilShiftReadStarts(0)
        try await repository.waitUntilSwapReadStarts(0)
        let obsoleteRefreshTask = try #require(viewModel.shiftsRefreshTask)
        let requestId = controlledShiftSwapRequestId(suffix)
        let acknowledgement = expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: suffix)
        let readBack = ControlledShiftSwapReceiptReadBack(
            kind: kind,
            member: fixture.member,
            suffix: suffix,
            shiftRepository: shiftRepository,
            repository: repository
        )
        #expect(viewModel.shiftSwapAcknowledgements[requestId] == acknowledgement)

        let successor = controlledAdminAccessSuccessor(from: initialSession, drift: drift)
        viewModel.sessionViewModel.mode = .authorized(successor)
        viewModel.handleShiftSwapAuthorizationBoundaryChange()
        #expect(viewModel.shiftSwapAcknowledgements[requestId] == acknowledgement)
        viewModel.handleSessionModeChange(.authorized(successor))
        #expect(viewModel.shiftSwapAcknowledgements[requestId] == acknowledgement)
        try await shiftRepository.waitUntilShiftReadStarts(1)
        try await repository.waitUntilSwapReadStarts(1)
        let successorRefreshTask = try #require(viewModel.shiftsRefreshTask)
        #expect(shiftRepository.wasShiftReadCancelled(0))
        #expect(repository.wasSwapReadCancelled(0))

        await readBack.complete(0)
        await obsoleteRefreshTask.value
        #expect(viewModel.shiftSwapAcknowledgements[requestId] == acknowledgement)

        await readBack.complete(1)
        await successorRefreshTask.value

        #expect(viewModel.shiftSwapAcknowledgements[requestId] == acknowledgement)
        #expect(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix) == nil)
        #expect(repository.records().count == 1)
    }

    @Test(
        arguments: ControlledShiftSwapMutationKind.allCases,
        ControlledShiftSwapPreHandlerDrift.allCases
    )
    func preHandlerRefreshCannotEraseExistingSameScopeReceipt(
        _ kind: ControlledShiftSwapMutationKind,
        _ drift: ControlledShiftSwapPreHandlerDrift
    ) async throws {
        let shiftRepository = ControlledShiftsFeedRepository(pairCount: 2)
        let repository = ControlledShiftSwapMutationRepository(readOperationCount: 2)
        let member = shiftMember(id: "member_receipt_preservation", displayName: "Carmen")
        let rootViewModel = makeShiftSwapOwnershipRootViewModel(
            member: member,
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: repository
        )
        let viewModel = rootViewModel.shiftsViewModel
        let initialSession = try #require(viewModel.currentSession)
        let suffix = "_receipt_preservation"
        let mutation = try await startControlledAmbiguousMutation(
            kind,
            viewModel: viewModel,
            member: member,
            repository: repository,
            suffix: suffix
        )
        try await completeEmptyReceiptReadBack(
            0,
            viewModel: viewModel,
            shiftRepository: shiftRepository,
            repository: repository
        )

        let successor = drift.successor(from: initialSession, member: member)
        viewModel.sessionViewModel.mode = .authorized(successor)
        viewModel.requestShiftsRefresh()
        #expect(
            viewModel.uncertainShiftSwapMutationIntents[mutation.intent.uncertaintyKey]?.operationId ==
                mutation.operationId
        )
        #expect(shiftRepository.readCounts().shifts == 1)
        #expect(repository.swapReadCount() == 1)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: "_pre_handler_other") == false)

        rootViewModel.handleSessionModeChange(from: .authorized(initialSession), to: .authorized(successor))
        rootViewModel.handleShiftSwapAuthorizationBoundaryChange()
        try await completeEmptyReceiptReadBack(
            1,
            viewModel: viewModel,
            shiftRepository: shiftRepository,
            repository: repository
        )

        #expect(
            viewModel.uncertainShiftSwapMutationIntents[mutation.intent.uncertaintyKey]?.operationId ==
                mutation.operationId
        )
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: suffix) == false)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: "_post_handler_other"))
    }
}
