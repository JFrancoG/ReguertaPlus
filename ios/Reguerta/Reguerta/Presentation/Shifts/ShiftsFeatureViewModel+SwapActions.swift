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
        guard !isSavingShiftSwapRequest else { return false }
        guard let submission = shiftSwapCreateSubmission(for: context) else { return false }

        isSavingShiftSwapRequest = true
        defer {
            if isCurrentSession(context) {
                isSavingShiftSwapRequest = false
            }
        }
        let result: ShiftSwapTransitionResult
        do {
            result = try await shiftSwapRequestRepository.transition(
                .create(request: submission.request)
            )
        } catch is CancellationError {
            return false
        } catch {
            if isCurrentSession(context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
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
        respondToShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId, responseStatus: .unavailable)
    }

    func cancelShiftSwapRequest(requestId: String) async {
        guard let context = authorizedSessionContext,
              !acknowledgedShiftSwapRequestIds.contains(requestId),
              let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }
        guard let mutationOperationId = beginSwapMutation() else { return }
        let cancelled = ShiftSwapRequest(
                id: request.id,
                requestedShiftId: request.requestedShiftId,
                requesterUserId: request.requesterUserId,
                reason: request.reason,
                status: .cancelled,
                candidates: request.candidates,
                responses: request.responses,
                selectedCandidateUserId: request.selectedCandidateUserId,
                selectedCandidateShiftId: request.selectedCandidateShiftId,
                requestedAtMillis: request.requestedAtMillis,
                confirmedAtMillis: request.confirmedAtMillis,
                appliedAtMillis: request.appliedAtMillis
        )
        defer { finishSwapMutation(mutationOperationId, context: context) }
        let result: ShiftSwapTransitionResult
        do {
            result = try await shiftSwapRequestRepository.transition(.cancel(request: cancelled))
        } catch is CancellationError {
            return
        } catch {
            if isCurrentSwapMutation(mutationOperationId, context: context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
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
              let context = confirmShiftSwapContext(
            requestId: requestId,
            candidateShiftId: candidateShiftId
        ) else { return }
        guard let mutationOperationId = beginSwapMutation() else { return }

        Task { @MainActor in
            defer { finishSwapMutation(mutationOperationId, context: sessionContext) }
            let now = nowMillisProvider()
            let updatedRequest = appliedShiftSwapRequest(from: context.request, candidate: context.candidate, now: now)
            let result: ShiftSwapTransitionResult
            do {
                result = try await shiftSwapRequestRepository.transition(
                        .apply(request: updatedRequest, candidateShiftId: candidateShiftId)
                )
            } catch is CancellationError {
                return
            } catch {
                if isCurrentSwapMutation(mutationOperationId, context: sessionContext) {
                    feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
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
        let candidates = shift.swapCandidates(
            allShifts: shiftsFeed,
            requesterUserId: context.session.member.id,
            nowMillis: nowMillisProvider()
        )
        guard !candidates.isEmpty else {
            feedbackCenter.show(AccessL10nKey.feedbackShiftSwapNoCandidates)
            return nil
        }
        return ShiftSwapCreateSubmission(
            draft: draft,
            requestedShiftId: shift.id,
            request: ShiftSwapRequest(
                id: "",
                requestedShiftId: shift.id,
                requesterUserId: context.session.member.id,
                reason: draft.reason.trimmingCharacters(in: .whitespacesAndNewlines),
                status: .open,
                candidates: candidates,
                responses: [],
                selectedCandidateUserId: nil,
                selectedCandidateShiftId: nil,
                requestedAtMillis: nowMillisProvider(),
                confirmedAtMillis: nil,
                appliedAtMillis: nil
            )
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
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }
        guard let candidate = request.candidates.first(where: { $0.userId == session.member.id && $0.shiftId == candidateShiftId }) else { return }
        guard let mutationOperationId = beginSwapMutation() else { return }
        Task { @MainActor in
            defer { finishSwapMutation(mutationOperationId, context: context) }
            let now = nowMillisProvider()
            let updatedRequest = shiftSwapResponseRequest(
                request: request,
                candidate: candidate,
                responseStatus: responseStatus,
                respondedAtMillis: now
            )
            let result: ShiftSwapTransitionResult
            do {
                result = try await shiftSwapRequestRepository.transition(
                    .respond(
                        request: updatedRequest,
                        candidateShiftId: candidateShiftId,
                        response: responseStatus
                    )
                )
            } catch is CancellationError {
                return
            } catch {
                if isCurrentSwapMutation(mutationOperationId, context: context) {
                    feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
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

    func shiftSwapResponseRequest(
        request: ShiftSwapRequest,
        candidate: ShiftSwapCandidate,
        responseStatus: ShiftSwapResponseStatus,
        respondedAtMillis: Int64
    ) -> ShiftSwapRequest {
        let updatedResponses = request.responses
            .filter { !($0.userId == candidate.userId && $0.shiftId == candidate.shiftId) }
            + [ShiftSwapResponse(
                userId: candidate.userId,
                shiftId: candidate.shiftId,
                status: responseStatus,
                respondedAtMillis: respondedAtMillis
            )]
        return ShiftSwapRequest(
            id: request.id,
            requestedShiftId: request.requestedShiftId,
            requesterUserId: request.requesterUserId,
            reason: request.reason,
            status: request.status,
            candidates: request.candidates,
            responses: updatedResponses.sorted { $0.respondedAtMillis > $1.respondedAtMillis },
            selectedCandidateUserId: request.selectedCandidateUserId,
            selectedCandidateShiftId: request.selectedCandidateShiftId,
            requestedAtMillis: request.requestedAtMillis,
            confirmedAtMillis: request.confirmedAtMillis,
            appliedAtMillis: request.appliedAtMillis
        )
    }

    func confirmShiftSwapContext(requestId: String, candidateShiftId: String) -> ConfirmShiftSwapContext? {
        guard let session = authorizedSession else { return nil }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return nil }
        guard let requestedShift = shiftsFeed.first(where: { $0.id == request.requestedShiftId }) else { return nil }
        guard let candidate = request.candidates.first(where: { $0.shiftId == candidateShiftId }) else { return nil }
        guard let candidateShift = shiftsFeed.first(where: { $0.id == candidate.shiftId }) else { return nil }

        return ConfirmShiftSwapContext(
            session: session,
            request: request,
            requestedShift: requestedShift,
            candidate: candidate,
            candidateShift: candidateShift
        )
    }

    func refreshShiftSwapState(for context: SessionContext) async {
        guard isCurrentSession(context) else { return }
        await refreshShifts()
    }

    func appliedShiftSwapRequest(
        from request: ShiftSwapRequest,
        candidate: ShiftSwapCandidate,
        now: Int64
    ) -> ShiftSwapRequest {
        ShiftSwapRequest(
            id: request.id,
            requestedShiftId: request.requestedShiftId,
            requesterUserId: request.requesterUserId,
            reason: request.reason,
            status: .applied,
            candidates: request.candidates,
            responses: request.responses,
            selectedCandidateUserId: candidate.userId,
            selectedCandidateShiftId: candidate.shiftId,
            requestedAtMillis: request.requestedAtMillis,
            confirmedAtMillis: now,
            appliedAtMillis: now
        )
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

    func finishSwapMutation(_ operationId: UInt64, context: SessionContext) {
        guard activeSwapMutationOperationId == operationId else { return }
        activeSwapMutationOperationId = nil
        guard isCurrentSession(context) else { return }
        isUpdatingShiftSwapRequest = false
    }

}
