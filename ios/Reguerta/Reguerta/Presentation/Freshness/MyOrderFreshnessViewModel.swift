import Foundation
import Observation
import OSLog

@MainActor
@Observable
final class MyOrderFreshnessViewModel {
    @ObservationIgnored let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    @ObservationIgnored let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    @ObservationIgnored private let timeout: Duration
    @ObservationIgnored private let automaticRetryDelays: [Duration]
    @ObservationIgnored private let sleeper: @Sendable (Duration) async throws -> Void
    @ObservationIgnored private let automaticRetrySleeper: @Sendable (Duration) async throws -> Void
    @ObservationIgnored private let sessionStateRevisionProvider: @MainActor @Sendable () -> UInt64
    @ObservationIgnored private let applyCriticalOrderingState:
        @MainActor @Sendable (
            MyOrderFreshnessSessionContext,
            CriticalDataRefreshPayload
        ) async throws -> Void
    @ObservationIgnored private let isCriticalOrderingStateCurrent:
        @MainActor @Sendable (MyOrderFreshnessSessionContext) -> Bool
    @ObservationIgnored private let acknowledgedCriticalOrderingStateRevision:
        @MainActor @Sendable (MyOrderFreshnessSessionContext) -> UInt64?
    @ObservationIgnored var freshnessOperationTask: Task<Void, Never>?
    @ObservationIgnored var freshnessTimeoutTask: Task<Void, Never>?
    @ObservationIgnored var freshnessRetryTask: Task<Void, Never>?
    @ObservationIgnored var freshnessEntryWaiters: [UUID: FreshnessEntryWaiter] = [:]
    @ObservationIgnored private(set) var freshnessGeneration: UInt64 = 0
    @ObservationIgnored private var freshnessRetryGeneration: UInt64 = 0
    @ObservationIgnored private var automaticRetryAttempt = 0

    var state: MyOrderFreshnessState = .idle

    private var currentIdentity: MyOrderFreshnessSessionContext?

    init(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase,
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository,
        sessionStateRevisionProvider: @escaping @MainActor @Sendable () -> UInt64 = { 0 },
        applyCriticalOrderingState: @escaping @MainActor @Sendable (
            MyOrderFreshnessSessionContext,
            CriticalDataRefreshPayload
        ) async throws -> Void = { _, _ in },
        isCriticalOrderingStateCurrent: @escaping @MainActor @Sendable (
            MyOrderFreshnessSessionContext
        ) -> Bool = { _ in true },
        acknowledgedCriticalOrderingStateRevision: @escaping @MainActor @Sendable (
            MyOrderFreshnessSessionContext
        ) -> UInt64? = { _ in nil },
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
        self.sessionStateRevisionProvider = sessionStateRevisionProvider
        self.applyCriticalOrderingState = applyCriticalOrderingState
        self.isCriticalOrderingStateCurrent = isCriticalOrderingStateCurrent
        self.acknowledgedCriticalOrderingStateRevision = acknowledgedCriticalOrderingStateRevision
        self.timeout = timeout
        self.automaticRetryDelays = automaticRetryDelays
        self.sleeper = sleeper
        self.automaticRetrySleeper = automaticRetrySleeper
    }

