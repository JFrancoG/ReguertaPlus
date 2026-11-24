import Foundation
import Testing
@testable import Reguerta

@MainActor
final class LiveCoverageHarness {
    let session: ShiftCoverageSession
    var current: ShiftCoverageSession?
    let transport: LiveCoverageTransport
    let tokens = LiveCoverageTokenProvider()
    private(set) var repository: FirebaseShiftCoverageRepository!
    private(set) var route: CoverageRouteViewModel!

    var command: ShiftCoverageCommand {
        ShiftCoverageCommand(
            expectedPolicyRevision: "admitted-policy-v1",
            environment: session.environment,
            caseId: "case-a",
            operationId: "live-accept-once",
            expectedRevision: 2,
            expectedShiftRevision: 4,
            action: .accept
        )
    }

    init(environment: SessionEnvironment) throws {
        session = ShiftCoverageSession(
            environment: environment,
            uid: "auth-a",
            memberId: "member-a",
            authorizationRevision: 1
        )
        current = session
        transport = try LiveCoverageTransport(environment: environment)
        repository = FirebaseShiftCoverageRepository(
            client: Self.client(transport: transport, tokens: tokens),
            currentSession: { [weak self] in self?.current }
        )
        route = CoverageRouteViewModel(repository: repository, sessionProvider: { [weak self] in self?.current })
    }

    static func client(
        transport: LiveCoverageTransport,
        tokens: LiveCoverageTokenProvider = LiveCoverageTokenProvider()
    ) -> AuthenticatedFirebaseFunctionsClient {
        AuthenticatedFirebaseFunctionsClient(
            baseURL: URL(string: "https://europe-west1-example.cloudfunctions.net")!,
            tokenProvider: tokens,
            dataLoader: transport
        )
    }
}

@MainActor
final class LiveCoverageTokenProvider: FirebaseIDTokenProviding {
    var currentUserID: String? = "auth-a"
    var onRefresh: (@MainActor () -> Void)?

    func validIDToken(forcingRefresh: Bool) async throws -> String {
        onRefresh?()
        return "signed-session-token"
    }
}

@MainActor
final class LiveCoverageTransport: HTTPDataLoading {
    static let eventID = "coverage-" + String(repeating: "a", count: 64)
    let environment: SessionEnvironment
    var enabled = true
    var corruptOverview: String?
    var policyRevision = "admitted-policy-v1"
    var isAdmin = false
    var commandError: (status: Int, code: String)?
    var loseFirstCommand = false
    private(set) var actions: [String] = []
    private(set) var environments: [String] = []
    private(set) var commandBodies: [Data] = []
    private let overview: String
    private let notification: String
    private let administration: String

