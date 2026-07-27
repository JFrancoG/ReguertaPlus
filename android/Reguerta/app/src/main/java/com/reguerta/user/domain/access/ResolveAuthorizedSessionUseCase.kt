package com.reguerta.user.domain.access

class ResolveAuthorizedSessionUseCase(
    private val memberRepository: MemberRepository,
    private val authorizedMemberResolver: AuthorizedMemberResolver,
) {
    suspend operator fun invoke(authPrincipal: AuthPrincipal): AccessResolutionResult {
        val resolution = authorizedMemberResolver.resolve()
        if (resolution is AuthorizedMemberResolution.Unauthorized) {
            return AccessResolutionResult.Unauthorized(
                reason = when {
                    resolution.emailVerificationRequired -> UnauthorizedReason.EMAIL_NOT_VERIFIED
                    resolution.isActive == false -> UnauthorizedReason.USER_ACCESS_RESTRICTED
                    else -> UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS
                },
            )
        }

        resolution as AuthorizedMemberResolution.Authorized
        if (!resolution.isActive) {
            return AccessResolutionResult.Unauthorized(reason = UnauthorizedReason.USER_ACCESS_RESTRICTED)
        }
        val linkedMember = memberRepository.findByAuthUid(authPrincipal.uid)
            ?: return AccessResolutionResult.Unauthorized(
                reason = UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS,
            )
        if (
            linkedMember.id != resolution.memberId ||
            linkedMember.authUid != authPrincipal.uid ||
            !linkedMember.isActive
        ) {
            return AccessResolutionResult.Unauthorized(reason = UnauthorizedReason.USER_ACCESS_RESTRICTED)
        }

        return AccessResolutionResult.Authorized(linkedMember)
    }
}
