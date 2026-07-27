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
        isSavingShiftSwapRequest = false
    }

    func dismissShiftSwapActivity(requestId: String) {
        dismissedShiftSwapRequestIds.insert(requestId)
    }

    func saveShiftSwapRequest() async -> Bool {
        guard let session = authorizedSession else { return false }
        guard !shiftSwapDraft.shiftId.isEmpty else { return false }
        guard let shift = shiftsFeed.first(where: { $0.id == shiftSwapDraft.shiftId }) else { return false }
        let candidates = shift.swapCandidates(
            allShifts: shiftsFeed,
            requesterUserId: session.member.id,
            nowMillis: nowMillisProvider()
        )
        guard !candidates.isEmpty else {
            feedbackCenter.show(AccessL10nKey.feedbackShiftSwapNoCandidates)
            return false
        }

        isSavingShiftSwapRequest = true
        defer { isSavingShiftSwapRequest = false }
        let request = ShiftSwapRequest(
                id: "",
                requestedShiftId: shift.id,
                requesterUserId: session.member.id,
                reason: shiftSwapDraft.reason.trimmingCharacters(in: .whitespacesAndNewlines),
                status: .open,
                candidates: candidates,
                responses: [],
                selectedCandidateUserId: nil,
                selectedCandidateShiftId: nil,
                requestedAtMillis: nowMillisProvider(),
                confirmedAtMillis: nil,
                appliedAtMillis: nil
        )
        do {
            _ = try await shiftSwapRequestRepository.transition(.create(request: request))
        } catch {
            feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            return false
        }
        await refreshShiftSwapState(for: session)
        shiftSwapDraft = ShiftSwapDraft()
        return true
    }

    func acceptShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId, responseStatus: .available)
    }

    func rejectShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId, responseStatus: .unavailable)
    }

    func cancelShiftSwapRequest(requestId: String) {
        guard let session = authorizedSession,
              let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }
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
        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            defer { isUpdatingShiftSwapRequest = false }
            do {
                _ = try await shiftSwapRequestRepository.transition(.cancel(request: cancelled))
                await refreshShiftSwapState(for: session)
            } catch {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
        }
    }

    func confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        guard let context = confirmShiftSwapContext(
            requestId: requestId,
            candidateShiftId: candidateShiftId
        ) else { return }

        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            defer { isUpdatingShiftSwapRequest = false }
            let now = nowMillisProvider()
            let updatedRequest = appliedShiftSwapRequest(from: context.request, candidate: context.candidate, now: now)
            do {
                _ = try await shiftSwapRequestRepository.transition(
                    .apply(request: updatedRequest, candidateShiftId: candidateShiftId)
                )
                await refreshShiftSwapState(for: context.session)
            } catch {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
        }
    }
}

private extension ShiftsFeatureViewModel {
    func respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        responseStatus: ShiftSwapResponseStatus
    ) {
        guard let session = authorizedSession else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }
        guard let candidate = request.candidates.first(where: { $0.userId == session.member.id && $0.shiftId == candidateShiftId }) else { return }
        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            let now = nowMillisProvider()
            let updatedResponses = request.responses
                .filter { !($0.userId == candidate.userId && $0.shiftId == candidate.shiftId) }
                + [ShiftSwapResponse(
                    userId: candidate.userId,
                    shiftId: candidate.shiftId,
                    status: responseStatus,
                    respondedAtMillis: now
                )]
            let updatedRequest = ShiftSwapRequest(
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
            do {
                _ = try await shiftSwapRequestRepository.transition(
                    .respond(
                        request: updatedRequest,
                        candidateShiftId: candidateShiftId,
                        response: responseStatus
                    )
                )
                let allRequests = await shiftSwapRequestRepository.allShiftSwapRequests()
                shiftSwapRequests = allRequests.visible(to: session.member.id)
            } catch {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
            isUpdatingShiftSwapRequest = false
        }
    }

    func confirmShiftSwapContext(
        requestId: String,
        candidateShiftId: String
    ) -> ConfirmShiftSwapContext? {
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

    func refreshShiftSwapState(for session: AuthorizedSession) async {
        let allRequests = await shiftSwapRequestRepository.allShiftSwapRequests()
        let allShifts = await shiftRepository.allShifts()
        shiftSwapRequests = allRequests.visible(to: session.member.id)
        shiftsFeed = allShifts
        recomputeNextShifts()
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

}
