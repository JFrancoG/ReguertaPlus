import Testing

@testable import Reguerta

enum ControlledShiftSwapRoleDrift: CaseIterable {
    case grantProducer
    case removeProducer

    var initialRoles: Set<MemberRole> {
        switch self {
        case .grantProducer:
            [.member]
        case .removeProducer:
            [.member, .producer]
        }
    }

    var successorRoles: Set<MemberRole> {
        switch self {
        case .grantProducer:
            [.member, .producer]
        case .removeProducer:
            [.member]
        }
    }
}

enum ControlledShiftSwapAdminAccessDrift: CaseIterable {
    case grantAdmin
    case removeAdmin

    var initialRoles: Set<MemberRole> {
        switch self {
        case .grantAdmin:
            [.member]
        case .removeAdmin:
            [.member, .admin]
        }
    }

    var successorRoles: Set<MemberRole> {
        switch self {
        case .grantAdmin:
            [.member, .admin]
        case .removeAdmin:
            [.member]
        }
    }
}

enum ControlledShiftSwapHandlerOrder: CaseIterable {
    case modeFirst
    case boundaryFirst

    @MainActor
    func handle(rootViewModel: AccessRootViewModel, from initialMode: SessionMode, to successorMode: SessionMode) {
        switch self {
        case .modeFirst:
            rootViewModel.handleSessionModeChange(from: initialMode, to: successorMode)
            rootViewModel.handleShiftSwapAuthorizationBoundaryChange()
        case .boundaryFirst:
            rootViewModel.handleShiftSwapAuthorizationBoundaryChange()
            rootViewModel.handleSessionModeChange(from: initialMode, to: successorMode)
        }
    }
}

enum ControlledShiftSwapDistinctScopeDrift: CaseIterable {
    case principalAuthentication
    case authenticatedMember
    case selectedMember
    case environment

    var authorizationDrift: ShiftsAuthorizationDrift {
        switch self {
        case .principalAuthentication:
            .principalAuthentication
        case .authenticatedMember:
            .authenticatedMember
        case .selectedMember:
            .selectedMember
        case .environment:
            .environment
        }
    }
}

@MainActor
func controlledAdminAccessSuccessor(
    from initialSession: AuthorizedSession,
    drift: ControlledShiftSwapAdminAccessDrift
) -> AuthorizedSession {
    let successorMember = replacingRoles(in: initialSession.member, with: drift.successorRoles)
    var successor = initialSession
    successor.authenticatedMember = successorMember
    successor.member = successorMember
    successor.members = [successorMember]
    return successor
}

@MainActor
func makeControlledShiftSwapMutationFixture(
    repository: ControlledShiftSwapMutationRepository,
    shiftRepository: any ShiftRepository = InMemoryShiftRepository(),
    memberRoles: Set<MemberRole> = [.member]
) -> ControlledShiftSwapMutationFixture {
    let member = replacingRoles(
        in: shiftMember(id: "member_swap_owner", displayName: "Carmen"),
        with: memberRoles
    )
    let viewModel = makeShiftsViewModel(
        currentMember: member,
        members: [member],
        shiftRepository: shiftRepository,
        shiftSwapRequestRepository: repository
    )
    return ControlledShiftSwapMutationFixture(member: member, viewModel: viewModel)
}

func controlledShiftSwapIntent(
    _ kind: ControlledShiftSwapMutationKind,
    member: Member,
    suffix: String
) -> ShiftSwapMutationIntent {
    switch kind {
    case .create:
        .create(
            ShiftSwapCreateSubmission(
                draft: ShiftSwapDraft(shiftId: controlledRequestedShiftId(suffix), reason: "reason"),
                requestedShiftId: controlledRequestedShiftId(suffix),
                reason: "reason"
            )
        )
    case .respond:
        .respond(
            requestId: controlledShiftSwapRequestId(suffix),
            userId: member.id,
            candidateShiftId: controlledCandidateShiftId(suffix),
            response: .available
        )
    case .cancel:
        .cancel(requestId: controlledShiftSwapRequestId(suffix))
    case .apply:
        .apply(
            requestId: controlledShiftSwapRequestId(suffix),
            candidateShiftId: controlledCandidateShiftId(suffix)
        )
    }
}

func controlledShiftSwapResult(_ kind: ControlledShiftSwapMutationKind, suffix: String) -> ShiftSwapTransitionResult {
    ShiftSwapTransitionResult(
        requestId: controlledShiftSwapRequestId(suffix),
        candidateCount: kind == .create ? 1 : nil
    )
}

