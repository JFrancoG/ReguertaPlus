package com.reguerta.user.domain.access

import com.reguerta.user.data.access.InMemoryMemberRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class AccessUseCasesTest {
    private val repository = InMemoryMemberRepository()
    private val resolveAuthorizedSession = ResolveAuthorizedSessionUseCase(repository)
    private val upsertMemberByAdmin = UpsertMemberByAdminUseCase(repository)

    @Test
    fun `returns unauthorized when email was not pre-authorized`() = runBlocking {
        val result = resolveAuthorizedSession(
            AuthPrincipal(uid = "uid_unknown", email = "unknown@reguerta.app"),
        )

        assertTrue(result is AccessResolutionResult.Unauthorized)
        assertEquals(
            UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS,
            (result as AccessResolutionResult.Unauthorized).reason,
        )
    }

    @Test
    fun `returns restricted unauthorized when member exists but is inactive`() = runBlocking {
        repository.upsertMember(
            Member(
                id = "member_inactive_001",
                displayName = "Inactiva",
                normalizedEmail = "inactive@reguerta.app",
                authUid = null,
                roles = setOf(MemberRole.MEMBER),
                isActive = false,
                producerCatalogEnabled = true,
            ),
        )

        val result = resolveAuthorizedSession(
            AuthPrincipal(uid = "uid_inactive", email = "inactive@reguerta.app"),
        )

        assertTrue(result is AccessResolutionResult.Unauthorized)
        assertEquals(
            UnauthorizedReason.USER_ACCESS_RESTRICTED,
            (result as AccessResolutionResult.Unauthorized).reason,
        )
    }

    @Test
    fun `links auth uid on first authorized login`() = runBlocking {
        val firstLogin = resolveAuthorizedSession(
            AuthPrincipal(uid = "uid_admin_1", email = "ana.admin@reguerta.app"),
        )

        assertTrue(firstLogin is AccessResolutionResult.Authorized)
        val authorized = firstLogin as AccessResolutionResult.Authorized
        assertEquals("uid_admin_1", authorized.member.authUid)
    }

    @Test
    fun `prevents removing the last active admin`() = runBlocking {
        resolveAuthorizedSession(AuthPrincipal(uid = "uid_admin_2", email = "ana.admin@reguerta.app"))
        val currentAdmin = repository.findByEmailNormalized("ana.admin@reguerta.app")!!

        try {
            upsertMemberByAdmin(
                actorAuthUid = "uid_admin_2",
                target = currentAdmin.copy(roles = setOf(MemberRole.MEMBER)),
            )
            fail("Expected last active admin protection")
        } catch (_: MemberManagementException.LastAdminRemoval) {
            assertTrue(true)
        }
    }

    @Test
    fun `admin can create pre-authorized member`() = runBlocking {
        resolveAuthorizedSession(AuthPrincipal(uid = "uid_admin_3", email = "ana.admin@reguerta.app"))

        val created = upsertMemberByAdmin(
            actorAuthUid = "uid_admin_3",
            target = Member(
                id = "member_new_001",
                displayName = "Nuevo Miembro",
                normalizedEmail = "nuevo@reguerta.app",
                authUid = null,
                roles = setOf(MemberRole.MEMBER),
                isActive = true,
                producerCatalogEnabled = true,
            ),
        )

        assertEquals("nuevo@reguerta.app", created.normalizedEmail)
        assertTrue(repository.findByEmailNormalized("nuevo@reguerta.app") != null)
    }
}
