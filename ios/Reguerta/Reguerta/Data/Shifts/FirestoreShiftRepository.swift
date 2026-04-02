import FirebaseFirestore
import Foundation

final class FirestoreShiftRepository: @unchecked Sendable, ShiftRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment = .develop
    ) {
        self.db = db
        self.environment = environment
    }

    private var shiftsCollection: CollectionReference {
        db.reguertaCollection(.shifts, environment: environment)
    }

    func allShifts() async -> [ShiftAssignment] {
        do {
            let snapshot = try await shiftsCollection.getDocuments()
            return snapshot.documents
                .compactMap(Self.toShiftAssignment)
                .sorted { $0.dateMillis < $1.dateMillis }
        } catch {
            return []
        }
    }

    private static func toShiftAssignment(_ document: QueryDocumentSnapshot) -> ShiftAssignment? {
        let data = document.data()
        guard let typeRaw = (data["type"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased(),
              let type = ShiftType(rawValue: typeRaw),
              let statusRaw = (data["status"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased(),
              let status = ShiftStatus(rawValue: statusRaw),
              let date = data["date"] as? Timestamp,
              let assignedUserIds = data["assignedUserIds"] as? [String] else {
            return nil
        }

        let helperUserId = (data["helperUserId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfEmpty
        let createdAtMillis = Int64(((data["createdAt"] as? Timestamp)?.dateValue().timeIntervalSince1970 ?? date.dateValue().timeIntervalSince1970) * 1_000)
        let updatedAtMillis = Int64(((data["updatedAt"] as? Timestamp)?.dateValue().timeIntervalSince1970 ?? date.dateValue().timeIntervalSince1970) * 1_000)

        return ShiftAssignment(
            id: document.documentID,
            type: type,
            dateMillis: Int64(date.dateValue().timeIntervalSince1970 * 1_000),
            assignedUserIds: assignedUserIds.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty },
            helperUserId: helperUserId,
            status: status,
            source: ((data["source"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines))
                .flatMap { $0.isEmpty ? nil : $0 } ?? "app",
            createdAtMillis: createdAtMillis,
            updatedAtMillis: updatedAtMillis
        )
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
