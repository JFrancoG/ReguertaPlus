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
        var documentsById: [String: QueryDocumentSnapshot] = [:]
        for field in ["userId", "memberId"] {
            do {
                let snapshot = try await commitmentsCollection
                    .whereField(field, isEqualTo: userId)
                    .getDocuments()
                for document in snapshot.documents {
                    documentsById[document.documentID] = document
                }
            } catch {
                continue
            }
        }

        return documentsById.values
            .compactMap(Self.toSeasonalCommitment)
            .filter(\.active)
            .sorted(by: Self.sortCommitments)
    }

    private static func sortCommitments(_ lhs: SeasonalCommitment, _ rhs: SeasonalCommitment) -> Bool {
        if lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) != .orderedSame {
            return lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) == .orderedAscending
        }
        return lhs.productId.localizedCaseInsensitiveCompare(rhs.productId) == .orderedAscending
    }

    private static func toSeasonalCommitment(_ document: QueryDocumentSnapshot) -> SeasonalCommitment? {
        let data = document.data()
        guard let userId = normalizedString(data["userId"]) ?? normalizedString(data["memberId"]),
              let productId = normalizedString(data["productId"]),
              let seasonKey = normalizedString(data["seasonKey"]),
              let fixedQtyPerOfferedWeek = positiveDouble(data["fixedQtyPerOfferedWeek"]) else {
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

    private static func positiveDouble(_ value: Any?) -> Double? {
        if let number = value as? NSNumber {
            let double = number.doubleValue
            return double > 0 ? double : nil
        }
        if let string = value as? String {
            let normalized = string
                .replacingOccurrences(of: ",", with: ".")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if let double = Double(normalized), double > 0 {
                return double
            }
        }
        return nil
    }
}
