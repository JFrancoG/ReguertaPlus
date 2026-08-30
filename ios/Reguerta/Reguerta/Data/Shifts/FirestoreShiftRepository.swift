import FirebaseCore
import FirebaseFirestore
import Foundation

actor FirestoreShiftRepository: ShiftRepository {
    private let storedDB: Firestore

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for shifts")
        }
        self.storedDB = Firestore.firestore(app: app)
    }

    func allShifts(environment: SessionEnvironment) async throws -> [ShiftAssignment] {
        try Task.checkCancellation()
        let shiftsCollection = storedDB.collection(Self.collectionPath(environment: environment))
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

    static func collectionPath(environment: SessionEnvironment) -> String {
        ReguertaFirestorePath(environment: environment).collectionPath(.shifts)
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
