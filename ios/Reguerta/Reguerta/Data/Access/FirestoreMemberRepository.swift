import FirebaseCore
import FirebaseFirestore
import Foundation

actor FirestoreMemberRepository: MemberRepository {
    private let storedDB: Firestore

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for members")
        }
        self.storedDB = Firestore.firestore(app: app)
    }

    func member(id: String, environment: SessionEnvironment) async throws -> Member? {
        let normalizedID = id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedID.isEmpty, !normalizedID.contains("/") else {
            throw RepositoryError.invalidData(resource: "members.id")
        }

        do {
            try Task.checkCancellation()
            let usersCollection = storedDB.reguertaCollection(.users, environment: environment)
            let snapshot = try await usersCollection.document(normalizedID).getDocument()
            guard snapshot.exists else { return nil }
            guard let data = snapshot.data() else { throw Self.invalidMemberDocumentError }
            return try Self.member(documentID: snapshot.documentID, data: data)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "members.document")
        }
    }

    func members(visibleTo member: Member, environment: SessionEnvironment) async throws -> [Member] {
        do {
            try Task.checkCancellation()
            let members: [Member]
            if member.canManageMembers {
                let usersCollection = storedDB.reguertaCollection(.users, environment: environment)
                let snapshot = try await usersCollection.getDocuments()
                members = try snapshot.documents.map { document in
                    try Self.member(documentID: document.documentID, data: document.data())
                }
            } else {
                let memberDirectoryCollection = storedDB.reguertaCollection(
                    .memberDirectory,
                    environment: environment
                )
                let snapshot = try await memberDirectoryCollection
                    .whereField("isActive", isEqualTo: true)
                    .getDocuments()
                let directoryMembers = try snapshot.documents.map { document in
                    try Self.directoryMember(documentID: document.documentID, data: document.data())
                }
                members = Self.mergingAuthenticatedMember(member, into: directoryMembers)
            }
            return members.sorted { lhs, rhs in
                lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
            }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "members")
        }
    }

    func updateOwnProducerCatalogEnabled(
        member: Member,
        enabled: Bool,
        environment: SessionEnvironment
    ) async throws -> Member {
        do {
            try Task.checkCancellation()
            let usersCollection = storedDB.reguertaCollection(.users, environment: environment)
            try await usersCollection.document(member.id).updateData([
                "producerCatalogEnabled": enabled
            ])
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "members.write")
        }
        return member.copy(producerCatalogEnabled: enabled)
    }
}

extension FirestoreMemberRepository {
    static func member(documentID: String, data: [String: Any]) throws -> Member {
        let id = try requiredDocumentID(documentID, resource: "members.document")
        let contact = try fullMemberContact(data)
        let access = try fullMemberAccess(data)
        let commitment = try fullMemberCommitment(data)

        return Member(
            id: id,
            displayName: contact.displayName,
            companyName: contact.companyName,
            phoneNumber: contact.phoneNumber,
            normalizedEmail: contact.normalizedEmail,
            authUid: contact.authUid,
            roles: access.roles,
            isActive: access.isActive,
            producerCatalogEnabled: access.producerCatalogEnabled,
            isCommonPurchaseManager: access.isCommonPurchaseManager,
            producerParity: commitment.producerParity,
            ecoCommitmentMode: commitment.mode,
            ecoCommitmentParity: commitment.parity
        )
    }

    static func directoryMember(documentID: String, data: [String: Any]) throws -> Member {
        let resource = "members.directory.document"
        let id = try requiredDocumentID(documentID, resource: resource)
        guard try requiredString(data, field: "userId", resource: resource) == id else {
            throw RepositoryError.invalidData(resource: resource)
        }
        let displayName = try requiredString(data, field: "displayName", resource: resource)
        let companyName = try optionalString(data, keys: ["companyName"], resource: resource)
        let roles = try directoryRoles(data, resource: resource)
        guard try requiredBool(data, field: "isActive", resource: resource) else {
            throw RepositoryError.invalidData(resource: resource)
        }
        let producerCatalogEnabled = try requiredBool(
            data,
            field: "producerCatalogEnabled",
            resource: resource
        )
        let isCommonPurchaseManager = try requiredBool(
            data,
            field: "isCommonPurchaseManager",
            resource: resource
        )
        let producerParity = try optionalParity(
            data["producerParity"],
            resource: resource,
            acceptsLegacyValues: false
        )
        guard let ecoCommitment = try optionalMap(data, field: "ecoCommitment", resource: resource) else {
            throw RepositoryError.invalidData(resource: resource)
        }
        let ecoCommitmentMode = try requiredEcoMode(ecoCommitment["mode"], resource: resource)
        let ecoCommitmentParity = try optionalParity(
            ecoCommitment["parity"],
            resource: resource,
            acceptsLegacyValues: false
        )

        return Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            phoneNumber: nil,
            normalizedEmail: "",
            authUid: nil,
            roles: roles,
            isActive: true,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }

