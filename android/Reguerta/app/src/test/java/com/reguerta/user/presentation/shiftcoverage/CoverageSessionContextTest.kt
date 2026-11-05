package com.reguerta.user.presentation.shiftcoverage

import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CoverageSessionContextTest {
    @Test fun canonicalIdentityUsesTheResolvedEnvironmentAndEpoch() {
        val state = authorized()
        val context = checkNotNull(state.coverageSession())
        assertEquals("firebase-user", context.uid)
        assertEquals("canonical-member", context.memberId)
        assertEquals("production", context.environment)
        assertEquals(7L, context.authorizationRevision)
        assertNotEquals(context, state.copy(sessionEpoch = 8).coverageSession())
        assertNotEquals(context, state.copy(sessionEnvironment = "develop").coverageSession())
    }

    @Test fun impersonationOrAnUnresolvedOrRevokedSessionHasNoCoverageIdentity() {
        val state = authorized()
        val mode = state.mode as SessionMode.Authorized
        for (invalid in listOf(
            state.copy(mode = SessionMode.SignedOut),
            state.copy(sessionEnvironment = null),
            state.copy(sessionEnvironment = "staging"),
            state.copy(mode = mode.copy(member = mode.member.copy(id = "impersonated-member"))),
            state.copy(mode = mode.copy(member = mode.member.copy(isActive = false))),
            state.copy(mode = mode.copy(authenticatedMember = mode.authenticatedMember.copy(isActive = false))),
            state.copy(mode = mode.copy(authenticatedMember = mode.authenticatedMember.copy(authUid = "foreign-user"))),
        )) assertNull(invalid.coverageSession())
    }

    @Test fun refreshedAuthorizationChangesScopeEvenWhenTheEpochIsUnchanged() {
        val initial = authorized()
        val mode = initial.mode as SessionMode.Authorized
        val previous = checkNotNull(initial.coverageSession())
        for (member in listOf(
            mode.authenticatedMember.copy(roles = setOf(MemberRole.ADMIN, MemberRole.MEMBER)),
            mode.authenticatedMember.copy(isCommonPurchaseManager = true),
        )) {
            val refreshed = initial.copy(mode = mode.copy(authenticatedMember = member, member = member))
            assertEquals(initial.sessionEpoch, refreshed.sessionEpoch)
            assertNotEquals(previous, refreshed.coverageSession())
        }
        val roles = mutableSetOf(MemberRole.MEMBER)
        val member = mode.authenticatedMember.copy(roles = roles)
        val scope = initial.copy(mode = mode.copy(authenticatedMember = member, member = member)).coverageSession()!!
        roles.add(MemberRole.ADMIN)
        assertEquals(setOf(MemberRole.MEMBER), scope.authorization!!.roles)
    }

    private fun authorized(): SessionUiState {
        val member = Member(id = "canonical-member", displayName = "Real account",
            normalizedEmail = "account@example.test", authUid = "firebase-user", roles = setOf(MemberRole.MEMBER),
            isActive = true, producerCatalogEnabled = false)
        return SessionUiState(sessionEpoch = 7, sessionEnvironment = "production",
            mode = SessionMode.Authorized(AuthPrincipal("firebase-user", member.normalizedEmail), member, member, listOf(member)))
    }
}
