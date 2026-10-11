package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand.Action
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import java.util.UUID

internal class CoverageCommandDraft(
    val action: Action,
    val item: ShiftCoverageSnapshot.Case?,
    val snapshot: ShiftCoverageSnapshot,
    val nowMillis: Long,
) {
    private val id = UUID.randomUUID().toString()
    private val latestOfferDeadlineMillis = minOf(
        nowMillis + snapshot.policy.maximumOfferWindowMillis,
        (item?.scheduledAtMillis ?: Long.MAX_VALUE) - 1000,
        if (action == Action.offerAdmin && item?.selectionPhase == ShiftCoverageSnapshot.Phase.adminRequired)
            Long.MAX_VALUE else item?.phaseClosesAtMillis ?: Long.MAX_VALUE,
    )
    private val remainingOfferMillis = (latestOfferDeadlineMillis - nowMillis).coerceAtLeast(0)
    private val maximumDeadlineMinutes = remainingOfferMillis / 60_000 +
        if (remainingOfferMillis % 60_000 > 0) 1 else 0
    var shiftId by mutableStateOf(snapshot.availableShifts.firstOrNull { it.writable }?.shiftId.orEmpty())
    var memberId by mutableStateOf("")
    var reason by mutableStateOf("")
    var deadlineMinutes by mutableStateOf(maximumDeadlineMinutes.toString())
    val shifts get() = snapshot.availableShifts.filter { it.writable }
    val selectedShift get() = shifts.firstOrNull { it.shiftId == shiftId }
    val needsReason get() = action in listOf(Action.open, Action.offer, Action.offerAdmin, Action.resumeAdmin, Action.cancel, Action.fail)
    val needsMember get() = action in listOf(Action.open, Action.offer, Action.offerAdmin)
    val needsDeadline get() = action in listOf(Action.offer, Action.offerAdmin, Action.offerNext)
    /** The minute field may round up; the actual offer always ends within the exact remaining deadline. */
    val offerExpiresAtMillis: Long?
        get() {
            val minutes = deadlineMinutes.toLongOrNull() ?: return null
            if (minutes <= 0 || minutes > maximumDeadlineMinutes) return null
            return minOf(nowMillis + minutes * 60_000, latestOfferDeadlineMillis).takeIf { it > nowMillis }
        }
    val members get() = if (action == Action.open) snapshot.members.filter { selectedShift?.assignedUserIds?.contains(it.memberId) == true } else snapshot.members.filter { it.offerCandidate }
    val command: ShiftCoverageCommand?
        get() {
            val trimmed = reason.trim()
            if (needsReason && (trimmed.isEmpty() || trimmed.length > 500)) return null
            if (needsMember && members.none { it.memberId == memberId }) return null
            val expires = if (needsDeadline) offerExpiresAtMillis ?: return null else null
            if (action == Action.open && selectedShift == null || action != Action.open && item == null) return null
            return ShiftCoverageCommand(
                caseId = item?.caseId ?: id,
                operationId = id,
                expectedRevision = item?.revision ?: 0,
                expectedShiftRevision = item?.shiftRevision ?: selectedShift?.shiftRevision ?: 0,
                action = action,
                shiftId = if (action == Action.open) shiftId else null,
                absentUserId = if (action == Action.open) memberId else null,
                reason = if (needsReason) trimmed else null,
                userId = if (action in listOf(Action.offer, Action.offerAdmin)) memberId else null,
                expiresAtMillis = expires,
            )
        }
}
