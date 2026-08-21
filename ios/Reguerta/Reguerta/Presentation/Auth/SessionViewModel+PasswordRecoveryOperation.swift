import Foundation

extension SessionViewModel {
    /// Starts one password-recovery request without occupying the serialized authentication lane.
    ///
    /// The retained task and monotonic generation own result publication. Leaving the recovery route,
    /// terminating the local session, or starting a successor invalidates that ownership synchronously, so a
    /// late provider result cannot publish feedback or clear state belonging to a later request.
    func sendPasswordReset() {
        guard passwordRecoveryOperationTask == nil else { return }
        let email = normalizeAccessEmail(recoverEmailInput)
        feedbackCenter.clear()
        recoverEmailErrorKey = nil

        if email.isEmpty {
            recoverEmailErrorKey = AccessL10nKey.feedbackEmailRequired
            return
        }
        if !isValidAccessEmail(email) {
            recoverEmailErrorKey = AccessL10nKey.feedbackEmailInvalid
            return
        }

        let generation = beginPasswordRecoveryOperation()
        let provider = authSessionProvider
        passwordRecoveryOperationTask = Task { @MainActor [weak self, provider] in
            let result = await provider.sendPasswordReset(email: email)
            guard let self, isCurrentPasswordRecoveryOperation(generation) else { return }
            defer { finishPasswordRecoveryOperation(generation) }

            switch result {
            case .success:
                feedbackCenter.show(AccessL10nKey.authInfoPasswordResetSent)
            case .failure(let reason):
                applyPasswordResetFailure(reason)
            }
        }
    }

    func resetRecoverDraft() {
        invalidatePasswordRecoveryOperation()
        recoverEmailInput = ""
        recoverEmailErrorKey = nil
    }

    /// Revokes publication ownership immediately without waiting for cooperative provider cancellation.
    ///
    /// Incrementing the generation before clearing the retained handle ensures that a late provider completion cannot
    /// publish feedback or finish a successor operation, even when the provider ignores task cancellation.
    func invalidatePasswordRecoveryOperation() {
        passwordRecoveryOperationGeneration &+= 1
        passwordRecoveryOperationTask?.cancel()
        passwordRecoveryOperationTask = nil
        isRecoveringPassword = false
    }

    private func beginPasswordRecoveryOperation() -> UInt64 {
        passwordRecoveryOperationGeneration &+= 1
        isRecoveringPassword = true
        return passwordRecoveryOperationGeneration
    }

    private func isCurrentPasswordRecoveryOperation(_ generation: UInt64) -> Bool {
        !Task.isCancelled && generation == passwordRecoveryOperationGeneration
    }

    private func finishPasswordRecoveryOperation(_ generation: UInt64) {
        guard generation == passwordRecoveryOperationGeneration else { return }
        passwordRecoveryOperationTask = nil
        isRecoveringPassword = false
    }
}
