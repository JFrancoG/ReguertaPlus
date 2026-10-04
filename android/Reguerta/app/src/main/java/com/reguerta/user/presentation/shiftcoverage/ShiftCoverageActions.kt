package com.reguerta.user.presentation.shiftcoverage

import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand.Action
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot.Phase
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot.Status

internal fun ShiftCoverageViewModel.actions(item: ShiftCoverageSnapshot.Case): List<Action> {
    val current = state.value
    val snapshot = current.snapshot ?: return emptyList()
    if (current.isBusy || current.pendingCommand != null || !item.writable) return emptyList()
    val actions = mutableListOf<Action>()
    val now = nowMillis
    if (item.status == Status.offered && item.offer?.userId == snapshot.memberId && now < item.offer.expiresAtMillis) {
        actions += listOf(Action.accept, Action.decline)
    }
    if (item.status == Status.open && item.selectionPhase == Phase.volunteers &&
        now < (item.volunteerClosesAtMillis ?: Long.MIN_VALUE) && snapshot.eligible
    ) {
        if (item.volunteered) actions += Action.withdrawVolunteer
        else if (!item.hasVolunteered) actions += Action.volunteer
    }
    if (snapshot.isAdmin) {
        when (item.status) {
            Status.open -> when (item.selectionPhase) {
                null -> {
                    if (item.revision == 1L && snapshot.policy.volunteerWindowMillis != null) actions += Action.startSelection
                    actions += Action.offer
                }
                Phase.reserve, Phase.draw -> actions += Action.offerNext
                Phase.volunteers -> if (now >= (item.volunteerClosesAtMillis ?: Long.MAX_VALUE)) actions += Action.offerNext
                Phase.drawRequired -> if (snapshot.policy.drawAvailable) {
                    if (!item.drawCommitted) actions += Action.commitDraw
                    else if (now >= (item.drawAvailableAtMillis ?: Long.MAX_VALUE)) actions += Action.revealDraw
                }
                Phase.adminRequired -> actions += Action.offerAdmin
            }
            Status.offered -> if (now >= (item.offer?.expiresAtMillis ?: Long.MAX_VALUE)) actions += Action.expire
            Status.accepted -> {
                if (now >= item.scheduledAtMillis) actions += Action.complete
                actions += Action.fail
            }
            Status.cancelled -> if (item.canResumeAdmin) actions += Action.resumeAdmin
            Status.completed, Status.failed -> Unit
        }
    }
    if (item.status in listOf(Status.open, Status.offered) && (snapshot.isAdmin || item.openedByMe)) actions += Action.cancel
    return actions
}

internal fun ShiftCoverageViewModel.memberName(id: String): String =
    state.value.snapshot?.members?.firstOrNull { it.memberId == id }?.displayName ?: id
