import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
@Suite("Firestore News and Notification decoding")
struct FirestoreNewsNotificationDecodingTests {
    @Test("An empty news snapshot is valid and a mixed corrupt snapshot fails atomically")
    func newsSnapshotIsAtomic() throws {
        #expect(try FirestoreNewsRepository.newsArticles(documents: []).isEmpty)

        #expect(throws: RepositoryError.invalidData(resource: "news/broken")) {
            try FirestoreNewsRepository.newsArticles(
                documents: [
                    (documentID: "valid", data: validNewsData()),
                    (documentID: "broken", data: ["title": "Incomplete"])
                ]
            )
        }
    }

    @Test("News requires canonical non-empty fields, Bool and Timestamp")
    func newsRejectsMissingBlankAndMistypedRequiredFields() {
        var data = validNewsData()
        data["publishedBy"] = "   "
        expectInvalidNews(data)

        data = validNewsData()
        data["active"] = "true"
        expectInvalidNews(data)

        data = validNewsData()
        data["active"] = NSNumber(value: 1)
        expectInvalidNews(data)

        data = validNewsData()
        data["publishedAt"] = 123
        expectInvalidNews(data)

        expectInvalidNews(validNewsData(), documentID: "   ")
    }

    @Test("News optional image accepts only absence, null or a non-empty String")
    func newsValidatesOptionalImage() throws {
        var missing = validNewsData()
        missing.removeValue(forKey: "urlImage")
        #expect(try FirestoreNewsRepository.newsArticle(documentID: "news", data: missing).urlImage == nil)

        var null = validNewsData()
        null["urlImage"] = NSNull()
        #expect(try FirestoreNewsRepository.newsArticle(documentID: "news", data: null).urlImage == nil)

        var typed = validNewsData()
        typed["urlImage"] = " https://cdn.test/news.jpg "
        #expect(
            try FirestoreNewsRepository.newsArticle(documentID: "news", data: typed).urlImage ==
                "https://cdn.test/news.jpg"
        )

        var wrongType = validNewsData()
        wrongType["urlImage"] = 42
        expectInvalidNews(wrongType)

        var blank = validNewsData()
        blank["urlImage"] = "   "
        expectInvalidNews(blank)
    }

    @Test(
        "Every canonical notification type decodes",
        arguments: [
            "order_reminder",
            "order_auto_generated",
            "shift_swap_requested",
            "shift_swap_available",
            "shift_swap_unavailable",
            "shift_swap_accepted",
            "shift_swap_applied",
            "shift_updated",
            "news_published",
            "admin_broadcast"
        ]
    )
    func canonicalNotificationTypesDecode(_ type: String) throws {
        var data = validNotificationData()
        data["type"] = type

        let event = try FirestoreNotificationRepository.notificationEvent(
            documentID: "event",
            data: data,
            source: .events
        )

        #expect(event.type == type)
    }

    @Test("An empty notification snapshot is valid and a corrupt document rejects the complete snapshot")
    func notificationSnapshotIsAtomic() throws {
        #expect(
            try FirestoreNotificationRepository.notificationEvents(
                documents: [],
                source: .events
            ).isEmpty
        )

        #expect(throws: RepositoryError.invalidData(resource: "notificationEvents/broken")) {
            try FirestoreNotificationRepository.notificationEvents(
                documents: [
                    (documentID: "valid", data: validNotificationData()),
                    (documentID: "broken", data: ["title": "Incomplete"])
                ],
                source: .events
            )
        }
    }

    @Test("Notification required fields, enums and Timestamp are strict")
    func notificationRejectsMissingBlankAndNonCanonicalFields() {
        var data = validNotificationData()
        data.removeValue(forKey: "createdBy")
        expectInvalidNotification(data)

        data = validNotificationData()
        data["title"] = "   "
        expectInvalidNotification(data)

        data = validNotificationData()
        data["type"] = "ADMIN_BROADCAST"
        expectInvalidNotification(data)

        data = validNotificationData()
        data["target"] = " all "
        expectInvalidNotification(data)

        data = validNotificationData()
        data["sentAt"] = 123
        expectInvalidNotification(data)

        expectInvalidNotification(validNotificationData(), documentID: "")
    }

    @Test("Notification target payload accepts only the exact canonical shape")
    func notificationValidatesExactTargetPayload() throws {
        let all = try FirestoreNotificationRepository.notificationEvent(
            documentID: "all",
            data: validNotificationData(),
            source: .events
        )
        #expect(all.target == "all")
        #expect(all.userIds.isEmpty)

        var usersData = validNotificationData()
        usersData["target"] = "users"
        usersData["targetPayload"] = ["userIds": [" member_1 ", "member_2"]]
        let users = try FirestoreNotificationRepository.notificationEvent(
            documentID: "users",
            data: usersData,
            source: .events
        )
        #expect(users.userIds == ["member_1", "member_2"])

        var segmentData = validNotificationData()
        segmentData["target"] = "segment"
        segmentData["targetPayload"] = ["segmentType": "role", "role": "producer"]
        let segment = try FirestoreNotificationRepository.notificationEvent(
            documentID: "segment",
            data: segmentData,
            source: .events
        )
        #expect(segment.segmentType == "role")
        #expect(segment.targetRole == .producer)

        var extraAll = validNotificationData()
        extraAll["targetPayload"] = ["userIds": ["member_1"]]
        expectInvalidNotification(extraAll)

        var emptyUsers = usersData
        emptyUsers["targetPayload"] = ["userIds": [String]()]
        expectInvalidNotification(emptyUsers)

        var blankUser = usersData
        blankUser["targetPayload"] = ["userIds": ["   "]]
        expectInvalidNotification(blankUser)

        var extraUsers = usersData
        extraUsers["targetPayload"] = ["userIds": ["member_1"], "role": "member"]
        expectInvalidNotification(extraUsers)

        var uppercaseRole = segmentData
        uppercaseRole["targetPayload"] = ["segmentType": "role", "role": "ADMIN"]
        expectInvalidNotification(uppercaseRole)

        var extraSegment = segmentData
        extraSegment["targetPayload"] = [
            "segmentType": "role",
            "role": "admin",
            "userIds": ["member_1"]
        ]
        expectInvalidNotification(extraSegment)
    }

    @Test("Notification week key accepts only absence, null or a non-empty String")
    func notificationValidatesOptionalWeekKey() throws {
        var missing = validNotificationData()
        missing.removeValue(forKey: "weekKey")
        #expect(
            try FirestoreNotificationRepository.notificationEvent(
                documentID: "event",
                data: missing,
                source: .events
            ).weekKey == nil
        )

        var null = validNotificationData()
        null["weekKey"] = NSNull()
        #expect(
            try FirestoreNotificationRepository.notificationEvent(
                documentID: "event",
                data: null,
                source: .events
            ).weekKey == nil
        )

        var wrongType = validNotificationData()
        wrongType["weekKey"] = false
        expectInvalidNotification(wrongType)

        var blank = validNotificationData()
        blank["weekKey"] = "  "
        expectInvalidNotification(blank)
    }

    @Test("Inbox identity must match the document and errors expose only collection and ID")
    func notificationInboxValidatesIdentityAndPIIFreeResource() throws {
        var valid = validNotificationData()
        valid["notificationEventId"] = "event_1"
        #expect(
            try FirestoreNotificationRepository.notificationEvent(
                documentID: "event_1",
                data: valid,
                source: .inbox
            ).id == "event_1"
        )

        valid["notificationEventId"] = "private title or member id"
        #expect(throws: RepositoryError.invalidData(resource: "notificationInbox/event_1")) {
            try FirestoreNotificationRepository.notificationEvent(
                documentID: "event_1",
                data: valid,
                source: .inbox
            )
        }
    }

    private func expectInvalidNews(_ data: [String: Any], documentID: String = "news_1") {
        #expect(throws: RepositoryError.invalidData(resource: "news/\(documentID)")) {
            try FirestoreNewsRepository.newsArticle(documentID: documentID, data: data)
        }
    }

    private func expectInvalidNotification(_ data: [String: Any], documentID: String = "event_1") {
        #expect(throws: RepositoryError.invalidData(resource: "notificationEvents/\(documentID)")) {
            try FirestoreNotificationRepository.notificationEvent(
                documentID: documentID,
                data: data,
                source: .events
            )
        }
    }

    private func validNewsData() -> [String: Any] {
        [
            "title": " News title ",
            "body": " News body ",
            "publishedBy": " Publisher ",
            "publishedAt": Timestamp(date: Date(timeIntervalSince1970: 123)),
            "active": true,
            "urlImage": NSNull()
        ]
    }

    private func validNotificationData() -> [String: Any] {
        [
            "title": " Notification title ",
            "body": " Notification body ",
            "type": "admin_broadcast",
            "target": "all",
            "targetPayload": [String: Any](),
            "sentAt": Timestamp(date: Date(timeIntervalSince1970: 456)),
            "createdBy": " system ",
            "weekKey": NSNull()
        ]
    }
}
