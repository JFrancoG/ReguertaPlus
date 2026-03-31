import Foundation

struct ResolveAuthorizedSessionUseCase: Sendable {
    private let repository: any MemberRepository

    init(repository: any MemberRepository) {
        self.repository = repository
    }

    func execute(authPrincipal: AuthPrincipal) async -> AccessResolutionResult {
        let normalizedEmail = normalizeEmail(authPrincipal.email)

        if let linkedMember = await repository.findByAuthUid(authPrincipal.uid) {
            guard linkedMember.isActive else {
                return .unauthorized(.userAccessRestricted)
            }
            return .authorized(linkedMember)
        }

        guard let member = await repository.findByEmailNormalized(normalizedEmail) else {
            return .unauthorized(.userNotFoundInAuthorizedUsers)
        }

        guard member.isActive else {
            return .unauthorized(.userAccessRestricted)
        }

        let linkedMember: Member?
        if let authUid = member.authUid {
            guard authUid == authPrincipal.uid else {
                return .unauthorized(.userAccessRestricted)
            }
            linkedMember = member
        } else {
            linkedMember = await repository.linkAuthUid(memberId: member.id, authUid: authPrincipal.uid)
        }

        guard let linkedMember else {
            return .unauthorized(.userAccessRestricted)
        }

        return .authorized(linkedMember)
    }

    private func normalizeEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
