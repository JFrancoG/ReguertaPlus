package com.reguerta.user.presentation.access

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.reguerta.user.R
import com.reguerta.user.domain.access.AccessResolutionResult
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.AuthSessionProvider
import com.reguerta.user.domain.access.AuthSignInFailureReason
import com.reguerta.user.domain.access.AuthSignInResult
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberManagementException
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.UnauthorizedReason
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
        val reason: UnauthorizedReason,
    ) : SessionMode
}

data class SessionUiState(
    val emailInput: String = "",
    val passwordInput: String = "",
    @param:StringRes val emailErrorRes: Int? = null,
    @param:StringRes val passwordErrorRes: Int? = null,
    val isAuthenticating: Boolean = false,
    val mode: SessionMode = SessionMode.SignedOut,
    val memberDraft: MemberDraft = MemberDraft(),
)

sealed interface SessionUiEvent {
    data class ShowMessage(@param:StringRes val messageRes: Int) : SessionUiEvent
}

class SessionViewModel(
    private val repository: MemberRepository,
    private val authSessionProvider: AuthSessionProvider,
    private val resolveAuthorizedSession: ResolveAuthorizedSessionUseCase,
    private val upsertMemberByAdmin: UpsertMemberByAdminUseCase,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SessionUiState())
    val uiState: StateFlow<SessionUiState> = _uiState.asStateFlow()

    private val _uiEvents = MutableSharedFlow<SessionUiEvent>(replay = 0)
    val uiEvents: SharedFlow<SessionUiEvent> = _uiEvents.asSharedFlow()

    fun onEmailChanged(value: String) {
        _uiState.update { it.copy(emailInput = value, emailErrorRes = null) }
    }

    fun onPasswordChanged(value: String) {
        _uiState.update { it.copy(passwordInput = value, passwordErrorRes = null) }
    }

    fun signIn() {
        val currentState = _uiState.value
        val email = currentState.emailInput.trim()
        val password = currentState.passwordInput

        val emailErrorRes = when {
            email.isBlank() -> R.string.feedback_email_required
            !email.matches(EmailPatternRegex) -> R.string.feedback_email_invalid
            else -> null
        }
        val passwordErrorRes = if (password.isBlank()) R.string.feedback_password_required else null

        if (emailErrorRes != null || passwordErrorRes != null) {
            _uiState.update {
                it.copy(
                    emailErrorRes = emailErrorRes,
                    passwordErrorRes = passwordErrorRes,
                )
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isAuthenticating = true, emailErrorRes = null, passwordErrorRes = null) }

            when (val authResult = authSessionProvider.signIn(email = email, password = password)) {
                is AuthSignInResult.Success -> {
                    when (val result = resolveAuthorizedSession(authResult.principal)) {
                        is AccessResolutionResult.Authorized -> {
                            val members = repository.getAllMembers()
                            _uiState.update {
                                it.copy(
                                    isAuthenticating = false,
                                    mode = SessionMode.Authorized(
                                        principal = authResult.principal,
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
                                        email = authResult.principal.email,
                                        reason = result.reason,
                                    ),
                                )
                            }
                        }
                    }
                }

                is AuthSignInResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isAuthenticating = false,
                            emailErrorRes = authResult.reason.emailErrorRes(),
                            passwordErrorRes = authResult.reason.passwordErrorRes(),
                        )
                    }

                    authResult.reason.globalMessageResOrNull()?.let(::emitMessage)
                }
            }
        }
    }

    fun signOut() {
        authSessionProvider.signOut()
        _uiState.update {
            it.copy(
                mode = SessionMode.SignedOut,
                passwordInput = "",
                emailErrorRes = null,
                passwordErrorRes = null,
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
            emitMessage(R.string.feedback_only_admin_create)
            return
        }

        val draft = _uiState.value.memberDraft
        if (draft.displayName.isBlank() || draft.email.isBlank()) {
            emitMessage(R.string.feedback_display_name_email_required)
            return
        }

        val normalizedEmail = draft.email.trim().lowercase()
        val allMembers = mode.members
        val memberId = buildMemberId(normalizedEmail)
        if (allMembers.any { it.id == memberId || it.normalizedEmail == normalizedEmail }) {
            emitMessage(R.string.feedback_member_exists)
            return
        }

        val roles = buildRoles(draft)
        if (roles.isEmpty()) {
            emitMessage(R.string.feedback_select_role)
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
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_toggle_active)
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
                emitMessage(R.string.feedback_only_admin_manage_members)
                return@launch
            } catch (_: MemberManagementException.LastAdminRemoval) {
                emitMessage(R.string.feedback_cannot_remove_last_admin)
                return@launch
            } catch (_: Exception) {
                emitMessage(R.string.feedback_unable_save_changes)
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

    private fun emitMessage(@StringRes messageRes: Int) {
        viewModelScope.launch {
            _uiEvents.emit(SessionUiEvent.ShowMessage(messageRes))
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

private val EmailPatternRegex = "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$".toRegex(setOf(RegexOption.IGNORE_CASE))

@StringRes
private fun AuthSignInFailureReason.emailErrorRes(): Int? =
    when (this) {
        AuthSignInFailureReason.INVALID_EMAIL -> R.string.feedback_email_invalid
        AuthSignInFailureReason.USER_NOT_FOUND -> R.string.auth_error_user_not_found
        AuthSignInFailureReason.USER_DISABLED -> R.string.auth_error_user_disabled
        else -> null
    }

@StringRes
private fun AuthSignInFailureReason.passwordErrorRes(): Int? =
    when (this) {
        AuthSignInFailureReason.INVALID_CREDENTIALS -> R.string.auth_error_invalid_credentials
        else -> null
    }

@StringRes
private fun AuthSignInFailureReason.globalMessageResOrNull(): Int? =
    when (this) {
        AuthSignInFailureReason.TOO_MANY_REQUESTS -> R.string.auth_error_too_many_requests
        AuthSignInFailureReason.NETWORK -> R.string.auth_error_network
        AuthSignInFailureReason.UNKNOWN -> R.string.auth_error_unknown
        else -> null
    }
