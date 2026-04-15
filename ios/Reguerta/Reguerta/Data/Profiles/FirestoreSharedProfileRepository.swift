import FirebaseFirestore
import Foundation

final class FirestoreSharedProfileRepository: @unchecked Sendable, SharedProfileRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil
    ) {
        self.db = db
        self.environment = environment
    }

    private var profilesCollection: CollectionReference {
        db.reguertaCollection(.sharedProfiles, environment: environment)
    }

    func allSharedProfiles() async -> [SharedProfile] {
        do {
            let snapshot = try await profilesCollection.getDocuments()
            return snapshot.documents
                .compactMap(Self.toSharedProfile)
                .sorted { $0.updatedAtMillis > $1.updatedAtMillis }
        } catch {
            return []
        }
    }

    func sharedProfile(userId: String) async -> SharedProfile? {
        do {
            let document = try await profilesCollection.document(userId).getDocument()
            return Self.toSharedProfile(document)
        } catch {
            return nil
        }
    }

    func upsert(profile: SharedProfile) async -> SharedProfile {
        var payload: [String: Any] = [
            "userId": profile.userId,
            "familyNames": profile.familyNames,
            "about": profile.about,
            "updatedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(profile.updatedAtMillis) / 1_000)),
        ]
        if let photoUrl = profile.photoUrl {
            payload["photoUrl"] = photoUrl
        }

        do {
            try await profilesCollection.document(profile.userId).setData(payload, merge: true)
            return profile
        } catch {
            return profile
        }
    }

    func deleteSharedProfile(userId: String) async -> Bool {
        do {
            try await profilesCollection.document(userId).delete()
            return true
        } catch {
            return false
        }
    }

    private static func toSharedProfile(_ document: DocumentSnapshot) -> SharedProfile? {
        guard let data = document.data() else {
            return nil
        }
        let userId = ((data["userId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
            .flatMap { $0.isEmpty ? nil : $0 } ?? document.documentID
        let familyNames = ((data["familyNames"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)) ?? ""
        let about = ((data["about"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)) ?? ""
        let photoUrl = ((data["photoUrl"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
            .flatMap { $0.isEmpty ? nil : $0 }
        let updatedAtMillis: Int64
        if let timestamp = data["updatedAt"] as? Timestamp {
            updatedAtMillis = Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
        } else {
            updatedAtMillis = 0
        }
        return SharedProfile(
            userId: userId,
            familyNames: familyNames,
            photoUrl: photoUrl,
            about: about,
            updatedAtMillis: updatedAtMillis
        )
    }
}
