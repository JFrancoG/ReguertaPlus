import Foundation
import Testing

@testable import Reguerta

@MainActor
func controlledBenignABASuccessor(from initialSession: AuthorizedSession, member: Member) -> AuthorizedSession {
    let producer = replacingRoles(in: member, with: [.member, .producer])
    var successor = initialSession
    successor.authenticatedMember = producer
    successor.member = producer
    successor.members = [
        producer,
        shiftMember(id: "member_aba_list_refresh", displayName: "Javier")
    ]
    return successor
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationAuthorizationWiringTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func coalescedAuthorizationBounceIsHandledThroughTheRootBoundarySignal(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let member = shiftMember(id: "member_boundary_aba", displayName: "Carmen")
        let rootViewModel = makeShiftSwapOwnershipRootViewModel(
            member: member,
            shiftSwapRequestRepository: repository
        )
        let viewModel = rootViewModel.shiftsViewModel
        let initialSession = try #require(viewModel.currentSession)
        let initialBoundaryRevision = viewModel.sessionViewModel.shiftSwapAuthorizationBoundaryRevision
        let suffix = "_boundary_aba"
        let intent = controlledShiftSwapIntent(kind, member: member, suffix: suffix)
        seedControlledPublicMutationState(kind, viewModel: viewModel, member: member, suffix: suffix)
        let mutationTask = try #require(
            startControlledPublicMutation(kind, viewModel: viewModel, member: member, suffix: suffix)
        )
        try await repository.waitUntilTransitionStarts()
        viewModel.defaultDeliveryDayOfWeek = .friday
        viewModel.activePlanningSubmissionOperationId = 73
        viewModel.isSubmittingShiftPlanningRequest = true

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.sessionViewModel.mode = .authorized(initialSession)
        #expect(
            viewModel.sessionViewModel.shiftSwapAuthorizationBoundaryRevision != initialBoundaryRevision
        )
        rootViewModel.handleShiftSwapAuthorizationBoundaryChange()

        #expect(repository.wasTransitionCancelled())
        #expect(viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        #expect(viewModel.uncertainShiftSwapMutationIntents.count == 1)
        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(viewModel.defaultDeliveryDayOfWeek == .friday)
        #expect(viewModel.activePlanningSubmissionOperationId == 73)
        #expect(viewModel.isSubmittingShiftPlanningRequest)

        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )

        #expect(await mutationTask.value == false)
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: suffix) == false)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: "_other_aba_key"))
        expectControlledShiftSwapOwnerIsReleased(viewModel)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func modeFirstBenignCompletionHandlesPriorHardBoundaryBeforeRebase(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let member = shiftMember(id: "member_mode_first_aba", displayName: "Carmen")
        let rootViewModel = makeShiftSwapOwnershipRootViewModel(
            member: member,
            shiftSwapRequestRepository: repository
        )
        let viewModel = rootViewModel.shiftsViewModel
        let initialSession = try #require(viewModel.currentSession)
        let initialMode = SessionMode.authorized(initialSession)
        let finalSession = controlledBenignABASuccessor(from: initialSession, member: member)
        let initialBoundaryRevision = viewModel.sessionViewModel.shiftSwapAuthorizationBoundaryRevision
        let suffix = "_mode_first_aba"
        let intent = controlledShiftSwapIntent(kind, member: member, suffix: suffix)
        seedControlledPublicMutationState(kind, viewModel: viewModel, member: member, suffix: suffix)
        let mutationTask = try #require(
            startControlledPublicMutation(kind, viewModel: viewModel, member: member, suffix: suffix)
        )
        try await repository.waitUntilTransitionStarts()
        viewModel.defaultDeliveryDayOfWeek = .friday
        viewModel.activePlanningSubmissionOperationId = 79
        viewModel.isSubmittingShiftPlanningRequest = true

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.sessionViewModel.mode = .authorized(finalSession)
        #expect(
            viewModel.sessionViewModel.shiftSwapAuthorizationBoundaryRevision != initialBoundaryRevision
        )
        rootViewModel.handleSessionModeChange(from: initialMode, to: .authorized(finalSession))
        rootViewModel.handleShiftSwapAuthorizationBoundaryChange()

        #expect(repository.wasTransitionCancelled())
        #expect(viewModel.currentSession == finalSession)
        #expect(viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        #expect(viewModel.defaultDeliveryDayOfWeek == .friday)
        #expect(viewModel.activePlanningSubmissionOperationId == 79)
        #expect(viewModel.isSubmittingShiftPlanningRequest)

        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )

        #expect(await mutationTask.value == false)
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: suffix) == false)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: viewModel, suffix: "_other_mode_key"))
        expectControlledShiftSwapOwnerIsReleased(viewModel)
    }

    @Test
    func contentViewObservesTheBoundaryRevisionThroughTheRootHandler() throws {
        let contentViewURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Reguerta/Presentation/Root/ContentView.swift")
        let source = try String(contentsOf: contentViewURL, encoding: .utf8)
        let expectedWiring = """
        .onChange(of: sessionViewModel.shiftSwapAuthorizationBoundaryRevision) { _, _ in
                    rootViewModel.handleShiftSwapAuthorizationBoundaryChange()
                }
        """

        #expect(source.contains(expectedWiring))
    }
}
