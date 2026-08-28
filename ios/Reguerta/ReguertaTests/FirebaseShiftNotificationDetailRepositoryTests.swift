import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirebaseShiftNotificationDetailRepositoryTests {
    @Test func exactCurrentAssignmentMapsToDomainDetail() async throws {
        let loader = RecordingHTTPDataLoader(data: Data(validResponse.utf8), statusCode: 200)
        let repository = makeRepository(loader: loader)

        let detail = try await repository.currentDetail(
            eventID: "event_1",
            memberID: "member_1",
            environment: .production
        )

        #expect(detail.eventID == "event_1")
        #expect(detail.assignmentRevision == 4)
        #expect(detail.documentRevision == 5)
        #expect(detail.shift.id == "delivery_1")
        #expect(detail.shift.assignedUserIds == ["member_1"])
        #expect(detail.shift.helperUserId == "member_2")
        #expect(loader.lastRequest?.url?.lastPathComponent == "resolveShiftNotificationDetail")
        #expect(loader.lastRequest?.httpBody.flatMap { try? JSONDecoder().decode(RequestProbe.self, from: $0) } ==
            RequestProbe(environment: .production, eventId: "event_1"))
    }

    @Test func extraRichFieldIsRejectedFailClosed() async {
        let response = validResponse.replacingOccurrences(
            of: "\"eventId\": \"event_1\"",
            with: "\"eventId\": \"event_1\", \"recipientName\": \"Sensitive\""
        )
        let repository = makeRepository(loader: RecordingHTTPDataLoader(data: Data(response.utf8), statusCode: 200))

        await #expect(throws: RepositoryError.invalidData(resource: "notifications.shiftDetail.response")) {
            try await repository.currentDetail(
                eventID: "event_1",
                memberID: "member_1",
                environment: .production
            )
        }
    }

    @Test func reassignedCurrentMemberIsRejectedFailClosed() async {
        let response = validResponse.replacingOccurrences(of: "member_1", with: "member_3")
        let repository = makeRepository(loader: RecordingHTTPDataLoader(data: Data(response.utf8), statusCode: 200))

        await #expect(throws: RepositoryError.invalidData(resource: "notifications.shiftDetail.response")) {
            try await repository.currentDetail(
                eventID: "event_1",
                memberID: "member_1",
                environment: .production
            )
        }
    }

    private func makeRepository(loader: RecordingHTTPDataLoader) -> FirebaseShiftNotificationDetailRepository {
        FirebaseShiftNotificationDetailRepository(
            functionsClient: AuthenticatedFirebaseFunctionsClient(
                baseURL: URL(string: "https://example.test")!,
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: loader
            )
        )
    }

    private var validResponse: String {
        """
        {
          "schemaVersion": 1,
          "eventId": "event_1",
          "assignmentRevision": 4,
          "documentRevision": 5,
          "shift": {
            "id": "delivery_1",
            "type": "delivery",
            "dateMillis": 1788127200000,
            "assignedUserIds": ["member_1"],
            "helperUserId": "member_2",
            "status": "planned",
            "source": "app",
            "createdAtMillis": 1787000000000,
            "updatedAtMillis": 1787000001000
          }
        }
        """
    }
}

nonisolated private struct RequestProbe: Codable, Equatable {
    let environment: SessionEnvironment
    let eventId: String
}
