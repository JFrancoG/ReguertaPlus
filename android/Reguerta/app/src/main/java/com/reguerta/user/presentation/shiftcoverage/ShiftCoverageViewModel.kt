package com.reguerta.user.presentation.shiftcoverage

import androidx.annotation.MainThread
import androidx.lifecycle.ViewModel
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
    val failure: ShiftCoverageFailure? = null,
    val isBusy: Boolean = false,
)

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
        get() = (state.value.snapshot?.serverTimeMillis ?: 0) + (System.nanoTime() - receivedAtNanos) / 1_000_000

    fun bind(session: ShiftCoverageSession?) {
        if (state.value.session == session) return
        generation++
        detailEventId = null
        overviewRequested = false
        mutableState.value = ShiftCoverageState(session = session)
    }

    suspend fun refresh() { load(detailEventId) }

    suspend fun refreshOverview() {
        overviewRequested = true
        if (state.value.isBusy) return
        overviewRequested = false
        detailEventId = null
        load(null)
    }

    suspend fun openNotification(eventId: String): String? {
        if (state.value.pendingCommand != null) return null
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
        if (current.isBusy || current.snapshot == null || current.pendingCommand != null) return
        mutableState.value = current.copy(pendingCommand = command)
        executePending(session)
    }

    suspend fun retryPending() {
        val current = state.value
        val session = current.session ?: return
        if (current.isBusy || current.pendingCommand == null) return
        executePending(session)
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
