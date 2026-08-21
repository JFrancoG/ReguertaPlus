import Foundation
import Synchronization

@testable import Reguerta

nonisolated struct SecurityBoundaryFixedAuthorizedMemberResolver: AuthorizedMemberResolving {
    let resolution: AuthorizedMemberResolution

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        resolution
    }
}

struct SecurityBoundaryThrowingAuthorizedMemberResolver: AuthorizedMemberResolving {
    let error: AuthorizedMemberResolutionError

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        throw error
    }
}

struct CancellingExpiredMemberResolver: AuthorizedMemberResolving {
    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        withUnsafeCurrentTask { task in
            task?.cancel()
        }
        throw AuthorizedMemberResolutionError.sessionExpired
    }
}

final class ControlledExpiredMemberResolver: AuthorizedMemberResolving, Sendable {
    private enum WaitRegistration {
        case suspended
        case started
        case cancelled
    }

    private struct State {
        var resolutionID: UUID?
        var resolutionContinuation: CheckedContinuation<AuthorizedMemberResolution, any Error>?
        var requestWaiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        let resolutionID = UUID()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let requestWaiters = state.withLock { state -> [CheckedContinuation<Void, any Error>]? in
                    guard !Task.isCancelled else { return nil }
                    state.resolutionID = resolutionID
                    state.resolutionContinuation = continuation
                    defer { state.requestWaiters.removeAll() }
                    return Array(state.requestWaiters.values)
                }
                guard let requestWaiters else {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                requestWaiters.forEach { $0.resume() }
            }
        } onCancel: {
            self.cancelResolution(resolutionID)
        }
    }

    func waitForRequest() async throws {
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> WaitRegistration in
                    guard !Task.isCancelled else { return .cancelled }
                    guard state.resolutionContinuation == nil else { return .started }
                    state.requestWaiters[waiterID] = continuation
                    return .suspended
                }
                switch registration {
                case .suspended:
                    break
                case .started:
                    continuation.resume()
                case .cancelled:
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            self.cancelRequestWaiter(waiterID)
        }
    }

    func completeWithExpiredSession() {
        let continuation = state.withLock { state in
            state.resolutionID = nil
            defer { state.resolutionContinuation = nil }
            return state.resolutionContinuation
        }
        continuation?.resume(throwing: AuthorizedMemberResolutionError.sessionExpired)
    }

    func cancelAll() {
        let pending = state.withLock { state in
            state.resolutionID = nil
            let resolutionContinuation = state.resolutionContinuation
            state.resolutionContinuation = nil
            let requestWaiters = Array(state.requestWaiters.values)
            state.requestWaiters.removeAll()
            return (resolutionContinuation, requestWaiters)
        }
        pending.0?.resume(throwing: CancellationError())
        pending.1.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancelResolution(_ resolutionID: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<AuthorizedMemberResolution, any Error>? in
            guard state.resolutionID == resolutionID else { return nil }
            state.resolutionID = nil
            defer { state.resolutionContinuation = nil }
            return state.resolutionContinuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private func cancelRequestWaiter(_ waiterID: UUID) {
        let continuation = state.withLock { $0.requestWaiters.removeValue(forKey: waiterID) }
        continuation?.resume(throwing: CancellationError())
    }
}

@MainActor
final class RecordingSessionEnvironmentRouter: SessionEnvironmentRouting {
    let baseEnvironment: SessionEnvironment
    let environmentStore: RuntimeSessionEnvironmentStore
    private(set) var appliedEnvironment: SessionEnvironment?
    private(set) var resetCount = 0
    private var activeLease: SessionEnvironmentLease?

    var environmentSnapshotProvider: any SessionEnvironmentSnapshotProviding { environmentStore }
    var transitionSignal: SessionEnvironmentRoutingSignal { environmentStore.transitionSignal }

    init(baseEnvironment: SessionEnvironment) {
        self.baseEnvironment = baseEnvironment
        self.environmentStore = RuntimeSessionEnvironmentStore(baseEnvironment: baseEnvironment)
    }

    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) {
        environmentStore.apply(environment, lease: lease)
        appliedEnvironment = environment
        activeLease = lease
        transitionSignal.publish(environment: environment)
    }

    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        guard activeLease == lease else { return }
        resetToBaseEnvironment()
    }

    func resetToBaseEnvironment() {
        environmentStore.reset()
        appliedEnvironment = nil
        activeLease = nil
        resetCount += 1
        transitionSignal.publish(environment: baseEnvironment)
    }
}

@MainActor
final class EnvironmentRecordingMemberRepository: MemberRepository {
    let memberValue: Member?
    let router: RecordingSessionEnvironmentRouter
    private(set) var environmentAtMemberRead: SessionEnvironment?
    private(set) var requestedMemberIds: [String] = []

    init(member: Member?, router: RecordingSessionEnvironmentRouter) {
        memberValue = member
        self.router = router
    }

    nonisolated func member(id: String, environment: SessionEnvironment) async throws -> Member? {
        await MainActor.run {
            requestedMemberIds.append(id)
            environmentAtMemberRead = environment
            return id == memberValue?.id ? memberValue : nil
        }
    }

    nonisolated func members(visibleTo member: Member, environment _: SessionEnvironment) async throws -> [Member] {
        await MainActor.run {
            memberValue.map { [$0] } ?? []
        }
    }

    nonisolated func updateOwnProducerCatalogEnabled(
        member: Member,
        enabled: Bool,
        environment _: SessionEnvironment
    ) async throws -> Member {
        try await MainActor.run {
            guard let memberValue else {
                throw FirebaseFunctionClientError.invalidResponse
            }
            return memberValue
        }
    }
}

nonisolated struct TestUpsertMemberResponse: Encodable {
    let ok: Bool
    let memberId: String
    let roles: [MemberRole]
    let isActive: Bool
    let environment: SessionEnvironment
}

nonisolated struct TestUpsertMemberRequest: Decodable {
    let environment: SessionEnvironment
    let memberId: String
    let normalizedEmail: String
    let roles: [MemberRole]
}

nonisolated struct TestShiftSwapTransitionResponse: Encodable {
    let ok: Bool
    let environment: SessionEnvironment
    let action: String
    let requestId: String
    let candidateCount: Int?
}

@MainActor
final class RecordingFirebaseIDTokenProvider: FirebaseIDTokenProviding {
    let token: String
    private(set) var forceRefreshValues: [Bool] = []

    init(token: String) {
        self.token = token
    }

    func validIDToken(forcingRefresh: Bool) async throws -> String {
        forceRefreshValues.append(forcingRefresh)
        return token
    }
}

@MainActor
struct ThrowingFirebaseIDTokenProvider: FirebaseIDTokenProviding {
    let error: any Error

    func validIDToken(forcingRefresh: Bool) async throws -> String {
        throw error
    }
}

@MainActor
final class RecordingHTTPDataLoader: HTTPDataLoading {
    private let result: Result<(Data, URLResponse), any Error>
    private(set) var lastRequest: URLRequest?

    init(data: Data, statusCode: Int) {
        let response = HTTPURLResponse(
            url: URL(string: "https://example.test")!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        result = .success((data, response))
    }

    init(error: any Error) {
        result = .failure(error)
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        lastRequest = request
        return try result.get()
    }
}
