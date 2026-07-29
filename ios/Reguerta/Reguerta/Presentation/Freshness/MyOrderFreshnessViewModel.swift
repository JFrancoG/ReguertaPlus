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
    @ObservationIgnored private let sleeper: @Sendable (Duration) async throws -> Void
    @ObservationIgnored private let applyCriticalOrderingState:
        @MainActor @Sendable (
            CriticalDataRefreshScope,
            CriticalDataRefreshPayload
        ) async throws -> Void
    @ObservationIgnored private let isCriticalOrderingStateCurrent:
        @MainActor @Sendable (CriticalDataRefreshScope) -> Bool
    @ObservationIgnored var freshnessOperationTask: Task<Void, Never>?
    @ObservationIgnored var freshnessTimeoutTask: Task<Void, Never>?
    @ObservationIgnored private var freshnessGeneration: UInt64 = 0

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
        timeout: Duration = .milliseconds(2_500),
        sleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        }
    ) {
        self.resolveCriticalDataFreshness = resolveCriticalDataFreshness
        self.criticalDataFreshnessLocalRepository = criticalDataFreshnessLocalRepository
        self.applyCriticalOrderingState = applyCriticalOrderingState
        self.isCriticalOrderingStateCurrent = isCriticalOrderingStateCurrent
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
            let identity = freshnessIdentity(for: session)
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
        let identity = freshnessIdentity(for: session)
        currentIdentity = identity
        refresh(for: identity)
    }

    @discardableResult
    func revalidateForEntry(
        currentMode: SessionMode,
        onReady: @MainActor () -> Void = {}
    ) async -> Bool {
        guard case .authorized(let session) = currentMode else { return false }
        let identity = freshnessIdentity(for: session)
        currentIdentity = identity
        let handle = refresh(for: identity)
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
    private func refresh(for identity: FreshnessSessionIdentity) -> FreshnessOperationHandle {
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
            guard self?.isCurrentFreshnessOperation(generation, identity: identity) == true else {
                return
            }

            do {
                let resolution = try await resolver.execute(scope: identity.refreshScope)
                guard let self, isCurrentFreshnessOperation(generation, identity: identity) else {
                    return
                }
                try await applyAndPublish(
                    resolution,
                    identity: identity,
                    generation: generation,
                    metadataWriteGeneration: metadataWriteGeneration
                )
            } catch is CancellationError {
                return
            } catch {
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

    private func makeFreshnessTimeoutTask(
        identity: FreshnessSessionIdentity,
        generation: UInt64
    ) -> Task<Void, Never> {
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
            return freshnessIdentity(for: session) != identity
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