    static func mergingAuthenticatedMember(_ authenticatedMember: Member, into directoryMembers: [Member]) -> [Member] {
        directoryMembers.filter { $0.id != authenticatedMember.id } + [authenticatedMember]
    }
}

private extension FirestoreMemberRepository {
    static func fullMemberContact(_ data: [String: Any]) throws -> FullMemberContact {
        let resource = "members.document"
        let displayName = try optionalString(data, keys: ["displayName"], resource: resource)
            ?? combinedName(
                firstName: try optionalString(data, keys: ["name"], resource: resource),
                lastName: try optionalString(data, keys: ["surname"], resource: resource)
            )
        guard let displayName,
              let normalizedEmail = try optionalString(
                data,
                keys: ["normalizedEmail", "emailNormalized", "email"],
                resource: resource
              )?.lowercased() else {
            throw invalidMemberDocumentError
        }
        return FullMemberContact(
            displayName: displayName,
            companyName: try optionalString(
                data,
                keys: ["companyName", "company_name", "company"],
                resource: resource
            ),
            phoneNumber: try optionalString(
                data,
                keys: ["phoneNumber", "phone", "telephone", "telefono"],
                resource: resource
            ),
            normalizedEmail: normalizedEmail,
            authUid: try optionalString(data, keys: ["authUid"], resource: resource)
        )
    }

    static func fullMemberAccess(_ data: [String: Any]) throws -> FullMemberAccess {
        let resource = "members.document"
        return FullMemberAccess(
            roles: try fullMemberRoles(data),
            isActive: try optionalBool(
                data,
                keys: ["isActive", "available"],
                default: true,
                resource: resource
            ),
            producerCatalogEnabled: try optionalBool(
                data,
                keys: ["producerCatalogEnabled"],
                default: true,
                resource: resource
            ),
            isCommonPurchaseManager: try optionalBool(
                data,
                keys: ["isCommonPurchaseManager"],
                default: false,
                resource: resource
            )
        )
    }

    static func fullMemberCommitment(_ data: [String: Any]) throws -> FullMemberCommitment {
        let resource = "members.document"
        let ecoCommitment = try optionalMap(data, field: "ecoCommitment", resource: resource)
        return FullMemberCommitment(
            producerParity: try optionalParity(
                data["producerParity"],
                resource: resource,
                acceptsLegacyValues: true
            ),
            mode: try optionalEcoMode(
                ecoCommitment?["mode"],
                default: .weekly,
                resource: resource,
                acceptsLegacyValues: true
            ),
            parity: try optionalParity(
                ecoCommitment?["parity"],
                resource: resource,
                acceptsLegacyValues: true
            )
        )
    }

    private static func fullMemberRoles(_ data: [String: Any]) throws -> Set<MemberRole> {
        let resource = "members.document"
        let parsedRoles: Set<MemberRole>
        if let rawRoles = data["roles"], !(rawRoles is NSNull) {
            guard let values = rawRoles as? [Any] else { throw RepositoryError.invalidData(resource: resource) }
            parsedRoles = try Set(values.map { value in
                guard let value = value as? String,
                      let role = legacyCompatibleRole(from: value) else {
                    throw RepositoryError.invalidData(resource: resource)
                }
                return role
            })
        } else {
            parsedRoles = []
        }
        if !parsedRoles.isEmpty { return parsedRoles }
        return legacyRoles(
            isProducer: try optionalBool(
                data,
                keys: ["isProducer"],
                default: false,
                resource: resource
            ),
            isAdmin: try optionalBool(
                data,
                keys: ["isAdmin"],
                default: false,
                resource: resource
            )
        )
    }

    private static func directoryRoles(_ data: [String: Any], resource: String) throws -> Set<MemberRole> {
        guard let rawRoles = data["roles"] as? [Any], !rawRoles.isEmpty else {
            throw RepositoryError.invalidData(resource: resource)
        }
        let roles = try Set(rawRoles.map { value in
            guard let value = value as? String,
                  value == value.trimmingCharacters(in: .whitespacesAndNewlines),
                  let role = MemberRole(rawValue: value) else {
                throw RepositoryError.invalidData(resource: resource)
            }
            return role
        })
        guard roles.contains(.member) else { throw RepositoryError.invalidData(resource: resource) }
        return roles
    }

