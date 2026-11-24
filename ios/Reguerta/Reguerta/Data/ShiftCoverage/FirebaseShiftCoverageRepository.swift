import Foundation

/// Keeps access admission scoped to the application's current authorization. A token refresh cannot
/// transfer an old intent to another session, and an uncertain mutation is never automatically repeated.
@MainActor
struct FirebaseShiftCoverageRepository: ShiftCoverageRepository {
    private let storedClient: AuthenticatedFirebaseFunctionsClient
    private let sessionProvider: @MainActor () -> ShiftCoverageSession?

    func resolveAccess(session: ShiftCoverageSession) async throws -> ShiftCoverageAccess {
        let result: ShiftCoverageAccess = try await post(
            function: .resolveShiftCoverageAccess,
            body: AccessQuery(environment: session.environment),
            session: session
        )
        guard result.schemaVersion == 1, result.environment == session.environment,
              result.memberId == session.memberId,
              result.enabled ? result.policyRevision?.isEmpty == false : result.policyRevision == nil else {
            throw ShiftCoverageFailure.invalidResponse
        }
        return result
    }

    func read(caseId: String?, session: ShiftCoverageSession) async throws -> ShiftCoverageSnapshot {
        let policy = try await admittedPolicy(session)
        let result: ShiftCoverageSnapshot = try await post(
            body: Query(
                environment: session.environment, action: caseId == nil ? "overview" : "detail", caseId: caseId
            ),
            session: session
        )
        try validate(result, session: session, policy: policy)
        return result
    }

    func readNotification(eventId: String, session: ShiftCoverageSession) async throws -> ShiftCoverageSnapshot {
        let policy = try await admittedPolicy(session)
        let result: ShiftCoverageSnapshot = try await post(
            body: Query(environment: session.environment, action: "notification", caseId: nil, eventId: eventId),
            session: session
        )
        try validate(result, session: session, policy: policy)
        guard let reference = result.notification, reference.eventId == eventId, reference.caseRevision > 0,
              result.cases.count == 1, result.cases.first?.caseId == reference.caseId,
              (result.cases.first?.revision ?? 0) >= reference.caseRevision else {
            throw ShiftCoverageFailure.invalidResponse
        }
        return result
    }

    func execute(_ command: ShiftCoverageCommand, session: ShiftCoverageSession) async throws {
        guard command.environment == session.environment,
              (0..<9_007_199_254_740_991).contains(command.expectedRevision) else {
            throw ShiftCoverageFailure.invalidResponse
        }
        let policy = try await admittedPolicy(session)
        guard command.expectedPolicyRevision == policy else { throw ShiftCoverageFailure.unavailable }
        let result: Receipt = try await post(body: command, session: session)
        guard result.schemaVersion == 1, result.environment == session.environment,
              result.operationId == command.operationId, result.caseId == command.caseId,
              result.revision == command.expectedRevision + 1 else {
            throw ShiftCoverageFailure.invalidResponse
        }
    }

    func readAdministration(session: ShiftCoverageSession) async throws -> ShiftCoverageAdministrationSnapshot {
        let policy = try await admittedPolicy(session)
        let result: ShiftCoverageAdministrationSnapshot = try await post(
            body: Query(environment: session.environment, action: "administration", caseId: nil), session: session
        )
        guard result.schemaVersion == 1, result.environment == session.environment.rawValue,
              result.memberId == session.memberId, result.isAdmin, result.policyRevision == policy else {
            throw ShiftCoverageFailure.invalidResponse
        }
        return result
    }

    func executeAdministration(
        _ command: ShiftCoverageAdministrationCommand,
        session: ShiftCoverageSession
    ) async throws {
        guard command.environment == session.environment else { throw ShiftCoverageFailure.invalidResponse }
        let policy = try await admittedPolicy(session)
        guard command.expectedPolicyRevision == policy else { throw ShiftCoverageFailure.unavailable }
        let result: AdministrationReceipt = try await post(body: command, session: session)
        guard result.schemaVersion == 1, result.environment == session.environment,
              result.operationId == command.operationId, result.action == command.action,
              result.userId == command.userId else { throw ShiftCoverageFailure.invalidResponse }
        switch command.intent {
        case let .membership(revision, _, _):
            guard let acknowledged = result.membershipRevision, acknowledged >= revision,
                  acknowledged < 9_007_199_254_740_991, result.exceptionId == nil else {
                throw ShiftCoverageFailure.invalidResponse
            }
        case .spacing:
            guard result.membershipRevision == nil, let id = result.exceptionId,
                  !id.isEmpty, !id.contains("/") else { throw ShiftCoverageFailure.invalidResponse }
        }
    }

