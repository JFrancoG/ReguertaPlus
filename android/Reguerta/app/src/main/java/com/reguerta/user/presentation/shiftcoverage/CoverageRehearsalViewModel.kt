package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.reguerta.user.domain.shiftcoverage.CoverageRehearsalAccess
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import kotlinx.coroutines.launch

internal class CoverageRehearsalViewModel(private val access: CoverageRehearsalAccess) : ViewModel() {
    val coverage = ShiftCoverageViewModel(access.repository)
    var selectedCaseId by mutableStateOf<String?>(null)
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var isSigningIn by mutableStateOf(false)
        private set
    var loginFailed by mutableStateOf(false)
        private set
    var draft by mutableStateOf<CoverageCommandDraft?>(null)
        private set
    private var draftSession: ShiftCoverageSession? = null
    private var revision = 0L
    val canSignIn: Boolean get() = !isSigningIn && email.isNotBlank() && password.isNotEmpty()

    fun signIn() {
        if (!canSignIn) return
        revision++
        val owner = revision
        val secret = password
        password = ""
        isSigningIn = true
        loginFailed = false
        viewModelScope.launch {
            try {
                val session = access.signIn(email.trim(), secret)
                if (revision != owner) return@launch
                coverage.bind(session)
                coverage.refresh()
            } catch (_: Exception) {
                if (revision == owner) loginFailed = true
            } finally {
                if (revision == owner) isSigningIn = false
            }
        }
    }

    fun signOut() {
        revision++
        access.signOut()
        coverage.bind(null)
        selectedCaseId = null
        password = ""
        draft = null
        isSigningIn = false
        loginFailed = false
    }

    val canOpen: Boolean get() = !coverage.state.value.isBusy && coverage.state.value.pendingCommand == null &&
        coverage.state.value.snapshot?.availableShifts?.any { it.writable } == true

    fun present(action: ShiftCoverageCommand.Action, item: ShiftCoverageSnapshot.Case? = null) {
        if (coverage.state.value.isBusy || coverage.state.value.pendingCommand != null) return
        val snapshot = coverage.state.value.snapshot ?: return
        draftSession = coverage.state.value.session
        draft = CoverageCommandDraft(action, item, snapshot, coverage.nowMillis)
    }

    fun dismissDraft() { draft = null }
    fun canConfirmDraft(now: Long = coverage.nowMillis): Boolean {
        val command = draft?.command ?: return false
        val state = coverage.state.value
        val snapshot = state.snapshot ?: return false
        if (draftSession != state.session || state.isBusy || state.pendingCommand != null) return false
        if (command.expiresAtMillis?.let { it <= now } == true) return false
        if (command.action == ShiftCoverageCommand.Action.open) {
            return snapshot.availableShifts.any { it.shiftId == command.shiftId &&
                it.shiftRevision == command.expectedShiftRevision && it.writable && it.scheduledAtMillis > now }
        }
        val item = snapshot.cases.firstOrNull { it.caseId == command.caseId } ?: return false
        return item.revision == command.expectedRevision && item.shiftRevision == command.expectedShiftRevision &&
            coverage.actions(item).contains(command.action)
    }

    fun confirmDraft() {
        if (!canConfirmDraft()) return
        val command = draft?.command ?: return
        draft = null
        viewModelScope.launch { coverage.submit(command) }
    }
    fun openNotification(eventId: String) {
        if (draft != null) return
        selectedCaseId = null
        viewModelScope.launch {
            coverage.openNotification(eventId)?.let { selectedCaseId = it }
        }
    }

    fun showOverview() {
        selectedCaseId = null
        viewModelScope.launch { coverage.refreshOverview() }
    }

    fun refresh() { viewModelScope.launch { coverage.refresh() } }
    fun retryPending() { viewModelScope.launch { coverage.retryPending() } }

    override fun onCleared() {
        signOut()
    }
}
