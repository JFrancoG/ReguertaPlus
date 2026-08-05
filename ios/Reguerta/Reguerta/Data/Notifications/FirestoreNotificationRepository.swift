import FirebaseFirestore
import Foundation

enum FirestoreNotificationDocumentSource {
    case events
    case inbox

    var collectionName: String {
        switch self {
        case .events:
            "notificationEvents"
        case .inbox:
            "notificationInbox"
        }
    }
}

final class FirestoreNotificationRepository: @unchecked Sendable, NotificationRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(db: Firestore = Firestore.firestore(), environment: ReguertaFirestoreEnvironment? = nil) {
        self.db = db
        self.environment = environment
    }

    private var notificationsCollection: CollectionReference {
        db.reguertaCollection(.notificationEvents, environment: environment)
    }

    private func notificationReadsCollection(memberId: String) -> CollectionReference {
        db.reguertaCollection(.users, environment: environment)
            .document(memberId)
            .collection("notificationReads")
    }

    private func notificationInboxCollection(memberId: String) -> CollectionReference {
        db.reguertaCollection(.users, environment: environment)
            .document(memberId)
            .collection("notificationInbox")
    }

    func notifications(visibleTo member: Member) async throws -> [NotificationEvent] {
        do {
            let snapshot = try await notificationInboxCollection(memberId: member.id).getDocuments()
            return try Self.notificationEvents(
                documents: snapshot.documents.map {
                    (documentID: $0.documentID, data: $0.data())
                },
                source: .inbox
            )
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "notificationInbox")
        }
    }

    func allNotifications() async throws -> [NotificationEvent] {
        do {
            let snapshot = try await notificationsCollection.getDocuments()
            return try Self.notificationEvents(
                documents: snapshot.documents.map {
                    (documentID: $0.documentID, data: $0.data())
                },
                source: .events
            )
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "notificationEvents")
        }
    }

    func readNotificationIds(memberId: String) async throws -> Set<String> {
        do {
            let snapshot = try await notificationReadsCollection(memberId: memberId).getDocuments()
            return Set(snapshot.documents.map(\.documentID))
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "notificationReads")
        }
    }

    func markNotificationsRead(memberId: String, notificationIds: [String], readAtMillis: Int64) async throws {
        let normalizedIds = Set(notificationIds.map {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
        }.filter { !$0.isEmpty })
        guard !normalizedIds.isEmpty else { return }

        let batch = db.batch()
        let readAt = Timestamp(date: Date(timeIntervalSince1970: TimeInterval(readAtMillis) / 1_000))
        let collection = notificationReadsCollection(memberId: memberId)
        for notificationId in normalizedIds {
            batch.setData(
                [
                    "notificationEventId": notificationId,
                    "readAt": readAt
                ],
                forDocument: collection.document(notificationId),
                merge: true
            )
        }
        do {
            try await batch.commit()
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "notificationReads")
        }
    }

    func send(event: NotificationEvent) async throws -> NotificationEvent {
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

        var payload: [String: Any] = [
            "title": persisted.title,
            "body": persisted.body,
            "type": persisted.type,
            "target": persisted.target,
            "targetPayload": targetPayload,
            "sentAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(persisted.sentAtMillis) / 1_000)),
            "createdBy": persisted.createdBy
        ]
        if let weekKey = persisted.weekKey {
            payload["weekKey"] = weekKey
        }
        do {
            try await notificationsCollection.document(documentId).setData(payload, merge: true)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(
                error,
                resource: "notificationEvents/\(documentId)"
            )
        }
        return persisted
    }

    static func notificationEvents(
        documents: [(documentID: String, data: [String: Any])],
        source: FirestoreNotificationDocumentSource
    ) throws -> [NotificationEvent] {
        try documents
            .map {
                try notificationEvent(
                    documentID: $0.documentID,
                    data: $0.data,
                    source: source
                )
            }
            .sorted { $0.sentAtMillis > $1.sentAtMillis }
    }

    static func notificationEvent(
        documentID: String,
        data: [String: Any],
        source: FirestoreNotificationDocumentSource
    ) throws -> NotificationEvent {
        let dto = try FirestoreNotificationDocumentDecoder.decode(
            documentID: documentID,
            data: data,
            source: source
        )
        return FirestoreNotificationDocumentMapper.toDomain(dto)
    }
}

private extension MemberRole {
    var wireValue: String {
        switch self {
        case .member: "member"
        case .producer: "producer"
        case .admin: "admin"
        }
    }
}

private struct FirestoreNotificationDocumentDTO {
    let documentID: String
    let title: String
    let body: String
    let type: String
    let target: String
    let userIDs: [String]
    let segmentType: String?
    let targetRole: MemberRole?
    let createdBy: String
    let sentAtMillis: Int64
    let weekKey: String?
}

