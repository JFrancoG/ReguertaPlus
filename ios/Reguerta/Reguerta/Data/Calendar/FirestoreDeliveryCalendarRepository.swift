import FirebaseFirestore
import Foundation

final class FirestoreDeliveryCalendarRepository: @unchecked Sendable, DeliveryCalendarRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(db: Firestore = Firestore.firestore(), environment: ReguertaFirestoreEnvironment? = nil) {
        self.db = db
        self.environment = environment
    }

    func defaultDeliveryDayOfWeek() async throws -> DeliveryWeekday {
        let path = ReguertaFirestorePath(environment: environment)
        let candidatePaths = [
            path.documentPath(in: .config, documentId: ReguertaFirestoreDocument.memberConfiguration.rawValue),
            path.documentPath(in: .config, documentId: ReguertaFirestoreDocument.global.rawValue)
        ]

        for documentPath in candidatePaths {
            do {
                let snapshot = try await db.document(documentPath).getDocument(source: .server)
                guard snapshot.exists else { continue }
                guard let data = snapshot.data() else { throw Self.invalidConfigurationError }
                return try Self.deliveryWeekday(data: data)
            } catch {
                throw FirestoreRepositoryErrorMapper.map(error, resource: "config.deliveryCalendar")
            }
        }
        throw RepositoryError.notFound(resource: "config.deliveryCalendar")
    }

    func allOverrides() async throws -> [DeliveryCalendarOverride] {
        let path = ReguertaFirestorePath(environment: environment)
        do {
            let snapshot = try await db.collection(path.collectionPath(.deliveryCalendar)).getDocuments(source: .server)
            return try snapshot.documents
                .map { document in
                    try Self.deliveryOverride(documentID: document.documentID, data: document.data())
                }
                .sorted { $0.weekKey < $1.weekKey }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "deliveryCalendar")
        }
    }

    func upsertOverride(_ override: DeliveryCalendarOverride) async throws -> DeliveryCalendarOverride {
        let payload: [String: Any] = [
            "weekKey": override.weekKey,
            "deliveryDate": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.deliveryDateMillis) / 1000)),
            "ordersBlockedDate": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.ordersBlockedDateMillis) / 1000)),
            "ordersOpenAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.ordersOpenAtMillis) / 1000)),
            "ordersCloseAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.ordersCloseAtMillis) / 1000)),
            "updatedBy": override.updatedBy,
            "updatedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.updatedAtMillis) / 1000))
        ]
        do {
            try await db
                .document(ReguertaFirestorePath(environment: environment).documentPath(in: .deliveryCalendar, documentId: override.weekKey))
                .setData(payload)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "deliveryCalendar.write")
        }
        return override
    }

    func deleteOverride(weekKey: String) async throws {
        do {
            try await db
                .document(ReguertaFirestorePath(environment: environment).documentPath(in: .deliveryCalendar, documentId: weekKey))
                .delete()
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "deliveryCalendar.write")
        }
    }

    static func deliveryOverride(documentID: String, data: [String: Any]) throws -> DeliveryCalendarOverride {
        guard let weekKey = requiredString(data["weekKey"]),
              weekKey == documentID,
              let deliveryDate = data["deliveryDate"] as? Timestamp,
              let ordersBlockedDate = data["ordersBlockedDate"] as? Timestamp,
              let ordersOpenAt = data["ordersOpenAt"] as? Timestamp,
              let ordersCloseAt = data["ordersCloseAt"] as? Timestamp,
              let updatedBy = requiredString(data["updatedBy"]),
              let updatedAt = data["updatedAt"] as? Timestamp else {
            throw invalidDocumentError
        }

        return DeliveryCalendarOverride(
            weekKey: weekKey,
            deliveryDateMillis: millis(deliveryDate),
            ordersBlockedDateMillis: millis(ordersBlockedDate),
            ordersOpenAtMillis: millis(ordersOpenAt),
            ordersCloseAtMillis: millis(ordersCloseAt),
            updatedBy: updatedBy,
            updatedAtMillis: millis(updatedAt)
        )
    }

    static func deliveryWeekday(data: [String: Any]) throws -> DeliveryWeekday {
        for key in ["deliveryDayOfWeek", "deliveryDateOfWeek"] where data[key] != nil {
            return try weekday(from: data[key])
        }
        if let rawOtherConfig = data["otherConfig"] {
            guard let otherConfig = rawOtherConfig as? [String: Any] else {
                throw invalidConfigurationError
            }
            for key in ["deliveryDayOfWeek", "deliveryDateOfWeek"] where otherConfig[key] != nil {
                return try weekday(from: otherConfig[key])
            }
        }
        throw invalidConfigurationError
    }

    private static func weekday(from value: Any?) throws -> DeliveryWeekday {
        guard let rawValue = requiredString(value)?.uppercased(),
              let weekday = DeliveryWeekday(rawValue: rawValue) else {
            throw invalidConfigurationError
        }
        return weekday
    }

    private static func requiredString(_ value: Any?) -> String? {
        guard let value = value as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func millis(_ timestamp: Timestamp) -> Int64 {
        Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
    }

    private static var invalidDocumentError: RepositoryError {
        .invalidData(resource: "deliveryCalendar.document")
    }

    private static var invalidConfigurationError: RepositoryError {
        .invalidData(resource: "config.deliveryCalendar")
    }
}
