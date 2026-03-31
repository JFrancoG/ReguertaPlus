package com.reguerta.user.domain.access

class ResolveAuthorizedSessionUseCase(
    private val memberRepository: MemberRepository,
) {
    suspend operator fun invoke(authPrincipal: AuthPrincipal): AccessResolutionResult {
        val normalizedEmail = normalizeEmail(authPrincipal.email)
        val linkedByAuthUid = memberRepository.findByAuthUid(authPrincipal.uid)
        if (linkedByAuthUid != null) {
            return if (linkedByAuthUid.isActive) {
                AccessResolutionResult.Authorized(linkedByAuthUid)
            } else {
                AccessResolutionResult.Unauthorized(reason = UnauthorizedReason.USER_ACCESS_RESTRICTED)
            }
        }

        val member = memberRepository.findByEmailNormalized(normalizedEmail)
            ?: return AccessResolutionResult.Unauthorized(
                reason = UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS,
            )

        if (!member.isActive) {
            return AccessResolutionResult.Unauthorized(reason = UnauthorizedReason.USER_ACCESS_RESTRICTED)
        }

        val linkedMember = when {
            member.authUid == null -> {
                memberRepository.linkAuthUid(memberId = member.id, authUid = authPrincipal.uid)
            }

            member.authUid == authPrincipal.uid -> member
            else -> return AccessResolutionResult.Unauthorized(reason = UnauthorizedReason.USER_ACCESS_RESTRICTED)
        }

        return AccessResolutionResult.Authorized(linkedMember)
    }

    private fun normalizeEmail(email: String): String = email.trim().lowercase()
}
