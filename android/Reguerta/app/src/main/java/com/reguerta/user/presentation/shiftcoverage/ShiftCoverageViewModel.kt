package com.reguerta.user.presentation.shiftcoverage

import androidx.annotation.MainThread
import androidx.lifecycle.ViewModel
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministration
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministrationCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageRepository
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal data class ShiftCoverageState(
    val session: ShiftCoverageSession? = null,
    val snapshot: ShiftCoverageSnapshot? = null,
    val pendingCommand: ShiftCoverageCommand? = null,
    val administration: ShiftCoverageAdministration? = null,
    val pendingAdministration: ShiftCoverageAdministrationCommand? = null,
    val isAdministration: Boolean = false,
    val failure: ShiftCoverageFailure? = null,
    val isBusy: Boolean = false,
) {
    val hasPendingMutation: Boolean get() = pendingCommand != null || pendingAdministration != null
}

/** Caller owns structured coroutines. All entry points and state changes belong to the UI dispatcher. */
@MainThread
internal class ShiftCoverageViewModel(private val repository: ShiftCoverageRepository) : ViewModel() {
    private val mutableState = MutableStateFlow(ShiftCoverageState())
    val state = mutableState.asStateFlow()
    private var detailEventId: String? = null
    private var overviewRequested = false
    private var generation = 0L
    private var receivedAtNanos = System.nanoTime()

    val nowMillis: Long
        get() = (state.value.administration?.serverTimeMillis ?: state.value.snapshot?.serverTimeMillis ?: 0) + (System.nanoTime() - receivedAtNanos) / 1_000_000

    fun bind(session: ShiftCoverageSession?) {
        if (state.value.session == session) return
        generation++
        detailEventId = null
        overviewRequested = false
        mutableState.value = ShiftCoverageState(session = session)
    }

    suspend fun refresh() {
        if (state.value.isAdministration) loadAdministration() else load(detailEventId)
    }

    suspend fun openAdministration() {
        if (state.value.isBusy || state.value.hasPendingMutation || state.value.snapshot?.isAdmin != true) return
        mutableState.value = state.value.copy(isAdministration = true)
        detailEventId = null
        loadAdministration()
    }

    suspend fun refreshOverview() {
        overviewRequested = true
        if (state.value.isBusy) return
        overviewRequested = false
        detailEventId = null
        mutableState.value = state.value.copy(isAdministration = false, administration = null)
        load(null)
    }

    suspend fun openNotification(eventId: String): String? {
        if (state.value.hasPendingMutation || state.value.isAdministration) return null
        return load(eventId)
    }

    private suspend fun load(eventId: String?): String? {
        val session = state.value.session ?: return null
        if (state.value.isBusy) return null
        val owner = generation
        mutableState.value = state.value.copy(isBusy = true, snapshot = null, failure = null)
        var selectedCaseId: String? = null
        try {
            val result = if (eventId == null) repository.read(null, session) else repository.readNotification(eventId, session)
            if (owner != generation) return null
            currentCoroutineContext().ensureActive()
            receivedAtNanos = System.nanoTime()
            mutableState.value = state.value.copy(snapshot = result)
            detailEventId = eventId
            selectedCaseId = result.notification?.caseId
        } catch (error: Exception) {
            if (owner == generation) record(error)
        } finally {
            if (owner == generation) mutableState.value = state.value.copy(isBusy = false)
        }
        if (owner != generation) return null
        if (overviewRequested) {
            refreshOverview()
            return null
        }
        return selectedCaseId
    }

    suspend fun submit(command: ShiftCoverageCommand) {
        val current = state.value
        val session = current.session ?: return
        if (current.isBusy || current.snapshot == null || current.hasPendingMutation || current.isAdministration) return
        mutableState.value = current.copy(pendingCommand = command)
        executePending(session)
    }

    suspend fun retryPending() {
        val current = state.value
        val session = current.session ?: return
        if (current.isBusy || !current.hasPendingMutation) return
        if (current.pendingAdministration != null) executePendingAdministration(session) else executePending(session)
    }

