import Foundation

extension SessionViewModel {
    func applyLocalSessionTermination(firebaseSignOutSucceeded: Bool, showsExpiredDialog: Bool) {
        let principalEmail = sessionOperationState == .idle
            ? currentPrincipalEmail
            : sessionOperationPrincipalEmail
        let hadOwnedSessionOperation = prepareForLocalSessionTermination()
        if firebaseSignOutSucceeded {
            mode = .signedOut
        } else {
            mode = .unauthorized(
                email: principalEmail,
                reason: .userAccessRestricted
            )
            feedbackCenter.show(AccessL10nKey.authErrorUnknown)
        }
        showSessionExpiredDialog = showsExpiredDialog
        showUnauthorizedDialog = !firebaseSignOutSucceeded && !showsExpiredDialog
        if !hadOwnedSessionOperation {
            startStandaloneSessionTerminationBarrier(
                firebaseSignOutSucceeded: firebaseSignOutSucceeded,
                principalEmail: principalEmail
            )
        }
    }

    func applyEmailVerificationRequiredSession(
        email: String,
        firebaseSignOutSucceeded: Bool,
        feedbackMessageKey: String
    ) {
        let hadOwnedSessionOperation = prepareForLocalSessionTermination()
        mode = firebaseSignOutSucceeded
            ? .signedOut
            : .unauthorized(email: email, reason: .emailVerificationRequired)
        feedbackCenter.show(feedbackMessageKey)
        if !hadOwnedSessionOperation {
            startStandaloneSessionTerminationBarrier(
                firebaseSignOutSucceeded: firebaseSignOutSucceeded,
                principalEmail: email
            )
        }
    }

    func beginSessionOperation(principalEmail: String) -> SessionOperationContext? {
        guard sessionOperationState == .idle else { return nil }
        let predecessor = invalidateSessionOperation()
        sessionOperationPrincipalEmail = principalEmail
        sessionOperationState = .active(generation: sessionOperationGeneration)
        return SessionOperationContext(
            generation: sessionOperationGeneration,
            predecessor: predecessor,
            principalEmail: principalEmail
        )
    }

    @discardableResult func invalidateSessionOperation() -> Task<Void, Never>? {
        let invalidatedTask = sessionOperationTask
        invalidatedTask?.cancel()
        switch sessionOperationState {
        case .draining:
            isAuthenticating = false
            isRegistering = false
            isSessionRefreshInFlight = false
            return invalidatedTask
        case .active(let generation):
            sessionOperationTimeoutTask?.cancel()
            sessionOperationTimeoutTask = nil
            sessionOperationState = .draining(generation: generation)
            isAuthenticating = false
            isRegistering = false
            isSessionRefreshInFlight = false
            return invalidatedTask
        case .idle:
            break
        }
        sessionOperationTimeoutTask?.cancel()
        sessionOperationTimeoutTask = nil
        sessionOperationGeneration &+= 1
        sessionOperationState = .idle
        isAuthenticating = false
        isRegistering = false
        isSessionRefreshInFlight = false
        return invalidatedTask
    }

    func isCurrentSessionOperation(_ generation: UInt64) -> Bool {
        guard !Task.isCancelled, generation == sessionOperationGeneration else { return false }
        return sessionOperationState != .draining(generation: generation)
    }

    func finishSessionOperation(_ generation: UInt64) {
        guard generation == sessionOperationGeneration else { return }
        guard sessionOperationState == .active(generation: generation) ||
            sessionOperationState == .draining(generation: generation) else { return }
        guard sessionTerminationCleanupTask == nil else { return }
        sessionOperationTimeoutTask?.cancel()
        sessionOperationTimeoutTask = nil
        sessionOperationTask = nil
        sessionOperationState = .idle
        sessionOperationPrincipalEmail = ""
        isAuthenticating = false
        isRegistering = false
        isSessionRefreshInFlight = false
    }

    func startSessionOperationTimeout(_ generation: UInt64) {
        guard sessionOperationState == .active(generation: generation) else { return }
        let timeout = sessionOperationTimeout
        let sleeper = sessionOperationSleeper

        sessionOperationTimeoutTask = Task { @MainActor [weak self, sleeper] in
            do {
                try await sleeper(timeout)
                try Task.checkCancellation()
            } catch {
                self?.finishSessionOperationTimeout(generation)
                return
            }
            self?.handleSessionOperationTimeout(generation)
        }
    }

    func finishSessionOperationAfterProviderReturn(_ generation: UInt64) {
        if sessionOperationState == .draining(generation: generation) {
            guard authSessionProvider.signOut() else {
                applyDefinitiveSessionCleanupFailure()
                return
            }
            if let cleanupTask = sessionTerminationCleanupTask {
                startSessionTerminationCleanupBarrier(
                    cleanupTask,
                    generation: generation,
                    cleanupGeneration: sessionTerminationCleanupGeneration
                )
                return
            }
        }
        finishSessionOperation(generation)
    }

    func isDrainingSessionOperation(_ generation: UInt64) -> Bool {
        sessionOperationState == .draining(generation: generation)
    }

    /// Revokes local authorization immediately and keeps the session lane draining until owned cleanup completes.
    func prepareForResolvedAuthorizationRevocation(principalEmail: String) {
        let hadOwnedSessionOperation = prepareForLocalSessionTermination()
        guard !hadOwnedSessionOperation else { return }
        startStandaloneSessionTerminationBarrier(
            firebaseSignOutSucceeded: authSessionProvider.signOut(),
            principalEmail: principalEmail
        )
    }

