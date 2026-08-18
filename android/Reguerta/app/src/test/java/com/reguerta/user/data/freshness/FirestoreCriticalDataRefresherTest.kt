package com.reguerta.user.data.freshness

import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.commitments.loadActiveCommitmentsForMember
import com.reguerta.user.domain.commitments.seasonalCommitmentLookupKeys
import com.reguerta.user.domain.freshness.CriticalDataRefreshScope
import kotlinx.coroutines.test.runTest
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
    fun `seasonal commitment lookup uses only the canonical member id`() {
        val selected = member(id = "selected", isActive = true)

        assertEquals(listOf("selected"), selected.seasonalCommitmentLookupKeys())
    }

    @Test
    fun `canonical commitments use one member id lookup`() = runTest {
        val selected = member(id = "selected", isActive = true)
        val calls = mutableListOf<String>()
        val canonical = commitment(id = "canonical", userId = selected.id)

        val result = loadActiveCommitmentsForMember(selected) { lookupKey ->
            calls += lookupKey
            if (lookupKey == selected.id) listOf(canonical) else error("Unexpected lookup")
        }

        assertEquals(listOf(selected.id), calls)
        assertEquals(listOf(canonical), result)
    }

    @Test
    fun `empty canonical result is successful without identity fallbacks`() = runTest {
        val selected = member(id = "selected", isActive = true)
        val calls = mutableListOf<String>()

        val result = loadActiveCommitmentsForMember(selected) { lookupKey ->
            calls += lookupKey
            emptyList()
        }

        assertEquals(listOf(selected.id), calls)
        assertTrue(result.isEmpty())
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

private fun commitment(id: String, userId: String) = SeasonalCommitment(
    id = id,
    userId = userId,
    productId = "product-$id",
    seasonKey = "2026",
    fixedQtyPerOfferedWeek = 1.0,
    active = true,
    createdAtMillis = 1L,
    updatedAtMillis = 1L,
)
