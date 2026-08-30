import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirebaseShiftPlanningRequestContextResolverTests {
    @Test func resolvesTheExactEnvironmentAndMinimalLineageContext() async throws {
        let loader = RecordingHTTPDataLoader(
            data: try contextData(),
            statusCode: 200
        )
        let resolver = FirebaseShiftPlanningRequestContextResolver(
            functionsClient: AuthenticatedFirebaseFunctionsClient(
                baseURL: try #require(URL(string: "https://example.test")),
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: loader
            )
        )

        let context = try await resolver.resolve(environment: .production)

        #expect(
            context == ShiftPlanningRequestContext(
                environment: .production,
                expectedWriteEpoch: 7,
                expectedActiveRevision: "active-6"
            )
        )
        let request = try #require(loader.lastRequest)
        #expect(request.url?.lastPathComponent == "resolveShiftPlanningRequestContext")
        let requestData = try #require(request.httpBody)
        let body = try #require(
            JSONSerialization.jsonObject(with: requestData) as? [String: Any]
        )
        #expect(Set(body.keys) == ["schemaVersion", "environment"])
        #expect(body["environment"] as? String == "production")
    }

    @Test func malformedContextFailsClosed() async throws {
        let loader = RecordingHTTPDataLoader(
            data: try JSONSerialization.data(withJSONObject: [
                "ok": true,
                "schemaVersion": 1,
                "environment": "production",
                "expectedWriteEpoch": -1,
                "expectedActiveRevision": NSNull()
            ]),
            statusCode: 200
        )
        let resolver = FirebaseShiftPlanningRequestContextResolver(
            functionsClient: AuthenticatedFirebaseFunctionsClient(
                baseURL: try #require(URL(string: "https://example.test")),
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: loader
            )
        )

        await #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningRequests.context.response")) {
            try await resolver.resolve(environment: .production)
        }
    }

    @Test func contextWithUnknownFieldFailsClosed() async throws {
        let loader = RecordingHTTPDataLoader(
            data: try JSONSerialization.data(withJSONObject: [
                "ok": true,
                "schemaVersion": 1,
                "environment": "production",
                "expectedWriteEpoch": 7,
                "expectedActiveRevision": "active-6",
                "activeDigest": "must-remain-private"
            ]),
            statusCode: 200
        )
        let resolver = FirebaseShiftPlanningRequestContextResolver(
            functionsClient: AuthenticatedFirebaseFunctionsClient(
                baseURL: try #require(URL(string: "https://example.test")),
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: loader
            )
        )

        await #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningRequests.context.response")) {
            try await resolver.resolve(environment: .production)
        }
    }

    private func contextData() throws -> Data {
        try JSONSerialization.data(withJSONObject: [
            "ok": true,
            "schemaVersion": 1,
            "environment": "production",
            "expectedWriteEpoch": 7,
            "expectedActiveRevision": "active-6"
        ])
    }
}