    @discardableResult private func prepareForLocalSessionTermination() -> Bool {
        let environmentLease = authorizedEnvironmentLease
        let deviceSessionLease = authorizedDeviceSessionLease
        let hadOwnedSessionOperation = sessionOperationState != .idle
        invalidateAuthorizedDeviceRegistration()
        authorizedEnvironmentLease = nil
        authorizedDeviceSessionLease = nil
        invalidateSessionOperation()
        clearSessionRefreshTracking()
        if let environmentLease {
            environmentRouter.resetToBaseEnvironment(ifOwnedBy: environmentLease)
        }
        let freshnessCleanupSucceeded: Bool
        do {
            try criticalDataFreshnessLocalRepository.clear()
            freshnessCleanupSucceeded = true
        } catch {
            freshnessCleanupSucceeded = false
        }
        let cleanupTask: Task<Bool, Never>?
        if let deviceSessionLease {
            cleanupTask = Task { [authorizedDeviceRegistrar] in
                let deviceCleanupSucceeded: Bool
                do {
                    try await authorizedDeviceRegistrar.clearAuthorization(
                        ifOwnedBy: deviceSessionLease
                    )
                    deviceCleanupSucceeded = true
                } catch is CancellationError {
                    deviceCleanupSucceeded = false
                } catch {
                    deviceCleanupSucceeded = false
                }
                return freshnessCleanupSucceeded && deviceCleanupSucceeded
            }
        } else if !freshnessCleanupSucceeded {
            cleanupTask = Task { false }
        } else {
            cleanupTask = nil
        }
        appendSessionTerminationCleanup(cleanupTask)
        resetAccessCredentialsAndErrors()
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        feedbackCenter.clear()
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
        return hadOwnedSessionOperation
    }

    private func invalidateAuthorizedDeviceRegistration() {
        authorizedDeviceRegistrationRevision &+= 1
        authorizedDeviceRegistrationTask?.cancel()
        authorizedDeviceRegistrationTask = nil
    }

    private func handleSessionOperationTimeout(_ generation: UInt64) {
        guard sessionOperationState == .active(generation: generation) else { return }

        sessionOperationState = .draining(generation: generation)
        sessionOperationTask?.cancel()
        sessionOperationTimeoutTask = nil
        let principalEmail = sessionOperationPrincipalEmail
        let firebaseSignOutSucceeded = authSessionProvider.signOut()
        prepareForLocalSessionTermination()
        mode = firebaseSignOutSucceeded
            ? .signedOut
            : .unauthorized(email: principalEmail, reason: .userAccessRestricted)
        feedbackCenter.show(AccessL10nKey.authErrorNetwork)
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
    }

    private func finishSessionOperationTimeout(_ generation: UInt64) {
        guard sessionOperationState == .active(generation: generation) else { return }
        sessionOperationTimeoutTask = nil
    }

    private func applyDefinitiveSessionCleanupFailure() {
        if case .unauthorized(_, .emailVerificationRequired) = mode {
            showSessionExpiredDialog = false
            showUnauthorizedDialog = false
            return
        }
        mode = .unauthorized(
            email: sessionOperationPrincipalEmail,
            reason: .userAccessRestricted
        )
        feedbackCenter.show(AccessL10nKey.authErrorUnknown)
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
    }

    private func startStandaloneSessionTerminationBarrier(firebaseSignOutSucceeded: Bool, principalEmail: String) {
        guard !firebaseSignOutSucceeded || sessionTerminationCleanupTask != nil else { return }
        let generation = sessionOperationGeneration
        sessionOperationPrincipalEmail = principalEmail
        sessionOperationState = .draining(generation: generation)

        guard firebaseSignOutSucceeded,
              let cleanupTask = sessionTerminationCleanupTask else {
            let cleanupTask = sessionTerminationCleanupTask
            sessionOperationTask = Task {
                if let cleanupTask {
                    _ = await cleanupTask.value
                }
            }
            return
        }
        startSessionTerminationCleanupBarrier(
            cleanupTask,
            generation: generation,
            cleanupGeneration: sessionTerminationCleanupGeneration
        )
    }

    private func startSessionTerminationCleanupBarrier(
        _ cleanupTask: Task<Bool, Never>,
        generation: UInt64,
        cleanupGeneration: UInt64
    ) {
        sessionOperationTask = Task { @MainActor [weak self] in
            let cleanupSucceeded = await cleanupTask.value
            guard let self,
                  self.sessionOperationState == .draining(generation: generation) else {
                return
            }
            guard self.sessionTerminationCleanupGeneration == cleanupGeneration else {
                if let currentCleanupTask = self.sessionTerminationCleanupTask {
                    self.startSessionTerminationCleanupBarrier(
                        currentCleanupTask,
                        generation: generation,
                        cleanupGeneration: self.sessionTerminationCleanupGeneration
                    )
                }
                return
            }
            guard cleanupSucceeded else {
                self.applyDefinitiveSessionCleanupFailure()
                return
            }
            self.sessionTerminationCleanupTask = nil
            self.finishSessionOperation(generation)
        }
    }

    private func appendSessionTerminationCleanup(_ cleanupTask: Task<Bool, Never>?) {
        guard let cleanupTask else { return }
        sessionTerminationCleanupGeneration &+= 1
        guard let previousCleanupTask = sessionTerminationCleanupTask else {
            sessionTerminationCleanupTask = cleanupTask
            return
        }
        sessionTerminationCleanupTask = Task {
            let previousSucceeded = await previousCleanupTask.value
            let currentSucceeded = await cleanupTask.value
            return previousSucceeded && currentSucceeded
        }
    }
}
