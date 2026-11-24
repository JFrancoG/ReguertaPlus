package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.reguerta.user.domain.notifications.ShiftNotificationPushReference
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageRepository
import kotlinx.coroutines.CoroutineScope
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministration
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException

internal open class CoverageRouteViewModel(
    private val repository: ShiftCoverageRepository,
    private val externalScope: CoroutineScope? = null,
) : ViewModel() {
    protected val routeScope: CoroutineScope get() = externalScope ?: viewModelScope
    open val isRehearsal: Boolean get() = false
    protected open val authenticationInFlight: Boolean get() = false
    private var boundSession: ShiftCoverageSession? = null
    val coverage = ShiftCoverageViewModel(repository)
    var selectedCaseId by mutableStateOf<String?>(null)
    var draft by mutableStateOf<CoverageCommandDraft?>(null)
        private set
    var administrationDraft by mutableStateOf<CoverageAdministrationDraft?>(null)
        private set
    private var draftSession: ShiftCoverageSession? = null
    private var revision = 0L
    private var availabilityRevision = 0L
    var isAvailable by mutableStateOf(false)
        private set
    fun isAvailableFor(session: ShiftCoverageSession?): Boolean = session != null && isAvailable &&
        session == boundSession && coverage.state.value.session == session
    var pendingPushEventId by mutableStateOf<String?>(null)
        private set
    fun bindSession(session: ShiftCoverageSession?, preservePendingPush: Boolean = false) {
        if (session != null && boundSession == session && coverage.state.value.session == session) return
        revision++
        boundSession = session
        if (!preservePendingPush) pendingPushEventId = null
        selectedCaseId = null
        draft = null
        administrationDraft = null
        draftSession = null
        coverage.bind(session)
        refreshAvailability()
    }

    fun refreshAvailability() {
        val owner = ++availabilityRevision
        isAvailable = false
        val session = boundSession ?: return
        if (isRehearsal) return
        routeScope.launch {
            val enabled = try { repository.resolveAccess(session).enabled }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                if (owner == availabilityRevision && (error == ShiftCoverageFailure.SessionChanged ||
                    error is ShiftCoverageFailure.Rejected && error.status in listOf(401, 403))) bindSession(null)
                false
            }
            if (owner == availabilityRevision && boundSession == session && coverage.state.value.session == session) {
                isAvailable = enabled
            }
        }
    }

    val canOpen: Boolean get() = !coverage.state.value.isBusy && !coverage.state.value.hasPendingMutation &&
        !coverage.state.value.isAdministration &&
        coverage.state.value.snapshot?.availableShifts?.any { it.writable } == true

    fun present(action: ShiftCoverageCommand.Action, item: ShiftCoverageSnapshot.Case? = null) {
        if (coverage.state.value.isBusy || coverage.state.value.hasPendingMutation || administrationDraft != null) return
        val snapshot = coverage.state.value.snapshot ?: return
        draftSession = coverage.state.value.session
        draft = CoverageCommandDraft(action, item, snapshot, coverage.nowMillis)
    }

    fun dismissDraft() { draft = null }
    fun canConfirmDraft(now: Long = coverage.nowMillis): Boolean {
        val command = draft?.command ?: return false
        val state = coverage.state.value
        val snapshot = state.snapshot ?: return false
        if (draftSession != state.session || state.isBusy || state.hasPendingMutation ||
            command.environment != snapshot.environment || command.expectedPolicyRevision != snapshot.policyRevision) return false
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
        routeScope.launch { coverage.submit(command) }
    }

    fun openAdministration() {
        if (draft != null || administrationDraft != null) return
        selectedCaseId = null
        routeScope.launch { coverage.openAdministration() }
    }

    fun presentMembership(member: ShiftCoverageAdministration.Member, permanentDeparture: Boolean = false) {
        presentAdministration(CoverageAdministrationDraft(member = member, permanentDeparture = permanentDeparture,
            environment = coverage.state.value.administration?.environment ?: "develop",
            expectedPolicyRevision = coverage.state.value.administration?.policyRevision))
    }

    fun presentSpacing(candidate: ShiftCoverageAdministration.SpacingCandidate) {
        presentAdministration(CoverageAdministrationDraft(spacing = candidate,
            environment = coverage.state.value.administration?.environment ?: "develop",
            expectedPolicyRevision = coverage.state.value.administration?.policyRevision))
    }

    private fun presentAdministration(value: CoverageAdministrationDraft) {
        val state = coverage.state.value
        val snapshot = state.administration ?: return
        if (state.isBusy || state.hasPendingMutation || draft != null || administrationDraft != null ||
            !state.isAdministration || !snapshot.isAdmin) return
        if (value.member != null && (!snapshot.membershipWritable || value.member !in snapshot.members)) return
        if (value.spacing != null && value.spacing !in snapshot.spacingCandidates) return
        draftSession = state.session
        administrationDraft = value
    }

    fun dismissAdministrationDraft() { administrationDraft = null }

    fun discardDraftsAfterSessionChange() {
        selectedCaseId = null
        if (draftSession != coverage.state.value.session) {
            draft = null
            administrationDraft = null
            draftSession = null
        }
    }

    fun canConfirmAdministrationDraft(now: Long = coverage.nowMillis): Boolean {
        val state = coverage.state.value
        val snapshot = state.administration ?: return false
        return draftSession == state.session && !state.isBusy && !state.hasPendingMutation && state.isAdministration &&
            administrationDraft?.isCurrent(snapshot, now) == true
    }

    fun confirmAdministrationDraft() {
        if (!canConfirmAdministrationDraft()) return
        val command = administrationDraft?.command ?: return
        administrationDraft = null
        routeScope.launch { coverage.submitAdministration(command) }
    }
    fun acceptPush(reference: ShiftNotificationPushReference) {
        if (reference.isCoverage) pendingPushEventId = reference.eventId
    }

    val readyPushEventId: String? get() {
        val state = coverage.state.value
        return pendingPushEventId.takeIf {
            state.session != null && !authenticationInFlight && !state.isBusy && !state.hasPendingMutation && draft == null &&
                administrationDraft == null && !state.isAdministration
        }
    }

    fun openPendingPush() {
        val eventId = readyPushEventId ?: return
        pendingPushEventId = null
        openNotification(eventId)
    }

    fun openNotification(eventId: String) {
        if (draft != null || administrationDraft != null || coverage.state.value.hasPendingMutation) return
        selectedCaseId = null
        val owner = revision
        routeScope.launch {
            if (owner != revision) return@launch
            coverage.openNotification(eventId)?.let { selectedCaseId = it }
        }
    }

    fun showOverview() {
        selectedCaseId = null
        routeScope.launch { coverage.refreshOverview() }
    }

    fun refresh() {
        if (coverage.state.value.session == null) boundSession?.let(coverage::bind)
        routeScope.launch { coverage.refresh() }
    }
    fun retryPending() { routeScope.launch { coverage.retryPending() } }

    override fun onCleared() { bindSession(null) }
}
