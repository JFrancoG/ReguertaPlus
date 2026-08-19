import FirebaseCore
import FirebaseFirestore
import Foundation

actor FirestoreSharedProfileRepository: SharedProfileRepository {
    private let storedDB: Firestore

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for shared profiles")
        }
        self.storedDB = Firestore.firestore(app: app)
    }

    func allSharedProfiles(environment: SessionEnvironment) async throws -> [SharedProfile] {
        do {
            let profilesCollection = storedDB.reguertaCollection(.sharedProfiles, environment: environment)
            try Task.checkCancellation()
            let snapshot = try await profilesCollection.getDocuments()
            return try snapshot.documents
                .map { document in
                    try Self.sharedProfile(
                        documentID: document.documentID,
                        data: document.data()
                    )
                }
                .sorted { $0.updatedAtMillis > $1.updatedAtMillis }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "sharedProfiles")
        }
    }

    func sharedProfile(userId: String, environment: SessionEnvironment) async throws -> SharedProfile? {
        do {
            let profilesCollection = storedDB.reguertaCollection(.sharedProfiles, environment: environment)
            try Task.checkCancellation()
            let document = try await profilesCollection.document(userId).getDocument()
            guard document.exists else { return nil }
            guard let data = document.data() else { throw Self.invalidDocumentError }
            return try Self.sharedProfile(documentID: document.documentID, data: data)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "sharedProfiles.document")
        }
    }

    func upsert(profile: SharedProfile, environment: SessionEnvironment) async throws -> SharedProfile {
        do {
            let profilesCollection = storedDB.reguertaCollection(.sharedProfiles, environment: environment)
            try Task.checkCancellation()
            try await profilesCollection.document(profile.userId).setData(
                Self.upsertPayload(for: profile),
                merge: true
            )
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "sharedProfiles.write")
        }
        return profile
    }

    func deleteSharedProfile(userId: String, environment: SessionEnvironment) async throws -> Bool {
        do {
            let profilesCollection = storedDB.reguertaCollection(.sharedProfiles, environment: environment)
            try Task.checkCancellation()
            try await profilesCollection.document(userId).delete()
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "sharedProfiles.write")
        }
        return true
    }

    static func upsertPayload(for profile: SharedProfile) -> [String: Any] {
        [
            "userId": profile.userId,
            "familyNames": profile.familyNames,
            "photoUrl": firestoreValue(profile.photoUrl),
            "about": profile.about,
            "updatedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(profile.updatedAtMillis) / 1_000))
        ]
    }

    static func sharedProfile(documentID: String, data: [String: Any]) throws -> SharedProfile {
        let normalizedDocumentID = documentID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedDocumentID.isEmpty,
              try requiredString(data, field: "userId") == normalizedDocumentID,
              let updatedAt = data["updatedAt"] as? Timestamp else {
            throw invalidDocumentError
        }

        return SharedProfile(
            userId: normalizedDocumentID,
            familyNames: try optionalString(data, field: "familyNames") ?? "",
            photoUrl: try optionalString(data, field: "photoUrl"),
            about: try optionalString(data, field: "about") ?? "",
            updatedAtMillis: Int64(updatedAt.dateValue().timeIntervalSince1970 * 1_000)
        )
    }

    private static func requiredString(_ data: [String: Any], field: String) throws -> String {
        guard let value = try optionalString(data, field: field) else { throw invalidDocumentError }
        return value
    }

    private static func optionalString(_ data: [String: Any], field: String) throws -> String? {
        guard let rawValue = data[field], !(rawValue is NSNull) else { return nil }
        guard let value = rawValue as? String else { throw invalidDocumentError }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }

    private static func firestoreValue<Value>(_ value: Value?) -> Any {
        if let value {
            return value
        }
        return FieldValue.delete()
    }

    private static var invalidDocumentError: RepositoryError {
        .invalidData(resource: "sharedProfiles.document")
    }
}