private struct FirestoreNotificationAudienceDTO {
    let userIDs: [String]
    let segmentType: String?
    let role: MemberRole?
}

private enum FirestoreNotificationDocumentDecoder {
    private static let canonicalTypes: Set<String> = [
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

    static func decode(
        documentID: String,
        data: [String: Any],
        source: FirestoreNotificationDocumentSource
    ) throws -> FirestoreNotificationDocumentDTO {
        let normalizedDocumentID = documentID.trimmingCharacters(in: .whitespacesAndNewlines)
        let resource = "\(source.collectionName)/\(documentID)"
        guard !documentID.isEmpty, documentID == normalizedDocumentID else {
            throw RepositoryError.invalidData(resource: resource)
        }
        if source == .inbox {
            let eventID = try exactRequiredString(
                data,
                field: "notificationEventId",
                resource: resource
            )
            guard eventID == documentID else {
                throw RepositoryError.invalidData(resource: resource)
            }
        }

        let type = try exactRequiredString(data, field: "type", resource: resource)
        guard canonicalTypes.contains(type) else {
            throw RepositoryError.invalidData(resource: resource)
        }
        let target = try exactRequiredString(data, field: "target", resource: resource)
        let audience = try decodeAudience(data, target: target, resource: resource)

        return try FirestoreNotificationDocumentDTO(
            documentID: documentID,
            title: requiredString(data, field: "title", resource: resource),
            body: requiredString(data, field: "body", resource: resource),
            type: type,
            target: target,
            userIDs: audience.userIDs,
            segmentType: audience.segmentType,
            targetRole: audience.role,
            createdBy: requiredString(data, field: "createdBy", resource: resource),
            sentAtMillis: requiredTimestampMillis(data, field: "sentAt", resource: resource),
            weekKey: optionalString(data, field: "weekKey", resource: resource)
        )
    }

    private static func decodeAudience(
        _ data: [String: Any],
        target: String,
        resource: String
    ) throws -> FirestoreNotificationAudienceDTO {
        guard let payload = data["targetPayload"] as? [String: Any] else {
            throw RepositoryError.invalidData(resource: resource)
        }
        switch target {
        case "all":
            guard payload.isEmpty else {
                throw RepositoryError.invalidData(resource: resource)
            }
            return FirestoreNotificationAudienceDTO(
                userIDs: [],
                segmentType: nil,
                role: nil
            )
        case "users":
            guard Set(payload.keys) == ["userIds"],
                  let rawUserIDs = payload["userIds"] as? [String],
                  !rawUserIDs.isEmpty else {
                throw RepositoryError.invalidData(resource: resource)
            }
            let userIDs = rawUserIDs.map {
                $0.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            guard userIDs.allSatisfy({ !$0.isEmpty }) else {
                throw RepositoryError.invalidData(resource: resource)
            }
            return FirestoreNotificationAudienceDTO(
                userIDs: userIDs,
                segmentType: nil,
                role: nil
            )
        case "segment":
            guard Set(payload.keys) == ["segmentType", "role"],
                  let segmentType = payload["segmentType"] as? String,
                  segmentType == "role",
                  let roleValue = payload["role"] as? String,
                  let role = MemberRole(rawValue: roleValue) else {
                throw RepositoryError.invalidData(resource: resource)
            }
            return FirestoreNotificationAudienceDTO(
                userIDs: [],
                segmentType: segmentType,
                role: role
            )
        default:
            throw RepositoryError.invalidData(resource: resource)
        }
    }

    private static func exactRequiredString(_ data: [String: Any], field: String, resource: String) throws -> String {
        guard let string = data[field] as? String, !string.isEmpty else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return string
    }

    private static func requiredString(_ data: [String: Any], field: String, resource: String) throws -> String {
        guard let value = try optionalString(data, field: field, resource: resource) else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return value
    }

    private static func optionalString(_ data: [String: Any], field: String, resource: String) throws -> String? {
        guard let value = data[field] else { return nil }
        if value is NSNull { return nil }
        guard let string = value as? String else {
            throw RepositoryError.invalidData(resource: resource)
        }
        let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return normalized
    }

    private static func requiredTimestampMillis(
        _ data: [String: Any],
        field: String,
        resource: String
    ) throws -> Int64 {
        guard let timestamp = data[field] as? Timestamp else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
    }
}

private enum FirestoreNotificationDocumentMapper {
    static func toDomain(_ dto: FirestoreNotificationDocumentDTO) -> NotificationEvent {
        NotificationEvent(
            id: dto.documentID,
            title: dto.title,
            body: dto.body,
            type: dto.type,
            target: dto.target,
            userIds: dto.userIDs,
            segmentType: dto.segmentType,
            targetRole: dto.targetRole,
            createdBy: dto.createdBy,
            sentAtMillis: dto.sentAtMillis,
            weekKey: dto.weekKey
        )
    }
}
