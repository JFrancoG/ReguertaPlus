package com.reguerta.user.domain.access

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SecureAccessUseCasesTest {
    @Test
    fun `session resolution uses backend resolver then auth link lookup`() = runBlocking {
        val expected = member(authUid = "uid_001")
        val repository = RecordingMemberRepository(memberByUid = expected)
        val resolver = RecordingAuthorizedMemberResolver(
            AuthorizedMemberResolution.Authorized(
                memberId = expected.id,
                roles = expected.roles,
                isActive = true,
                environment = "develop",
                firstLoginLinked = true,
            ),
        )
        val useCase = ResolveAuthorizedSessionUseCase(repository, resolver)

        val result = useCase(AuthPrincipal(uid = "uid_001", email = "ignored@attacker.invalid"))

        assertEquals(1, resolver.calls)
        assertEquals(listOf("uid_001"), repository.requestedAuthUids)
        assertTrue(result is AccessResolutionResult.Authorized)
        assertEquals(expected, (result as AccessResolutionResult.Authorized).member)
    }

    @Test
    fun `session resolution does not trust mismatched auth link`() = runBlocking {
        val repository = RecordingMemberRepository(memberByUid = member(authUid = "different_uid"))
        val resolver = RecordingAuthorizedMemberResolver(
            AuthorizedMemberResolution.Authorized(
                memberId = "member_001",
                roles = setOf(MemberRole.MEMBER),
                isActive = true,
                environment = "production",
                firstLoginLinked = false,
            ),
        )

        val result = ResolveAuthorizedSessionUseCase(repository, resolver)(
            AuthPrincipal(uid = "uid_001", email = "ignored@reguerta.app"),
        )

        assertEquals(
            UnauthorizedReason.USER_ACCESS_RESTRICTED,
            (result as AccessResolutionResult.Unauthorized).reason,
        )
    }

    @Test
    fun `admin use case delegates authorization to authenticated backend`() = runBlocking {
        val administration = RecordingMemberAdministrationRepository()
        val target = member(authUid = null).copy(normalizedEmail = " TARGET@REGUERTA.APP ")
        val useCase = UpsertMemberByAdminUseCase(administration)

        val result = useCase(actorAuthUid = "must_not_be_used", target = target)

        assertEquals("target@reguerta.app", result.normalizedEmail)
        assertEquals("target@reguerta.app", administration.target?.normalizedEmail)
    }

    @Test
    fun `admin use case preserves canonical member role for specialized users`() = runBlocking {
        val administration = RecordingMemberAdministrationRepository()
        val target = member(authUid = null).copy(roles = setOf(MemberRole.PRODUCER))

        UpsertMemberByAdminUseCase(administration)(actorAuthUid = "unused", target = target)

        assertEquals(
            setOf(MemberRole.MEMBER, MemberRole.PRODUCER),
            administration.target?.roles,
        )
    }

    @Test
    fun `verified email denial is distinct from membership denial`() = runBlocking {
        val repository = RecordingMemberRepository(memberByUid = null)
        val resolver = RecordingAuthorizedMemberResolver(
            AuthorizedMemberResolution.Unauthorized(
                isActive = null,
                emailVerificationRequired = true,
            ),
        )

        val result = ResolveAuthorizedSessionUseCase(repository, resolver)(
            AuthPrincipal(uid = "pending_uid", email = "pending@reguerta.app"),
        )

        assertEquals(
            UnauthorizedReason.EMAIL_NOT_VERIFIED,
            (result as AccessResolutionResult.Unauthorized).reason,
        )
        assertTrue(repository.requestedAuthUids.isEmpty())
    }
}

private class RecordingAuthorizedMemberResolver(
    private val result: AuthorizedMemberResolution,
) : AuthorizedMemberResolver {
    var calls: Int = 0

    override suspend fun resolve(): AuthorizedMemberResolution {
        calls += 1
        return result
    }
}

private class RecordingMemberRepository(
    private val memberByUid: Member?,
) : MemberRepository {
    val requestedAuthUids = mutableListOf<String>()

    override suspend fun findByAuthUid(authUid: String): Member? {
        requestedAuthUids += authUid
        return memberByUid
    }

    override suspend fun getMembersVisibleTo(member: Member): List<Member> = listOfNotNull(memberByUid)

    override suspend fun updateOwnProducerCatalogEnabled(memberId: String, isEnabled: Boolean): Member =
        checkNotNull(memberByUid).copy(producerCatalogEnabled = isEnabled)
}

private class RecordingMemberAdministrationRepository : MemberAdministrationRepository {
    var target: Member? = null

    override suspend fun upsertMember(member: Member): Member {
        target = member
        return member
    }
}

private fun member(authUid: String?): Member = Member(
    id = "member_001",
    displayName = "Member",
    normalizedEmail = "member@reguerta.app",
    authUid = authUid,
    roles = setOf(MemberRole.MEMBER),
    isActive = true,
    producerCatalogEnabled = true,
)
