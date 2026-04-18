package com.reguerta.user.presentation.access

import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberManagementException
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.access.canGrantAdminRole
import com.reguerta.user.domain.access.canManageMembers
import kotlinx.coroutines.CoroutineScope
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
    fun createAuthorizedMember() {
        saveMemberDraft(editingMemberId = null)
    }

    fun saveMemberDraft(
        editingMemberId: String?,
        onSuccess: () -> Unit = {},
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
            val memberId = buildMemberId(normalizedEmail)
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
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            val allMembers = memberRepository.getAllMembers()
            val refreshedCurrentMember = allMembers.firstOrNull { it.id == mode.member.id } ?: mode.member
            val refreshedAuthenticatedMember = allMembers.firstOrNull { it.id == mode.authenticatedMember.id }
                ?: mode.authenticatedMember
            uiState.update {
                it.copy(
                    mode = SessionMode.Authorized(
                        principal = mode.principal,
                        authenticatedMember = refreshedAuthenticatedMember,
                        member = refreshedCurrentMember,
                        members = allMembers,
                    ),
                )
            }
        }
    }

    private fun updateMember(
        mode: SessionMode.Authorized,
        target: Member,
        onSuccessState: (SessionUiState) -> SessionUiState = { it },
        onSuccess: () -> Unit = {},
    ) {
        scope.launch {
            val updatedMember = try {
                upsertMemberByAdmin(actorAuthUid = mode.principal.uid, target = target)
            } catch (_: MemberManagementException.AccessDenied) {
                emitMessage(R.string.feedback_only_admin_manage_members)
                return@launch
            } catch (_: MemberManagementException.LastAdminRemoval) {
                emitMessage(R.string.feedback_cannot_remove_last_admin)
                return@launch
            } catch (_: Exception) {
                emitMessage(R.string.feedback_unable_save_changes)
                return@launch
            }

            val allMembers = memberRepository.getAllMembers()
            val refreshedCurrentMember = if (mode.member.id == updatedMember.id) {
                updatedMember
            } else {
                mode.member
            }
            val refreshedAuthenticatedMember = if (mode.authenticatedMember.id == updatedMember.id) {
                updatedMember
            } else {
                mode.authenticatedMember
            }

            uiState.update {
                onSuccessState(
                    it.copy(
                        mode = SessionMode.Authorized(
                            principal = mode.principal,
                            authenticatedMember = refreshedAuthenticatedMember,
                            member = refreshedCurrentMember,
                            members = allMembers,
                        ),
                    ),
                )
            }
            onSuccess()
        }
    }

    private fun buildRoles(draft: MemberDraft): Set<MemberRole> {
        val roles = mutableSetOf<MemberRole>()
        if (draft.isMember) roles.add(MemberRole.MEMBER)
        if (draft.isProducer) roles.add(MemberRole.PRODUCER)
        if (draft.isAdmin) roles.add(MemberRole.ADMIN)
        return roles
    }

    private fun buildMemberId(normalizedEmail: String): String {
        val suffix = normalizedEmail.replace("[^a-z0-9]+".toRegex(), "_").trim('_').ifBlank { "member" }
        return "member_${suffix.take(40)}"
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
