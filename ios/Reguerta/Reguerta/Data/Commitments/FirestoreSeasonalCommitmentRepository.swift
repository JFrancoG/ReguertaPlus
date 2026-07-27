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

    func activeCommitments(userId: String) async throws -> [SeasonalCommitment] {
        let normalizedLookup = userId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedLookup.isEmpty else {
            return []
        }

        var documentsById: [String: QueryDocumentSnapshot] = [:]

        do {
            try await queryByFields(
                seasonalCommitmentQueryUserFields,
                lookupValue: normalizedLookup,
                includeReferenceTarget: !normalizedLookup.contains("@"),
                output: &documentsById
            )

            if documentsById.isEmpty {
                try await queryByFields(
                    seasonalCommitmentLegacyUserFields,
                    lookupValue: normalizedLookup,
                    includeReferenceTarget: !normalizedLookup.contains("@"),
                    output: &documentsById
                )
            }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "seasonalCommitments")
        }

        return try documentsById.values
            .map { document in
                try Self.commitment(documentID: document.documentID, data: document.data())
            }
            .filter { $0.userId.matchesLookupUserId(normalizedLookup) }
            .filter(\.active)
            .sorted(by: Self.sortCommitments)
    }

    private func queryByFields(
        _ fields: [String],
        lookupValue: String,
        includeReferenceTarget: Bool,
        output: inout [String: QueryDocumentSnapshot]
    ) async throws {
        let userReference = usersCollection.document(lookupValue)
        var targets: [Any] = [lookupValue]
        if includeReferenceTarget {
            targets.append(userReference)
        }

        for field in fields {
            for target in targets {
                let snapshot = try await commitmentsCollection
                    .whereField(field, isEqualTo: target)
                    .getDocuments()
                for document in snapshot.documents {
                    output[document.documentID] = document
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

    static func commitment(documentID: String, data: [String: Any]) throws -> SeasonalCommitment {
        guard let userId = try firstNormalizedID(in: data, fields: seasonalCommitmentUserReadFields),
              let productId = try firstNormalizedID(in: data, fields: seasonalCommitmentProductFields),
              let seasonKey = try firstNormalizedID(in: data, fields: seasonalCommitmentSeasonFields),
              let fixedQtyPerOfferedWeek = try firstPositiveDouble(in: data, fields: seasonalCommitmentQtyFields) else {
            throw invalidDocumentError
        }
        return SeasonalCommitment(
            id: documentID,
            userId: userId,
            productId: productId,
            productNameHint: try optionalNormalizedText(data, field: "productName") ??
                optionalNormalizedText(data, field: "productDisplayName") ??
                optionalNormalizedText(data, field: "name"),
            seasonKey: seasonKey,
            fixedQtyPerOfferedWeek: fixedQtyPerOfferedWeek,
            active: try optionalBool(data, field: "active", default: true),
            createdAtMillis: try optionalTimestampMillis(data, field: "createdAt"),
            updatedAtMillis: try optionalTimestampMillis(data, field: "updatedAt")
        )
    }

    private static func firstNormalizedID(in data: [String: Any], fields: [String]) throws -> String? {
        for field in fields {
            guard let value = data[field] else { continue }
            if value is NSNull { continue }
            guard let identifier = normalizedID(value) else { throw invalidDocumentError }
            return identifier
        }
        return nil
    }

    private static func firstPositiveDouble(in data: [String: Any], fields: [String]) throws -> Double? {
        for field in fields {
            guard let value = data[field] else { continue }
            if value is NSNull { continue }
            guard let number = positiveDouble(value) else { throw invalidDocumentError }
            return number
        }
        return nil
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

    private static func optionalNormalizedText(_ data: [String: Any], field: String) throws -> String? {
        guard let value = data[field] else { return nil }
        if value is NSNull { return nil }
        guard let text = normalizedText(value) else { throw invalidDocumentError }
        return text
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
        if value is Bool { return nil }
        if let number = value as? NSNumber {
            let double = number.doubleValue
            return double.isFinite && double > 0 ? double : nil
        }
        if let string = value as? String {
            let normalized = string
                .replacingOccurrences(of: ",", with: ".")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if let double = Double(normalized), double.isFinite, double > 0 {
                return double
            }
        }
        return nil
    }

    private static func optionalBool(
        _ data: [String: Any],
        field: String,
        default defaultValue: Bool
    ) throws -> Bool {
        guard let value = data[field] else { return defaultValue }
        if value is NSNull { return defaultValue }
        guard let bool = value as? Bool else { throw invalidDocumentError }
        return bool
    }

    private static func optionalTimestampMillis(_ data: [String: Any], field: String) throws -> Int64 {
        guard let value = data[field] else { return 0 }
        if value is NSNull { return 0 }
        guard let timestamp = value as? Timestamp else { throw invalidDocumentError }
        return Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
    }

    private static var invalidDocumentError: RepositoryError {
        .invalidData(resource: "seasonalCommitments.document")
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
