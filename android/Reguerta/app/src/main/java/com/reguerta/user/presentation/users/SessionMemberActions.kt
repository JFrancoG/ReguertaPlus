package com.reguerta.user.presentation.users

import com.reguerta.user.presentation.root.MemberDraft
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState

import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberManagementException
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.access.buildSecureMemberId
import com.reguerta.user.domain.access.canGrantAdminRole
import com.reguerta.user.domain.access.canManageMembers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal class SessionMemberActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val memberRepository: MemberRepository,
    private val upsertMemberByAdmin: UpsertMemberByAdminUseCase,
    private val emitMessage: (Int) -> Unit,
) {
    private var nextMemberMutationToken = 0L
    private var activeMemberMutation: ActiveMemberMutation? = null

    fun createAuthorizedMember() {
        saveMemberDraft(editingMemberId = null)
    }

    fun saveMemberDraft(
        editingMemberId: String?,
        onSuccess: (String) -> Unit = {},
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageMembers) {
            emitMessage(R.string.feedback_only_admin_create)
            return
        }

        val draft = uiState.value.memberDraft
        if (draft.displayName.isBlank() || draft.email.isBlank()) {
            emitMessage(R.string.feedback_display_name_email_required)
            return
        }

        val normalizedEmail = draft.email.trim().lowercase()
        val duplicateEmail = mode.members.any {
            it.normalizedEmail == normalizedEmail && it.id != editingMemberId
        }
        if (duplicateEmail) {
            emitMessage(R.string.feedback_member_exists)
            return
        }

        val roles = buildRoles(draft)
        if (roles.isEmpty()) {
            emitMessage(R.string.feedback_select_role)
            return
        }
        if (roles.contains(MemberRole.PRODUCER) && draft.companyName.isBlank()) {
            emitMessage(R.string.feedback_producer_company_required)
            return
        }

        val member = if (editingMemberId == null) {
            val memberId = buildSecureMemberId(normalizedEmail)
            if (mode.members.any { it.id == memberId }) {
                emitMessage(R.string.feedback_member_exists)
                return
            }
            Member(
                id = memberId,
                displayName = draft.displayName.trim(),
                companyName = normalizeCompanyName(draft, roles),
                phoneNumber = normalizePhoneNumber(draft),
                normalizedEmail = normalizedEmail,
                authUid = null,
                roles = roles,
                isActive = draft.isActive,
                producerCatalogEnabled = true,
                isCommonPurchaseManager = draft.isCommonPurchaseManager,
            )
        } else {
            val existing = mode.members.firstOrNull { it.id == editingMemberId } ?: return
            existing.copy(
                displayName = draft.displayName.trim(),
                companyName = normalizeCompanyName(draft, roles),
                phoneNumber = normalizePhoneNumber(draft),
                normalizedEmail = normalizedEmail,
                roles = roles,
                isActive = draft.isActive,
                isCommonPurchaseManager = draft.isCommonPurchaseManager,
            )
        }

        updateMember(
            mode = mode,
            target = member,
            onSuccessState = {
                it.copy(memberDraft = MemberDraft())
            },
            onSuccess = onSuccess,
        )
    }

    fun toggleAdmin(memberId: String) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canGrantAdminRole) {
            emitMessage(R.string.feedback_only_admin_edit_roles)
            return
        }

        val target = mode.members.firstOrNull { it.id == memberId } ?: return
        val updatedRoles = target.roles.toMutableSet().also { roles ->
            if (roles.contains(MemberRole.ADMIN)) {
                roles.remove(MemberRole.ADMIN)
            } else {
                roles.add(MemberRole.ADMIN)
            }
            if (roles.isEmpty()) {
                roles.add(MemberRole.MEMBER)
            }
        }

        val updated = target.copy(roles = updatedRoles)
        updateMember(mode, updated)
    }

    fun toggleActive(memberId: String) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageMembers) {
            emitMessage(R.string.feedback_only_admin_toggle_active)
            return
        }

        val target = mode.members.firstOrNull { it.id == memberId } ?: return
        val updated = target.copy(isActive = !target.isActive)
        updateMember(mode, updated)
    }

    fun refreshMembers() {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = MemberSessionContext.from(initialState, mode)
        scope.launch {
            try {
                val allMembers = memberRepository.getMembersVisibleTo(mode.member)
                currentCoroutineContext().ensureActive()
                var requiresDirectoryRefresh = false
                updateIfCurrent(context) { state ->
                    val currentMode = state.mode as SessionMode.Authorized
                    val refreshedMode = currentMode.copy(
                        authenticatedMember = allMembers.firstOrNull {
                            it.id == currentMode.authenticatedMember.id
                        } ?: currentMode.authenticatedMember,
                        member = allMembers.firstOrNull { it.id == currentMode.member.id }
                            ?: currentMode.member,
                        members = allMembers,
                    )
                    requiresDirectoryRefresh = currentMode.canExposePrivateMemberData() &&
                        !refreshedMode.canExposePrivateMemberData()
                    state.copy(
                        mode = refreshedMode.protectPrivateMemberData(),
                    )
                }
                if (requiresDirectoryRefresh) refreshMembers()
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                if (isCurrent(context)) {
                    emitMessage(R.string.feedback_unable_load_data)
                }
            }
        }
    }

    private fun updateMember(
        mode: SessionMode.Authorized,
        target: Member,
        onSuccessState: (SessionUiState) -> SessionUiState = { it },
        onSuccess: (String) -> Unit = {},
    ) {
        val context = MemberSessionContext.from(uiState.value, mode)
        scope.launch {
            val token = beginMemberMutation(context) ?: return@launch
            val updatedMember = try {
                upsertMemberByAdmin(actorAuthUid = mode.principal.uid, target = target)
                    .also { currentCoroutineContext().ensureActive() }
            } catch (cancellation: CancellationException) {
                finishMemberMutation(context, token)
                throw cancellation
            } catch (_: MemberManagementException.AccessDenied) {
                if (isCurrentMemberMutation(context, token)) {
                    emitMessage(R.string.feedback_only_admin_manage_members)
                }
                finishMemberMutation(context, token)
                return@launch
            } catch (_: MemberManagementException.LastAdminRemoval) {
                if (isCurrentMemberMutation(context, token)) {
                    emitMessage(R.string.feedback_cannot_remove_last_admin)
                }
                finishMemberMutation(context, token)
                return@launch
            } catch (_: MemberManagementException.Conflict) {
                if (isCurrentMemberMutation(context, token)) {
                    emitMessage(R.string.feedback_member_conflict)
                }
                finishMemberMutation(context, token)
                return@launch
            } catch (_: Exception) {
                if (isCurrentMemberMutation(context, token)) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
                finishMemberMutation(context, token)
                return@launch
            }
            if (!isCurrentMemberMutation(context, token)) return@launch
            var requiresDirectoryRefresh = false
            updateIfCurrent(context) { state ->
                val currentMode = state.mode as SessionMode.Authorized
                val locallyUpdatedMembers = buildList {
                    addAll(currentMode.members.map { member ->
                        if (member.id == updatedMember.id) updatedMember else member
                    })
                    if (none { it.id == updatedMember.id }) add(updatedMember)
                }.sortedBy { it.displayName.lowercase() }
                val updatedMode = currentMode.copy(
                    authenticatedMember = if (currentMode.authenticatedMember.id == updatedMember.id) {
                        updatedMember
                    } else {
                        currentMode.authenticatedMember
                    },
                    member = if (currentMode.member.id == updatedMember.id) {
                        updatedMember
                    } else {
                        currentMode.member
                    },
                    members = locallyUpdatedMembers,
                )
                requiresDirectoryRefresh = currentMode.canExposePrivateMemberData() &&
                    !updatedMode.canExposePrivateMemberData()
                onSuccessState(
                    state.copy(
                        mode = updatedMode.protectPrivateMemberData(),
                    ),
                )
            }
            finishMemberMutation(context, token)
            if (requiresDirectoryRefresh) refreshMembers()
            onSuccess(updatedMember.id)
        }
    }

    private fun isCurrent(
        context: MemberSessionContext,
        state: SessionUiState = uiState.value,
    ): Boolean {
        val currentMode = state.mode as? SessionMode.Authorized ?: return false
        return state.sessionEpoch == context.epoch &&
            currentMode.principal.uid == context.principalUid &&
            currentMode.member.id == context.memberId &&
            currentMode.member.roles == context.memberRoles &&
            currentMode.member.isActive == context.memberIsActive &&
            currentMode.authenticatedMember.id == context.authenticatedMemberId &&
            currentMode.authenticatedMember.authUid == context.authenticatedMemberAuthUid &&
            currentMode.authenticatedMember.roles == context.authenticatedMemberRoles &&
            currentMode.authenticatedMember.isActive == context.authenticatedMemberIsActive
    }

    private fun updateIfCurrent(
        context: MemberSessionContext,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrent(context)) return false
        var didUpdate = false
        uiState.update { state ->
            if (isCurrent(context, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun beginMemberMutation(context: MemberSessionContext): Long? {
        if (!isCurrent(context)) return null
        if (activeMemberMutation?.context == context) return null
        nextMemberMutationToken += 1
        val token = nextMemberMutationToken
        activeMemberMutation = ActiveMemberMutation(context, token)
        return token
    }

    private fun isCurrentMemberMutation(context: MemberSessionContext, token: Long): Boolean =
        activeMemberMutation == ActiveMemberMutation(context, token) && isCurrent(context)

    private fun finishMemberMutation(context: MemberSessionContext, token: Long) {
        if (activeMemberMutation == ActiveMemberMutation(context, token)) {
            activeMemberMutation = null
        }
    }

    private fun buildRoles(draft: MemberDraft): Set<MemberRole> {
        val roles = mutableSetOf<MemberRole>()
        if (draft.isMember) roles.add(MemberRole.MEMBER)
        if (draft.isProducer) roles.add(MemberRole.PRODUCER)
        if (draft.isAdmin) roles.add(MemberRole.ADMIN)
        return roles
    }

    private fun normalizeCompanyName(
        draft: MemberDraft,
        roles: Set<MemberRole>,
    ): String? {
        if (!roles.contains(MemberRole.PRODUCER)) {
            return null
        }
        return draft.companyName.trim().ifBlank { null }
    }

    private fun normalizePhoneNumber(draft: MemberDraft): String? {
        return draft.phoneNumber.trim().ifBlank { null }
    }
}

private data class MemberSessionContext(
    val epoch: Long,
    val principalUid: String,
    val memberId: String,
    val memberRoles: Set<MemberRole>,
    val memberIsActive: Boolean,
    val authenticatedMemberId: String,
    val authenticatedMemberAuthUid: String?,
    val authenticatedMemberRoles: Set<MemberRole>,
    val authenticatedMemberIsActive: Boolean,
) {
    companion object {
        fun from(state: SessionUiState, mode: SessionMode.Authorized) = MemberSessionContext(
            epoch = state.sessionEpoch,
            principalUid = mode.principal.uid,
            memberId = mode.member.id,
            memberRoles = mode.member.roles,
            memberIsActive = mode.member.isActive,
            authenticatedMemberId = mode.authenticatedMember.id,
            authenticatedMemberAuthUid = mode.authenticatedMember.authUid,
            authenticatedMemberRoles = mode.authenticatedMember.roles,
            authenticatedMemberIsActive = mode.authenticatedMember.isActive,
        )
    }
}

private data class ActiveMemberMutation(
    val context: MemberSessionContext,
    val token: Long,
)

private fun SessionMode.Authorized.canExposePrivateMemberData(): Boolean =
    member.canManageMembers &&
        authenticatedMember.canManageMembers &&
        authenticatedMember.authUid == principal.uid

private fun SessionMode.Authorized.protectPrivateMemberData(): SessionMode.Authorized {
    if (canExposePrivateMemberData()) return this
    val hasReciprocalAuthLink = authenticatedMember.authUid == principal.uid
    val publicAuthenticatedMember = if (hasReciprocalAuthLink) {
        authenticatedMember
    } else {
        authenticatedMember.publicDirectoryProjection()
    }
    val publicCurrentMember = if (member.id == authenticatedMember.id && hasReciprocalAuthLink) {
        publicAuthenticatedMember
    } else {
        member.publicDirectoryProjection()
    }
    return copy(
        authenticatedMember = publicAuthenticatedMember,
        member = publicCurrentMember,
        members = members.map { candidate ->
            if (candidate.id == authenticatedMember.id && hasReciprocalAuthLink) {
                publicAuthenticatedMember
            } else {
                candidate.publicDirectoryProjection()
            }
        },
    )
}

private fun Member.publicDirectoryProjection(): Member = copy(
    phoneNumber = null,
    normalizedEmail = "",
    authUid = null,
)
