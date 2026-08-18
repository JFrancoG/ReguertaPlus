import Foundation
import Observation
import OSLog

private let myOrderFreshnessLogger = Logger(
    subsystem: "com.reguerta.app",
    category: "CriticalFreshness"
)

enum MyOrderFreshnessState: Equatable, Sendable {
    case idle
    case checking
    case ready
    case timedOut
    case unavailable
}

private struct FreshnessSessionIdentity: Equatable {
    let uid: String
    let authenticatedMemberID: String
    let authenticatedMemberAuthUID: String?
    let memberID: String
    let environment: SessionEnvironment
    let canManageMembers: Bool

    var refreshScope: CriticalDataRefreshScope {
        CriticalDataRefreshScope(
            principalUID: uid,
            authenticatedMemberID: authenticatedMemberID,
            memberID: memberID,
            environment: environment,
            canManageMembers: canManageMembers
        )
    }
}

private struct FreshnessOperationHandle {
    let generation: UInt64
    let task: Task<Void, Never>
}

@MainActor
@Observable
final class MyOrderFreshnessViewModel {
    @ObservationIgnored let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    @ObservationIgnored let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    @ObservationIgnored private let timeout: Duration
    @ObservationIgnored private let automaticRetryDelays: [Duration]
    @ObservationIgnored private let sleeper: @Sendable (Duration) async throws -> Void
    @ObservationIgnored private let automaticRetrySleeper: @Sendable (Duration) async throws -> Void
    @ObservationIgnored private let applyCriticalOrderingState:
        @MainActor @Sendable (
            CriticalDataRefreshScope,
            CriticalDataRefreshPayload
        ) async throws -> Void
    @ObservationIgnored private let isCriticalOrderingStateCurrent:
        @MainActor @Sendable (CriticalDataRefreshScope) -> Bool
    @ObservationIgnored var freshnessOperationTask: Task<Void, Never>?
    @ObservationIgnored var freshnessTimeoutTask: Task<Void, Never>?
    @ObservationIgnored var freshnessRetryTask: Task<Void, Never>?
    @ObservationIgnored private var freshnessGeneration: UInt64 = 0
    @ObservationIgnored private var freshnessRetryGeneration: UInt64 = 0
    @ObservationIgnored private var automaticRetryAttempt = 0

    var state: MyOrderFreshnessState = .idle

    private var currentIdentity: FreshnessSessionIdentity?

