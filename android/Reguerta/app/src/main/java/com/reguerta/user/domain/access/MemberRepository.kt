package com.reguerta.user.domain.access

interface MemberRepository {
    suspend fun findByAuthUid(authUid: String): Member?

    suspend fun getMembersVisibleTo(member: Member): List<Member>

    suspend fun updateOwnProducerCatalogEnabled(
        memberId: String,
        isEnabled: Boolean,
    ): Member
}
