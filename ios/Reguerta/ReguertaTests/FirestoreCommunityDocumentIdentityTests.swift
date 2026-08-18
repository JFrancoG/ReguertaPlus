import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
@Suite("Firestore community document identity")
struct FirestoreCommunityDocumentIdentityTests {
    @Test("News and Notification document IDs reject surrounding whitespace") func documentIDsAreExact() {
        #expect(throws: RepositoryError.invalidData(resource: "news/ news_1 ")) {
            try FirestoreNewsRepository.newsArticle(
                documentID: " news_1 ",
                data: newsData()
            )
        }
        #expect(
            throws: RepositoryError.invalidData(
                resource: "notificationEvents/ event_1 "
            )
        ) {
            try FirestoreNotificationRepository.notificationEvent(
                documentID: " event_1 ",
                data: notificationData(),
                source: .events
            )
        }
    }

    @Test("Inbox identity compares the exact document and payload IDs") func inboxIdentityIsExact() {
        var data = notificationData()
        data["notificationEventId"] = "event_1"
        #expect(
            throws: RepositoryError.invalidData(
                resource: "notificationInbox/ event_1 "
            )
        ) {
            try FirestoreNotificationRepository.notificationEvent(
                documentID: " event_1 ",
                data: data,
                source: .inbox
            )
        }

        data["notificationEventId"] = " event_1 "
        #expect(
            throws: RepositoryError.invalidData(
                resource: "notificationInbox/event_1"
            )
        ) {
            try FirestoreNotificationRepository.notificationEvent(
                documentID: "event_1",
                data: data,
                source: .inbox
            )
        }
    }

    private func newsData() -> [String: Any] {
        [
            "title": "News",
            "body": "Body",
            "publishedBy": "Publisher",
            "publishedAt": Timestamp(date: Date(timeIntervalSince1970: 1)),
            "active": true
        ]
    }

    private func notificationData() -> [String: Any] {
        [
            "title": "Notification",
            "body": "Body",
            "type": "admin_broadcast",
            "target": "all",
            "targetPayload": [String: Any](),
            "sentAt": Timestamp(date: Date(timeIntervalSince1970: 1)),
            "createdBy": "admin_1"
        ]
    }
}