    init(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase,
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository,
        applyCriticalOrderingState: @escaping @MainActor @Sendable (
            CriticalDataRefreshScope,
            CriticalDataRefreshPayload
        ) async throws -> Void = { _, _ in },
        isCriticalOrderingStateCurrent: @escaping @MainActor @Sendable (
            CriticalDataRefreshScope
        ) -> Bool = { _ in true },
        timeout: Duration = .seconds(10),
        automaticRetryDelays: [Duration] = [.seconds(10), .seconds(20), .seconds(30)],
        sleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        },
        automaticRetrySleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        }
    ) {
        self.resolveCriticalDataFreshness = resolveCriticalDataFreshness
        self.criticalDataFreshnessLocalRepository = criticalDataFreshnessLocalRepository
        self.applyCriticalOrderingState = applyCriticalOrderingState
        self.isCriticalOrderingStateCurrent = isCriticalOrderingStateCurrent
        self.timeout = timeout
        self.automaticRetryDelays = automaticRetryDelays
        self.sleeper = sleeper
        self.automaticRetrySleeper = automaticRetrySleeper
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
            let identity = freshnessIdentity(for: session)
            currentIdentity = identity
            if shouldRefresh(from: previousMode, identity: identity) {
                refresh(for: identity, resetAutomaticRetry: true)
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
        let identity = freshnessIdentity(for: session)
        currentIdentity = identity
        refresh(for: identity, resetAutomaticRetry: true)
    }

    @discardableResult
    func revalidateForEntry(
        currentMode: SessionMode,
        onReady: @MainActor () -> Void = {}
    ) async -> Bool {
        guard case .authorized(let session) = currentMode else { return false }
        let identity = freshnessIdentity(for: session)
        currentIdentity = identity
        let handle = refresh(for: identity, resetAutomaticRetry: true)
        await handle.task.value
        let canEnter = handle.generation == freshnessGeneration &&
            currentIdentity == identity &&
            state == .ready &&
            isCriticalOrderingStateCurrent(identity.refreshScope)
        if canEnter {
            onReady()
        }
        return canEnter
    }

    @discardableResult
    private func refresh(
        for identity: FreshnessSessionIdentity,
        resetAutomaticRetry: Bool
    ) -> FreshnessOperationHandle {
        if resetAutomaticRetry {
            cancelAutomaticRetry(resetBackoff: true)
        }
        invalidateFreshnessOperation()
        let generation = freshnessGeneration
        let metadataWriteGeneration = criticalDataFreshnessLocalRepository.writeGeneration
        state = .checking
        let operationTask = makeFreshnessOperationTask(
            identity: identity,
            generation: generation,
            metadataWriteGeneration: metadataWriteGeneration
        )
        freshnessOperationTask = operationTask
        freshnessTimeoutTask = makeFreshnessTimeoutTask(
            identity: identity,
            generation: generation
        )
        return FreshnessOperationHandle(
            generation: generation,
            task: operationTask
        )
    }

    private func makeFreshnessOperationTask(
        identity: FreshnessSessionIdentity,
        generation: UInt64,
        metadataWriteGeneration: UInt64
    ) -> Task<Void, Never> {
        let resolver = resolveCriticalDataFreshness
        return Task { @MainActor [weak self, resolver] in
            defer { self?.finishFreshnessOperation(generation) }
            guard self?.isCurrentFreshnessOperation(generation, identity: identity) == true else { return }

            do {
                let resolution = try await resolver.execute(scope: identity.refreshScope)
                guard let self, isCurrentFreshnessOperation(generation, identity: identity) else { return }
                try await applyAndPublish(
                    resolution,
                    identity: identity,
                    generation: generation,
                    metadataWriteGeneration: metadataWriteGeneration
                )
            } catch is CancellationError {
                return
            } catch {
                myOrderFreshnessLogger.error(
                    "Critical freshness failed: \(String(describing: error), privacy: .private)"
                )
                self?.publishFailureIfCurrent(
                    identity: identity,
                    generation: generation,
                    metadataWriteGeneration: metadataWriteGeneration
                )
            }
        }
    }

    private func applyAndPublish(
        _ resolution: CriticalDataFreshnessResolution,
        identity: FreshnessSessionIdentity,
        generation: UInt64,
        metadataWriteGeneration: UInt64
    ) async throws {
        if case .fresh(_, let refreshedPayload) = resolution {
            try await applyCriticalOrderingState(
                identity.refreshScope,
                refreshedPayload
            )
            try Task.checkCancellation()
            guard isCurrentFreshnessOperation(generation, identity: identity) else { return }
            guard isCriticalOrderingStateCurrent(identity.refreshScope) else {
                freshnessTimeoutTask?.cancel()
                freshnessTimeoutTask = nil
                state = .unavailable
                return
            }
        }
        guard isCurrentFreshnessOperation(generation, identity: identity) else { return }
        publish(
            resolution,
            generation: generation,
            metadataWriteGeneration: metadataWriteGeneration
        )
    }

    private func publishFailureIfCurrent(
        identity: FreshnessSessionIdentity,
        generation: UInt64,
        metadataWriteGeneration: UInt64
    ) {
        guard isCurrentFreshnessOperation(generation, identity: identity) else { return }
        publish(
            .invalidConfig,
            generation: generation,
            metadataWriteGeneration: metadataWriteGeneration
        )
    }

    private func makeFreshnessTimeoutTask(identity: FreshnessSessionIdentity, generation: UInt64) -> Task<Void, Never> {
        let sleeper = sleeper
        let timeout = timeout
        return Task { @MainActor [weak self, sleeper] in
            do {
                try await sleeper(timeout)
                try Task.checkCancellation()
            } catch {
                self?.finishFreshnessTimeout(generation)
                return
            }

            guard let self, isCurrentFreshnessOperation(generation, identity: identity) else { return }
            myOrderFreshnessLogger.warning("Critical freshness exceeded its bounded timeout")
            freshnessOperationTask?.cancel()
            freshnessTimeoutTask = nil
            state = .timedOut
            scheduleAutomaticRetryIfNeeded(identity: identity, generation: generation)
        }
    }

    private func reset() {
        invalidateFreshnessOperation()
        cancelAutomaticRetry(resetBackoff: true)
        currentIdentity = nil
        state = .idle
    }

    private func shouldRefresh(from previousMode: SessionMode, identity: FreshnessSessionIdentity) -> Bool {
        switch previousMode {
        case .signedOut:
            return true
        case .unauthorized:
            return true
        case .authorized(let session):
            return freshnessIdentity(for: session) != identity
        }
    }

    @discardableResult private func invalidateFreshnessOperation() -> Task<Void, Never>? {
        let invalidatedOperation = freshnessOperationTask
        invalidatedOperation?.cancel()
        freshnessTimeoutTask?.cancel()
        freshnessGeneration &+= 1
        freshnessOperationTask = nil
        freshnessTimeoutTask = nil
        return invalidatedOperation
    }

    private func isCurrentFreshnessOperation(_ generation: UInt64, identity: FreshnessSessionIdentity) -> Bool {
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
        case .fresh(let metadataToPersist, _):
            if let metadataToPersist {
                guard criticalDataFreshnessLocalRepository.saveMetadata(
                    metadataToPersist,
                    ifWriteGeneration: metadataWriteGeneration
                ) else {
                    state = .unavailable
                    return
                }
            }
            state = .ready
            cancelAutomaticRetry(resetBackoff: true)
        case .invalidConfig:
            state = .unavailable
        }
    }

    private func finishFreshnessOperation(_ generation: UInt64) {
        guard generation == freshnessGeneration else { return }
        freshnessOperationTask = nil
        guard let currentIdentity else { return }
        scheduleAutomaticRetryIfNeeded(identity: currentIdentity, generation: generation)
    }

    private func finishFreshnessTimeout(_ generation: UInt64) {
        guard generation == freshnessGeneration else { return }
        freshnessTimeoutTask = nil
    }
}

