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
    @ObservationIgnored private let timeoutNanoseconds: UInt64

    var state: MyOrderFreshnessState = .idle

    private var currentPrincipal: AuthPrincipal?

    init(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase,
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository,
        timeoutNanoseconds: UInt64 = 2_500_000_000
    ) {
        self.resolveCriticalDataFreshness = resolveCriticalDataFreshness
        self.criticalDataFreshnessLocalRepository = criticalDataFreshnessLocalRepository
        self.timeoutNanoseconds = timeoutNanoseconds
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
            Task { await criticalDataFreshnessLocalRepository.clear() }
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
        state = .checking
        Task { @MainActor in
            let resolution = await resolveFreshnessWithTimeout()
            guard currentPrincipal == principal else { return }

            switch resolution {
            case .fresh:
                state = .ready
            case .invalidConfig:
                state = .unavailable
            case nil:
                state = .timedOut
            }
        }
    }

    private func reset() {
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

    private func resolveFreshnessWithTimeout() async -> CriticalDataFreshnessResolution? {
        await withTaskGroup(of: CriticalDataFreshnessResolution?.self) { group in
            group.addTask { [resolveCriticalDataFreshness] in
                await resolveCriticalDataFreshness.execute()
            }
            group.addTask { [timeoutNanoseconds] in
                try? await Task.sleep(nanoseconds: timeoutNanoseconds)
                return nil
            }

            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }
}
