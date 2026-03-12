package com.reguerta.user.domain.access

class ResolveAuthorizedSessionUseCase(
    private val memberRepository: MemberRepository,
) {
    suspend operator fun invoke(authPrincipal: AuthPrincipal): AccessResolutionResult {
        val normalizedEmail = normalizeEmail(authPrincipal.email)
        val member = memberRepository.findByEmailNormalized(normalizedEmail)
            ?: return AccessResolutionResult.Unauthorized(reason = UnauthorizedReason.USER_NOT_AUTHORIZED)

        if (!member.isActive) {
            return AccessResolutionResult.Unauthorized(reason = UnauthorizedReason.USER_NOT_AUTHORIZED)
        }

        val linkedMember = when {
            member.authUid == null -> {
                memberRepository.linkAuthUid(memberId = member.id, authUid = authPrincipal.uid)
            }

            member.authUid == authPrincipal.uid -> member
            else -> return AccessResolutionResult.Unauthorized(reason = UnauthorizedReason.USER_NOT_AUTHORIZED)
        }

        return AccessResolutionResult.Authorized(linkedMember)
    }

    private fun normalizeEmail(email: String): String = email.trim().lowercase()
}
