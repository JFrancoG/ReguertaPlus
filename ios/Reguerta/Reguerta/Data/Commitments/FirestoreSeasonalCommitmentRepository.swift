import FirebaseFirestore
import Foundation

final class FirestoreSeasonalCommitmentRepository: @unchecked Sendable, SeasonalCommitmentRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment = .develop
    ) {
        self.db = db
        self.environment = environment
    }

    private var commitmentsCollection: CollectionReference {
        db.reguertaCollection(.seasonalCommitments, environment: environment)
    }

    func activeCommitments(userId: String) async -> [SeasonalCommitment] {
        do {
            let snapshot = try await commitmentsCollection
                .whereField("userId", isEqualTo: userId)
                .whereField("active", isEqualTo: true)
                .getDocuments()
            return snapshot.documents
                .compactMap(Self.toSeasonalCommitment)
                .sorted(by: Self.sortCommitments)
        } catch {
            return []
        }
    }

    private static func sortCommitments(_ lhs: SeasonalCommitment, _ rhs: SeasonalCommitment) -> Bool {
        if lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) != .orderedSame {
            return lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) == .orderedAscending
        }
        return lhs.productId.localizedCaseInsensitiveCompare(rhs.productId) == .orderedAscending
    }

    private static func toSeasonalCommitment(_ document: QueryDocumentSnapshot) -> SeasonalCommitment? {
        let data = document.data()
        guard let userId = normalizedString(data["userId"]),
              let productId = normalizedString(data["productId"]),
              let seasonKey = normalizedString(data["seasonKey"]),
              let fixedQtyPerOfferedWeek = data["fixedQtyPerOfferedWeek"] as? Double else {
            return nil
        }

        let createdAtMillis = ((data["createdAt"] as? Timestamp)?.dateValue().timeIntervalSince1970 ?? 0) * 1_000
        let updatedAtMillis = ((data["updatedAt"] as? Timestamp)?.dateValue().timeIntervalSince1970 ?? 0) * 1_000

        return SeasonalCommitment(
            id: document.documentID,
            userId: userId,
            productId: productId,
            seasonKey: seasonKey,
            fixedQtyPerOfferedWeek: fixedQtyPerOfferedWeek,
            active: (data["active"] as? Bool) ?? true,
            createdAtMillis: Int64(createdAtMillis),
            updatedAtMillis: Int64(updatedAtMillis)
        )
    }

    private static func normalizedString(_ value: Any?) -> String? {
        guard let string = value as? String else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
