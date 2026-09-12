#if DEBUG
import Foundation

/// Deliberately absent from Release and live composition. Only unsigned Auth-emulator tokens for
/// the fixed demo project can leave this adapter; the local server still verifies them authoritatively.
@MainActor
struct LocalShiftCoverageRepository: ShiftCoverageRepository {
    private let endpoint: URL
    private let currentSession: @MainActor () -> ShiftCoverageSession?
    private let tokenProvider: @MainActor () async throws -> String
    private let loader: any HTTPDataLoading

    func read(caseId: String?, session: ShiftCoverageSession) async throws -> ShiftCoverageSnapshot {
        let query = Query(action: caseId == nil ? "overview" : "detail", caseId: caseId)
        let result: ShiftCoverageSnapshot = try await post(query, session: session)
        guard result.schemaVersion == 1, result.environment == "develop",
              result.policyRevision == "hu084-provisional-v1", result.memberId == session.memberId else {
            throw ShiftCoverageFailure.invalidResponse
        }
        return result
    }

    func execute(_ command: ShiftCoverageCommand, session: ShiftCoverageSession) async throws {
        guard (0..<9_007_199_254_740_991).contains(command.expectedRevision) else {
            throw ShiftCoverageFailure.invalidResponse
        }
        let result: Receipt = try await post(command, session: session)
        guard result.schemaVersion == 1, result.environment == "develop",
              result.caseId == command.caseId, result.operationId == command.operationId,
              result.revision == command.expectedRevision + 1 else {
            throw ShiftCoverageFailure.invalidResponse
        }
    }

    private func post<Body: Encodable, Value: Decodable>(
        _ body: Body,
        session: ShiftCoverageSession
    ) async throws -> Value {
        try requireCurrent(session)
        let token = try await tokenProvider()
        try requireCurrent(session)
        try Self.requireEmulatorToken(token, uid: session.uid)
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await loader.data(for: request)
        try requireCurrent(session)
        guard let response = response as? HTTPURLResponse, response.url == endpoint else {
            throw ShiftCoverageFailure.invalidResponse
        }
        guard response.statusCode == 200 else {
            if [400, 401, 403, 409].contains(response.statusCode),
               let rejection = try? JSONDecoder().decode(Rejection.self, from: data), !rejection.ok {
                throw ShiftCoverageFailure.rejected(status: response.statusCode, code: rejection.code)
            }
            throw ShiftCoverageFailure.unavailable
        }
        guard let envelope = try? JSONDecoder().decode(Envelope<Value>.self, from: data), envelope.ok else {
            throw ShiftCoverageFailure.invalidResponse
        }
        return envelope.data
    }

    private func requireCurrent(_ session: ShiftCoverageSession) throws {
        guard currentSession() == session else { throw ShiftCoverageFailure.sessionChanged }
        try Task.checkCancellation()
    }

    private static func requireEmulatorToken(_ token: String, uid: String) throws {
        let parts = token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[2].isEmpty,
              let header: TokenHeader = decodeTokenPart(parts[0]), header.alg == "none",
              let claims: TokenClaims = decodeTokenPart(parts[1]),
              claims.aud == "demo-reguerta-hu084-coverage",
              claims.iss == "https://securetoken.google.com/demo-reguerta-hu084-coverage",
              claims.sub == uid else { throw ShiftCoverageFailure.localOnly }
    }

    private static func decodeTokenPart<Value: Decodable>(_ part: Substring) -> Value? {
        var base64 = part.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
        guard let data = Data(base64Encoded: base64) else { return nil }
        return try? JSONDecoder().decode(Value.self, from: data)
    }

    private struct Query: Encodable {
        let schemaVersion = 1
        let environment = "develop"
        let action: String
        let caseId: String?
    }

    private struct Envelope<Value: Decodable>: Decodable {
        let ok: Bool
        let data: Value
    }

    private struct Rejection: Decodable {
        let ok: Bool
        let code: String
    }

    private struct Receipt: Decodable {
        let schemaVersion: Int
        let environment: String
        let caseId: String
        let operationId: String
        let revision: Int64
        let replayed: Bool
    }

    private struct TokenHeader: Decodable { let alg: String }
    private struct TokenClaims: Decodable {
        let aud: String
        let iss: String
        let sub: String
    }
}

extension LocalShiftCoverageRepository {
    init(
        port: Int,
        currentSession: @escaping @MainActor () -> ShiftCoverageSession?,
        tokenProvider: @escaping @MainActor () async throws -> String,
        loader: any HTTPDataLoading = LocalCoverageDataLoader()
    ) throws {
        guard (1...65535).contains(port), let endpoint = URL(string: "http://127.0.0.1:\(port)/coverage") else {
            throw ShiftCoverageFailure.localOnly
        }
        self.endpoint = endpoint
        self.currentSession = currentSession
        self.tokenProvider = tokenProvider
        self.loader = loader
    }
}

@MainActor
private struct LocalCoverageDataLoader: HTTPDataLoading {
    private let session = URLSession(configuration: .ephemeral)

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await session.data(for: request, delegate: CoverageRedirectRefusal())
    }
}

private final class CoverageRedirectRefusal: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping @Sendable (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}
#endif
