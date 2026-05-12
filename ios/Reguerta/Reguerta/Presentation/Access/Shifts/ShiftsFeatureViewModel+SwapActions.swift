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
            sessionViewModel.feedbackMessageKey = AccessL10nKey.feedbackShiftSwapNoCandidates
            return false
        }

        isSavingShiftSwapRequest = true
        let saved = await shiftSwapRequestRepository.upsert(
            request: ShiftSwapRequest(
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
        )
        await sendShiftSwapNotification(
            title: l10n(AccessL10nKey.shiftSwapNotificationRequestedTitle),
            body: l10n(
                AccessL10nKey.shiftSwapNotificationRequestedBody,
                session.member.displayName,
                localizedShiftNotificationDateTime(shift.dateMillis)
            ),
            type: "shift_swap_requested",
            targetUserIds: Array(Set(saved.candidates.map(\.userId))),
            createdBy: session.member.id
        )
        await refreshShiftSwapState(for: session)
        shiftSwapDraft = ShiftSwapDraft()
        isSavingShiftSwapRequest = false
        return true
    }

    func acceptShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId, responseStatus: .available)
    }

    func rejectShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId, responseStatus: .unavailable)
    }

    func cancelShiftSwapRequest(requestId: String) {
        updateShiftSwapRequest(requestId: requestId) { request, _, _ in
            ShiftSwapRequest(
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
        }
    }

    func confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        guard let context = confirmShiftSwapContext(
            requestId: requestId,
            candidateShiftId: candidateShiftId
        ) else { return }

        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            let now = nowMillisProvider()
            let updatedRequest = appliedShiftSwapRequest(from: context.request, candidate: context.candidate, now: now)
            let swapped = context.requestedShift.swappingMember(
                with: context.candidateShift,
                requesterUserId: context.request.requesterUserId,
                responderUserId: context.candidate.userId,
                nowMillis: now
            )
            _ = await shiftSwapRequestRepository.upsert(request: updatedRequest)
            let existingShifts = await shiftRepository.allShifts()
            let shiftsToPersist = existingShifts.applyingConfirmedSwap(
                updatedRequestedShift: swapped.0,
                updatedCandidateShift: swapped.1,
                nowMillis: now
            )
            for shift in shiftsToPersist {
                _ = await shiftRepository.upsert(shift: shift)
            }
            await sendShiftSwapAppliedNotification(context: context)
            await refreshShiftSwapState(for: context.session)
            isUpdatingShiftSwapRequest = false
        }
    }
}

private extension ShiftsFeatureViewModel {
    func updateShiftSwapRequest(
        requestId: String,
        transform: @escaping (ShiftSwapRequest, AuthorizedSession, Int64) -> ShiftSwapRequest
    ) {
        guard let session = authorizedSession else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }

        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            let now = nowMillisProvider()
            let updatedRequest = transform(request, session, now)
            _ = await shiftSwapRequestRepository.upsert(request: updatedRequest)
            await refreshShiftSwapState(for: session)
            isUpdatingShiftSwapRequest = false
        }
    }

    func respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        responseStatus: ShiftSwapResponseStatus
    ) {
        guard let session = authorizedSession else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }
        guard let candidate = request.candidates.first(where: { $0.userId == session.member.id && $0.shiftId == candidateShiftId }) else { return }
        guard let requestedShift = shiftsFeed.first(where: { $0.id == request.requestedShiftId }) else { return }
        let candidateShift = shiftsFeed.first(where: { $0.id == candidate.shiftId })

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
            _ = await shiftSwapRequestRepository.upsert(request: updatedRequest)
            await sendShiftSwapNotification(
                title: shiftSwapResponseNotificationTitle(for: responseStatus),
                body: shiftSwapResponseNotificationBody(
                    for: responseStatus,
                    memberDisplayName: session.member.displayName,
                    requestedShiftDate: localizedShiftNotificationDateTime(requestedShift.dateMillis),
                    candidateShiftDate: candidateShift.map { localizedShiftNotificationDateTime($0.dateMillis) }
                ),
                type: responseStatus == .available ? "shift_swap_available" : "shift_swap_unavailable",
                targetUserIds: [request.requesterUserId],
                createdBy: session.member.id
            )
            let allRequests = await shiftSwapRequestRepository.allShiftSwapRequests()
            shiftSwapRequests = allRequests.visible(to: session.member.id)
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

    func sendShiftSwapAppliedNotification(context: ConfirmShiftSwapContext) async {
        await sendShiftSwapNotification(
            title: l10n(AccessL10nKey.shiftSwapNotificationAppliedTitle),
            body: l10n(
                AccessL10nKey.shiftSwapNotificationAppliedBody,
                context.session.member.displayName,
                displayName(for: context.candidate.userId, in: context.session),
                localizedShiftNotificationDateTime(context.requestedShift.dateMillis),
                localizedShiftNotificationDateTime(context.candidateShift.dateMillis)
            ),
            type: "shift_swap_applied",
            targetUserIds: Array(Set(context.session.members.filter(\.isActive).map(\.id))),
            createdBy: context.session.member.id
        )
    }

    func sendShiftSwapNotification(
        title: String,
        body: String,
        type: String,
        targetUserIds: [String],
        createdBy: String
    ) async {
        _ = await notificationRepository.send(
            event: NotificationEvent(
                id: "",
                title: title,
                body: body,
                type: type,
                target: "users",
                userIds: targetUserIds,
                segmentType: nil,
                targetRole: nil,
                createdBy: createdBy,
                sentAtMillis: nowMillisProvider(),
                weekKey: nil
            )
        )
    }

    func shiftSwapResponseNotificationTitle(for status: ShiftSwapResponseStatus) -> String {
        switch status {
        case .available:
            return l10n(AccessL10nKey.shiftSwapNotificationResponseAvailableTitle)
        case .unavailable:
            return l10n(AccessL10nKey.shiftSwapNotificationResponseUnavailableTitle)
        }
    }

    func shiftSwapResponseNotificationBody(
        for status: ShiftSwapResponseStatus,
        memberDisplayName: String,
        requestedShiftDate: String,
        candidateShiftDate: String?
    ) -> String {
        switch (status, candidateShiftDate) {
        case (.available, .some(let sourceDate)):
            return l10n(
                AccessL10nKey.shiftSwapNotificationResponseAvailableBodyWithSource,
                memberDisplayName,
                requestedShiftDate,
                sourceDate
            )
        case (.available, .none):
            return l10n(
                AccessL10nKey.shiftSwapNotificationResponseAvailableBody,
                memberDisplayName,
                requestedShiftDate
            )
        case (.unavailable, .some(let sourceDate)):
            return l10n(
                AccessL10nKey.shiftSwapNotificationResponseUnavailableBodyWithSource,
                memberDisplayName,
                requestedShiftDate,
                sourceDate
            )
        case (.unavailable, .none):
            return l10n(
                AccessL10nKey.shiftSwapNotificationResponseUnavailableBody,
                memberDisplayName,
                requestedShiftDate
            )
        }
    }
}
