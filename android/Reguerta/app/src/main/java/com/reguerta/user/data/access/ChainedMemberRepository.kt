package com.reguerta.user.data.access

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRepository

class ChainedMemberRepository(
    private val primary: MemberRepository,
    private val fallback: MemberRepository,
) : MemberRepository {
    override suspend fun findByEmailNormalized(emailNormalized: String): Member? {
        return primary.findByEmailNormalized(emailNormalized)
            ?: fallback.findByEmailNormalized(emailNormalized)
    }

    override suspend fun findByAuthUid(authUid: String): Member? {
        return primary.findByAuthUid(authUid)
            ?: fallback.findByAuthUid(authUid)
    }

    override suspend fun linkAuthUid(memberId: String, authUid: String): Member {
        val fallbackMember = fallback.linkAuthUid(memberId = memberId, authUid = authUid)
        val primaryMember = runCatching {
            primary.linkAuthUid(memberId = memberId, authUid = authUid)
        }.getOrNull()
        return primaryMember ?: fallbackMember
    }

    override suspend fun getAllMembers(): List<Member> {
        val primaryMembers = primary.getAllMembers()
        return if (primaryMembers.isNotEmpty()) {
            primaryMembers
        } else {
            fallback.getAllMembers()
        }
    }

    override suspend fun upsertMember(member: Member): Member {
        val fallbackUpdated = fallback.upsertMember(member)
        val primaryUpdated = runCatching { primary.upsertMember(member) }.getOrNull()
        return primaryUpdated ?: fallbackUpdated
    }
}
