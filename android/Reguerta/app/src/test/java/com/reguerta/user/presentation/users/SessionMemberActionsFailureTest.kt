package com.reguerta.user.presentation.users

import com.reguerta.user.R
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberAdministrationRepository
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.access.canManageMembers
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionMemberActionsFailureTest {
    @Test
    fun `failed member refresh preserves the authorized directory and reports load feedback`() = runTest {
        val admin = admin()
        val target = member()
        val initial = authorizedState(admin, listOf(admin, target))
        val state = MutableStateFlow(initial)
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            memberRepository = RejectingMemberRepository,
            administrationRepository = ImmediateMemberAdministrationRepository,
            emitMessage = messages::add,
        )

        actions.refreshMembers()
        advanceUntilIdle()

        assertEquals(initial, state.value)
        assertEquals(R.string.feedback_unable_load_data, messages.last())
    }

    @Test
    fun `confirmed member mutation updates local session without directory read back`() = runTest {
        val admin = admin()
        val target = member(isActive = true)
        val repository = CountingRejectingMemberRepository()
        val state = MutableStateFlow(authorizedState(admin, listOf(admin, target)))
        val actions = actions(
            state = state,
            memberRepository = repository,
            administrationRepository = ImmediateMemberAdministrationRepository,
            emitMessage = {},
        )

        actions.toggleActive(target.id)
        advanceUntilIdle()

        val mode = state.value.mode as SessionMode.Authorized
        assertEquals(false, mode.members.first { it.id == target.id }.isActive)
        assertEquals(0, repository.readCount)
    }

    @Test
    fun `self deactivation immediately removes private member data`() = runTest {
        val admin = admin()
        val otherAdmin = admin(id = "other_admin")
        val target = member()
        val state = MutableStateFlow(authorizedState(admin, listOf(admin, otherAdmin, target)))
        val actions = actions(
            state = state,
            memberRepository = RejectingMemberRepository,
            administrationRepository = ImmediateMemberAdministrationRepository,
            emitMessage = {},
        )

        actions.toggleActive(admin.id)
        advanceUntilIdle()

        val mode = state.value.mode as SessionMode.Authorized
        assertEquals(false, mode.member.isActive)
        assertEquals(false, mode.member.canManageMembers)
        assertEquals(
            false,
            mode.members.any { it.id == target.id && (it.normalizedEmail.isNotEmpty() || it.authUid != null) },
        )
    }

    @Test
    fun `stale member mutation from a previous session publishes nothing`() = runTest {
        val oldAdmin = admin()
        val target = member()
        val administrationRepository = SuspendedMemberAdministrationRepository()
        val initial = authorizedState(oldAdmin, listOf(oldAdmin, target))
        val state = MutableStateFlow(initial)
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            memberRepository = RejectingMemberRepository,
            administrationRepository = administrationRepository,
            emitMessage = messages::add,
        )

        actions.toggleActive(target.id)
        runCurrent()
        administrationRepository.writeStarted.await()
        val replacementAdmin = admin(id = "new_admin")
        val replacement = authorizedState(replacementAdmin, listOf(replacementAdmin))
            .copy(sessionEpoch = initial.sessionEpoch + 1)
        state.value = replacement
        administrationRepository.completeWrite()
        advanceUntilIdle()

        assertEquals(replacement, state.value)
        assertEquals(emptyList<Int>(), messages)
    }

    private suspend fun actions(
        state: MutableStateFlow<SessionUiState>,
        memberRepository: MemberRepository,
        administrationRepository: MemberAdministrationRepository,
        emitMessage: (Int) -> Unit,
    ) = SessionMemberActions(
        uiState = state,
        scope = kotlinx.coroutines.CoroutineScope(currentCoroutineContext()),
        memberRepository = memberRepository,
        upsertMemberByAdmin = UpsertMemberByAdminUseCase(administrationRepository),
        emitMessage = emitMessage,
    )
}

private object RejectingMemberRepository : MemberRepository {
    override suspend fun findByAuthUid(authUid: String): Member? = null
    override suspend fun getMembersVisibleTo(member: Member): List<Member> = throw IOException("read rejected")
    override suspend fun updateOwnProducerCatalogEnabled(member: Member, isEnabled: Boolean): Member = member
}

private class CountingRejectingMemberRepository : MemberRepository {
    var readCount = 0
        private set

    override suspend fun findByAuthUid(authUid: String): Member? = null

    override suspend fun getMembersVisibleTo(member: Member): List<Member> {
        readCount += 1
        throw IOException("read rejected")
    }

    override suspend fun updateOwnProducerCatalogEnabled(member: Member, isEnabled: Boolean): Member = member
}

private object ImmediateMemberAdministrationRepository : MemberAdministrationRepository {
    override suspend fun upsertMember(member: Member): Member = member
}

private class SuspendedMemberAdministrationRepository : MemberAdministrationRepository {
    val writeStarted = CompletableDeferred<Unit>()
    private val writeResult = CompletableDeferred<Member>()
    private var submitted: Member? = null

    override suspend fun upsertMember(member: Member): Member {
        submitted = member
        writeStarted.complete(Unit)
        return writeResult.await()
    }

    fun completeWrite() {
        writeResult.complete(checkNotNull(submitted))
    }
}

private fun authorizedState(actor: Member, members: List<Member>) = SessionUiState(
    sessionEpoch = 1L,
    mode = SessionMode.Authorized(
        principal = AuthPrincipal(uid = checkNotNull(actor.authUid), email = actor.normalizedEmail),
        authenticatedMember = actor,
        member = actor,
        members = members,
    ),
)

private fun admin(id: String = "admin") = Member(
    id = id,
    displayName = "Admin",
    normalizedEmail = "$id@reguerta.test",
    authUid = "auth_$id",
    roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN),
    isActive = true,
    producerCatalogEnabled = true,
)

private fun member(id: String = "member_1", isActive: Boolean = true) = Member(
    id = id,
    displayName = "Member",
    normalizedEmail = "$id@reguerta.test",
    authUid = null,
    roles = setOf(MemberRole.MEMBER),
    isActive = isActive,
    producerCatalogEnabled = true,
)
