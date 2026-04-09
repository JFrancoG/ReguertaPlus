import Foundation

extension SessionViewModel {
    func refreshShifts() {
        guard case .authorized(let session) = mode else { return }
        isLoadingShifts = true
        Task { @MainActor in
            let shifts = await shiftRepository.allShifts()
            let requests = await shiftSwapRequestRepository.allShiftSwapRequests()
            shiftsFeed = shifts
            shiftSwapRequests = requests.visible(to: session.member.id)
            nextDeliveryShift = shifts.nextAssignedShift(
                memberId: session.member.id,
                type: .delivery,
                nowMillis: nowMillisProvider()
            )
            nextMarketShift = shifts.nextAssignedShift(
                memberId: session.member.id,
                type: .market,
                nowMillis: nowMillisProvider()
            )
            isLoadingShifts = false
        }
    }

    func refreshDeliveryCalendar() {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else { return }
        isLoadingDeliveryCalendar = true
        Task { @MainActor in
            defaultDeliveryDayOfWeek = await deliveryCalendarRepository.defaultDeliveryDayOfWeek()
            deliveryCalendarOverrides = await deliveryCalendarRepository.allOverrides()
            isLoadingDeliveryCalendar = false
        }
    }

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

    func saveDeliveryCalendarOverride(
        weekKey: String,
        weekday: DeliveryWeekday,
        updatedByUserId: String,
        onSuccess: @escaping @MainActor () -> Void = {}
    ) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else { return }
        guard let override = buildDeliveryCalendarOverride(
            weekKey: weekKey,
            weekday: weekday,
            updatedByUserId: updatedByUserId,
            updatedAtMillis: nowMillisProvider()
        ) else { return }

