import Foundation

extension ShiftsFeatureViewModel {
    func updateShiftSwapDraft(
        _ update: (inout ShiftSwapDraft) -> Void
    ) {
        var draft = shiftSwapDraft
        update(&draft)
        shiftSwapDraft = draft
    }

    func startCreatingShiftSwap(shiftId: String) {
        shiftSwapDraft = ShiftSwapDraft(
            shiftId: shiftId,
            reason: ""
        )
    }

    func clearShiftSwapDraft() {
        shiftSwapDraft = ShiftSwapDraft()
    }

    func dismissShiftSwapActivity(requestId: String) {
        dismissedShiftSwapRequestIds.insert(requestId)
    }

    func saveShiftSwapRequest() async -> Bool {
        guard let context = authorizedSessionContext else { return false }
        guard let submission = shiftSwapCreateSubmission(for: context) else { return false }
        guard let saveOperationId = beginSwapSaveOperation() else { return false }

        defer { finishSwapSaveOperation(saveOperationId) }
        let result: ShiftSwapTransitionResult
        do {
            result = try await shiftSwapRequestRepository.transition(
                .create(
                    requestedShiftId: submission.requestedShiftId,
                    reason: submission.reason
                ),
                environment: context.environment
            )
        } catch is CancellationError {
            return false
        } catch {
            if isCurrentSession(context) {
                showShiftSwapError(error)
            }
            return false
        }
        guard isCurrentSession(context) else { return false }
        shiftSwapAcknowledgements[result.requestId] = .create(
            requestedShiftId: submission.requestedShiftId
        )
        if shiftSwapDraft == submission.draft {
            shiftSwapDraft = ShiftSwapDraft()
        }
        await refreshShiftSwapState(for: context)
        return true
    }

    func acceptShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId, responseStatus: .available)
    }

    func rejectShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(
            requestId: requestId,
            candidateShiftId: candidateShiftId,
            responseStatus: .unavailable
        )
    }

    func cancelShiftSwapRequest(requestId: String) async {
        guard let context = authorizedSessionContext,
              !acknowledgedShiftSwapRequestIds.contains(requestId),
              shiftSwapRequests.contains(where: { $0.id == requestId }) else { return }
        guard let mutationOperationId = beginSwapMutation() else { return }
        defer { finishSwapMutation(mutationOperationId) }
        let result: ShiftSwapTransitionResult
        do {
            result = try await shiftSwapRequestRepository.transition(
                .cancel(requestId: requestId),
                environment: context.environment
            )
        } catch is CancellationError {
            return
        } catch {
            if isCurrentSwapMutation(mutationOperationId, context: context) {
                showShiftSwapError(error)
            }
            return
        }
        guard isCurrentSwapMutation(mutationOperationId, context: context) else { return }
        shiftSwapAcknowledgements[result.requestId] = .cancel
        await refreshShiftSwapState(for: context)
    }

    func confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        guard let sessionContext = authorizedSessionContext,
              !acknowledgedShiftSwapRequestIds.contains(requestId),
              let request = shiftSwapRequests.first(where: { $0.id == requestId }),
              request.requesterUserId == sessionContext.session.member.id,
              request.candidates.contains(where: { $0.shiftId == candidateShiftId }) else { return }
        guard let mutationOperationId = beginSwapMutation() else { return }

        Task { @MainActor in
            defer { finishSwapMutation(mutationOperationId) }
            let result: ShiftSwapTransitionResult
            do {
                result = try await shiftSwapRequestRepository.transition(
                    .apply(requestId: requestId, candidateShiftId: candidateShiftId),
                    environment: sessionContext.environment
                )
            } catch is CancellationError {
                return
            } catch {
                if isCurrentSwapMutation(mutationOperationId, context: sessionContext) {
                    showShiftSwapError(error)
                }
                return
            }
            guard isCurrentSwapMutation(mutationOperationId, context: sessionContext) else { return }
            shiftSwapAcknowledgements[result.requestId] = .apply
            await refreshShiftSwapState(for: sessionContext)
        }
    }
}

private extension ShiftsFeatureViewModel {
    func shiftSwapCreateSubmission(for context: SessionContext) -> ShiftSwapCreateSubmission? {
        let draft = shiftSwapDraft
        guard !draft.shiftId.isEmpty,
              let shift = shiftsFeed.first(where: { $0.id == draft.shiftId }),
              canRequestSwapForShift(
                shift,
                currentMemberId: context.session.member.id
              ) else { return nil }
        return ShiftSwapCreateSubmission(
            draft: draft,
            requestedShiftId: shift.id,
            reason: draft.reason.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    func respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        responseStatus: ShiftSwapResponseStatus
    ) {
        guard let context = authorizedSessionContext else { return }
        let session = context.session
        guard !acknowledgedShiftSwapRequestIds.contains(requestId) else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else {
            return
        }
        guard let candidate = request.candidates.first(where: {
            $0.userId == session.member.id && $0.shiftId == candidateShiftId
        }) else {
            return
        }
        guard let mutationOperationId = beginSwapMutation() else { return }
        Task { @MainActor in
            defer { finishSwapMutation(mutationOperationId) }
            let result: ShiftSwapTransitionResult
            do {
                result = try await shiftSwapRequestRepository.transition(
                    .respond(
                        requestId: requestId,
                        candidateShiftId: candidateShiftId,
                        response: responseStatus
                    ),
                    environment: context.environment
                )
            } catch is CancellationError {
                return
            } catch {
                if isCurrentSwapMutation(mutationOperationId, context: context) {
                    showShiftSwapError(error)
                }
                return
            }
            guard isCurrentSwapMutation(mutationOperationId, context: context) else { return }
            shiftSwapAcknowledgements[result.requestId] = .respond(
                userId: candidate.userId,
                candidateShiftId: candidate.shiftId,
                response: responseStatus
            )
            await refreshShiftSwapState(for: context)
        }
    }

    func refreshShiftSwapState(for context: SessionContext) async {
        guard isCurrentSession(context) else { return }
        await refreshShifts()
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

    func beginSwapMutation() -> UInt64? {
        guard activeSwapMutationOperationId == nil, !isUpdatingShiftSwapRequest else { return nil }
        nextSwapMutationOperationId += 1
        activeSwapMutationOperationId = nextSwapMutationOperationId
        isUpdatingShiftSwapRequest = true
        return nextSwapMutationOperationId
    }

    func isCurrentSwapMutation(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeSwapMutationOperationId == operationId && isCurrentSession(context)
    }

    func finishSwapMutation(_ operationId: UInt64) {
        guard activeSwapMutationOperationId == operationId else { return }
        activeSwapMutationOperationId = nil
        isUpdatingShiftSwapRequest = false
    }

    func beginSwapSaveOperation() -> UInt64? {
        guard activeSwapSaveOperationId == nil, !isSavingShiftSwapRequest else { return nil }
        nextSwapSaveOperationId += 1
        activeSwapSaveOperationId = nextSwapSaveOperationId
        isSavingShiftSwapRequest = true
        return nextSwapSaveOperationId
    }

    func finishSwapSaveOperation(_ operationId: UInt64) {
        guard activeSwapSaveOperationId == operationId else { return }
        activeSwapSaveOperationId = nil
        isSavingShiftSwapRequest = false
    }

}
