package com.reguerta.user.data.access

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InMemoryMemberRepositoryPrivacyTest {
    @Test
    fun `non admin reads stable public projection and keeps own identity`() = runTest {
        val repository = InMemoryMemberRepository()
        val currentMember = Member(
            id = "current_member",
            displayName = "Current Member",
            normalizedEmail = "current@reguerta.test",
            authUid = "auth_current_member",
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        )
        val otherMember = Member(
            id = "other_member",
            displayName = "Other Member",
            phoneNumber = "600000000",
            normalizedEmail = "other@reguerta.test",
            authUid = "auth_other_member",
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        )
        repository.seedMemberForTesting(currentMember)
        repository.seedMemberForTesting(otherMember)

        val firstRead = repository.getMembersVisibleTo(currentMember)
        val secondRead = repository.getMembersVisibleTo(currentMember)
        val projectedOther = firstRead.first { it.id == otherMember.id }

        assertEquals(firstRead, secondRead)
        assertEquals(currentMember, firstRead.first { it.id == currentMember.id })
        assertEquals("", projectedOther.normalizedEmail)
        assertNull(projectedOther.phoneNumber)
        assertNull(projectedOther.authUid)
    }
}
