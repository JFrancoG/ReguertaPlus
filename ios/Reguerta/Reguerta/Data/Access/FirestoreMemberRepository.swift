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

    private var memberDirectoryCollection: CollectionReference {
        db.reguertaCollection(.memberDirectory, environment: environment)
    }

    func member(id: String) async throws -> Member? {
        let normalizedID = id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedID.isEmpty, !normalizedID.contains("/") else {
            throw FirestoreMemberRepositoryError.invalidMemberID
        }
        let snapshot = try await usersCollection.document(normalizedID).getDocument()
        guard snapshot.exists else { return nil }
        guard let member = Self.toMember(snapshot) else {
            throw FirestoreMemberRepositoryError.invalidMemberDocument
        }
        return member
    }

    func members(visibleTo member: Member) async throws -> [Member] {
        let members: [Member]
        if member.isAdmin {
            let snapshot = try await usersCollection.getDocuments()
            members = snapshot.documents.compactMap(Self.toMember)
        } else {
            let snapshot = try await memberDirectoryCollection
                .whereField("isActive", isEqualTo: true)
                .getDocuments()
            members = Self.mergingAuthenticatedMember(
                member,
                into: snapshot.documents.compactMap { document in
                    Self.mapDirectoryMember(id: document.documentID, data: document.data())
                }
            )
        }
        return members.sorted { lhs, rhs in
            lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
        }
    }

    func updateOwnProducerCatalogEnabled(member: Member, enabled: Bool) async throws -> Member {
        let document = usersCollection.document(member.id)
        try await document.updateData(["producerCatalogEnabled": enabled])
        return member.copy(producerCatalogEnabled: enabled)
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
        guard let displayName else { return nil }

        let normalizedEmail = normalizedOptionalString(
            data,
            keys: ["normalizedEmail", "emailNormalized", "email"]
        )?.lowercased()
        guard let normalizedEmail else { return nil }
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
            ? legacyRoles(isProducer: (data["isProducer"] as? Bool) ?? false, isAdmin: (data["isAdmin"] as? Bool) ?? false)
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

    static func mapDirectoryMember(id: String, data: [String: Any]) -> Member? {
        guard let displayName = normalizedOptionalString(data, keys: ["displayName"]) else {
            return nil
        }
        let companyName = normalizedOptionalString(data, keys: ["companyName"])
        let isActive = (data["isActive"] as? Bool) ?? false
        let producerCatalogEnabled = (data["producerCatalogEnabled"] as? Bool) ?? true
        let isCommonPurchaseManager = (data["isCommonPurchaseManager"] as? Bool) ?? false
        let producerParity = normalizedOptionalString(data, keys: ["producerParity"])
            .flatMap(ProducerParity.init(rawValue:))
        let ecoCommitment = data["ecoCommitment"] as? [String: Any]
        let ecoCommitmentMode = normalizedOptionalString(ecoCommitment, keys: ["mode"])
            .flatMap(EcoCommitmentMode.init(rawValue:)) ?? .weekly
        let ecoCommitmentParity = normalizedOptionalString(ecoCommitment, keys: ["parity"])
            .flatMap(ProducerParity.init(rawValue:))
        let parsedRoles = Set(
            ((data["roles"] as? [String]) ?? []).compactMap(legacyCompatibleRole(from:))
        )
        let roles = parsedRoles.union([.member])

        return Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            phoneNumber: nil,
            normalizedEmail: "",
            authUid: nil,
            roles: roles,
            isActive: isActive,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }

    static func mergingAuthenticatedMember(
        _ authenticatedMember: Member,
        into directoryMembers: [Member]
    ) -> [Member] {
        directoryMembers.filter { $0.id != authenticatedMember.id } + [authenticatedMember]
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

private enum FirestoreMemberRepositoryError: Error {
    case invalidMemberID
    case invalidMemberDocument
}
