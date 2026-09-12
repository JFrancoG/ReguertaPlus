import Foundation
import Testing
@testable import Reguerta

@MainActor
final class CoverageClientHarness {
    let transport: CoverageClientTransport
    var current: ShiftCoverageSession?
    var token = CoverageClientHarness.token(project: "demo-reguerta-hu084-coverage", uid: "auth-a")
    var onToken: (@MainActor () -> Void)?
    private(set) var model: ShiftCoverageViewModel!
    let command = ShiftCoverageCommand(
        caseId: "case-a",
        operationId: "accept-once",
        expectedRevision: 2,
        expectedShiftRevision: 4,
        action: .accept
    )

    init() throws {
        let url = try #require(Bundle(for: CoverageClientBundle.self)
            .url(forResource: "shift-coverage-overview", withExtension: "json"))
        transport = CoverageClientTransport(overview: try String(contentsOf: url, encoding: .utf8))
        current = ShiftCoverageSession(uid: "auth-a", memberId: "member-a", authorizationRevision: 1)
        let repository = try LocalShiftCoverageRepository(
            port: 8799,
            currentSession: { [weak self] in self?.current },
            tokenProvider: { [weak self] in
                guard let self else { throw ShiftCoverageFailure.sessionChanged }
                onToken?()
                return token
            },
            loader: transport
        )
        model = ShiftCoverageViewModel(repository: repository)
        model.bind(current)
    }

    func bind(revision: UInt64) {
        current = ShiftCoverageSession(uid: "auth-a", memberId: "member-a", authorizationRevision: revision)
        model.bind(current)
    }

    static func token(project: String, uid: String) -> String {
        let header = #"{"alg":"none"}"#
        let claims = "{\"aud\":\"\(project)\",\"iss\":\"https://securetoken.google.com/\(project)\",\"sub\":\"\(uid)\"}"
        return [header, claims].map {
            Data($0.utf8).base64EncodedString().replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        }.joined(separator: ".") + "."
    }
}

@MainActor
final class CoverageClientTransport: HTTPDataLoading {
    var overview: String
    var commands: [Data] = []
    var requests = 0
    var loseFirstCommandResponse = false
    var failReadBack = false
    var wrongReceipt = false
    var rejectionStatus: Int?
    var beforeResponse: (@MainActor () -> Void)?

    init(overview: String) {
        self.overview = overview
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        requests += 1
        let body = try #require(request.httpBody)
        let action = try JSONDecoder().decode(Action.self, from: body).action
        var response = overview
        if action != "overview" && action != "detail" {
            commands.append(body)
            if loseFirstCommandResponse && commands.count == 1 {
                throw URLError(.timedOut)
            }
            let operationId = wrongReceipt ? "wrong-operation" : "accept-once"
            response = """
            {"ok":true,"data":{"schemaVersion":1,"environment":"develop","caseId":"case-a",
            "operationId":"\(operationId)","revision":3,"replayed":\(commands.count > 1)}}
            """
        } else if !commands.isEmpty {
            if failReadBack {
                throw URLError(.networkConnectionLost)
            }
            response = overview.replacingOccurrences(of: "\"offered\"", with: "\"accepted\"")
        }
        beforeResponse?()
        if rejectionStatus != nil {
            response = #"{"ok":false,"code":"auth_invalid"}"#
        }
        let url = try #require(request.url)
        let http = try #require(HTTPURLResponse(
            url: url,
            statusCode: rejectionStatus ?? 200,
            httpVersion: nil,
            headerFields: nil
        ))
        return (Data(response.utf8), http)
    }

    private struct Action: Decodable { let action: String }
}

private final class CoverageClientBundle: NSObject {}

struct CoverageSentCommand: Decodable, Equatable {
    let schemaVersion: Int
    let environment: String
    let caseId: String
    let operationId: String
    let expectedRevision: Int64
    let expectedShiftRevision: Int64
    let action: String
    let reason: String?
    let userId: String?
    let expiresAtMillis: Int64?
    let shiftId: String?
    let absentUserId: String?
}
