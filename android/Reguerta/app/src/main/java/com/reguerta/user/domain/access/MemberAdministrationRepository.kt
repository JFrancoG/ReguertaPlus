package com.reguerta.user.domain.access

interface MemberAdministrationRepository {
    suspend fun upsertMember(member: Member): Member
}
