import Testing

@testable import Reguerta

enum ControlledShiftSwapRouteCompletion: CaseIterable {
    case success
    case failure
}

@MainActor
private func startControlledRouteMutation(
    _ kind: ControlledShiftSwapMutationKind,
    rootViewModel: AccessRootViewModel,
    viewModel: ShiftsFeatureViewModel,
    member: Member,
    suffix: String
) throws -> (navigation: Task<Void, Never>?, mutation: Task<Bool, Never>) {
    if kind == .create {
        viewModel.startCreatingShiftSwap(shiftId: controlledRequestedShiftId(suffix))
        guard let navigationTask = rootViewModel.startShiftSwapRequestSave() else {
            Issue.record("Expected the request route to start its accepted mutation")
            throw CancellationError()
        }
        return (
            navigationTask,
            try #require(viewModel.shiftSwapMutationTask)
        )
    }
    return (
        nil,
        try #require(startControlledPublicMutation(kind, viewModel: viewModel, member: member, suffix: suffix))
    )
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationRoutingTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ControlledShiftSwapRouteCompletion.allCases)
    func routeExitPreservesAcceptedMutationAndFencesItsCompletion(
        _ kind: ControlledShiftSwapMutationKind,
        _ completion: ControlledShiftSwapRouteCompletion
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let member = shiftMember(id: "member_route_exit", displayName: "Carmen")
        let rootViewModel = makeShiftSwapOwnershipRootViewModel(
            member: member,
            shiftSwapRequestRepository: repository
        )
        let viewModel = rootViewModel.shiftsViewModel
        let suffix = "_route_exit"
        seedControlledPublicMutationState(kind, viewModel: viewModel, member: member, suffix: suffix)
        rootViewModel.homeDestination = kind == .create ? .shiftSwapRequest : .shifts

        let tasks = try startControlledRouteMutation(
            kind,
            rootViewModel: rootViewModel,
            viewModel: viewModel,
            member: member,
            suffix: suffix
        )
        try await repository.waitUntilTransitionStarts()

        if kind == .create {
            rootViewModel.handleHomePrimaryAction()
            #expect(rootViewModel.homeDestination == .shifts)
        }
        rootViewModel.handleHomeDrawerNavigation(.settings)
        #expect(repository.wasTransitionCancelled() == false)
        switch completion {
        case .success:
            await repository.completeTransition(
                with: .success(controlledShiftSwapResult(kind, suffix: suffix))
            )
            #expect(await tasks.mutation.value)
        case .failure:
            await repository.completeTransition(
                with: .failure(.conflict(code: "definitive_route_failure"))
            )
            #expect(await tasks.mutation.value == false)
        }
        await tasks.navigation?.value

        #expect(rootViewModel.homeDestination == .settings)
        switch completion {
        case .success:
            #expect(
                viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId(suffix)] ==
                    expectedControlledShiftSwapAcknowledgement(kind, member: member, suffix: suffix)
            )
            #expect(viewModel.feedbackCenter.messageKey == nil)
        case .failure:
            #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
            #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackShiftSwapConflict)
        }
        expectControlledShiftSwapOwnerIsReleased(viewModel)
    }

    @Test
    func staleSaveCompletionCannotNavigateAReenteredRequestRoute() async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let member = shiftMember(id: "member_route_reentry", displayName: "Carmen")
        let rootViewModel = makeShiftSwapOwnershipRootViewModel(
            member: member,
            shiftSwapRequestRepository: repository
        )
        let viewModel = rootViewModel.shiftsViewModel
        let suffix = "_old_route"
        seedControlledPublicMutationState(.create, viewModel: viewModel, member: member, suffix: suffix)
        rootViewModel.homeDestination = .shiftSwapRequest
        viewModel.startCreatingShiftSwap(shiftId: controlledRequestedShiftId(suffix))
        let completionTask = try #require(rootViewModel.startShiftSwapRequestSave())
        try await repository.waitUntilTransitionStarts()

        rootViewModel.handleHomePrimaryAction()
        let newDraft = ShiftSwapDraft(shiftId: "new_route_shift", reason: "new route")
        viewModel.shiftSwapDraft = newDraft
        rootViewModel.handleHomeDrawerNavigation(.shiftSwapRequest)
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(.create, suffix: suffix))
        )
        await completionTask.value

        #expect(rootViewModel.homeDestination == .shiftSwapRequest)
        #expect(viewModel.shiftSwapDraft == newDraft)
        #expect(
            viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId(suffix)] ==
                .create(requestedShiftId: controlledRequestedShiftId(suffix))
        )
    }

    @Test
    func publicSaveWaiterDoesNotRetainReleasedRootOrShiftsViewModel() async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let member = shiftMember(id: "member_root_lifetime", displayName: "Carmen")
        var rootViewModel: AccessRootViewModel? = makeShiftSwapOwnershipRootViewModel(
            member: member,
            shiftSwapRequestRepository: repository
        )
        let suffix = "_root_lifetime"
        var viewModel: ShiftsFeatureViewModel? = try #require(rootViewModel?.shiftsViewModel)
        seedControlledPublicMutationState(
            .create,
            viewModel: try #require(viewModel),
            member: member,
            suffix: suffix
        )
        rootViewModel?.homeDestination = .shiftSwapRequest
        viewModel?.startCreatingShiftSwap(shiftId: controlledRequestedShiftId(suffix))
        let weakRoot = WeakShiftsOwnershipReference(rootViewModel)
        let weakViewModel = WeakShiftsOwnershipReference(viewModel)
        let completionTask = try #require(rootViewModel?.startShiftSwapRequestSave())
        try await repository.waitUntilTransitionStarts()

        viewModel = nil
        rootViewModel = nil

        #expect(weakRoot.value == nil)
        #expect(weakViewModel.value == nil)
        #expect(repository.wasTransitionCancelled())
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(.create, suffix: suffix))
        )
        await completionTask.value
    }
}
