enum ShiftSwapMutationUncertaintyKey: Hashable {
    case create(requestedShiftId: String)
    case request(requestId: String)
}

struct ShiftSwapMutationUncertaintyReceipt {
    let operationId: UInt64
    let intent: ShiftSwapMutationIntent
}

struct ShiftSwapMutationReceipts {
    let acknowledgements: [String: ShiftSwapAcknowledgement]
    let uncertainties: [ShiftSwapMutationUncertaintyKey: ShiftSwapMutationUncertaintyReceipt]
}

enum ShiftSwapMutationIntent {
    case create(ShiftSwapCreateSubmission)
    case respond(
        requestId: String,
        userId: String,
        candidateShiftId: String,
        response: ShiftSwapResponseStatus
    )
    case cancel(requestId: String)
    case apply(requestId: String, candidateShiftId: String)

    var command: ShiftSwapCommand {
        switch self {
        case .create(let submission):
            .create(requestedShiftId: submission.requestedShiftId, reason: submission.reason)
        case .respond(let requestId, _, let candidateShiftId, let response):
            .respond(requestId: requestId, candidateShiftId: candidateShiftId, response: response)
        case .cancel(let requestId):
            .cancel(requestId: requestId)
        case .apply(let requestId, let candidateShiftId):
            .apply(requestId: requestId, candidateShiftId: candidateShiftId)
        }
    }

    var isCreate: Bool {
        if case .create = self { return true }
        return false
    }

    var uncertaintyKey: ShiftSwapMutationUncertaintyKey {
        switch self {
        case .create(let submission):
            .create(requestedShiftId: submission.requestedShiftId)
        case .respond(let requestId, _, _, _), .cancel(let requestId), .apply(let requestId, _):
            .request(requestId: requestId)
        }
    }

    func acknowledgement() -> ShiftSwapAcknowledgement {
        switch self {
        case .create(let submission):
            .create(requestedShiftId: submission.requestedShiftId)
        case .respond(_, let userId, let candidateShiftId, let response):
            .respond(userId: userId, candidateShiftId: candidateShiftId, response: response)
        case .cancel:
            .cancel
        case .apply:
            .apply
        }
    }
}

extension ShiftsFeatureViewModel {
    var shiftSwapMutationReceipts: ShiftSwapMutationReceipts {
        ShiftSwapMutationReceipts(
            acknowledgements: shiftSwapAcknowledgements,
            uncertainties: uncertainShiftSwapMutationIntents
        )
    }

    func restoreShiftSwapMutationReceipts(_ receipts: ShiftSwapMutationReceipts) {
        shiftSwapAcknowledgements = receipts.acknowledgements
        uncertainShiftSwapMutationIntents = receipts.uncertainties
    }

    func resetForShiftSwapBoundary(preserving receipts: ShiftSwapMutationReceipts, sameScope: Bool) {
        sessionIdentityEpoch += 1
        reset()
        guard sameScope else { return }
        restoreShiftSwapMutationReceipts(receipts)
    }

    func startShiftSwapMutation(_ intent: ShiftSwapMutationIntent, context: SessionContext) -> Task<Bool, Never>? {
        guard activeShiftSwapMutationOperationId == nil,
              shiftSwapMutationTask == nil,
              pendingShiftSwapAuthorizationBoundaryReceipt == nil,
              uncertainShiftSwapMutationIntents[intent.uncertaintyKey] == nil,
              !isSavingShiftSwapRequest,
              !isUpdatingShiftSwapRequest,
              handledShiftSwapAuthorizationBoundaryRevision ==
                  sessionViewModel.shiftSwapAuthorizationBoundaryRevision,
              context.generation == sessionIdentityEpoch,
              isCurrentShiftSwapSession(context) else { return nil }

        nextShiftSwapMutationOperationId += 1
        let operationId = nextShiftSwapMutationOperationId
        activeShiftSwapMutationOperationId = operationId
        activeShiftSwapMutationAuthorizationReceipt = ShiftSwapMutationAuthorizationReceipt(
            operationId: operationId,
            generation: context.generation,
            sessionStateRevision: context.sessionStateRevision,
            authorizationBoundaryRevision: sessionViewModel.shiftSwapAuthorizationBoundaryRevision
        )
        activeShiftSwapMutationIntent = intent
        activeShiftSwapMutationDidStartTransition = false
        isSavingShiftSwapRequest = intent.isCreate
        isUpdatingShiftSwapRequest = !intent.isCreate
        let owner = ShiftSwapMutationOwner(
            viewModel: self,
            repository: shiftSwapRequestRepository,
            context: context,
            operationId: operationId,
            intent: intent
        )
        let mutationTask = Task<Bool, Never> { @MainActor in
            await owner.run()
        }
        shiftSwapMutationTask = mutationTask
        return mutationTask
    }

