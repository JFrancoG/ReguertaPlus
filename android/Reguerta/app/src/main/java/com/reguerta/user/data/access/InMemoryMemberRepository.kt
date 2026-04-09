package com.reguerta.user.data.access

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.ProducerParity
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryMemberRepository : MemberRepository {
    private val mutex = Mutex()
    private val members = mutableMapOf(
        "member_admin_001" to Member(
            id = "member_admin_001",
            displayName = "Ana Admin",
            normalizedEmail = "ana.admin@reguerta.app",
            authUid = null,
            roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN),
            isActive = true,
            producerCatalogEnabled = true,
        ),
        "member_producer_001" to Member(
            id = "member_producer_001",
            displayName = "Pablo Productor",
            normalizedEmail = "pablo.producer@reguerta.app",
            authUid = null,
            roles = setOf(MemberRole.MEMBER, MemberRole.PRODUCER),
            isActive = true,
            producerCatalogEnabled = true,
            producerParity = ProducerParity.EVEN,
        ),
        "member_member_001" to Member(
            id = "member_member_001",
            displayName = "Marta Miembro",
            normalizedEmail = "marta.member@reguerta.app",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
            ecoCommitmentMode = EcoCommitmentMode.BIWEEKLY,
            ecoCommitmentParity = ProducerParity.EVEN,
        ),
    )

    override suspend fun findByEmailNormalized(emailNormalized: String): Member? = mutex.withLock {
        members.values.firstOrNull { it.normalizedEmail == emailNormalized }
    }

    override suspend fun findByAuthUid(authUid: String): Member? = mutex.withLock {
        members.values.firstOrNull { it.authUid == authUid }
    }

    override suspend fun linkAuthUid(memberId: String, authUid: String): Member = mutex.withLock {
        val member = checkNotNull(members[memberId]) { "Member not found" }
        val updated = member.copy(authUid = authUid)
        members[memberId] = updated
        updated
    }

    override suspend fun getAllMembers(): List<Member> = mutex.withLock {
        members.values.sortedBy { it.displayName.lowercase() }
    }

    override suspend fun upsertMember(member: Member): Member = mutex.withLock {
        members[member.id] = member
        member
    }

    suspend fun nextMemberId(email: String): String {
        val suffix = email.trim().lowercase().replace("[^a-z0-9]+".toRegex(), "_").trim('_')
        val safeSuffix = if (suffix.isBlank()) "member" else suffix
        return "member_${safeSuffix.take(40)}"
    }
}
