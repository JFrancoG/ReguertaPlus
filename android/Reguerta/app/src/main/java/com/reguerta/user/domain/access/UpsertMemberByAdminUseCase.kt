package com.reguerta.user.domain.access

class UpsertMemberByAdminUseCase(
    private val administrationRepository: MemberAdministrationRepository,
) {
    @Suppress("UNUSED_PARAMETER")
    suspend operator fun invoke(actorAuthUid: String, target: Member): Member {
        val normalizedTarget = target.copy(
            normalizedEmail = normalizeEmail(target.normalizedEmail),
            roles = target.roles + MemberRole.MEMBER,
        )
        return administrationRepository.upsertMember(normalizedTarget)
    }

    private fun normalizeEmail(email: String): String = email.trim().lowercase()
}

sealed class MemberManagementException(message: String) : IllegalStateException(message) {
    data object AccessDenied : MemberManagementException("Only admins can manage members")

    data object LastAdminRemoval : MemberManagementException("Cannot remove the last active admin")

    data object Conflict : MemberManagementException("Member data conflicts with an existing account")
}