    /// Invalidates the local owner before cancellation so a non-cooperative result cannot affect a successor.
    func invalidateShiftSwapMutationOwner() {
        activeShiftSwapMutationOperationId = nil
        activeShiftSwapMutationAuthorizationReceipt = nil
        activeShiftSwapMutationIntent = nil
        activeShiftSwapMutationDidStartTransition = false
        pendingShiftSwapAuthorizationBoundaryReceipt = nil
        shiftSwapMutationTask?.cancel()
        shiftSwapMutationTask = nil
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
    }

    func isCurrentShiftSwapMutation(_ operationId: UInt64, context: SessionContext) -> Bool {
        guard activeShiftSwapMutationOperationId == operationId,
              var receipt = activeShiftSwapMutationAuthorizationReceipt,
              receipt.operationId == operationId,
              receipt.generation == sessionIdentityEpoch,
              receipt.authorizationBoundaryRevision == sessionViewModel.shiftSwapAuthorizationBoundaryRevision,
              isCurrentShiftSwapSession(context) else { return false }
        if receipt.sessionStateRevision != sessionViewModel.sessionStateRevision {
            receipt.sessionStateRevision = sessionViewModel.sessionStateRevision
            activeShiftSwapMutationAuthorizationReceipt = receipt
        }
        return true
    }

    func finishShiftSwapMutation(_ operationId: UInt64) {
        guard activeShiftSwapMutationOperationId == operationId else { return }
        if activeShiftSwapMutationDidStartTransition,
           activeShiftSwapMutationAuthorizationReceipt?.authorizationBoundaryRevision !=
               sessionViewModel.shiftSwapAuthorizationBoundaryRevision,
           handledShiftSwapAuthorizationBoundaryRevision !=
               sessionViewModel.shiftSwapAuthorizationBoundaryRevision {
            if let activeShiftSwapMutationIntent {
                pendingShiftSwapAuthorizationBoundaryReceipt = ShiftSwapMutationUncertaintyReceipt(
                    operationId: operationId,
                    intent: activeShiftSwapMutationIntent
                )
            }
        }
        activeShiftSwapMutationOperationId = nil
        activeShiftSwapMutationAuthorizationReceipt = nil
        activeShiftSwapMutationIntent = nil
        activeShiftSwapMutationDidStartTransition = false
        shiftSwapMutationTask = nil
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
    }

    func discardDefinitivelyResolvedShiftSwapMutation(_ operationId: UInt64, intent: ShiftSwapMutationIntent) {
        if activeShiftSwapMutationOperationId == operationId {
            activeShiftSwapMutationDidStartTransition = false
            activeShiftSwapMutationIntent = nil
        }
        if pendingShiftSwapAuthorizationBoundaryReceipt?.operationId == operationId {
            pendingShiftSwapAuthorizationBoundaryReceipt = nil
        }
        if uncertainShiftSwapMutationIntents[intent.uncertaintyKey]?.operationId == operationId {
            uncertainShiftSwapMutationIntents.removeValue(forKey: intent.uncertaintyKey)
        }
    }

    /// Rebinds an accepted swap command only after the session owner classifies the change as role/capability-only.
    func rebaseShiftSwapMutationAuthorizationReceipt() {
        guard let operationId = activeShiftSwapMutationOperationId,
              var receipt = activeShiftSwapMutationAuthorizationReceipt,
              receipt.operationId == operationId,
              receipt.authorizationBoundaryRevision ==
                  sessionViewModel.shiftSwapAuthorizationBoundaryRevision else { return }
        receipt.generation = sessionIdentityEpoch
        receipt.sessionStateRevision = sessionViewModel.sessionStateRevision
        activeShiftSwapMutationAuthorizationReceipt = receipt
    }

    func markShiftSwapTransitionStarted(_ operationId: UInt64) -> Bool {
        guard activeShiftSwapMutationOperationId == operationId,
              activeShiftSwapMutationAuthorizationReceipt?.operationId == operationId else { return false }
        activeShiftSwapMutationDidStartTransition = true
        return true
    }

