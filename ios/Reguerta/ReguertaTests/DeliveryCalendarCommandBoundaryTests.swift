import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct DeliveryCalendarCommandBoundaryTests {
    @Test func repositoryHasNoDirectFirestoreMutationOrOfflineQueuePath() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/Data/Calendar/FirestoreDeliveryCalendarRepository.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(source.contains(".setData(") == false)
        #expect(source.contains(".delete()") == false)
        #expect(source.contains("resolveDeliveryCalendarMutationContext"))
        #expect(source.contains("transitionDeliveryCalendarOverride"))
    }

    @Test func upsertResolvesContextThenSendsExactCommandAndReturnsBackendOverride() async throws {
        let loader = DeliveryCalendarHTTPDataLoader(
            responses: [
                .success(try contextData(environment: .production, weekKey: "2026-W36")),
                .success(
                    try transitionData(
                        environment: .production,
                        operationID: "operation-001",
                        action: "upsert",
                        weekKey: "2026-W36",
                        override: responseOverride(updatedBy: "server-member", updatedAtMillis: 42)
                    )
                )
            ]
        )
        let repository = makeRepository(loader: loader, operationID: "operation-001")

        let result = try await repository.upsertOverride(localOverride(), environment: .production)

        #expect(loader.requests.map(\.url?.lastPathComponent) == [
            "resolveDeliveryCalendarMutationContext",
            "transitionDeliveryCalendarOverride"
        ])
        let contextBody = try requestBody(loader.requests[0])
        #expect(Set(contextBody.keys) == ["schemaVersion", "environment", "weekKey"])
        let command = try requestBody(loader.requests[1])
        #expect(Set(command.keys) == [
            "schemaVersion",
            "environment",
            "operationId",
            "action",
            "weekKey",
            "expectedPlanningAuthority",
            "expectedOverrideDigest",
            "deliveryWeekday"
        ])
        #expect(command["environment"] as? String == "production")
        #expect(command["operationId"] as? String == "operation-001")
        #expect(command["action"] as? String == "upsert")
        #expect(command["weekKey"] as? String == "2026-W36")
        #expect(command["deliveryWeekday"] as? String == "TUE")
        #expect(command["expectedOverrideDigest"] is NSNull)
        #expect(result.updatedBy == "server-member")
        #expect(result.updatedAtMillis == 42)
    }

    @Test func deleteOmitsWeekdayAndRequiresNullBackendOverride() async throws {
        let loader = DeliveryCalendarHTTPDataLoader(
            responses: [
                .success(try contextData(environment: .develop, weekKey: "2026-W36")),
                .success(
                    try transitionData(
                        environment: .develop,
                        operationID: "operation-002",
                        action: "delete",
                        weekKey: "2026-W36",
                        override: nil
                    )
                )
            ]
        )
        let repository = makeRepository(loader: loader, operationID: "operation-002")

        try await repository.deleteOverride(weekKey: "2026-W36", environment: .develop)

        let command = try requestBody(loader.requests[1])
        #expect(command["action"] as? String == "delete")
        #expect(command["deliveryWeekday"] == nil)
        #expect(command["expectedOverrideDigest"] is NSNull)
    }

    @Test func staleConflictIsSurfacedWithoutRefreshingAndRetrying() async throws {
        let error = FirebaseFunctionErrorResponse(
            error: FirebaseFunctionErrorPayload(
                code: "delivery_calendar_authority_changed",
                message: "stale"
            )
        )
        let loader = DeliveryCalendarHTTPDataLoader(
            responses: [
                .success(try contextData(environment: .develop, weekKey: "2026-W36")),
                .failure(try JSONEncoder().encode(error), statusCode: 409)
            ]
        )
        let repository = makeRepository(loader: loader, operationID: "operation-003")

        await #expect(throws: RepositoryError.unavailable(resource: "deliveryCalendar.mutation")) {
            try await repository.upsertOverride(localOverride(), environment: .develop)
        }
        #expect(loader.requests.count == 2)
    }

    private func makeRepository(
        loader: DeliveryCalendarHTTPDataLoader,
        operationID: String
    ) -> FirestoreDeliveryCalendarRepository {
        FirestoreDeliveryCalendarRepository(
            firebaseAppName: Firestore.firestore().app.name,
            functionsClient: AuthenticatedFirebaseFunctionsClient(
                baseURL: URL(string: "https://example.test")!,
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: loader
            ),
            operationIDProvider: { operationID }
        )
    }
}