func expectedControlledShiftSwapAcknowledgement(
    _ kind: ControlledShiftSwapMutationKind,
    member: Member,
    suffix: String
) -> ShiftSwapAcknowledgement {
    switch kind {
    case .create:
        .create(requestedShiftId: controlledRequestedShiftId(suffix))
    case .respond:
        .respond(
            userId: member.id,
            candidateShiftId: controlledCandidateShiftId(suffix),
            response: .available
        )
    case .cancel:
        .cancel
    case .apply:
        .apply
    }
}

func controlledLateOutcome(
    _ completion: ControlledShiftSwapLateCompletion,
    kind: ControlledShiftSwapMutationKind,
    suffix: String
) -> ControlledShiftSwapMutationOutcome {
    switch completion {
    case .success:
        .success(controlledShiftSwapResult(kind, suffix: suffix))
    case .failure:
        .failure(.unavailable)
    }
}

func controlledReflectedShiftSwapRequest(
    _ kind: ControlledShiftSwapMutationKind,
    member: Member,
    suffix: String,
    requestId: String? = nil,
    requestedShiftId: String? = nil
) -> ShiftSwapRequest {
    let resolvedRequestId = requestId ?? controlledShiftSwapRequestId(suffix)
    let resolvedRequestedShiftId = requestedShiftId ?? controlledRequestedShiftId(suffix)
    let candidate = ShiftSwapCandidate(
        userId: member.id,
        shiftId: controlledCandidateShiftId(suffix)
    )
    switch kind {
    case .create:
        return shiftSwapRequest(
            id: resolvedRequestId,
            requestedShiftId: resolvedRequestedShiftId,
            requesterUserId: member.id,
            candidates: []
        )
    case .respond:
        return shiftSwapRequest(
            id: resolvedRequestId,
            requestedShiftId: resolvedRequestedShiftId,
            requesterUserId: "requester",
            candidates: [candidate],
            responses: [availableShiftSwapResponse(userId: member.id, shiftId: candidate.shiftId)]
        )
    case .cancel:
        return shiftSwapRequest(
            id: resolvedRequestId,
            requestedShiftId: resolvedRequestedShiftId,
            requesterUserId: member.id,
            candidates: [],
            status: .cancelled
        )
    case .apply:
        return shiftSwapRequest(
            id: resolvedRequestId,
            requestedShiftId: resolvedRequestedShiftId,
            requesterUserId: member.id,
            candidates: [candidate],
            responses: [availableShiftSwapResponse(userId: member.id, shiftId: candidate.shiftId)],
            status: .applied
        )
    }
}

func controlledUnreflectedShiftSwapRequest(
    _ kind: ControlledShiftSwapMutationKind,
    member: Member,
    suffix: String
) -> ShiftSwapRequest {
    switch kind {
    case .create:
        return shiftSwapRequest(
            id: controlledShiftSwapRequestId(suffix),
            requestedShiftId: controlledRequestedShiftId("_unreflected\(suffix)"),
            requesterUserId: member.id,
            candidates: []
        )
    case .respond, .cancel, .apply:
        return controlledOpenShiftSwapRequest(kind, member: member, suffix: suffix)
    }
}

func controlledWrongKeyShiftSwapRequest(
    _ kind: ControlledShiftSwapMutationKind,
    member: Member,
    suffix: String
) -> ShiftSwapRequest {
    let wrongRequestedShiftId = kind == .create
        ? controlledRequestedShiftId("_wrong_key\(suffix)")
        : nil
    return controlledReflectedShiftSwapRequest(
        kind,
        member: member,
        suffix: suffix,
        requestId: controlledShiftSwapRequestId("_wrong_key\(suffix)"),
        requestedShiftId: wrongRequestedShiftId
    )
}

func controlledShiftSwapUncertaintyKey(
    _ kind: ControlledShiftSwapMutationKind,
    suffix: String
) -> ShiftSwapMutationUncertaintyKey {
    switch kind {
    case .create:
        .create(requestedShiftId: controlledRequestedShiftId(suffix))
    case .respond, .cancel, .apply:
        .request(requestId: controlledShiftSwapRequestId(suffix))
    }
}