    /// Invalidates only swap/feed state when SwiftUI observes a hard boundary hidden by a coalesced mode value.
    func handleShiftSwapAuthorizationBoundaryChange() {
        let liveRevision = sessionViewModel.shiftSwapAuthorizationBoundaryRevision
        guard handledShiftSwapAuthorizationBoundaryRevision != liveRevision else { return }

        let uncertainReceipt = pendingShiftSwapAuthorizationBoundaryReceipt ?? activeShiftSwapUncertaintyReceipt
        let existingReceipts = shiftSwapMutationReceipts
        let acceptedSession = currentSession
        invalidateShiftSwapMutationOwner()
        resetShifts()
        handledShiftSwapAuthorizationBoundaryRevision = liveRevision

        guard let acceptedSession,
              let latestSession = authorizedSession,
              hasSameShiftSwapResourceScope(from: acceptedSession, to: latestSession) else { return }
        restoreShiftSwapMutationReceipts(existingReceipts)
        if let uncertainReceipt {
            recordUncertainShiftSwapMutation(
                uncertainReceipt.intent,
                operationId: uncertainReceipt.operationId
            )
        } else {
            requestShiftSwapMutationReadBack()
        }
    }

    func publishConfirmedShiftSwapMutation(result: ShiftSwapTransitionResult, intent: ShiftSwapMutationIntent) {
        shiftSwapAcknowledgements[result.requestId] = intent.acknowledgement()
        if case .create(let submission) = intent, shiftSwapDraft == submission.draft {
            shiftSwapDraft = ShiftSwapDraft()
        }
        requestShiftSwapMutationReadBack()
    }

    func recordUncertainShiftSwapMutation(_ intent: ShiftSwapMutationIntent, operationId: UInt64) {
        uncertainShiftSwapMutationIntents[intent.uncertaintyKey] = ShiftSwapMutationUncertaintyReceipt(
            operationId: operationId,
            intent: intent
        )
        requestShiftSwapMutationReadBack()
    }

    private func requestShiftSwapMutationReadBack() {
        guard authorizedSessionContext != nil else { return }
        requestShiftsRefresh()
    }

    func reconcileUncertainShiftSwapMutation(with requests: [ShiftSwapRequest]) {
        uncertainShiftSwapMutationIntents = uncertainShiftSwapMutationIntents.filter { _, receipt in
            switch receipt.intent {
            case .create:
                // The backend does not expose a client operation key, so a same-shift request cannot prove correlation.
                return true
            case .respond(let requestId, _, _, _), .cancel(let requestId), .apply(let requestId, _):
                guard let request = requests.first(where: { $0.id == requestId }) else { return true }
                return request.status == .open && !receipt.intent.acknowledgement().isReflected(in: request)
            }
        }
    }

    func canSubmitShiftSwapCreate(for requestedShiftId: String) -> Bool {
        canEnterShiftSwapMutationLane &&
            !requestedShiftId.isEmpty &&
            uncertainShiftSwapMutationIntents[.create(requestedShiftId: requestedShiftId)] == nil
    }

    func canSubmitShiftSwapRequestMutation(for requestId: String) -> Bool {
        canEnterShiftSwapMutationLane &&
            uncertainShiftSwapMutationIntents[.request(requestId: requestId)] == nil
    }

    private var canEnterShiftSwapMutationLane: Bool {
        authorizedSessionContext != nil &&
            activeShiftSwapMutationOperationId == nil &&
            shiftSwapMutationTask == nil &&
            pendingShiftSwapAuthorizationBoundaryReceipt == nil &&
            !isSavingShiftSwapRequest &&
            !isUpdatingShiftSwapRequest &&
            handledShiftSwapAuthorizationBoundaryRevision ==
                sessionViewModel.shiftSwapAuthorizationBoundaryRevision
    }

    private var activeShiftSwapUncertaintyReceipt: ShiftSwapMutationUncertaintyReceipt? {
        guard activeShiftSwapMutationDidStartTransition,
              let operationId = activeShiftSwapMutationOperationId,
              let intent = activeShiftSwapMutationIntent else { return nil }
        return ShiftSwapMutationUncertaintyReceipt(operationId: operationId, intent: intent)
    }

    func showShiftSwapError(_ error: any Error) {
        let messageKey: String
        switch error as? ShiftSwapCommandError {
        case .noCandidates:
            messageKey = AccessL10nKey.feedbackShiftSwapNoCandidates
        case .permissionDenied:
            messageKey = AccessL10nKey.feedbackShiftSwapPermissionDenied
        case .conflict:
            messageKey = AccessL10nKey.feedbackShiftSwapConflict
        case .unavailable:
            messageKey = AccessL10nKey.feedbackShiftSwapUnavailable
        case .invalidData:
            messageKey = AccessL10nKey.feedbackShiftSwapInvalidData
        case .unknown, .none:
            messageKey = AccessL10nKey.feedbackUnableSaveChanges
        }
        feedbackCenter.show(messageKey)
    }

