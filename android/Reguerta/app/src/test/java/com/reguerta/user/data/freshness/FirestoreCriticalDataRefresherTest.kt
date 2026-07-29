package com.reguerta.user.data.freshness

import com.reguerta.user.data.commitments.criticalSeasonalCommitmentLookupKeys
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.freshness.CriticalDataRefreshScope
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class FirestoreCriticalDataRefresherTest {
    @Test
    fun `selected member must exist and remain active`() {
        val active = member(id = "selected", isActive = true)

        assertEquals(listOf(active), listOf(active).requiringActiveSelectedMember("selected"))

        val missing = assertThrows(RepositoryException::class.java) {
            listOf(active).requiringActiveSelectedMember("missing")
        }
        assertEquals(RepositoryErrorKind.NOT_FOUND, missing.kind)

        val inactive = assertThrows(RepositoryException::class.java) {
            listOf(member(id = "selected", isActive = false))
                .requiringActiveSelectedMember("selected")
        }
        assertEquals(RepositoryErrorKind.PERMISSION_DENIED, inactive.kind)
    }

    @Test
    fun `seasonal commitment server refresh uses every selected member lookup key`() {
        val selected = member(id = "selected", isActive = true)

        assertEquals(
            listOf("selected", "uid-selected", "selected@reguerta.test"),
            criticalSeasonalCommitmentLookupKeys(selected),
        )
    }

    @Test
    fun `admin revocation invalidates impersonated scope before privileged refresh`() {
        val scope = CriticalDataRefreshScope(
            environment = "develop",
            principalUid = "uid-admin",
            authenticatedMemberId = "admin",
            memberId = "selected",
            canManageMembers = true,
        )
        val activeAdmin = member(id = "admin", isActive = true).copy(
            roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN),
        )
        val revokedAdmin = activeAdmin.copy(roles = setOf(MemberRole.MEMBER))

        assertFalse(scope.requiresAccessScopeRetry(activeAdmin))
        assertTrue(scope.requiresAccessScopeRetry(revokedAdmin))
    }

    @Test
    fun `authenticated member relink fails closed`() {
        val authenticatedMember = member(id = "member", isActive = true)

        assertEquals(
            authenticatedMember,
            authenticatedMember.requiringPrincipal("uid-member"),
        )
        val relinked = assertThrows(RepositoryException::class.java) {
            authenticatedMember.requiringPrincipal("uid-other")
        }

        assertEquals(RepositoryErrorKind.PERMISSION_DENIED, relinked.kind)
    }
}

private fun member(id: String, isActive: Boolean) = Member(
    id = id,
    displayName = id,
    normalizedEmail = "$id@reguerta.test",
    authUid = "uid-$id",
    roles = setOf(MemberRole.MEMBER),
    isActive = isActive,
    producerCatalogEnabled = false,
)