        isSavingDeliveryCalendar = true
        Task { @MainActor in
            _ = await deliveryCalendarRepository.upsertOverride(override)
            defaultDeliveryDayOfWeek = await deliveryCalendarRepository.defaultDeliveryDayOfWeek()
            deliveryCalendarOverrides = await deliveryCalendarRepository.allOverrides()
            isSavingDeliveryCalendar = false
            onSuccess()
        }
    }

    func deleteDeliveryCalendarOverride(
        weekKey: String,
        onSuccess: @escaping @MainActor () -> Void = {}
    ) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else { return }

        isSavingDeliveryCalendar = true
        Task { @MainActor in
            await deliveryCalendarRepository.deleteOverride(weekKey: weekKey)
            defaultDeliveryDayOfWeek = await deliveryCalendarRepository.defaultDeliveryDayOfWeek()
            deliveryCalendarOverrides = await deliveryCalendarRepository.allOverrides()
            isSavingDeliveryCalendar = false
            onSuccess()
        }
    }

    func submitShiftPlanningRequest(
        type: ShiftPlanningRequestType,
        onSuccess: @escaping @MainActor () -> Void = {}
    ) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else { return }

        isSubmittingShiftPlanningRequest = true
        Task { @MainActor in
            _ = await shiftPlanningRequestRepository.submit(
                request: ShiftPlanningRequest(
                    id: "",
                    type: type,
                    requestedByUserId: session.member.id,
                    requestedAtMillis: nowMillisProvider(),
                    status: .requested
                )
            )
            isSubmittingShiftPlanningRequest = false
            onSuccess()
        }
    }

    func saveShiftSwapRequest(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard !shiftSwapDraft.shiftId.isEmpty else { return }
        guard let shift = shiftsFeed.first(where: { $0.id == shiftSwapDraft.shiftId }) else { return }
        let candidates = shift.swapCandidates(
            allShifts: shiftsFeed,
            requesterUserId: session.member.id,
            nowMillis: nowMillisProvider()
        )
        guard !candidates.isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackShiftSwapNoCandidates
            return
        }

        isSavingShiftSwapRequest = true
        Task { @MainActor in
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
            let requests = await shiftSwapRequestRepository.allShiftSwapRequests()
            shiftSwapRequests = requests.visible(to: session.member.id)
            shiftSwapDraft = ShiftSwapDraft()
            isSavingShiftSwapRequest = false
            onSuccess()
        }
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
        guard case .authorized(let session) = mode else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }
        guard let requestedShift = shiftsFeed.first(where: { $0.id == request.requestedShiftId }) else { return }
        guard let candidate = request.candidates.first(where: { $0.shiftId == candidateShiftId }) else { return }
        guard let candidateShift = shiftsFeed.first(where: { $0.id == candidate.shiftId }) else { return }

        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            let now = nowMillisProvider()
            let updatedRequest = ShiftSwapRequest(
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
            let swapped = requestedShift.swappingMember(with: candidateShift, requesterUserId: request.requesterUserId, responderUserId: candidate.userId, nowMillis: now)
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
            await sendShiftSwapNotification(
                title: l10n(AccessL10nKey.shiftSwapNotificationAppliedTitle),
                body: l10n(
                    AccessL10nKey.shiftSwapNotificationAppliedBody,
                    session.member.displayName,
                    displayName(for: candidate.userId, in: session),
                    localizedShiftNotificationDateTime(requestedShift.dateMillis),
                    localizedShiftNotificationDateTime(candidateShift.dateMillis)
                ),
                type: "shift_swap_applied",
                targetUserIds: Array(Set(session.members.filter(\.isActive).map(\.id))),
                createdBy: session.member.id
            )
            let allRequests = await shiftSwapRequestRepository.allShiftSwapRequests()
            let allShifts = await shiftRepository.allShifts()
            shiftSwapRequests = allRequests.visible(to: session.member.id)
            shiftsFeed = allShifts
            nextDeliveryShift = allShifts.nextAssignedShift(memberId: session.member.id, type: .delivery, nowMillis: nowMillisProvider())
            nextMarketShift = allShifts.nextAssignedShift(memberId: session.member.id, type: .market, nowMillis: nowMillisProvider())
            isUpdatingShiftSwapRequest = false
        }
    }


    private func updateShiftSwapRequest(
        requestId: String,
        transform: @escaping (ShiftSwapRequest, AuthorizedSession, Int64) -> ShiftSwapRequest
    ) {
        guard case .authorized(let session) = mode else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }

        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            let now = nowMillisProvider()
            let updatedRequest = transform(request, session, now)
            _ = await shiftSwapRequestRepository.upsert(request: updatedRequest)
            let allRequests = await shiftSwapRequestRepository.allShiftSwapRequests()
            let allShifts = await shiftRepository.allShifts()
            shiftSwapRequests = allRequests.visible(to: session.member.id)
            shiftsFeed = allShifts
            nextDeliveryShift = allShifts.nextAssignedShift(
                memberId: session.member.id,
                type: .delivery,
                nowMillis: nowMillisProvider()
            )
            nextMarketShift = allShifts.nextAssignedShift(
                memberId: session.member.id,
                type: .market,
                nowMillis: nowMillisProvider()
            )
            isUpdatingShiftSwapRequest = false
        }
    }

    private func respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        responseStatus: ShiftSwapResponseStatus
    ) {
        guard case .authorized(let session) = mode else { return }
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

    private func sendShiftSwapNotification(
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

    private func shiftSwapResponseNotificationTitle(for status: ShiftSwapResponseStatus) -> String {
        switch status {
        case .available:
            return l10n(AccessL10nKey.shiftSwapNotificationResponseAvailableTitle)
        case .unavailable:
            return l10n(AccessL10nKey.shiftSwapNotificationResponseUnavailableTitle)
        }
    }

    private func shiftSwapResponseNotificationBody(
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

extension Array where Element == ShiftAssignment {
    func nextAssignedShift(
        memberId: String,
        type: ShiftType,
        nowMillis: Int64
    ) -> ShiftAssignment? {
        self
            .filter { $0.type == type && $0.dateMillis >= nowMillis && $0.isAssigned(to: memberId) }
            .min { $0.dateMillis < $1.dateMillis }
    }
}

extension Array where Element == ShiftSwapRequest {
    func visible(to memberId: String) -> [ShiftSwapRequest] {
        filter { request in
            request.requesterUserId == memberId || request.candidates.contains(where: { $0.userId == memberId })
        }
            .sorted { $0.requestedAtMillis > $1.requestedAtMillis }
    }
}

private extension ShiftAssignment {
    func swapCandidates(allShifts: [ShiftAssignment], requesterUserId: String, nowMillis: Int64) -> [ShiftSwapCandidate] {
        let calendar = Calendar(identifier: .iso8601)
        let thresholdDate: Date
        if type == .delivery {
            thresholdDate = calendar.date(byAdding: .day, value: 14, to: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)) ?? Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        } else {
            thresholdDate = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        }
        let thresholdMillis = Int64(thresholdDate.timeIntervalSince1970 * 1_000)
        return Array(
            allShifts
                .filter { $0.id != id && $0.type == type && $0.dateMillis >= thresholdMillis }
                .flatMap { shift in
                    shift.assignedUserIds
                        .filter { $0 != requesterUserId }
                        .map { ShiftSwapCandidate(userId: $0, shiftId: shift.id) }
                }
                .reduce(into: [String: ShiftSwapCandidate]()) { partialResult, candidate in
                    partialResult["\(candidate.userId):\(candidate.shiftId)"] = candidate
                }
                .values
        )
    }

    func swappingMember(with other: ShiftAssignment, requesterUserId: String, responderUserId: String, nowMillis: Int64) -> (ShiftAssignment, ShiftAssignment) {
        func replacing(_ shift: ShiftAssignment, oldUserId: String, newUserId: String) -> ShiftAssignment {
            let updatedAssigned = shift.assignedUserIds.map { $0 == oldUserId ? newUserId : $0 }
            let updatedHelper = shift.helperUserId == oldUserId ? newUserId : shift.helperUserId
            return ShiftAssignment(
                id: shift.id,
                type: shift.type,
                dateMillis: shift.dateMillis,
                assignedUserIds: updatedAssigned,
                helperUserId: updatedHelper,
                status: .confirmed,
                source: "app",
                createdAtMillis: shift.createdAtMillis,
                updatedAtMillis: nowMillis
            )
        }

        return (
            replacing(self, oldUserId: requesterUserId, newUserId: responderUserId),
            replacing(other, oldUserId: responderUserId, newUserId: requesterUserId)
        )
    }
}

private extension Array where Element == ShiftAssignment {
    func applyingConfirmedSwap(
        updatedRequestedShift: ShiftAssignment,
        updatedCandidateShift: ShiftAssignment,
        nowMillis: Int64
    ) -> [ShiftAssignment] {
        let replaced = map { shift in
            if shift.id == updatedRequestedShift.id {
                return updatedRequestedShift
            }
            if shift.id == updatedCandidateShift.id {
                return updatedCandidateShift
            }
            return shift
        }

        let deliveries = replaced
            .filter { $0.type == .delivery }
            .sorted { $0.dateMillis < $1.dateMillis }
        let helperByDeliveryId = Dictionary(
            uniqueKeysWithValues: deliveries.enumerated().map { index, shift in
                (shift.id, index + 1 < deliveries.count ? deliveries[index + 1].assignedUserIds.first : nil)
            }
        )

        return replaced.map { shift in
            guard shift.type == .delivery else { return shift }
            let recomputedHelper = helperByDeliveryId[shift.id] ?? nil
            guard shift.helperUserId != recomputedHelper else { return shift }
            return ShiftAssignment(
                id: shift.id,
                type: shift.type,
                dateMillis: shift.dateMillis,
                assignedUserIds: shift.assignedUserIds,
                helperUserId: recomputedHelper,
                status: .confirmed,
                source: "app",
                createdAtMillis: shift.createdAtMillis,
                updatedAtMillis: nowMillis
            )
        }
    }
}

private func localizedShiftNotificationDateTime(_ millis: Int64) -> String {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .none
    return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
}

private func displayName(for memberId: String, in session: AuthorizedSession) -> String {
    session.members.first(where: { $0.id == memberId })?.displayName ?? memberId
}
