package com.reguerta.user.presentation.access

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.reguerta.user.domain.access.AccessResolutionResult
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberManagementException
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MemberDraft(
    val displayName: String = "",
    val email: String = "",
    val isMember: Boolean = true,
    val isProducer: Boolean = false,
    val isAdmin: Boolean = false,
    val isActive: Boolean = true,
)

sealed interface SessionMode {
    data object SignedOut : SessionMode

    data class Authorized(
        val principal: AuthPrincipal,
        val member: Member,
        val members: List<Member>,
    ) : SessionMode

    data class Unauthorized(
        val email: String,
        val message: String,
    ) : SessionMode
}

data class SessionUiState(
    val emailInput: String = "",
    val uidInput: String = "",
    val isAuthenticating: Boolean = false,
    val mode: SessionMode = SessionMode.SignedOut,
    val memberDraft: MemberDraft = MemberDraft(),
)

sealed interface SessionUiEvent {
    data class ShowMessage(val message: String) : SessionUiEvent
}

class SessionViewModel(
    private val repository: MemberRepository,
    private val resolveAuthorizedSession: ResolveAuthorizedSessionUseCase,
    private val upsertMemberByAdmin: UpsertMemberByAdminUseCase,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SessionUiState())
    val uiState: StateFlow<SessionUiState> = _uiState.asStateFlow()

    private val _uiEvents = MutableSharedFlow<SessionUiEvent>(replay = 0)
    val uiEvents: SharedFlow<SessionUiEvent> = _uiEvents.asSharedFlow()

    fun onEmailChanged(value: String) {
        _uiState.update { it.copy(emailInput = value) }
    }

    fun onUidChanged(value: String) {
        _uiState.update { it.copy(uidInput = value) }
    }

    fun signIn() {
        val currentState = _uiState.value
        val email = currentState.emailInput.trim()
        val uid = currentState.uidInput.trim()

        if (email.isBlank() || uid.isBlank()) {
            emitMessage("Email and UID are required")
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isAuthenticating = true) }

            when (val result = resolveAuthorizedSession(AuthPrincipal(uid = uid, email = email))) {
                is AccessResolutionResult.Authorized -> {
                    val members = repository.getAllMembers()
                    _uiState.update {
                        it.copy(
                            isAuthenticating = false,
                            mode = SessionMode.Authorized(
                                principal = AuthPrincipal(uid = uid, email = email),
                                member = result.member,
                                members = members,
                            ),
                        )
                    }
                }

                is AccessResolutionResult.Unauthorized -> {
                    _uiState.update {
                        it.copy(
                            isAuthenticating = false,
                            mode = SessionMode.Unauthorized(
                                email = email,
                                message = result.message,
                            ),
                        )
                    }
                }
            }
        }
    }

    fun signOut() {
        _uiState.update {
            it.copy(
                mode = SessionMode.SignedOut,
                uidInput = "",
                memberDraft = MemberDraft(),
            )
        }
    }

    fun onMemberDraftChanged(newDraft: MemberDraft) {
        _uiState.update { it.copy(memberDraft = newDraft) }
    }

    fun createAuthorizedMember() {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage("Only admins can create members")
            return
        }

        val draft = _uiState.value.memberDraft
        if (draft.displayName.isBlank() || draft.email.isBlank()) {
            emitMessage("Display name and email are required")
            return
        }

        val normalizedEmail = draft.email.trim().lowercase()
        val allMembers = mode.members
        val memberId = buildMemberId(normalizedEmail)
        if (allMembers.any { it.id == memberId || it.normalizedEmail == normalizedEmail }) {
            emitMessage("Member already exists")
            return
        }

        val roles = buildRoles(draft)
        if (roles.isEmpty()) {
            emitMessage("Select at least one role")
            return
        }

        val member = Member(
            id = memberId,
            displayName = draft.displayName.trim(),
            normalizedEmail = normalizedEmail,
            authUid = null,
            roles = roles,
            isActive = draft.isActive,
            producerCatalogEnabled = true,
        )

        updateMember(mode, member) {
            it.copy(memberDraft = MemberDraft())
        }
    }

    fun toggleAdmin(memberId: String) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage("Only admins can edit roles")
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
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage("Only admins can activate or deactivate")
            return
        }

        val target = mode.members.firstOrNull { it.id == memberId } ?: return
        val updated = target.copy(isActive = !target.isActive)
        updateMember(mode, updated)
    }

    private fun updateMember(
        mode: SessionMode.Authorized,
        target: Member,
        onSuccessState: (SessionUiState) -> SessionUiState = { it },
    ) {
        viewModelScope.launch {
            val updatedMember = try {
                upsertMemberByAdmin(actorAuthUid = mode.principal.uid, target = target)
            } catch (_: MemberManagementException.AccessDenied) {
                emitMessage("Only admins can manage members")
                return@launch
            } catch (_: MemberManagementException.LastAdminRemoval) {
                emitMessage("Cannot leave the app without active admins")
                return@launch
            }

            val allMembers = repository.getAllMembers()
            val refreshedCurrentMember = if (mode.member.id == updatedMember.id) {
                updatedMember
            } else {
                mode.member
            }

            _uiState.update {
                onSuccessState(
                    it.copy(
                        mode = SessionMode.Authorized(
                            principal = mode.principal,
                            member = refreshedCurrentMember,
                            members = allMembers,
                        ),
                    ),
                )
            }
        }
    }

    private fun emitMessage(message: String) {
        viewModelScope.launch {
            _uiEvents.emit(SessionUiEvent.ShowMessage(message))
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
}
