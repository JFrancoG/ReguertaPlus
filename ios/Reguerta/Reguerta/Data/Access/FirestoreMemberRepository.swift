import Foundation
import FirebaseFirestore

final class FirestoreMemberRepository: @unchecked Sendable, MemberRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil
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
                producerCatalogEnabled: true,
                isCommonPurchaseManager: false
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
            "companyName": member.companyName ?? FieldValue.delete(),
            "phoneNumber": member.phoneNumber ?? FieldValue.delete(),
            "normalizedEmail": member.normalizedEmail,
            "email": FieldValue.delete(),
            "emailNormalized": FieldValue.delete(),
            "authUid": member.authUid as Any,
            "roles": member.roles.map(\.rawValue),
            "isProducer": member.roles.contains(.producer),
            "isAdmin": member.roles.contains(.admin),
            "isActive": member.isActive,
            "available": member.isActive,
            "producerCatalogEnabled": member.producerCatalogEnabled,
            "isCommonPurchaseManager": member.isCommonPurchaseManager,
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
        let displayName = normalizedOptionalString(
            data,
            keys: ["displayName"]
        ) ?? combinedName(
            firstName: normalizedOptionalString(data, keys: ["name"]),
            lastName: normalizedOptionalString(data, keys: ["surname"])
        )
        guard let displayName else {
            return nil
        }

        let normalizedEmail = normalizedOptionalString(
            data,
            keys: ["normalizedEmail", "emailNormalized", "email"]
        )?.lowercased()
        guard let normalizedEmail else {
            return nil
        }
        let authUid = normalizedOptionalString(data, keys: ["authUid"])
        let companyName = normalizedOptionalString(data, keys: ["companyName", "company_name", "company"])
        let phoneNumber = normalizedOptionalString(data, keys: ["phoneNumber", "phone", "telephone", "telefono"])
        let isActive = (data["isActive"] as? Bool) ?? (data["available"] as? Bool) ?? true
        let producerCatalogEnabled = (data["producerCatalogEnabled"] as? Bool) ?? true
        let isCommonPurchaseManager = (data["isCommonPurchaseManager"] as? Bool) ?? false
        let producerParity = normalizedOptionalString(data, keys: ["producerParity"])
            .flatMap(ProducerParity.init(rawValue:))
        let ecoCommitment = data["ecoCommitment"] as? [String: Any]
        let ecoCommitmentMode = normalizedOptionalString(ecoCommitment, keys: ["mode"])
            .flatMap(EcoCommitmentMode.init(rawValue:)) ?? .weekly
        let ecoCommitmentParity = normalizedOptionalString(ecoCommitment, keys: ["parity"])
            .flatMap(ProducerParity.init(rawValue:))
        let rawRoles = (data["roles"] as? [String]) ?? []
        let parsedRoles = Set(rawRoles.compactMap(legacyCompatibleRole(from:)))
        let roles = parsedRoles.isEmpty
            ? legacyRoles(
                isProducer: (data["isProducer"] as? Bool) ?? false,
                isAdmin: (data["isAdmin"] as? Bool) ?? false
            )
            : parsedRoles

        return Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            phoneNumber: phoneNumber,
            normalizedEmail: normalizedEmail,
            authUid: authUid,
            roles: roles,
            isActive: isActive,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }

    private static func normalizedOptionalString(_ data: [String: Any]?, keys: [String]) -> String? {
        guard let data else { return nil }
        for key in keys {
            guard let string = data[key] as? String else {
                continue
            }
            let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                return trimmed
            }
        }
        return nil
    }

    private static func legacyCompatibleRole(from rawValue: String) -> MemberRole? {
        let normalized = rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch normalized {
        case "member", "socio":
            return .member
        case "producer", "productor":
            return .producer
        case "admin", "administrador":
            return .admin
        default:
            return nil
        }
    }

    private static func legacyRoles(isProducer: Bool, isAdmin: Bool) -> Set<MemberRole> {
        var roles: Set<MemberRole> = [.member]
        if isProducer {
            roles.insert(.producer)
        }
        if isAdmin {
            roles.insert(.admin)
        }
        return roles
    }

    private static func combinedName(firstName: String?, lastName: String?) -> String? {
        let nameParts: [String] = [firstName, lastName].compactMap { (part: String?) -> String? in
            guard let part, !part.isEmpty else { return nil }
            return part
        }
        let combined = nameParts.joined(separator: " ")
        return combined.isEmpty ? nil : combined
    }
}
