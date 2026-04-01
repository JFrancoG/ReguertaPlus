import FirebaseFirestore
import Foundation

final class FirestoreNotificationRepository: @unchecked Sendable, NotificationRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment = .develop
    ) {
        self.db = db
        self.environment = environment
    }

    private var notificationsCollection: CollectionReference {
        db.reguertaCollection(.notificationEvents, environment: environment)
    }

    func allNotifications() async -> [NotificationEvent] {
        do {
            let snapshot = try await notificationsCollection.getDocuments()
            return snapshot.documents
                .compactMap(Self.toNotificationEvent)
                .sorted { $0.sentAtMillis > $1.sentAtMillis }
        } catch {
            return []
        }
    }

    func send(event: NotificationEvent) async -> NotificationEvent {
        let documentId = event.id.isEmpty ? notificationsCollection.document().documentID : event.id
        let persisted = NotificationEvent(
            id: documentId,
            title: event.title,
            body: event.body,
            type: event.type,
            target: event.target,
            userIds: event.userIds,
            segmentType: event.segmentType,
            targetRole: event.targetRole,
            createdBy: event.createdBy,
            sentAtMillis: event.sentAtMillis,
            weekKey: event.weekKey
        )

        let targetPayload: [String: Any?]
        switch persisted.target {
        case "users":
            targetPayload = ["userIds": persisted.userIds]
        case "segment" where persisted.segmentType == "role":
            targetPayload = [
                "segmentType": "role",
                "role": persisted.targetRole?.wireValue
            ]
        default:
            targetPayload = [:]
        }

        do {
            var payload: [String: Any] = [
                "title": persisted.title,
                "body": persisted.body,
                "type": persisted.type,
                "target": persisted.target,
                "targetPayload": targetPayload,
                "sentAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(persisted.sentAtMillis) / 1_000)),
                "createdBy": persisted.createdBy,
            ]
            if let weekKey = persisted.weekKey {
                payload["weekKey"] = weekKey
            }
            try await notificationsCollection.document(documentId).setData(payload, merge: true)
            return persisted
        } catch {
            return persisted
        }
    }

    private static func toNotificationEvent(_ document: QueryDocumentSnapshot) -> NotificationEvent? {
        let data = document.data()
        guard let title = (data["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              let body = (data["body"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              let type = (data["type"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              let target = (data["target"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !title.isEmpty,
              !body.isEmpty,
              !type.isEmpty,
              !target.isEmpty else {
            return nil
        }

        let targetPayload = data["targetPayload"] as? [String: Any]
        let userIds = targetPayload?["userIds"] as? [String] ?? []
        let segmentType = (targetPayload?["segmentType"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfEmpty
        let targetRole = (targetPayload?["role"] as? String).flatMap(MemberRole.init(wireValue:))
        let sentAtMillis: Int64
        if let timestamp = data["sentAt"] as? Timestamp {
            sentAtMillis = Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
        } else {
            sentAtMillis = 0
        }

        return NotificationEvent(
            id: document.documentID,
            title: title,
            body: body,
            type: type,
            target: target,
            userIds: userIds,
            segmentType: segmentType,
            targetRole: targetRole,
            createdBy: (data["createdBy"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            sentAtMillis: sentAtMillis,
            weekKey: (data["weekKey"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .nilIfEmpty
        )
    }
}

private extension MemberRole {
    init?(wireValue: String) {
        switch wireValue.lowercased() {
        case "member":
            self = .member
        case "producer":
            self = .producer
        case "admin":
            self = .admin
        default:
            return nil
        }
    }

    var wireValue: String {
        switch self {
        case .member: "member"
        case .producer: "producer"
        case .admin: "admin"
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
