import FirebaseFirestore
import Foundation

final class FirestoreShiftRepository: @unchecked Sendable, ShiftRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(db: Firestore = Firestore.firestore(), environment: ReguertaFirestoreEnvironment? = nil) {
        self.db = db
        self.environment = environment
    }

    private var shiftsCollection: CollectionReference {
        db.reguertaCollection(.shifts, environment: environment)
    }

    func allShifts() async throws -> [ShiftAssignment] {
        do {
            let snapshot = try await shiftsCollection.getDocuments(source: .server)
            return try snapshot.documents
                .map { document in
                    try Self.shift(documentID: document.documentID, data: document.data())
                }
                .sorted { $0.dateMillis < $1.dateMillis }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "shifts")
        }
    }

    func upsert(shift: ShiftAssignment) async throws -> ShiftAssignment {
        let payload: [String: Any] = [
            "type": shift.type.rawValue,
            "date": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(shift.dateMillis) / 1_000)),
            "assignedUserIds": shift.assignedUserIds,
            "helperUserId": shift.helperUserId as Any,
            "status": shift.status.rawValue,
            "source": shift.source,
            "createdAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(shift.createdAtMillis) / 1_000)),
            "updatedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(shift.updatedAtMillis) / 1_000))
        ]

        do {
            try await shiftsCollection.document(shift.id).setData(payload, merge: true)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "shifts.write")
        }
        return shift
    }

    static func shift(documentID: String, data: [String: Any]) throws -> ShiftAssignment {
        guard !documentID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let typeRaw = requiredTrimmedString(data["type"])?.lowercased(),
              let type = ShiftType(rawValue: typeRaw),
              let statusRaw = requiredTrimmedString(data["status"])?.lowercased(),
              let status = ShiftStatus(rawValue: statusRaw),
              let date = data["date"] as? Timestamp,
              let assignedUserIds = data["assignedUserIds"] as? [String],
              assignedUserIds.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
              let source = requiredTrimmedString(data["source"]),
              ["app", "google_sheets"].contains(source),
              let createdAt = data["createdAt"] as? Timestamp,
              let updatedAt = data["updatedAt"] as? Timestamp else {
            throw invalidDocumentError
        }

        let helperUserId: String?
        if let rawHelper = data["helperUserId"], !(rawHelper is NSNull) {
            guard let parsedHelper = requiredTrimmedString(rawHelper) else { throw invalidDocumentError }
            helperUserId = parsedHelper
        } else {
            helperUserId = nil
        }

        return ShiftAssignment(
            id: documentID,
            type: type,
            dateMillis: Int64(date.dateValue().timeIntervalSince1970 * 1_000),
            assignedUserIds: assignedUserIds.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) },
            helperUserId: helperUserId,
            status: status,
            source: source,
            createdAtMillis: Int64(createdAt.dateValue().timeIntervalSince1970 * 1_000),
            updatedAtMillis: Int64(updatedAt.dateValue().timeIntervalSince1970 * 1_000)
        )
    }

    private static func requiredTrimmedString(_ value: Any?) -> String? {
        guard let string = value as? String else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static var invalidDocumentError: RepositoryError {
        .invalidData(resource: "shifts.document")
    }
}