    /// Swap commands remain valid across role-only drift.
    /// Identity, admin-access, and environment drift invalidate them.
    private func isCurrentShiftSwapSession(_ context: SessionContext) -> Bool {
        guard context.session.representsActiveAuthorization,
              let currentSession,
              currentSession.representsActiveAuthorization,
              let currentMember,
              currentMember.isActive,
              let latestSession = authorizedSession,
              latestSession.representsActiveAuthorization else { return false }

        return isBenignShiftSwapAuthorizationTransition(from: context.session, to: currentSession) &&
            isBenignShiftSwapAuthorizationTransition(from: context.session, to: latestSession) &&
            sameShiftSwapMemberIdentity(currentMember, context.session.member) &&
            currentMember.isAdmin == context.session.member.isAdmin &&
            currentEnvironment == context.environment &&
            environmentProvider() == context.environment
    }

    func isBenignShiftSwapAuthorizationTransition(
        from acceptedSession: AuthorizedSession,
        to latestSession: AuthorizedSession
    ) -> Bool {
        hasSameShiftSwapResourceScope(from: acceptedSession, to: latestSession) &&
            acceptedSession.authenticatedMember.isAdmin == latestSession.authenticatedMember.isAdmin &&
            acceptedSession.member.isAdmin == latestSession.member.isAdmin
    }

    func hasSameShiftSwapResourceScope(
        from acceptedSession: AuthorizedSession,
        to latestSession: AuthorizedSession
    ) -> Bool {
        acceptedSession.representsActiveAuthorization &&
            latestSession.representsActiveAuthorization &&
            acceptedSession.principal.uid == latestSession.principal.uid &&
            sameShiftSwapMemberIdentity(acceptedSession.authenticatedMember, latestSession.authenticatedMember) &&
            sameShiftSwapMemberIdentity(acceptedSession.member, latestSession.member) &&
            acceptedSession.environment == latestSession.environment
    }

    private func sameShiftSwapMemberIdentity(_ lhs: Member, _ rhs: Member) -> Bool {
        lhs.id == rhs.id && lhs.authUid == rhs.authUid && lhs.isActive && rhs.isActive
    }
}

@MainActor
private final class ShiftSwapMutationOwner {
    private weak var viewModel: ShiftsFeatureViewModel?
    private let repository: any ShiftSwapRequestRepository
    private let context: ShiftsFeatureViewModel.SessionContext
    private let operationId: UInt64
    private let intent: ShiftSwapMutationIntent

    init(
        viewModel: ShiftsFeatureViewModel,
        repository: any ShiftSwapRequestRepository,
        context: ShiftsFeatureViewModel.SessionContext,
        operationId: UInt64,
        intent: ShiftSwapMutationIntent
    ) {
        self.viewModel = viewModel
        self.repository = repository
        self.context = context
        self.operationId = operationId
        self.intent = intent
    }

    func run() async -> Bool {
        defer { viewModel?.finishShiftSwapMutation(operationId) }
        var didStartTransition = false
        do {
            try Task.checkCancellation()
            guard viewModel?.isCurrentShiftSwapMutation(operationId, context: context) == true else { return false }
            guard viewModel?.markShiftSwapTransitionStarted(operationId) == true else { return false }
            didStartTransition = true
            let result = try await repository.transition(intent.command, environment: context.environment)
            try Task.checkCancellation()
            guard let viewModel,
                  viewModel.isCurrentShiftSwapMutation(operationId, context: context) else { return false }
            viewModel.publishConfirmedShiftSwapMutation(result: result, intent: intent)
            return true
        } catch is CancellationError {
            if didStartTransition,
               let viewModel,
               viewModel.isCurrentShiftSwapMutation(operationId, context: context) {
                viewModel.recordUncertainShiftSwapMutation(intent, operationId: operationId)
            }
            return false
        } catch {
            return handleTransitionFailure(error)
        }
    }

    private func handleTransitionFailure(_ error: any Error) -> Bool {
        guard let viewModel else { return false }
        guard viewModel.isCurrentShiftSwapMutation(operationId, context: context) else {
            if isDefinitiveShiftSwapFailure(error) {
                viewModel.discardDefinitivelyResolvedShiftSwapMutation(operationId, intent: intent)
            }
            return false
        }
        if Task.isCancelled || !isDefinitiveShiftSwapFailure(error) {
            viewModel.recordUncertainShiftSwapMutation(intent, operationId: operationId)
        }
        guard !Task.isCancelled else { return false }
        viewModel.showShiftSwapError(error)
        return false
    }

    private func isDefinitiveShiftSwapFailure(_ error: any Error) -> Bool {
        switch error as? ShiftSwapCommandError {
        case .noCandidates, .permissionDenied, .conflict:
            true
        case .unavailable, .invalidData, .unknown, .none:
            false
        }
    }
}