@MainActor
func seedControlledCreateDraftIfNeeded(_ intent: ShiftSwapMutationIntent, in viewModel: ShiftsFeatureViewModel) {
    guard case .create(let submission) = intent else { return }
    viewModel.shiftSwapDraft = submission.draft
}

@MainActor
func seedControlledPublicMutationState(
    _ kind: ControlledShiftSwapMutationKind,
    fixture: ControlledShiftSwapMutationFixture,
    suffix: String
) {
    seedControlledPublicMutationState(
        kind,
        viewModel: fixture.viewModel,
        member: fixture.member,
        suffix: suffix
    )
}

@MainActor
func seedControlledPublicMutationState(
    _ kind: ControlledShiftSwapMutationKind,
    viewModel: ShiftsFeatureViewModel,
    member: Member,
    suffix: String
) {
    let requestedShift = shift(
        id: controlledRequestedShiftId(suffix),
        type: .delivery,
        dateMillis: 10,
        assignedUserIds: [member.id]
    )
    viewModel.shiftsFeed = [requestedShift]
    if kind != .create {
        viewModel.shiftSwapRequests = [
            controlledOpenShiftSwapRequest(kind, member: member, suffix: suffix)
        ]
    }
}

func controlledOpenShiftSwapRequest(
    _ kind: ControlledShiftSwapMutationKind,
    member: Member,
    suffix: String
) -> ShiftSwapRequest {
    let candidate = ShiftSwapCandidate(
        userId: kind == .respond ? member.id : "candidate",
        shiftId: controlledCandidateShiftId(suffix)
    )
    return shiftSwapRequest(
        id: controlledShiftSwapRequestId(suffix),
        requestedShiftId: controlledRequestedShiftId(suffix),
        requesterUserId: kind == .respond ? "requester" : member.id,
        candidates: [candidate],
        responses: kind == .apply
            ? [availableShiftSwapResponse(userId: candidate.userId, shiftId: candidate.shiftId)]
            : []
    )
}

@MainActor
func startControlledPublicMutation(
    _ kind: ControlledShiftSwapMutationKind,
    fixture: ControlledShiftSwapMutationFixture,
    suffix: String
) -> Task<Bool, Never>? {
    startControlledPublicMutation(
        kind,
        viewModel: fixture.viewModel,
        member: fixture.member,
        suffix: suffix
    )
}

@MainActor
func startControlledPublicMutation(
    _ kind: ControlledShiftSwapMutationKind,
    viewModel: ShiftsFeatureViewModel,
    member _: Member,
    suffix: String
) -> Task<Bool, Never>? {
    let requestId = controlledShiftSwapRequestId(suffix)
    let candidateShiftId = controlledCandidateShiftId(suffix)
    switch kind {
    case .create:
        viewModel.startCreatingShiftSwap(shiftId: controlledRequestedShiftId(suffix))
        return viewModel.startSavingShiftSwapRequest()
    case .respond:
        viewModel.acceptShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
    case .cancel:
        return viewModel.startCancellingShiftSwapRequest(requestId: requestId)
    case .apply:
        viewModel.confirmShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
    }
    return viewModel.shiftSwapMutationTask
}

@MainActor
func canSubmitControlledPublicMutation(
    _ kind: ControlledShiftSwapMutationKind,
    viewModel: ShiftsFeatureViewModel,
    suffix: String
) -> Bool {
    switch kind {
    case .create:
        viewModel.canSubmitShiftSwapCreate(for: controlledRequestedShiftId(suffix))
    case .respond, .cancel, .apply:
        viewModel.canSubmitShiftSwapRequestMutation(for: controlledShiftSwapRequestId(suffix))
    }
}

@MainActor
func expectControlledShiftSwapOwnerIsReleased(_ viewModel: ShiftsFeatureViewModel) {
    #expect(viewModel.activeShiftSwapMutationOperationId == nil)
    #expect(viewModel.activeShiftSwapMutationAuthorizationReceipt == nil)
    #expect(viewModel.shiftSwapMutationTask == nil)
    #expect(viewModel.isSavingShiftSwapRequest == false)
    #expect(viewModel.isUpdatingShiftSwapRequest == false)
}

func controlledShiftSwapRequestId(_ suffix: String) -> String {
    "swap\(suffix)"
}

func controlledRequestedShiftId(_ suffix: String) -> String {
    "requested\(suffix)"
}

func controlledCandidateShiftId(_ suffix: String) -> String {
    "candidate\(suffix)"
}
