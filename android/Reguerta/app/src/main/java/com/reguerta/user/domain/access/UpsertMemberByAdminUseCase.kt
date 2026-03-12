package com.reguerta.user.domain.access

class UpsertMemberByAdminUseCase(
    private val memberRepository: MemberRepository,
) {
    suspend operator fun invoke(actorAuthUid: String, target: Member): Member {
        val actor = memberRepository.findByAuthUid(actorAuthUid)
            ?: throw MemberManagementException.AccessDenied

        if (!actor.isAdmin || !actor.isActive) {
            throw MemberManagementException.AccessDenied
        }

        val allMembers = memberRepository.getAllMembers()
        val current = allMembers.firstOrNull { it.id == target.id }
        val normalizedTarget = target.copy(normalizedEmail = normalizeEmail(target.normalizedEmail))

        if (wouldLeaveWithoutActiveAdmins(allMembers = allMembers, current = current, target = normalizedTarget)) {
            throw MemberManagementException.LastAdminRemoval
        }

        return memberRepository.upsertMember(normalizedTarget)
    }

    private fun normalizeEmail(email: String): String = email.trim().lowercase()

    private fun wouldLeaveWithoutActiveAdmins(
        allMembers: List<Member>,
        current: Member?,
        target: Member,
    ): Boolean {
        val activeAdminCount = allMembers.count { it.isActive && it.roles.contains(MemberRole.ADMIN) }
        val wasActiveAdmin = current?.isActive == true && current.roles.contains(MemberRole.ADMIN)
        val willBeActiveAdmin = target.isActive && target.roles.contains(MemberRole.ADMIN)

        return wasActiveAdmin && !willBeActiveAdmin && activeAdminCount <= 1
    }
}

sealed class MemberManagementException(message: String) : IllegalStateException(message) {
    data object AccessDenied : MemberManagementException("Only admins can manage members")

    data object LastAdminRemoval : MemberManagementException("Cannot remove the last active admin")
}
