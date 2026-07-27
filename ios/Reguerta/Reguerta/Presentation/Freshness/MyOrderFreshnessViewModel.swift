import Foundation
import Observation

enum MyOrderFreshnessState: Equatable, Sendable {
    case idle
    case checking
    case ready
    case timedOut
    case unavailable
}

@MainActor
@Observable
final class MyOrderFreshnessViewModel {
    @ObservationIgnored let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    @ObservationIgnored let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    @ObservationIgnored private let timeout: Duration
    @ObservationIgnored private let sleeper: @Sendable (Duration) async throws -> Void
    @ObservationIgnored var freshnessOperationTask: Task<Void, Never>?
    @ObservationIgnored var freshnessTimeoutTask: Task<Void, Never>?
    @ObservationIgnored private var freshnessGeneration: UInt64 = 0

    var state: MyOrderFreshnessState = .idle

    private var currentPrincipal: AuthPrincipal?

    init(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase,
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository,
        timeout: Duration = .milliseconds(2_500),
        sleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        }
    ) {
        self.resolveCriticalDataFreshness = resolveCriticalDataFreshness
        self.criticalDataFreshnessLocalRepository = criticalDataFreshnessLocalRepository
        self.timeout = timeout
        self.sleeper = sleeper
    }

    convenience init(dependencies: MyOrderFreshnessFeatureDependencies = .preview()) {
        self.init(
            resolveCriticalDataFreshness: dependencies.resolveCriticalDataFreshness,
            criticalDataFreshnessLocalRepository: dependencies.criticalDataFreshnessLocalRepository
        )
    }

    func handleSessionModeChange(from previousMode: SessionMode, to mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            currentPrincipal = session.principal
            if shouldRefresh(from: previousMode, principal: session.principal) {
                refresh(for: session.principal)
            }
        case .signedOut:
            reset()
            criticalDataFreshnessLocalRepository.clear()
        case .unauthorized:
            reset()
        }
    }

    func retry(currentMode: SessionMode) {
        guard case .authorized(let session) = currentMode else { return }
        currentPrincipal = session.principal
        refresh(for: session.principal)
    }

    private func refresh(for principal: AuthPrincipal) {
        invalidateFreshnessOperation()
        let generation = freshnessGeneration
        let resolver = resolveCriticalDataFreshness
        let timeout = timeout
        let sleeper = sleeper

        state = .checking
        freshnessOperationTask = Task { @MainActor [weak self, resolver] in
            defer { self?.finishFreshnessOperation(generation) }

            guard self?.isCurrentFreshnessOperation(generation, principal: principal) == true else {
                return
            }

            do {
                let resolution = try await resolver.execute()
                guard let self, isCurrentFreshnessOperation(generation, principal: principal) else {
                    return
                }
                publish(resolution, generation: generation)
            } catch is CancellationError {
                return
            } catch {
                guard let self, isCurrentFreshnessOperation(generation, principal: principal) else {
                    return
                }
                publish(.invalidConfig, generation: generation)
            }
        }

        freshnessTimeoutTask = Task { @MainActor [weak self, sleeper] in
            do {
                try await sleeper(timeout)
                try Task.checkCancellation()
            } catch {
                self?.finishFreshnessTimeout(generation)
                return
            }

            guard let self, isCurrentFreshnessOperation(generation, principal: principal) else {
                return
            }
            freshnessOperationTask?.cancel()
            freshnessTimeoutTask = nil
            state = .timedOut
        }
    }

    private func reset() {
        invalidateFreshnessOperation()
        currentPrincipal = nil
        state = .idle
    }

    private func shouldRefresh(from previousMode: SessionMode, principal: AuthPrincipal) -> Bool {
        switch previousMode {
        case .signedOut:
            return true
        case .unauthorized(let email, _):
            return email != principal.email
        case .authorized(let session):
            return session.principal.uid != principal.uid
        }
    }

    @discardableResult
    private func invalidateFreshnessOperation() -> Task<Void, Never>? {
        let invalidatedOperation = freshnessOperationTask
        invalidatedOperation?.cancel()
        freshnessTimeoutTask?.cancel()
        freshnessGeneration &+= 1
        freshnessOperationTask = nil
        freshnessTimeoutTask = nil
        return invalidatedOperation
    }

    private func isCurrentFreshnessOperation(
        _ generation: UInt64,
        principal: AuthPrincipal
    ) -> Bool {
        !Task.isCancelled &&
            generation == freshnessGeneration &&
            currentPrincipal?.uid == principal.uid
    }

    private func publish(
        _ resolution: CriticalDataFreshnessResolution,
        generation: UInt64
    ) {
        guard generation == freshnessGeneration else { return }
        freshnessTimeoutTask?.cancel()
        freshnessTimeoutTask = nil

        switch resolution {
        case .fresh(let metadataToPersist):
            if let metadataToPersist {
                criticalDataFreshnessLocalRepository.saveMetadata(metadataToPersist)
            }
            state = .ready
        case .invalidConfig:
            state = .unavailable
        }
    }

    private func finishFreshnessOperation(_ generation: UInt64) {
        guard generation == freshnessGeneration else { return }
        freshnessOperationTask = nil
    }

    private func finishFreshnessTimeout(_ generation: UInt64) {
        guard generation == freshnessGeneration else { return }
        freshnessTimeoutTask = nil
    }

}
