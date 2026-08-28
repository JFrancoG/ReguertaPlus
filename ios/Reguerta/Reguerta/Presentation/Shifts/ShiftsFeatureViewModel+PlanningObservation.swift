import Foundation

extension ShiftsFeatureViewModel {
    func startShiftPlanningObservation() {
        resetShiftPlanningObservation()
        guard let context = authorizedSessionContext, context.session.member.isAdmin else { return }
        shiftPlanningObservationTask = Task { @MainActor [weak self] in
            guard let self else { return }
            let stream = await shiftPlanningRequestRepository.observeLatestV2Request(environment: context.environment)
            do {
                for try await observation in stream {
                    try Task.checkCancellation()
                    guard isCurrentAdminSession(context) else { return }
                    shiftPlanningObservation = observation
                    if let reference = observation?.candidateReference,
                       shiftPlanningCandidate?.candidateDigest != reference.candidateDigest {
                        isLoadingShiftPlanningCandidate = true
                        shiftPlanningCandidate = nil
                        let candidate = try await shiftPlanningRequestRepository.stagedCandidate(reference: reference)
                        try Task.checkCancellation()
                        guard isCurrentAdminSession(context), shiftPlanningObservation?.id == observation?.id else {
                            return
                        }
                        shiftPlanningCandidate = candidate
                        isLoadingShiftPlanningCandidate = false
                    } else if observation?.candidateReference == nil {
                        shiftPlanningCandidate = nil
                        isLoadingShiftPlanningCandidate = false
                    }
                    reportPlanningFailureOnce(observation, context: context)
                    await refreshActivatedShiftsOnce(observation, context: context)
                }
            } catch is CancellationError {
                return
            } catch {
                guard isCurrentAdminSession(context) else { return }
                isLoadingShiftPlanningCandidate = false
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
    }

    func resetShiftPlanningObservation() {
        shiftPlanningObservationTask?.cancel()
        shiftPlanningObservationTask = nil
        shiftPlanningObservation = nil
        shiftPlanningCandidate = nil
        isLoadingShiftPlanningCandidate = false
        isRefreshingShiftsAfterActivation = false
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
