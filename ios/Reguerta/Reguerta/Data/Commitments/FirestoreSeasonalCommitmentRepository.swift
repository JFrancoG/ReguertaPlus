import FirebaseCore
import FirebaseFirestore
import Foundation

private let seasonalCommitmentCanonicalUserField = "userId"
private let seasonalCommitmentUserReadFields = [
    seasonalCommitmentCanonicalUserField,
    "memberId",
    "uid",
    "user",
    "member",
    "userRef",
    "memberRef",
    "userID",
    "memberID"
]
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

actor FirestoreSeasonalCommitmentRepository: SeasonalCommitmentRepository {
    private let storedDB: Firestore

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for seasonal commitments")
        }
        self.storedDB = Firestore.firestore(app: app)
    }

    func activeCommitments(userId: String, environment: SessionEnvironment) async throws -> [SeasonalCommitment] {
        return try await activeCommitments(userId: userId, source: .defaultSource, environment: environment)
    }

    func activeCommitmentsFromServer(
        userId: String,
        environment: SessionEnvironment
    ) async throws -> [SeasonalCommitment] {
        return try await activeCommitments(userId: userId, source: .server, environment: environment)
    }

    private func activeCommitments(
        userId: String,
        source: SeasonalCommitmentReadSource,
        environment: SessionEnvironment
    ) async throws -> [SeasonalCommitment] {
        let normalizedLookup = userId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedLookup.isEmpty else { return [] }

        do {
            return try await canonicalDocuments(
                lookupValue: normalizedLookup,
                source: source,
                environment: environment
            )
                .map { document in
                    try Self.commitment(documentID: document.documentID, data: document.data())
                }
                .filter { $0.userId.matchesLookupUserId(normalizedLookup) }
                .filter(\.active)
                .sorted(by: Self.sortCommitments)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "seasonalCommitments")
        }
    }

    private func canonicalDocuments(
        lookupValue: String,
        source: SeasonalCommitmentReadSource,
        environment: SessionEnvironment
    ) async throws -> [QueryDocumentSnapshot] {
        let commitmentsCollection = storedDB.reguertaCollection(.seasonalCommitments, environment: environment)
        let query = commitmentsCollection.whereField(
            seasonalCommitmentCanonicalUserField,
            isEqualTo: lookupValue
        )
        try Task.checkCancellation()
        let snapshot = switch source {
        case .defaultSource:
            try await query.getDocuments()
        case .server:
            try await query.getDocuments(source: .server)
        }
        return snapshot.documents
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
        if let number = value as? NSNumber,
           CFGetTypeID(number) != CFBooleanGetTypeID() {
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

    private static func optionalBool(_ data: [String: Any], field: String, default defaultValue: Bool) throws -> Bool {
        guard let value = data[field] else { return defaultValue }
        if value is NSNull { return defaultValue }
        guard let number = value as? NSNumber,
              CFGetTypeID(number) == CFBooleanGetTypeID() else {
            throw invalidDocumentError
        }
        return number.boolValue
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

private nonisolated enum SeasonalCommitmentReadSource: Sendable {
    case defaultSource
    case server
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
