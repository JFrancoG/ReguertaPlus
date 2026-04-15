import FirebaseFirestore
import Foundation

private let seasonalCommitmentQueryUserFields = [
    "userId",
    "memberId"
]
private let seasonalCommitmentLegacyUserFields = [
    "uid",
    "user",
    "member",
    "userRef",
    "memberRef",
    "userID",
    "memberID"
]
private let seasonalCommitmentUserReadFields = seasonalCommitmentQueryUserFields + seasonalCommitmentLegacyUserFields
private let seasonalCommitmentProductFields = [
    "productId",
    "product",
    "productRef",
    "commonProductId",
    "itemId"
]
private let seasonalCommitmentSeasonFields = [
    "seasonKey",
    "season",
    "campaignKey",
    "commitmentSeason"
]
private let seasonalCommitmentQtyFields = [
    "fixedQty",
    "fixedQtyPerOfferedWeek",
    "fixedQtyPerWeek",
    "weeklyQty",
    "qty",
    "quantity"
]

final class FirestoreSeasonalCommitmentRepository: @unchecked Sendable, SeasonalCommitmentRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil
    ) {
        self.db = db
        self.environment = environment
    }

    private var commitmentsCollection: CollectionReference {
        db.reguertaCollection(.seasonalCommitments, environment: environment)
    }

    private var usersCollection: CollectionReference {
        db.reguertaCollection(.users, environment: environment)
    }

    func activeCommitments(userId: String) async -> [SeasonalCommitment] {
        let normalizedLookup = userId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedLookup.isEmpty else {
            return []
        }

        var documentsById: [String: QueryDocumentSnapshot] = [:]

        await queryByFields(
            seasonalCommitmentQueryUserFields,
            lookupValue: normalizedLookup,
            includeReferenceTarget: !normalizedLookup.contains("@"),
            output: &documentsById
        )

        if documentsById.isEmpty {
            await queryByFields(
                seasonalCommitmentLegacyUserFields,
                lookupValue: normalizedLookup,
                includeReferenceTarget: !normalizedLookup.contains("@"),
                output: &documentsById
            )
        }

        return documentsById.values
            .compactMap(Self.toSeasonalCommitment)
            .filter { $0.userId.matchesLookupUserId(normalizedLookup) }
            .filter(\.active)
            .sorted(by: Self.sortCommitments)
    }

    private func queryByFields(
        _ fields: [String],
        lookupValue: String,
        includeReferenceTarget: Bool,
        output: inout [String: QueryDocumentSnapshot]
    ) async {
        let userReference = usersCollection.document(lookupValue)
        var targets: [Any] = [lookupValue]
        if includeReferenceTarget {
            targets.append(userReference)
        }

        for field in fields {
            for target in targets {
                do {
                    let snapshot = try await commitmentsCollection
                        .whereField(field, isEqualTo: target)
                        .getDocuments()
                    for document in snapshot.documents {
                        output[document.documentID] = document
                    }
                } catch {
                    continue
                }
            }
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
        guard let userId = firstNormalizedID(in: data, fields: seasonalCommitmentUserReadFields),
              let productId = firstNormalizedID(in: data, fields: seasonalCommitmentProductFields),
              let seasonKey = firstNormalizedID(in: data, fields: seasonalCommitmentSeasonFields),
              let fixedQtyPerOfferedWeek = firstPositiveDouble(in: data, fields: seasonalCommitmentQtyFields) else {
            return nil
        }

        let createdAtMillis = ((data["createdAt"] as? Timestamp)?.dateValue().timeIntervalSince1970 ?? 0) * 1_000
        let updatedAtMillis = ((data["updatedAt"] as? Timestamp)?.dateValue().timeIntervalSince1970 ?? 0) * 1_000

        return SeasonalCommitment(
            id: document.documentID,
            userId: userId,
            productId: productId,
            productNameHint: normalizedText(data["productName"]) ??
                normalizedText(data["productDisplayName"]) ??
                normalizedText(data["name"]),
            seasonKey: seasonKey,
            fixedQtyPerOfferedWeek: fixedQtyPerOfferedWeek,
            active: (data["active"] as? Bool) ?? true,
            createdAtMillis: Int64(createdAtMillis),
            updatedAtMillis: Int64(updatedAtMillis)
        )
    }

    private static func firstNormalizedID(in data: [String: Any], fields: [String]) -> String? {
        fields.compactMap { field in normalizedID(data[field]) }.first
    }

    private static func firstPositiveDouble(in data: [String: Any], fields: [String]) -> Double? {
        fields.compactMap { field in positiveDouble(data[field]) }.first
    }

    private static func normalizedString(_ value: Any?) -> String? {
        guard let string = value as? String else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func normalizedText(_ value: Any?) -> String? {
        if let string = normalizedString(value) {
            return string
        }
        if let dictionary = value as? [String: Any] {
            return normalizedText(dictionary["name"]) ??
                normalizedText(dictionary["displayName"]) ??
                normalizedText(dictionary["title"])
        }
        return nil
    }

    private static func normalizedID(_ value: Any?) -> String? {
        if let string = normalizedString(value) {
            return normalizePathLikeIdentifier(string)
        }
        if let reference = value as? DocumentReference {
            return normalizedString(reference.documentID)
        }
        if let dictionary = value as? [String: Any] {
            return normalizedID(dictionary["id"]) ??
                normalizedID(dictionary["documentId"]) ??
                normalizedID(dictionary["documentID"]) ??
                normalizedID(dictionary["path"])
        }
        return nil
    }

    fileprivate static func normalizePathLikeIdentifier(_ value: String) -> String {
        guard value.contains("/") else { return value }
        let trailing = value.split(separator: "/").last.map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return (trailing?.isEmpty == false) ? trailing! : value
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

private extension String {
    func matchesLookupUserId(_ lookup: String) -> Bool {
        let current = FirestoreSeasonalCommitmentRepository.normalizePathLikeIdentifier(
            trimmingCharacters(in: .whitespacesAndNewlines)
        )
        let target = FirestoreSeasonalCommitmentRepository.normalizePathLikeIdentifier(
            lookup.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        return current == target || current.caseInsensitiveCompare(target) == .orderedSame
    }
}
