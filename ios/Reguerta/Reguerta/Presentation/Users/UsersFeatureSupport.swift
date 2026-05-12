import Foundation

struct MemberDraft: Equatable, Sendable {
    var displayName = ""
    var email = ""
    var companyName = ""
    var phoneNumber = ""
    var isMember = true
    var isProducer = false
    var isAdmin = false
    var isCommonPurchaseManager = false
    var isActive = true
}

enum MemberDraftValidationError: Error, Equatable {
    case insufficientPermission
    case displayNameEmailRequired
    case selectRole
    case producerCompanyRequired
    case memberExists

    @MainActor var feedbackKey: String {
        switch self {
        case .insufficientPermission:
            AccessL10nKey.feedbackOnlyAdminCreate
        case .displayNameEmailRequired:
            AccessL10nKey.feedbackDisplayNameEmailRequired
        case .selectRole:
            AccessL10nKey.feedbackSelectRole
        case .producerCompanyRequired:
            AccessL10nKey.feedbackProducerCompanyRequired
        case .memberExists:
            AccessL10nKey.feedbackMemberExists
        }
    }
}

struct MemberDraftValidation: Equatable {
    let normalizedEmail: String
    let roles: Set<MemberRole>
}

extension MemberDraft {
    var trimmedDisplayName: String {
        displayName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var builtRoles: Set<MemberRole> {
        var roles: Set<MemberRole> = []
        if isMember { roles.insert(.member) }
        if isProducer { roles.insert(.producer) }
        if isAdmin { roles.insert(.admin) }
        return roles
    }

    func normalizedCompanyName(roles: Set<MemberRole>) -> String? {
        guard roles.contains(.producer) else {
            return nil
        }
        let trimmed = companyName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var normalizedPhoneNumber: String? {
        let trimmed = phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    func validated(
        editingMemberId: String?,
        members: [Member],
        canManageMembers: Bool
    ) -> Result<MemberDraftValidation, MemberDraftValidationError> {
        guard canManageMembers else {
            return .failure(.insufficientPermission)
        }

        let normalizedEmail = normalizeMemberEmail(email)
        guard !trimmedDisplayName.isEmpty, !normalizedEmail.isEmpty else {
            return .failure(.displayNameEmailRequired)
        }

        let roles = builtRoles
        guard !roles.isEmpty else {
            return .failure(.selectRole)
        }

        guard !roles.contains(.producer) || normalizedCompanyName(roles: roles) != nil else {
            return .failure(.producerCompanyRequired)
        }

        guard !members.contains(where: { $0.normalizedEmail == normalizedEmail && $0.id != editingMemberId }) else {
            return .failure(.memberExists)
        }

        return .success(MemberDraftValidation(normalizedEmail: normalizedEmail, roles: roles))
    }
}

extension Member {
    func toDraft() -> MemberDraft {
        MemberDraft(
            displayName: displayName,
            email: normalizedEmail,
            companyName: companyName ?? "",
            phoneNumber: phoneNumber ?? "",
            isMember: roles.contains(.member),
            isProducer: roles.contains(.producer),
            isAdmin: roles.contains(.admin),
            isCommonPurchaseManager: isCommonPurchaseManager,
            isActive: isActive
        )
    }
}

func buildMemberId(from normalizedEmail: String) -> String {
    let sanitized = normalizedEmail
        .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
        .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    let suffix = sanitized.isEmpty ? "member" : String(sanitized.prefix(40))
    return "member_\(suffix)"
}

func normalizeMemberEmail(_ email: String) -> String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
}