    @discardableResult
    private func refresh(
        for identity: MyOrderFreshnessSessionContext,
        resetAutomaticRetry: Bool
    ) -> FreshnessOperationHandle? {
        guard identity.representsActiveAuthorization,
              identity.sessionStateRevision == sessionStateRevisionProvider() else { return nil }
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
        identity: MyOrderFreshnessSessionContext,
        generation: UInt64,
        metadataWriteGeneration: UInt64
    ) -> Task<Void, Never> {
        let resolver = resolveCriticalDataFreshness
        return Task { @MainActor [weak self, resolver] in
            defer { self?.finishFreshnessOperation(generation, identity: identity) }
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
        identity: MyOrderFreshnessSessionContext,
        generation: UInt64,
        metadataWriteGeneration: UInt64
    ) async throws {
        if case .fresh(_, let refreshedPayload) = resolution {
            try await applyCriticalOrderingState(
                identity,
                refreshedPayload
            )
            try Task.checkCancellation()
            guard isOwnedFreshnessOperation(generation, identity: identity) else { return }
            guard hasCurrentCriticalOrderingState(identity) else {
                freshnessTimeoutTask?.cancel()
                freshnessTimeoutTask = nil
                state = .unavailable
                return
            }
        }
        guard isOwnedFreshnessOperation(generation, identity: identity) else { return }
        publish(
            resolution,
            generation: generation,
            metadataWriteGeneration: metadataWriteGeneration
        )
    }

    private func publishFailureIfCurrent(
        identity: MyOrderFreshnessSessionContext,
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
        identity: MyOrderFreshnessSessionContext,
        generation: UInt64
    ) -> Task<Void, Never> {
        let sleeper = sleeper
        let timeout = timeout
        return Task { @MainActor [weak self, sleeper] in
            defer { self?.finishFreshnessTimeout(generation) }
            do {
                try await sleeper(timeout)
                try Task.checkCancellation()
            } catch {
                return
            }

            guard let self, isOwnedFreshnessOperation(generation, identity: identity) else { return }
            guard isLiveOrAcknowledgedFreshnessContext(identity) else {
                finishStaleFreshnessTimeout(generation, identity: identity)
                return
            }
            myOrderFreshnessLogger.warning("Critical freshness exceeded its bounded timeout")
            freshnessOperationTask?.cancel()
            freshnessTimeoutTask = nil
            state = .timedOut
            resolveFreshnessEntryWaiters(generation: generation, result: false)
            scheduleAutomaticRetryIfNeeded(identity: identity, generation: generation)
        }
    }

    private func reset() {
        invalidateFreshnessOperation()
        cancelAutomaticRetry(resetBackoff: true)
        currentIdentity = nil
        state = .idle
    }

    private func shouldRefresh(from previousMode: SessionMode, identity: MyOrderFreshnessSessionContext) -> Bool {
        switch previousMode {
        case .signedOut:
            return true
        case .unauthorized:
            return true
        case .authorized(let session):
            return MyOrderFreshnessSessionContext(
                session: session,
                sessionStateRevision: identity.sessionStateRevision
            ) != identity
        }
    }

    @discardableResult private func invalidateFreshnessOperation() -> Task<Void, Never>? {
        let invalidatedOperation = freshnessOperationTask
        resolveFreshnessEntryWaiters(generation: freshnessGeneration, result: false)
        invalidatedOperation?.cancel()
        freshnessTimeoutTask?.cancel()
        freshnessGeneration &+= 1
        freshnessOperationTask = nil
        freshnessTimeoutTask = nil
        return invalidatedOperation
    }

    private func isCurrentFreshnessOperation(_ generation: UInt64, identity: MyOrderFreshnessSessionContext) -> Bool {
        isOwnedFreshnessOperation(generation, identity: identity) &&
            isLiveFreshnessContext(identity)
    }

    private func isOwnedFreshnessOperation(_ generation: UInt64, identity: MyOrderFreshnessSessionContext) -> Bool {
        !Task.isCancelled && ownsFreshnessGeneration(generation, identity: identity)
    }

    private func ownsFreshnessGeneration(_ generation: UInt64, identity: MyOrderFreshnessSessionContext) -> Bool {
        generation == freshnessGeneration && currentIdentity == identity
    }

    private func isLiveFreshnessContext(_ identity: MyOrderFreshnessSessionContext) -> Bool {
        identity.representsActiveAuthorization &&
            identity.sessionStateRevision == sessionStateRevisionProvider()
    }

    private func isLiveOrAcknowledgedFreshnessContext(_ identity: MyOrderFreshnessSessionContext) -> Bool {
        isLiveFreshnessContext(identity) || hasCurrentCriticalOrderingState(identity)
    }

    private func hasCurrentCriticalOrderingState(_ identity: MyOrderFreshnessSessionContext) -> Bool {
        guard isCriticalOrderingStateCurrent(identity) else { return false }
        let liveRevision = sessionStateRevisionProvider()
        guard identity.sessionStateRevision != liveRevision else { return true }
        return acknowledgedCriticalOrderingStateRevision(identity) == liveRevision
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

    private func finishFreshnessOperation(_ generation: UInt64, identity: MyOrderFreshnessSessionContext) {
        guard ownsFreshnessGeneration(generation, identity: identity) else { return }
        freshnessOperationTask = nil
        let canEnter = state == .ready && hasCurrentCriticalOrderingState(identity)
        resolveFreshnessEntryWaiters(
            generation: generation,
            identity: identity,
            result: canEnter
        )
        guard isLiveOrAcknowledgedFreshnessContext(identity) else {
            freshnessTimeoutTask?.cancel()
            freshnessTimeoutTask = nil
            if state == .checking {
                state = .unavailable
            }
            return
        }
        scheduleAutomaticRetryIfNeeded(identity: identity, generation: generation)
    }

    private func finishStaleFreshnessTimeout(_ generation: UInt64, identity: MyOrderFreshnessSessionContext) {
        guard ownsFreshnessGeneration(generation, identity: identity) else { return }
        resolveFreshnessEntryWaiters(generation: generation, result: false)
        freshnessOperationTask?.cancel()
        freshnessOperationTask = nil
        if state == .checking {
            state = .unavailable
        }
    }

    private func finishFreshnessTimeout(_ generation: UInt64) {
        guard generation == freshnessGeneration else { return }
        freshnessTimeoutTask = nil
    }
}
extension MyOrderFreshnessViewModel {
    convenience init(dependencies: MyOrderFreshnessFeatureDependencies) {
        self.init(
            resolveCriticalDataFreshness: dependencies.resolveCriticalDataFreshness,
            criticalDataFreshnessLocalRepository: dependencies.criticalDataFreshnessLocalRepository
        )
    }
}
extension MyOrderFreshnessViewModel {
    /// Recognizes only the successor revision emitted by the current Products refresh receipt.
    ///
    /// This check lets the session-mode observer preserve the owned refresh and entry waiter when
    /// Products synchronously updates benign member data. A generic current-state predicate cannot
    /// legitimize a revision change: the explicit acknowledgement must equal the live revision.
    func recognizesAcknowledgedRevisionHandoff(from previousMode: SessionMode, to mode: SessionMode) -> Bool {
        guard let identity = currentIdentity,
              case .authorized(let previousSession) = previousMode,
              case .authorized(let session) = mode,
              previousSession.representsActiveAuthorization,
              session.representsActiveAuthorization,
              identity.matchesAuthorization(of: previousSession),
              identity.matchesAuthorization(of: session),
              identity.sessionStateRevision != sessionStateRevisionProvider() else { return false }
        return hasCurrentCriticalOrderingState(identity)
    }

    func handleSessionModeChange(from previousMode: SessionMode, to mode: SessionMode) {
        if recognizesAcknowledgedRevisionHandoff(from: previousMode, to: mode) {
            return
        }
        switch mode {
        case .authorized(let session):
            guard session.representsActiveAuthorization else {
                reset()
                try? criticalDataFreshnessLocalRepository.clear()
                return
            }
            let identity = freshnessIdentity(for: session)
            let previousIdentity = currentIdentity
            currentIdentity = identity
            if shouldRefresh(from: previousMode, identity: identity) ||
                previousIdentity.map({ $0 != identity }) == true {
                refresh(for: identity, resetAutomaticRetry: true)
            }
        case .signedOut, .unauthorized:
            reset()
            try? criticalDataFreshnessLocalRepository.clear()
        }
    }

    func retry(currentMode: SessionMode) {
        guard case .authorized(let session) = currentMode, session.representsActiveAuthorization else { return }
        let identity = freshnessIdentity(for: session)
        currentIdentity = identity
        refresh(for: identity, resetAutomaticRetry: true)
    }

    /// Revalidates critical data for one attempted My Order entry.
    ///
    /// Cancellation or a stale session revision rejects the attempt before it can replace the
    /// current freshness owner. A successful result belongs to the same generation and immutable
    /// authorization context that reached `ready`; cancelling this caller removes only its waiter
    /// and does not cancel a refresh that may still serve other consumers.
    ///
    /// - Parameters:
    ///   - context: Immutable authorization and revision captured when the caller created the entry intent.
    ///   - onReady: Synchronous handoff invoked only after the owned refresh is ready and current.
    /// - Returns: `true` only when that exact entry attempt may consume the refreshed ordering state.
    @discardableResult
    func revalidateForEntry(
        context: MyOrderFreshnessSessionContext,
        onReady: @MainActor () -> Void = {}
    ) async -> Bool {
        guard context.representsActiveAuthorization,
              !Task.isCancelled,
              context.sessionStateRevision == sessionStateRevisionProvider() else { return false }
        currentIdentity = context
        guard let handle = refresh(for: context, resetAutomaticRetry: true) else { return false }
        let didResolveReady = await waitForFreshnessEntryResolution(
            generation: handle.generation,
            identity: context
        )
        let canEnter = didResolveReady &&
            !Task.isCancelled &&
            handle.generation == freshnessGeneration &&
            currentIdentity == context &&
            state == .ready &&
            hasCurrentCriticalOrderingState(context)
        if canEnter {
            onReady()
        }
        return canEnter
    }

    /// Resolves whether an entry waiter may still register for an owned checking operation.
    ///
    /// Returning `nil` means the exact generation and authorization context are still checking.
    /// Every other state is terminal for registration and resolves immediately, which prevents a
    /// waiter queued behind invalidation from being inserted into a successor generation.
    func freshnessEntryWaiterRegistrationResult(
        generation: UInt64,
        identity: MyOrderFreshnessSessionContext
    ) -> Bool? {
        guard generation == freshnessGeneration, currentIdentity == identity else { return false }
        switch state {
        case .checking:
            return nil
        case .ready:
            return hasCurrentCriticalOrderingState(identity)
        case .idle, .timedOut, .unavailable:
            return false
        }
    }
}

private extension MyOrderFreshnessViewModel {
    private func scheduleAutomaticRetryIfNeeded(identity: MyOrderFreshnessSessionContext, generation: UInt64) {
        guard generation == freshnessGeneration,
              currentIdentity == identity,
              identity.representsActiveAuthorization,
              identity.sessionStateRevision == sessionStateRevisionProvider() else { return }
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
                  identity.representsActiveAuthorization,
                  identity.sessionStateRevision == sessionStateRevisionProvider(),
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
    private func freshnessIdentity(for session: AuthorizedSession) -> MyOrderFreshnessSessionContext {
        MyOrderFreshnessSessionContext(
            session: session,
            sessionStateRevision: sessionStateRevisionProvider()
        )
    }
}