    init(environment: SessionEnvironment) throws {
        self.environment = environment
        let bundle = Bundle(for: LiveCoverageBundle.self)
        let overviewURL = try #require(bundle.url(forResource: "shift-coverage-overview", withExtension: "json"))
        let notificationURL = try #require(bundle.url(
            forResource: "shift-coverage-notification", withExtension: "json"
        ))
        overview = try String(contentsOf: overviewURL, encoding: .utf8)
        notification = try String(contentsOf: notificationURL, encoding: .utf8)
            .replacingOccurrences(of: "coverage-fixture-event", with: Self.eventID)
        let administrationURL = try #require(bundle.url(
            forResource: "shift-coverage-administration", withExtension: "json"
        ))
        administration = try String(contentsOf: administrationURL, encoding: .utf8)
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let url = try #require(request.url)
        let body = try #require(request.httpBody)
        let command = try JSONDecoder().decode(LiveCoverageRequest.self, from: body)
        environments.append(command.environment)
        let isAccess = url.lastPathComponent == "resolveShiftCoverageAccess"
        actions.append(isAccess ? "access" : command.action ?? "unknown")
        let json: String
        var status = 200
        if isAccess {
            let policy = enabled ? "\"\(policyRevision)\"" : "null"
            json = """
            {"schemaVersion":1,"environment":"\(environment.rawValue)","memberId":"member-a",
            "enabled":\(enabled),"policyRevision":\(policy)}
            """
        } else if ["overview", "notification", "administration"].contains(command.action) {
            json = queryResponse(action: command.action)
        } else {
            commandBodies.append(body)
            if loseFirstCommand && commandBodies.count == 1 {
                throw URLError(.networkConnectionLost)
            }
            if let commandError {
                status = commandError.status
                json = "{\"error\":{\"code\":\"\(commandError.code)\",\"message\":\"Rejected\"}}"
            } else {
                json = receipt(command)
            }
        }
        let response = try #require(HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil))
        return (Data(json.utf8), response)
    }

    private func queryResponse(action: String?) -> String {
        var json = action == "administration" ? administration : action == "notification" ? notification : overview
        json = json.replacingOccurrences(of: "hu084-provisional-v1", with: policyRevision)
            .replacingOccurrences(of: "\"develop\"", with: "\"\(environment.rawValue)\"")
        if isAdmin {
            json = json.replacingOccurrences(of: "\"isAdmin\": false", with: "\"isAdmin\": true")
        }
        if !commandBodies.isEmpty {
            json = json.replacingOccurrences(of: "\"offered\"", with: "\"accepted\"")
        }
        switch corruptOverview {
        case "member":
            json = json.replacingOccurrences(of: "\"memberId\": \"member-a\"", with: "\"memberId\": \"other\"")
        case "environment": json = json.replacingOccurrences(of: "\"production\"", with: "\"develop\"")
        case "policy": json = json.replacingOccurrences(of: policyRevision, with: "obsolete-policy")
        default: break
        }
        return json
    }

    private func receipt(_ command: LiveCoverageRequest) -> String {
        if command.action == "reconcileMembership" {
            return """
            {"ok":true,"data":{"schemaVersion":1,"environment":"\(environment.rawValue)",
            "action":"reconcileMembership","userId":"member-b","membershipRevision":4,"exceptionId":null,
            "operationId":"\(command.operationId ?? "missing")"}}
            """
        }
        return """
        {"ok":true,"data":{"schemaVersion":1,"environment":"\(environment.rawValue)",
        "caseId":"case-a","operationId":"\(command.operationId ?? "missing")","revision":3}}
        """
    }

}

private struct LiveCoverageRequest: Decodable {
    let environment: String
    let action: String?
    let operationId: String?
}

private final class LiveCoverageBundle: NSObject {}

@MainActor
func makeLiveCoverageRoot(transport: LiveCoverageTransport) -> AccessRootViewModel {
    let member = adminMember(id: "member-a", displayName: "Ana")
    let session = SessionViewModel(dependencies: .preview())
    session.mode = .authorized(AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_member-a", email: member.normalizedEmail),
        authenticatedMember: member,
        member: member,
        members: [member],
        environment: transport.environment
    ))
    let tokens = LiveCoverageTokenProvider()
    tokens.currentUserID = "auth_member-a"
    let root = AccessRootViewModel(
        sessionViewModel: session,
        productsFeatureDependencies: .preview(),
        ordersFeatureDependencies: .preview(),
        shiftsFeatureDependencies: .preview(
            coverageRepositoryFactory: { current in
                FirebaseShiftCoverageRepository(
                    client: LiveCoverageHarness.client(transport: transport, tokens: tokens), currentSession: current
                )
            },
            environmentProvider: { transport.environment }
        ),
        newsNotificationsFeatureDependencies: .preview(),
        sharedProfileFeatureDependencies: .preview(),
        usersFeatureDependencies: .preview(),
        myOrderFreshnessFeatureDependencies: .preview(),
        bylawsFeatureDependencies: .preview(),
        developmentTimeMachine: DevelopmentTimeMachine(),
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(policy: nil), environment: .develop
        ),
        shouldSkipSplashProvider: { true }
    )
    root.shellState = AuthShellState(backStack: [.home])
    return root
}