    private static func requiredDocumentID(_ documentID: String, resource: String) throws -> String {
        let normalized = documentID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, !normalized.contains("/") else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return normalized
    }

    private static func requiredString(_ data: [String: Any], field: String, resource: String) throws -> String {
        guard let value = try optionalString(data, keys: [field], resource: resource) else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return value
    }

    private static func optionalString(_ data: [String: Any], keys: [String], resource: String) throws -> String? {
        for key in keys {
            guard let rawValue = data[key], !(rawValue is NSNull) else { continue }
            guard let value = rawValue as? String else { throw RepositoryError.invalidData(resource: resource) }
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if !normalized.isEmpty { return normalized }
        }
        return nil
    }

    private static func requiredBool(_ data: [String: Any], field: String, resource: String) throws -> Bool {
        guard let rawValue = data[field], let value = rawValue as? Bool else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return value
    }

    private static func optionalBool(
        _ data: [String: Any],
        keys: [String],
        default defaultValue: Bool,
        resource: String
    ) throws -> Bool {
        for key in keys {
            guard let rawValue = data[key], !(rawValue is NSNull) else { continue }
            guard let value = rawValue as? Bool else { throw RepositoryError.invalidData(resource: resource) }
            return value
        }
        return defaultValue
    }

    private static func optionalMap(_ data: [String: Any], field: String, resource: String) throws -> [String: Any]? {
        guard let rawValue = data[field], !(rawValue is NSNull) else { return nil }
        guard let value = rawValue as? [String: Any] else { throw RepositoryError.invalidData(resource: resource) }
        return value
    }

    private static func optionalParity(
        _ rawValue: Any?,
        resource: String,
        acceptsLegacyValues: Bool
    ) throws -> ProducerParity? {
        guard let rawValue, !(rawValue is NSNull) else { return nil }
        guard let value = rawValue as? String else { throw RepositoryError.invalidData(resource: resource) }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate = acceptsLegacyValues ? normalized.lowercased() : normalized
        if acceptsLegacyValues, candidate.isEmpty { return nil }
        if let parity = ProducerParity(rawValue: candidate) {
            return parity
        }
        if acceptsLegacyValues {
            switch candidate {
            case "par": return .even
            case "impar": return .odd
            default: break
            }
        }
        throw RepositoryError.invalidData(resource: resource)
    }

    private static func requiredEcoMode(_ rawValue: Any?, resource: String) throws -> EcoCommitmentMode {
        guard let rawValue, let value = rawValue as? String,
              value == value.trimmingCharacters(in: .whitespacesAndNewlines),
              let mode = EcoCommitmentMode(rawValue: value) else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return mode
    }

    private static func optionalEcoMode(
        _ rawValue: Any?,
        default defaultValue: EcoCommitmentMode,
        resource: String,
        acceptsLegacyValues: Bool
    ) throws -> EcoCommitmentMode {
        guard let rawValue, !(rawValue is NSNull) else { return defaultValue }
        guard let value = rawValue as? String else { throw RepositoryError.invalidData(resource: resource) }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate = acceptsLegacyValues ? normalized.lowercased() : normalized
        if acceptsLegacyValues, candidate.isEmpty { return defaultValue }
        guard let mode = EcoCommitmentMode(rawValue: candidate) else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return mode
    }

    private static func legacyCompatibleRole(from rawValue: String) -> MemberRole? {
        switch rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "member", "socio": .member
        case "producer", "productor": .producer
        case "admin", "administrador": .admin
        default: nil
        }
    }

    private static func legacyRoles(isProducer: Bool, isAdmin: Bool) -> Set<MemberRole> {
        var roles: Set<MemberRole> = [.member]
        if isProducer { roles.insert(.producer) }
        if isAdmin { roles.insert(.admin) }
        return roles
    }

    private static func combinedName(firstName: String?, lastName: String?) -> String? {
        let combined = [firstName, lastName].compactMap { $0 }.joined(separator: " ")
        return combined.isEmpty ? nil : combined
    }

    private static var invalidMemberDocumentError: RepositoryError {
        .invalidData(resource: "members.document")
    }
}

private struct FullMemberContact {
    let displayName: String
    let companyName: String?
    let phoneNumber: String?
    let normalizedEmail: String
    let authUid: String?
}

private struct FullMemberAccess {
    let roles: Set<MemberRole>
    let isActive: Bool
    let producerCatalogEnabled: Bool
    let isCommonPurchaseManager: Bool
}

private struct FullMemberCommitment {
    let producerParity: ProducerParity?
    let mode: EcoCommitmentMode
    let parity: ProducerParity?
}
