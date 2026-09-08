import Foundation

extension ShiftsFeatureViewModel {
    func startShiftPlanningObservation() {
        shiftPlanningObservationTask?.cancel()
        guard let context = authorizedSessionContext, context.session.member.isAdmin else {
            resetShiftPlanningObservation()
            return
        }
        shiftPlanningObservationTask = Task { @MainActor [weak self] in
            await self?.observeShiftPlanningRequests(context: context)
        }
    }

    func resetShiftPlanningObservation() {
        shiftPlanningObservationTask?.cancel()
        shiftPlanningObservationTask = nil
        selectedShiftPlanningRequestID = nil
        shiftPlanningObservation = nil
        shiftPlanningCandidate = nil
        isLoadingShiftPlanningCandidate = false
        isRefreshingShiftsAfterActivation = false
    }

    private func observeShiftPlanningRequests(context: SessionContext) async {
        var retryDelaySeconds = 1
        var hasReportedReadFailure = false
        while !Task.isCancelled, isCurrentAdminSession(context) {
            let requestID = selectedShiftPlanningRequestID
            let stream = await shiftPlanningRequestRepository.observeV2Request(
                environment: context.environment,
                requestedByUserID: context.session.member.id,
                requestID: requestID
            )
            do {
                var selectionChanged = false
                for try await observation in stream {
                    if try await consumePlanningObservation(observation, requestID: requestID, context: context) {
                        selectionChanged = true
                        break
                    }
                    retryDelaySeconds = 1
                    hasReportedReadFailure = false
                }
                guard selectionChanged else { return }
            } catch is CancellationError {
                return
            } catch {
                guard isCurrentAdminSession(context), !Task.isCancelled else { return }
                isLoadingShiftPlanningCandidate = false
                if !hasReportedReadFailure {
                    feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
                    hasReportedReadFailure = true
                }
                guard isRetryablePlanningRead(error) else { return }
                do {
                    try await shiftsRetrySleeper(.seconds(retryDelaySeconds))
                } catch {
                    return
                }
                retryDelaySeconds = min(retryDelaySeconds * 2, 30)
            }
        }
    }

    private func consumePlanningObservation(
        _ observation: ShiftPlanningRequestObservation?,
        requestID: String?,
        context: SessionContext
    ) async throws -> Bool {
        try Task.checkCancellation()
        guard isCurrentAdminSession(context) else { throw CancellationError() }
        try validatePlanningObservation(observation, requestID: requestID, context: context)
        shiftPlanningObservation = observation
        if requestID == nil, let observation,
           observation.status == .requested || observation.status == .processing {
            selectedShiftPlanningRequestID = observation.id
            return true
        }
        try await loadPlanningCandidate(observation, context: context)
        try Task.checkCancellation()
        guard isCurrentAdminSession(context) else { throw CancellationError() }
        reportPlanningFailureOnce(observation, context: context)
        await refreshActivatedShiftsOnce(observation, context: context)
        try Task.checkCancellation()
        guard isCurrentAdminSession(context) else { throw CancellationError() }
        if requestID != nil, observation?.status == .completed || observation?.status == .failed {
            selectedShiftPlanningRequestID = nil
            return true
        }
        return false
    }

    private func validatePlanningObservation(
        _ observation: ShiftPlanningRequestObservation?,
        requestID: String?,
        context: SessionContext
    ) throws {
        guard let observation else { return }
        guard observation.requestedByUserId == context.session.member.id,
              requestID == nil || observation.id == requestID else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.observationOwner")
        }
    }

    private func loadPlanningCandidate(
        _ observation: ShiftPlanningRequestObservation?,
        context: SessionContext
    ) async throws {
        guard let reference = observation?.candidateReference else {
            shiftPlanningCandidate = nil
            isLoadingShiftPlanningCandidate = false
            return
        }
        guard shiftPlanningCandidate?.candidateDigest != reference.candidateDigest else { return }
        isLoadingShiftPlanningCandidate = true
        shiftPlanningCandidate = nil
        let candidate = try await shiftPlanningRequestRepository.stagedCandidate(reference: reference)
        try Task.checkCancellation()
        guard isCurrentAdminSession(context) else { return }
        shiftPlanningCandidate = candidate
        isLoadingShiftPlanningCandidate = false
    }

    private func isRetryablePlanningRead(_ error: any Error) -> Bool {
        guard let error = error as? RepositoryError else { return false }
        switch error {
        case .unavailable, .unknown: return true
        case .notFound, .permissionDenied, .invalidData: return false
        }
    }

    private func reportPlanningFailureOnce(
        _ observation: ShiftPlanningRequestObservation?,
        context: SessionContext
    ) {
        guard observation?.status == .failed,
              let requestID = observation?.id,
              reportedPlanningFailureRequestIds.insert(requestID).inserted,
              isCurrentAdminSession(context) else { return }
        feedbackCenter.show(AccessL10nKey.feedbackShiftPlanningFailed)
    }

    private func refreshActivatedShiftsOnce(
        _ observation: ShiftPlanningRequestObservation?,
        context: SessionContext
    ) async {
        guard observation?.mode == .activate,
              observation?.status == .completed,
              let requestID = observation?.id,
              refreshedActivationRequestIds.insert(requestID).inserted,
              isCurrentAdminSession(context) else { return }
        isRefreshingShiftsAfterActivation = true
        await refreshShifts()
        guard isCurrentAdminSession(context), shiftPlanningObservation?.id == requestID else { return }
        isRefreshingShiftsAfterActivation = false
    }

    private func isCurrentAdminSession(_ context: SessionContext) -> Bool {
        isCurrentSession(context) && context.session.member.isAdmin
    }
}