@MainActor
private final class DeliveryCalendarHTTPDataLoader: HTTPDataLoading {
    enum Response {
        case success(Data)
        case failure(Data, statusCode: Int)
    }

    private var responses: [Response]
    private(set) var requests: [URLRequest] = []

    init(responses: [Response]) {
        self.responses = responses
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        requests.append(request)
        guard !responses.isEmpty else { throw URLError(.badServerResponse) }
        let response = responses.removeFirst()
        let data: Data
        let statusCode: Int
        switch response {
        case .success(let payload):
            data = payload
            statusCode = 200
        case .failure(let payload, let responseStatusCode):
            data = payload
            statusCode = responseStatusCode
        }
        let url = try #require(request.url)
        let httpResponse = try #require(
            HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: nil, headerFields: nil)
        )
        return (data, httpResponse)
    }
}

private func requestBody(_ request: URLRequest) throws -> [String: Any] {
    let data = try #require(request.httpBody)
    return try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
}

private func contextData(environment: SessionEnvironment, weekKey: String) throws -> Data {
    try JSONSerialization.data(withJSONObject: [
        "ok": true,
        "schemaVersion": 1,
        "environment": environment.rawValue,
        "weekKey": weekKey,
        "planningAuthority": planningAuthority(),
        "overrideDigest": NSNull()
    ])
}

private func transitionData(
    environment: SessionEnvironment,
    operationID: String,
    action: String,
    weekKey: String,
    override: [String: Any]?
) throws -> Data {
    try JSONSerialization.data(withJSONObject: [
        "ok": true,
        "schemaVersion": 1,
        "environment": environment.rawValue,
        "operationId": operationID,
        "action": action,
        "weekKey": weekKey,
        "commandDigest": calendarDigest,
        "planningAuthority": planningAuthority(),
        "priorOverrideDigest": NSNull(),
        "overrideDigest": override == nil ? NSNull() : calendarDigest as Any,
        "override": override ?? NSNull() as Any,
        "replayed": false
    ])
}

private func localOverride() -> DeliveryCalendarOverride {
    DeliveryCalendarOverride(
        weekKey: "2026-W36",
        deliveryDateMillis: 1_788_235_200_000,
        ordersBlockedDateMillis: 1_788_321_600_000,
        ordersOpenAtMillis: 1_788_408_000_000,
        ordersCloseAtMillis: 1_788_796_799_000,
        updatedBy: "local-member",
        updatedAtMillis: 1
    )
}

private func responseOverride(updatedBy: String, updatedAtMillis: Int64) -> [String: Any] {
    [
        "weekKey": "2026-W36",
        "deliveryDateMillis": 1_788_235_200_000,
        "ordersBlockedDateMillis": 1_788_321_600_000,
        "ordersOpenAtMillis": 1_788_408_000_000,
        "ordersCloseAtMillis": 1_788_796_799_000,
        "updatedBy": updatedBy,
        "updatedAtMillis": updatedAtMillis
    ]
}

private func planningAuthority() -> [String: Any] {
    [
        "schemaVersion": 1,
        "stateRevision": 7,
        "writeEpoch": 3,
        "activeRevision": "revision-001",
        "activeDigest": "shift-planning:v1:sha256:" + String(repeating: "a", count: 64)
    ]
}

private let calendarDigest =
    "delivery-calendar:v1:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
