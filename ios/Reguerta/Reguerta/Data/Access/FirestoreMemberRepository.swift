import Foundation
import FirebaseFirestore

final class FirestoreMemberRepository: @unchecked Sendable, MemberRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment = .develop
    ) {
        self.db = db
        self.environment = environment
    }

    private var usersCollection: CollectionReference {
        db.reguertaCollection(.users, environment: environment)
    }

    func findByEmailNormalized(_ emailNormalized: String) async -> Member? {
        do {
            var snapshot = try await usersCollection
                .whereField("normalizedEmail", isEqualTo: emailNormalized)
                .limit(to: 1)
                .getDocuments()
            if snapshot.documents.isEmpty {
                snapshot = try await usersCollection
                    .whereField("emailNormalized", isEqualTo: emailNormalized)
                    .limit(to: 1)
                    .getDocuments()
            }
            return snapshot.documents.first.flatMap(Self.toMember)
        } catch {
            return nil
        }
    }

    func findByAuthUid(_ authUid: String) async -> Member? {
        do {
            let snapshot = try await usersCollection
                .whereField("authUid", isEqualTo: authUid)
                .limit(to: 1)
                .getDocuments()
            return snapshot.documents.first.flatMap(Self.toMember)
        } catch {
            return nil
        }
    }

    func linkAuthUid(memberId: String, authUid: String) async -> Member? {
        let docRef = usersCollection.document(memberId)

        do {
            try await docRef.setData(["authUid": authUid], merge: true)
            let snapshot = try await docRef.getDocument()
            return Self.toMember(snapshot)
        } catch {
            return Member(
                id: memberId,
                displayName: "",
                normalizedEmail: "",
                authUid: authUid,
                roles: [.member],
                isActive: true,
                producerCatalogEnabled: true
            )
        }
    }

    func allMembers() async -> [Member] {
        do {
            let snapshot = try await usersCollection.getDocuments()
            return snapshot.documents
                .compactMap(Self.toMember)
                .sorted { lhs, rhs in
                    lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
                }
        } catch {
            return []
        }
    }

    func upsert(member: Member) async -> Member {
        let payload: [String: Any] = [
            "displayName": member.displayName,
            "normalizedEmail": member.normalizedEmail,
            "email": FieldValue.delete(),
            "emailNormalized": FieldValue.delete(),
            "authUid": member.authUid as Any,
            "roles": member.roles.map(\.rawValue),
            "isActive": member.isActive,
            "producerCatalogEnabled": member.producerCatalogEnabled,
        ]

        do {
            try await usersCollection.document(member.id).setData(payload, merge: true)
            return member
        } catch {
            return member
        }
    }

    private static func toMember(_ document: QueryDocumentSnapshot) -> Member? {
        let data = document.data()
        return mapMember(id: document.documentID, data: data)
    }

    private static func toMember(_ document: DocumentSnapshot) -> Member? {
        guard let data = document.data() else {
            return nil
        }
        return mapMember(id: document.documentID, data: data)
    }

    private static func mapMember(id: String, data: [String: Any]) -> Member? {
        guard let displayName = data["displayName"] as? String else {
            return nil
        }

        let normalizedEmail = (data["normalizedEmail"] as? String)
            ?? (data["emailNormalized"] as? String)
            ?? (data["email"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let normalizedEmail else {
            return nil
        }
        let authUid = data["authUid"] as? String
        let isActive = (data["isActive"] as? Bool) ?? true
        let producerCatalogEnabled = (data["producerCatalogEnabled"] as? Bool) ?? true
        let rawRoles = (data["roles"] as? [String]) ?? ["member"]
        let parsedRoles = Set(rawRoles.compactMap(MemberRole.init(rawValue:)))
        let roles = parsedRoles.isEmpty ? Set([MemberRole.member]) : parsedRoles

        return Member(
            id: id,
            displayName: displayName,
            normalizedEmail: normalizedEmail,
            authUid: authUid,
            roles: roles,
            isActive: isActive,
            producerCatalogEnabled: producerCatalogEnabled
        )
    }
}
