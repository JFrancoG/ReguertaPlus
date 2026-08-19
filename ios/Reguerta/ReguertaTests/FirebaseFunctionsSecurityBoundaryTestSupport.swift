import Foundation

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
