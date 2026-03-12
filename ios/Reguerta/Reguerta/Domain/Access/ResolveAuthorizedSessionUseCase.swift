import Foundation

struct ResolveAuthorizedSessionUseCase: Sendable {
    private let repository: any MemberRepository

    init(repository: any MemberRepository) {
        self.repository = repository
    }

    func execute(authPrincipal: AuthPrincipal) async -> AccessResolutionResult {
        let normalizedEmail = normalizeEmail(authPrincipal.email)

        guard let member = await repository.findByEmailNormalized(normalizedEmail), member.isActive else {
            return .unauthorized("Unauthorized user")
        }

        let linkedMember: Member?
        if let authUid = member.authUid {
            guard authUid == authPrincipal.uid else {
                return .unauthorized("Unauthorized user")
            }
            linkedMember = member
        } else {
            linkedMember = await repository.linkAuthUid(memberId: member.id, authUid: authPrincipal.uid)
        }

        guard let linkedMember else {
            return .unauthorized("Unauthorized user")
        }

        return .authorized(linkedMember)
    }

    private func normalizeEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
