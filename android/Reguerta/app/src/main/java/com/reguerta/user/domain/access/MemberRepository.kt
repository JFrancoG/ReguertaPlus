package com.reguerta.user.domain.access

interface MemberRepository {
    suspend fun findByEmailNormalized(emailNormalized: String): Member?

    suspend fun findByAuthUid(authUid: String): Member?

    suspend fun linkAuthUid(memberId: String, authUid: String): Member

    suspend fun getAllMembers(): List<Member>

    suspend fun upsertMember(member: Member): Member
}
