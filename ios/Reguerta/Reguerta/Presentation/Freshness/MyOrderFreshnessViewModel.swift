import Foundation
import Observation

enum MyOrderFreshnessState: Equatable, Sendable {
    case idle
    case checking
    case ready
    case timedOut
    case unavailable
}

private struct FreshnessSessionIdentity: Equatable, Sendable {
    let uid: String
    let environment: SessionEnvironment
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

    private var currentIdentity: FreshnessSessionIdentity?

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
            let identity = FreshnessSessionIdentity(
                uid: session.principal.uid,
                environment: session.environment
            )
            currentIdentity = identity
            if shouldRefresh(from: previousMode, identity: identity) {
                refresh(for: identity)
            }
        case .signedOut:
            reset()
            try? criticalDataFreshnessLocalRepository.clear()
        case .unauthorized:
            reset()
            try? criticalDataFreshnessLocalRepository.clear()
        }
    }

    func retry(currentMode: SessionMode) {
        guard case .authorized(let session) = currentMode else { return }
        let identity = FreshnessSessionIdentity(
            uid: session.principal.uid,
            environment: session.environment
        )
        currentIdentity = identity
        refresh(for: identity)
    }

    private func refresh(for identity: FreshnessSessionIdentity) {
        invalidateFreshnessOperation()
        let generation = freshnessGeneration
        let metadataWriteGeneration = criticalDataFreshnessLocalRepository.writeGeneration
        let resolver = resolveCriticalDataFreshness
        let timeout = timeout
        let sleeper = sleeper

        state = .checking
        freshnessOperationTask = Task { @MainActor [weak self, resolver] in
            defer { self?.finishFreshnessOperation(generation) }

            guard self?.isCurrentFreshnessOperation(generation, identity: identity) == true else {
                return
            }

            do {
                let resolution = try await resolver.execute(environment: identity.environment)
                guard let self, isCurrentFreshnessOperation(generation, identity: identity) else {
                    return
                }
                publish(
                    resolution,
                    generation: generation,
                    metadataWriteGeneration: metadataWriteGeneration
                )
            } catch is CancellationError {
                return
            } catch {
                guard let self, isCurrentFreshnessOperation(generation, identity: identity) else {
                    return
                }
                publish(
                    .invalidConfig,
                    generation: generation,
                    metadataWriteGeneration: metadataWriteGeneration
                )
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

            guard let self, isCurrentFreshnessOperation(generation, identity: identity) else {
                return
            }
            freshnessOperationTask?.cancel()
            freshnessTimeoutTask = nil
            state = .timedOut
        }
    }

    private func reset() {
        invalidateFreshnessOperation()
        currentIdentity = nil
        state = .idle
    }

    private func shouldRefresh(
        from previousMode: SessionMode,
        identity: FreshnessSessionIdentity
    ) -> Bool {
        switch previousMode {
        case .signedOut:
            return true
        case .unauthorized:
            return true
        case .authorized(let session):
            return session.principal.uid != identity.uid || session.environment != identity.environment
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
        identity: FreshnessSessionIdentity
    ) -> Bool {
        !Task.isCancelled &&
            generation == freshnessGeneration &&
            currentIdentity == identity
    }

    private func publish(
        _ resolution: CriticalDataFreshnessResolution,
        generation: UInt64,
        metadataWriteGeneration: UInt64
    ) {
        guard generation == freshnessGeneration else { return }
        freshnessTimeoutTask?.cancel()
        freshnessTimeoutTask = nil

        switch resolution {
        case .fresh(let metadataToPersist):
            if let metadataToPersist {
                criticalDataFreshnessLocalRepository.saveMetadata(
                    metadataToPersist,
                    ifWriteGeneration: metadataWriteGeneration
                )
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
