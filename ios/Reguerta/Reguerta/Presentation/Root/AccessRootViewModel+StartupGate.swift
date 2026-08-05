import Foundation

extension AccessRootViewModel {
    func handleSplashIfNeeded() async {
        guard shellState.currentRoute == .splash else { return }

        if shouldSkipSplash {
            splashDelayCompleted = true
            startupGateState = .optionalDismissed
            continueFromSplashIfAllowed()
            return
        }

        try? await Task.sleep(nanoseconds: SplashAnimationContract.durationNanoseconds)
        guard shellState.currentRoute == .splash else { return }
        splashDelayCompleted = true
        continueFromSplashIfAllowed()
    }

    func refreshSessionAndEvaluateStartupGate() {
        sessionViewModel.refreshSession(trigger: .startup)
        evaluateStartupGateIfNeeded()
    }

    func evaluateStartupGateIfNeeded() {
        guard !didEvaluateStartupGate else { return }
        didEvaluateStartupGate = true

        if shouldSkipSplash {
            startupGateState = .optionalDismissed
            return
        }

        startStartupGateEvaluation()
    }

    func resolveStartupGateDecision(installedVersion: String) async throws -> StartupVersionGateDecision {
        try await startupVersionGateUseCase.execute(
            platform: .ios,
            installedVersion: installedVersion
        )
    }

    func retryStartupGate() {
        guard startupGateState == .timedOut || startupGateState == .unavailable else { return }
        startStartupGateEvaluation()
    }

    func continueAfterStartupGateFailure() {
        guard startupGateState == .timedOut || startupGateState == .unavailable else { return }
        invalidateStartupGateEvaluation()
        startupGateState = .optionalDismissed
        continueFromSplashIfAllowed()
    }

    func continueFromSplashIfAllowed() {
        guard shellState.currentRoute == .splash else { return }
        guard splashDelayCompleted else { return }
        guard startupGateState.allowsContinuation else { return }
        dispatchShell(.splashCompleted(isAuthenticated: sessionViewModel.mode.isAuthenticatedSession))
    }

    func dismissOptionalStartupUpdate() {
        startupGateState = .optionalDismissed
        continueFromSplashIfAllowed()
    }
}

private extension AccessRootViewModel {
    func startStartupGateEvaluation() {
        invalidateStartupGateEvaluation()
        let generation = startupGateGeneration
        let installedVersion = installedVersion
        let resolver = startupVersionGateUseCase
        let timeout = startupGateTimeout
        let sleeper = startupGateSleeper

        startupGateState = .checking
        startupGateOperationTask = Task { @MainActor [weak self, resolver] in
            defer { self?.finishStartupGateOperation(generation) }
            guard self?.isCurrentStartupGateEvaluation(generation) == true else { return }

            do {
                let decision = try await resolver.execute(
                    platform: .ios,
                    installedVersion: installedVersion
                )
                guard let self, isCurrentStartupGateEvaluation(generation) else { return }
                publishStartupGateDecision(decision, generation: generation)
            } catch is CancellationError {
                return
            } catch {
                guard let self, isCurrentStartupGateEvaluation(generation) else { return }
                publishStartupGateFailure(.unavailable, generation: generation)
            }
        }

        startupGateTimeoutTask = Task { @MainActor [weak self, sleeper] in
            do {
                try await sleeper(timeout)
                try Task.checkCancellation()
            } catch {
                self?.finishStartupGateTimeout(generation)
                return
            }

            guard let self, isCurrentStartupGateEvaluation(generation) else { return }
            startupGateOperationTask?.cancel()
            startupGateOperationTask = nil
            startupGateTimeoutTask = nil
            startupGateState = .timedOut
        }
    }

    @discardableResult func invalidateStartupGateEvaluation() -> Task<Void, Never>? {
        let invalidatedOperation = startupGateOperationTask
        invalidatedOperation?.cancel()
        startupGateTimeoutTask?.cancel()
        startupGateGeneration &+= 1
        startupGateOperationTask = nil
        startupGateTimeoutTask = nil
        return invalidatedOperation
    }

    func isCurrentStartupGateEvaluation(_ generation: UInt64) -> Bool {
        !Task.isCancelled && generation == startupGateGeneration
    }

    func publishStartupGateDecision(_ decision: StartupVersionGateDecision, generation: UInt64) {
        guard generation == startupGateGeneration else { return }
        startupGateTimeoutTask?.cancel()
        startupGateTimeoutTask = nil

        startupGateState = switch decision {
        case .allow:
            .ready
        case .optionalUpdate(let storeURL):
            .optionalUpdate(storeURL: storeURL)
        case .forcedUpdate(let storeURL):
            .forcedUpdate(storeURL: storeURL)
        }
        continueFromSplashIfAllowed()
    }

    func publishStartupGateFailure(_ state: StartupGateUIState, generation: UInt64) {
        guard generation == startupGateGeneration else { return }
        startupGateTimeoutTask?.cancel()
        startupGateTimeoutTask = nil
        startupGateState = state
    }

    func finishStartupGateOperation(_ generation: UInt64) {
        guard generation == startupGateGeneration else { return }
        startupGateOperationTask = nil
    }

    func finishStartupGateTimeout(_ generation: UInt64) {
        guard generation == startupGateGeneration else { return }
        startupGateTimeoutTask = nil
    }
}