    private suspend fun executePending(session: ShiftCoverageSession) {
        val command = state.value.pendingCommand ?: return
        val owner = generation
        mutableState.value = state.value.copy(isBusy = true, snapshot = null, failure = null)
        try {
            repository.execute(command, session)
            if (owner != generation) return
            // A read-back failure cannot turn an acknowledged command back into an uncertain write.
            mutableState.value = state.value.copy(pendingCommand = null)
            currentCoroutineContext().ensureActive()
            val eventId = detailEventId
            val result = if (eventId == null) repository.read(null, session) else repository.readNotification(eventId, session)
            if (owner != generation) return
            currentCoroutineContext().ensureActive()
            receivedAtNanos = System.nanoTime()
            mutableState.value = state.value.copy(snapshot = result)
        } catch (error: Exception) {
            if (owner != generation) return
            if (error is ShiftCoverageFailure.Rejected && error.status in listOf(400, 401, 403, 409)) {
                mutableState.value = state.value.copy(pendingCommand = null)
            }
            record(error)
        } finally {
            if (owner == generation) mutableState.value = state.value.copy(isBusy = false)
        }
        if (owner == generation && overviewRequested) refreshOverview()
    }
    private suspend fun loadAdministration() {
        val session = state.value.session ?: return
        if (state.value.isBusy) return
        val owner = generation
        mutableState.value = state.value.copy(isBusy = true, administration = null, snapshot = null, failure = null)
        try {
            val result = repository.readAdministration(session)
            if (owner != generation) return
            currentCoroutineContext().ensureActive()
            receivedAtNanos = System.nanoTime()
            mutableState.value = state.value.copy(administration = result)
        } catch (error: Exception) {
            if (owner == generation) record(error)
        } finally {
            if (owner == generation) mutableState.value = state.value.copy(isBusy = false)
        }
        if (owner == generation && overviewRequested) refreshOverview()
    }

    suspend fun submitAdministration(command: ShiftCoverageAdministrationCommand) {
        val current = state.value
        val session = current.session ?: return
        val snapshot = current.administration ?: return
        if (current.isBusy || current.hasPendingMutation || !current.isAdministration || !snapshot.isAdmin) return
        val allowed = when (command.action) {
            ShiftCoverageAdministrationCommand.Action.reconcileMembership -> snapshot.membershipWritable &&
                snapshot.members.any { it.userId == command.userId && it.membershipRevision == command.expectedRevision &&
                    it.contextDigest == command.expectedContextDigest && (command.permanentDepartureReason == null ||
                    it.allowsPermanentDeparture) }
            ShiftCoverageAdministrationCommand.Action.authorizeDeliverySpacingException -> snapshot.spacingCandidates.any {
                it.id == command.proposalId && it.userId == command.userId && it.contextDigest == command.expectedContextDigest &&
                    it.planningRequestId == command.planningRequestId && it.previousDate == command.previousDate &&
                    it.previousRoundNumber == command.previousRoundNumber && it.date == command.date && it.roundNumber == command.roundNumber
            }
        }
        if (!allowed) return
        mutableState.value = current.copy(pendingAdministration = command)
        executePendingAdministration(session)
    }

    private suspend fun executePendingAdministration(session: ShiftCoverageSession) {
        val command = state.value.pendingAdministration ?: return
        val owner = generation
        mutableState.value = state.value.copy(isBusy = true, snapshot = null, administration = null, failure = null)
        try {
            repository.executeAdministration(command, session)
            if (owner != generation) return
            // The acknowledged write is never replayed because a subsequent read failed.
            mutableState.value = state.value.copy(pendingAdministration = null)
            currentCoroutineContext().ensureActive()
            val overview = repository.read(null, session)
            if (owner != generation) return
            currentCoroutineContext().ensureActive()
            val administration = repository.readAdministration(session)
            if (owner != generation) return
            currentCoroutineContext().ensureActive()
            receivedAtNanos = System.nanoTime()
            mutableState.value = state.value.copy(snapshot = overview, administration = administration)
        } catch (error: Exception) {
            if (owner != generation) return
            if (error is ShiftCoverageFailure.Rejected && error.status in listOf(400, 401, 403, 409)) {
                mutableState.value = state.value.copy(pendingAdministration = null)
            }
            record(error)
        } finally {
            if (owner == generation) mutableState.value = state.value.copy(isBusy = false)
        }
        if (owner == generation && overviewRequested) refreshOverview()
    }

    private fun record(error: Exception) {
        val failure = error as? ShiftCoverageFailure ?: ShiftCoverageFailure.Unavailable
        if (failure == ShiftCoverageFailure.SessionChanged ||
            failure is ShiftCoverageFailure.Rejected && failure.status in listOf(401, 403)
        ) {
            bind(null)
        }
        mutableState.value = state.value.copy(failure = failure)
    }
}