private extension MyOrderFreshnessViewModel {
    private func scheduleAutomaticRetryIfNeeded(
        identity: FreshnessSessionIdentity,
        generation: UInt64
    ) {
        guard generation == freshnessGeneration, currentIdentity == identity else { return }
        guard state == .timedOut || state == .unavailable else { return }
        guard freshnessRetryTask == nil, automaticRetryAttempt < automaticRetryDelays.count else { return }

        let retryDelay = automaticRetryDelays[automaticRetryAttempt]
        automaticRetryAttempt += 1
        freshnessRetryGeneration &+= 1
        let retryGeneration = freshnessRetryGeneration
        let retrySleeper = automaticRetrySleeper
        freshnessRetryTask = Task { @MainActor [weak self, retrySleeper] in
            do {
                try await retrySleeper(retryDelay)
                try Task.checkCancellation()
            } catch {
                self?.finishAutomaticRetry(retryGeneration)
                return
            }

            guard let self,
                  retryGeneration == freshnessRetryGeneration,
                  generation == freshnessGeneration,
                  currentIdentity == identity,
                  state == .timedOut || state == .unavailable else {
                self?.finishAutomaticRetry(retryGeneration)
                return
            }
            freshnessRetryTask = nil
            refresh(for: identity, resetAutomaticRetry: false)
        }
    }

    private func cancelAutomaticRetry(resetBackoff: Bool) {
        freshnessRetryGeneration &+= 1
        freshnessRetryTask?.cancel()
        freshnessRetryTask = nil
        if resetBackoff {
            automaticRetryAttempt = 0
        }
    }

    private func finishAutomaticRetry(_ generation: UInt64) {
        guard generation == freshnessRetryGeneration else { return }
        freshnessRetryTask = nil
    }

    private func freshnessIdentity(for session: AuthorizedSession) -> FreshnessSessionIdentity {
        FreshnessSessionIdentity(
            uid: session.principal.uid,
            authenticatedMemberID: session.authenticatedMember.id,
            authenticatedMemberAuthUID: session.authenticatedMember.authUid,
            memberID: session.member.id,
            environment: session.environment,
            canManageMembers: session.authenticatedMember.canManageMembers
        )
    }
}
