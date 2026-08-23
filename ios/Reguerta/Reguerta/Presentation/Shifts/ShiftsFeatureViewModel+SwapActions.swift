import Foundation

extension ShiftsFeatureViewModel {
    func updateShiftSwapDraft(_ update: (inout ShiftSwapDraft) -> Void) {
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

    func startSavingShiftSwapRequest() -> Task<Bool, Never>? {
        guard let context = authorizedSessionContext,
              let submission = shiftSwapCreateSubmission(for: context),
              let mutationTask = startShiftSwapMutation(.create(submission), context: context) else { return nil }
        return mutationTask
    }

    func acceptShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(
            requestId: requestId,
            candidateShiftId: candidateShiftId,
            responseStatus: .available
        )
    }

    func rejectShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(
            requestId: requestId,
            candidateShiftId: candidateShiftId,
            responseStatus: .unavailable
        )
    }

    func startCancellingShiftSwapRequest(requestId: String) -> Task<Bool, Never>? {
        guard let context = authorizedSessionContext,
              !acknowledgedShiftSwapRequestIds.contains(requestId),
              shiftSwapRequests.contains(where: { $0.id == requestId }),
              let mutationTask = startShiftSwapMutation(
                  .cancel(requestId: requestId),
                  context: context
              ) else { return nil }
        return mutationTask
    }

    func confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        guard let context = authorizedSessionContext,
              !acknowledgedShiftSwapRequestIds.contains(requestId),
              let request = shiftSwapRequests.first(where: { $0.id == requestId }),
              request.requesterUserId == context.session.member.id,
              request.candidates.contains(where: { $0.shiftId == candidateShiftId }) else { return }

        _ = startShiftSwapMutation(
            .apply(requestId: requestId, candidateShiftId: candidateShiftId),
            context: context
        )
    }
}

private extension ShiftsFeatureViewModel {
    func shiftSwapCreateSubmission(for context: SessionContext) -> ShiftSwapCreateSubmission? {
        let draft = shiftSwapDraft
        guard !draft.shiftId.isEmpty,
              let shift = shiftsFeed.first(where: { $0.id == draft.shiftId }),
              canRequestSwapForShift(shift, currentMemberId: context.session.member.id) else { return nil }
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
        guard let context = authorizedSessionContext,
              !acknowledgedShiftSwapRequestIds.contains(requestId),
              let request = shiftSwapRequests.first(where: { $0.id == requestId }),
              let candidate = request.candidates.first(where: {
                  $0.userId == context.session.member.id && $0.shiftId == candidateShiftId
              }) else { return }

        _ = startShiftSwapMutation(
            .respond(
                requestId: requestId,
                userId: candidate.userId,
                candidateShiftId: candidate.shiftId,
                response: responseStatus
            ),
            context: context
        )
    }
}