    private func validate(_ result: ShiftCoverageSnapshot, session: ShiftCoverageSession, policy: String) throws {
        guard result.schemaVersion == 1, result.environment == session.environment.rawValue,
              result.memberId == session.memberId, result.policyRevision == policy else {
            throw ShiftCoverageFailure.invalidResponse
        }
    }

    private func admittedPolicy(_ session: ShiftCoverageSession) async throws -> String {
        let access = try await resolveAccess(session: session)
        guard access.enabled, let policy = access.policyRevision else { throw ShiftCoverageFailure.unavailable }
        return policy
    }

    private func requireCurrent(_ session: ShiftCoverageSession) throws {
        try Task.checkCancellation()
        guard sessionProvider() == session else { throw ShiftCoverageFailure.sessionChanged }
    }

    private func post<Body: Encodable, Value: Decodable>(
        function: FirebaseFunctionEndpoint = .shiftCoverage,
        body: Body,
        session: ShiftCoverageSession
    ) async throws -> Value {
        do {
            if function == .resolveShiftCoverageAccess {
                return try await storedClient.post(
                    function: function, body: body, response: Value.self, expectedAuthUID: session.uid
                ) {
                    try self.requireCurrent(session)
                }
            }
            let result = try await storedClient.post(
                function: function, body: body, response: Envelope<Value>.self, expectedAuthUID: session.uid
            ) {
                try self.requireCurrent(session)
            }
            guard result.ok else { throw ShiftCoverageFailure.invalidResponse }
            return result.data
        } catch let error as FirebaseFunctionClientError {
            throw map(error)
        }
    }

    private func map(_ error: FirebaseFunctionClientError) -> any Error {
        switch error {
        case .unauthorized, .forbidden, .conflict, .http:
            mapHTTP(error)
        case .missingIDToken: ShiftCoverageFailure.rejected(status: 401, code: "unauthenticated")
        case .cancelled: CancellationError()
        case .invalidEndpoint, .invalidHTTPResponse, .invalidResponse: ShiftCoverageFailure.invalidResponse
        case .timeout, .transport: ShiftCoverageFailure.unavailable
        }
    }

    private func mapHTTP(_ error: FirebaseFunctionClientError) -> any Error {
        switch error {
        case .unauthorized(let code, _): ShiftCoverageFailure.rejected(status: 401, code: code)
        case .forbidden(let code, _): ShiftCoverageFailure.rejected(status: 403, code: code)
        // Admission runs before receipt lookup. It cannot settle an earlier uncertain operation.
        case .conflict("coverage_unavailable", _): ShiftCoverageFailure.unavailable
        case .conflict("coverage_session_changed", _), .conflict("coverage_environment_changed", _):
            ShiftCoverageFailure.sessionChanged
        case .conflict(let code, _): ShiftCoverageFailure.rejected(status: 409, code: code)
        case .http(400, let code, _): ShiftCoverageFailure.rejected(status: 400, code: code)
        default: ShiftCoverageFailure.unavailable
        }
    }

    private struct AccessQuery: Encodable {
        let schemaVersion = 1
        let environment: SessionEnvironment
    }

    private struct Query: Encodable {
        let schemaVersion = 1
        let environment: SessionEnvironment
        let action: String
        let caseId: String?
        var eventId: String?
    }

    private struct Envelope<Value: Decodable>: Decodable {
        let ok: Bool
        let data: Value
    }

    private struct Receipt: Decodable {
        let schemaVersion: Int
        let environment: SessionEnvironment
        let caseId: String
        let operationId: String
        let revision: Int64
    }

    private struct AdministrationReceipt: Decodable {
        let schemaVersion: Int
        let environment: SessionEnvironment
        let action: String
        let operationId: String
        let userId: String
        let membershipRevision: Int64?
        let exceptionId: String?
    }
}

extension FirebaseShiftCoverageRepository {
    init(
        client: AuthenticatedFirebaseFunctionsClient,
        currentSession: @escaping @MainActor () -> ShiftCoverageSession?
    ) {
        self.storedClient = client
        self.sessionProvider = currentSession
    }
}
