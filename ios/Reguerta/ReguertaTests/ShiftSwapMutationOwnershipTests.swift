import Testing

@testable import Reguerta

enum ControlledShiftSwapLateCompletion: CaseIterable {
    case success
    case failure
}

struct ControlledShiftSwapMutationFixture {
    let member: Member
    let viewModel: ShiftsFeatureViewModel
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationOwnershipTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ControlledShiftSwapMutationKind.allCases)
    func secondMutationIsRejectedWhileFirstOwnsTheSingleLane(
        _ firstKind: ControlledShiftSwapMutationKind,
        _ secondKind: ControlledShiftSwapMutationKind
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let firstIntent = controlledShiftSwapIntent(firstKind, member: fixture.member, suffix: "_first")
        seedControlledCreateDraftIfNeeded(firstIntent, in: fixture.viewModel)
        let firstTask = try #require(
            fixture.viewModel.startShiftSwapMutation(firstIntent, context: context)
        )
        try await repository.waitUntilTransitionStarts()
        let firstToken = fixture.viewModel.activeShiftSwapMutationOperationId

        let secondIntent = controlledShiftSwapIntent(secondKind, member: fixture.member, suffix: "_second")
        let secondTask = fixture.viewModel.startShiftSwapMutation(secondIntent, context: context)

        #expect(secondTask == nil)
        #expect(fixture.viewModel.activeShiftSwapMutationOperationId == firstToken)
        #expect(repository.records().map(\.kind) == [firstKind])

        await repository.completeTransition(with: .failure(.unavailable))
        #expect(await firstTask.value == false)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ControlledShiftSwapLateCompletion.allCases)
    func callerCancellationRejectsNonCooperativeLateCompletion(
        _ kind: ControlledShiftSwapMutationKind,
        _ completion: ControlledShiftSwapLateCompletion
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository(readOperationCount: 1)
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: "_caller_cancel")
        seedControlledCreateDraftIfNeeded(intent, in: fixture.viewModel)
        let mutationTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts()

        mutationTask.cancel()
        await repository.completeTransition(
            with: controlledLateOutcome(completion, kind: kind, suffix: "_caller_cancel")
        )

        #expect(await mutationTask.value == false)
        #expect(repository.wasTransitionCancelled())
        try await repository.waitUntilSwapReadStarts()
        let refreshTask = try #require(fixture.viewModel.shiftsRefreshTask)
        await repository.completeSwapRead(with: .success([]))
        await refreshTask.value
        #expect(repository.swapReadCount() == 1)
        #expect(fixture.viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(fixture.viewModel.feedbackCenter.messageKey == nil)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
        if case .create(let submission) = intent {
            #expect(fixture.viewModel.shiftSwapDraft == submission.draft)
        }
    }

    @Test(arguments: ControlledShiftSwapLateCompletion.allCases)
    func publicSaveHandleCancellationRejectsALateCreateCompletion(
        _ completion: ControlledShiftSwapLateCompletion
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let suffix = "_public_save_cancel"
        seedControlledPublicMutationState(.create, fixture: fixture, suffix: suffix)
        fixture.viewModel.startCreatingShiftSwap(shiftId: controlledRequestedShiftId(suffix))
        let mutationTask = try #require(fixture.viewModel.startSavingShiftSwapRequest())
        try await repository.waitUntilTransitionStarts()

        mutationTask.cancel()
        await repository.completeTransition(
            with: controlledLateOutcome(completion, kind: .create, suffix: suffix)
        )

        #expect(await mutationTask.value == false)
        #expect(repository.wasTransitionCancelled())
        #expect(fixture.viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(
            fixture.viewModel.uncertainShiftSwapMutationIntents[
                controlledShiftSwapUncertaintyKey(.create, suffix: suffix)
            ] != nil
        )
        #expect(fixture.viewModel.shiftSwapDraft.shiftId == controlledRequestedShiftId(suffix))
        #expect(fixture.viewModel.feedbackCenter.messageKey == nil)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

    @Test(arguments: ControlledShiftSwapLateCompletion.allCases)
    func publicCancelHandleCancellationRejectsALateCommandCompletion(
        _ completion: ControlledShiftSwapLateCompletion
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let suffix = "_public_cancel_cancel"
        seedControlledPublicMutationState(.cancel, fixture: fixture, suffix: suffix)
        let requestId = controlledShiftSwapRequestId(suffix)
        let mutationTask = try #require(fixture.viewModel.startCancellingShiftSwapRequest(requestId: requestId))
        try await repository.waitUntilTransitionStarts()

        mutationTask.cancel()
        await repository.completeTransition(
            with: controlledLateOutcome(completion, kind: .cancel, suffix: suffix)
        )
        #expect(await mutationTask.value == false)

        #expect(repository.wasTransitionCancelled())
        #expect(fixture.viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(
            fixture.viewModel.uncertainShiftSwapMutationIntents[
                controlledShiftSwapUncertaintyKey(.cancel, suffix: suffix)
            ] != nil
        )
        #expect(fixture.viewModel.feedbackCenter.messageKey == nil)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

    @Test
    func publicRejectSendsUnavailableResponseAndPublishesItsExactAcknowledgement() async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let suffix = "_public_reject"
        seedControlledPublicMutationState(.respond, fixture: fixture, suffix: suffix)
        let requestId = controlledShiftSwapRequestId(suffix)
        let candidateShiftId = controlledCandidateShiftId(suffix)

        fixture.viewModel.rejectShiftSwapRequest(
            requestId: requestId,
            candidateShiftId: candidateShiftId
        )
        let mutationTask = try #require(fixture.viewModel.shiftSwapMutationTask)
        try await repository.waitUntilTransitionStarts()
        #expect(
            repository.records() == [
                ControlledShiftSwapMutationRecord(
                    kind: .respond,
                    environment: .develop,
                    requestId: requestId,
                    candidateShiftId: candidateShiftId,
                    response: .unavailable
                )
            ]
        )

        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(.respond, suffix: suffix))
        )
        #expect(await mutationTask.value)
        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[requestId] == .respond(
                userId: fixture.member.id,
                candidateShiftId: candidateShiftId,
                response: .unavailable
            )
        )
    }

}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationAuthorizationTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func signOutCancelsOwnedMutationAndRejectsLateSuccess(_ kind: ControlledShiftSwapMutationKind) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: "_sign_out")
        seedControlledCreateDraftIfNeeded(intent, in: fixture.viewModel)
        let mutationTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts()

        fixture.viewModel.sessionViewModel.mode = .signedOut
        fixture.viewModel.handleSessionModeChange(.signedOut)
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: "_sign_out"))
        )

        #expect(await mutationTask.value == false)
        #expect(repository.wasTransitionCancelled())
        #expect(fixture.viewModel.currentSession == nil)
        #expect(fixture.viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(fixture.viewModel.feedbackCenter.messageKey == nil)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func unauthorizedDemotionCancelsOwnedMutationAndRejectsLateSuccess(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let suffix = "_unauthorized"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        seedControlledCreateDraftIfNeeded(intent, in: fixture.viewModel)
        let mutationTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts()

        let mode = SessionMode.unauthorized(
            email: fixture.member.normalizedEmail,
            reason: .userAccessRestricted
        )
        fixture.viewModel.sessionViewModel.mode = mode
        fixture.viewModel.handleSessionModeChange(mode)
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )

        #expect(await mutationTask.value == false)
        #expect(repository.wasTransitionCancelled())
        #expect(fixture.viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(fixture.viewModel.feedbackCenter.messageKey == nil)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func unhandledBenignSessionRevisionRebasesAndPublishesKnownSuccess(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let suffix = "_revision_churn"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        let mutationTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts()
        let capturedRevision = fixture.viewModel.sessionViewModel.sessionStateRevision

        var churnedSession = try #require(fixture.viewModel.currentSession)
        churnedSession.members.append(shiftMember(id: "member_revision_churn", displayName: "Javier"))
        fixture.viewModel.sessionViewModel.mode = .authorized(churnedSession)
        #expect(fixture.viewModel.sessionViewModel.sessionStateRevision != capturedRevision)
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )

        #expect(await mutationTask.value)
        #expect(repository.wasTransitionCancelled() == false)
        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId(suffix)] ==
                expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: suffix)
        )
        #expect(fixture.viewModel.feedbackCenter.messageKey == nil)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func unhandledBenignSessionRevisionQuarantinesAnAmbiguousOutcome(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let suffix = "_revision_ambiguity"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        let mutationTask = try #require(fixture.viewModel.startShiftSwapMutation(intent, context: context))
        try await repository.waitUntilTransitionStarts()

        var churnedSession = try #require(fixture.viewModel.currentSession)
        churnedSession.members.append(shiftMember(id: "member_revision_ambiguity", displayName: "Javier"))
        fixture.viewModel.sessionViewModel.mode = .authorized(churnedSession)
        await repository.completeTransition(with: .failure(.unavailable))

        #expect(await mutationTask.value == false)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        #expect(fixture.viewModel.startShiftSwapMutation(intent, context: context) == nil)
        #expect(fixture.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackShiftSwapUnavailable)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func handledBenignMemberListRevisionRebasesTheAcceptedMutation(
        _ kind: ControlledShiftSwapMutationKind
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let suffix = "_handled_revision"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        let mutationTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts()

        var refreshedSession = try #require(fixture.viewModel.currentSession)
        refreshedSession.members.append(shiftMember(id: "member_list_refresh", displayName: "Javier"))
        let mode = SessionMode.authorized(refreshedSession)
        fixture.viewModel.sessionViewModel.mode = mode
        fixture.viewModel.handleSessionModeChange(mode)

        #expect(repository.wasTransitionCancelled() == false)
        #expect(
            fixture.viewModel.activeShiftSwapMutationAuthorizationReceipt?.sessionStateRevision ==
                fixture.viewModel.sessionViewModel.sessionStateRevision
        )
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )

        #expect(await mutationTask.value)
        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId(suffix)] ==
                expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: suffix)
        )
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ShiftsAuthorizationDrift.allCases)
    func hardAuthorizationBoundaryCancelsAndFencesLateSuccess(
        _ kind: ControlledShiftSwapMutationKind,
        _ drift: ShiftsAuthorizationDrift
    ) async throws {
        let scenario = shiftsAuthorizationScenario(for: drift)
        let repository = ControlledShiftSwapMutationRepository()
        let viewModel = makeShiftsViewModel(
            session: scenario.initial,
            shiftSwapRequestRepository: repository,
            environmentProvider: { scenario.environment.value }
        )
        let context = try #require(viewModel.authorizedSessionContext)
        let intent = controlledShiftSwapIntent(kind, member: scenario.initial.member, suffix: "_hard_drift")
        seedControlledCreateDraftIfNeeded(intent, in: viewModel)
        let mutationTask = try #require(viewModel.startShiftSwapMutation(intent, context: context))
        try await repository.waitUntilTransitionStarts()

        scenario.environment.value = scenario.successor.environment
        viewModel.sessionViewModel.mode = .authorized(scenario.successor)
        viewModel.handleSessionModeChange(.authorized(scenario.successor))
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: "_hard_drift"))
        )

        #expect(await mutationTask.value == false)
        #expect(repository.wasTransitionCancelled())
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == nil)
        expectControlledShiftSwapOwnerIsReleased(viewModel)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ShiftsAuthorizationDrift.allCases)
    func unhandledHardAuthorizationBoundaryFencesCompletionBeforeTheSessionHandler(
        _ kind: ControlledShiftSwapMutationKind,
        _ drift: ShiftsAuthorizationDrift
    ) async throws {
        let scenario = shiftsAuthorizationScenario(for: drift)
        let repository = ControlledShiftSwapMutationRepository()
        let viewModel = makeShiftsViewModel(
            session: scenario.initial,
            shiftSwapRequestRepository: repository,
            environmentProvider: { scenario.environment.value }
        )
        let context = try #require(viewModel.authorizedSessionContext)
        let suffix = "_unhandled_hard_drift"
        let intent = controlledShiftSwapIntent(kind, member: scenario.initial.member, suffix: suffix)
        let mutationTask = try #require(viewModel.startShiftSwapMutation(intent, context: context))
        try await repository.waitUntilTransitionStarts()

        scenario.environment.value = scenario.successor.environment
        viewModel.sessionViewModel.mode = .authorized(scenario.successor)
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )

        #expect(await mutationTask.value == false)
        #expect(repository.wasTransitionCancelled() == false)
        #expect(viewModel.authorizedSessionContext == nil)
        #expect(viewModel.startShiftSwapMutation(intent, context: context) == nil)
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(viewModel.uncertainShiftSwapMutationIntents.isEmpty)
        expectControlledShiftSwapOwnerIsReleased(viewModel)

        viewModel.handleSessionModeChange(.authorized(scenario.successor))
        let expectedSession: AuthorizedSession? = scenario.successor.representsActiveAuthorization
            ? scenario.successor
            : nil
        #expect(viewModel.currentSession == expectedSession)
    }

    @Test(arguments: ControlledShiftSwapMutationKind.allCases, ControlledShiftSwapRoleDrift.allCases)
    func roleOnlyDriftPreservesAnAcceptedMutation(
        _ kind: ControlledShiftSwapMutationKind,
        _ drift: ControlledShiftSwapRoleDrift
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(
            repository: repository,
            memberRoles: drift.initialRoles
        )
        let context = try #require(fixture.viewModel.authorizedSessionContext)
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: "_role_drift")
        seedControlledCreateDraftIfNeeded(intent, in: fixture.viewModel)
        let mutationTask = try #require(
            fixture.viewModel.startShiftSwapMutation(intent, context: context)
        )
        try await repository.waitUntilTransitionStarts()
        let operationId = fixture.viewModel.activeShiftSwapMutationOperationId

        let successorMember = replacingRoles(in: fixture.member, with: drift.successorRoles)
        var successor = try #require(fixture.viewModel.currentSession)
        successor.authenticatedMember = successorMember
        successor.member = successorMember
        successor.members = [successorMember]
        fixture.viewModel.sessionViewModel.mode = .authorized(successor)
        fixture.viewModel.handleSessionModeChange(.authorized(successor))

        #expect(fixture.viewModel.activeShiftSwapMutationOperationId == operationId)
        #expect(
            fixture.viewModel.activeShiftSwapMutationAuthorizationReceipt?.generation ==
                fixture.viewModel.sessionIdentityEpoch
        )
        #expect(
            fixture.viewModel.activeShiftSwapMutationAuthorizationReceipt?.sessionStateRevision ==
                fixture.viewModel.sessionViewModel.sessionStateRevision
        )
        #expect(repository.wasTransitionCancelled() == false)
        await repository.completeTransition(
            with: .success(controlledShiftSwapResult(kind, suffix: "_role_drift"))
        )

        #expect(await mutationTask.value)
        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId("_role_drift")] ==
                expectedControlledShiftSwapAcknowledgement(
                    kind,
                    member: fixture.member,
                    suffix: "_role_drift"
                )
        )
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }

}
