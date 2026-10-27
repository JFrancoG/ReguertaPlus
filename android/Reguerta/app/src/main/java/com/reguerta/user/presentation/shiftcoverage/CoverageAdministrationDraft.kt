package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministration
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministrationCommand
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID

internal class CoverageAdministrationDraft(
    val member: ShiftCoverageAdministration.Member? = null,
    val permanentDeparture: Boolean = false,
    val spacing: ShiftCoverageAdministration.SpacingCandidate? = null,
) {
    private val operationId = UUID.randomUUID().toString()
    var reason by mutableStateOf("")
    val needsReason: Boolean get() = permanentDeparture || spacing != null
    val command: ShiftCoverageAdministrationCommand?
        get() {
            val trimmed = reason.trim()
            if (needsReason && (trimmed.isEmpty() || trimmed.length > 500)) return null
            val member = member
            if (member != null && spacing == null) {
                if (permanentDeparture && !member.allowsPermanentDeparture) return null
                return ShiftCoverageAdministrationCommand(
                    action = ShiftCoverageAdministrationCommand.Action.reconcileMembership,
                    operationId = operationId,
                    userId = member.userId,
                    expectedContextDigest = member.contextDigest,
                    expectedRevision = member.membershipRevision,
                    permanentDepartureReason = trimmed.takeIf { permanentDeparture },
                )
            }
            val pair = spacing ?: return null
            return ShiftCoverageAdministrationCommand(
                action = ShiftCoverageAdministrationCommand.Action.authorizeDeliverySpacingException,
                operationId = operationId,
                userId = pair.userId,
                expectedContextDigest = pair.contextDigest,
                proposalId = pair.id,
                planningRequestId = pair.planningRequestId,
                previousDate = pair.previousDate,
                previousRoundNumber = pair.previousRoundNumber,
                date = pair.date,
                roundNumber = pair.roundNumber,
                reason = trimmed,
            )
        }

    fun isCurrent(snapshot: ShiftCoverageAdministration, now: Long): Boolean {
        if (!snapshot.isAdmin || command == null) return false
        member?.let { original ->
            return snapshot.membershipWritable && snapshot.members.any { it == original }
        }
        return spacing?.let { original -> snapshot.spacingCandidates.any { it == original } &&
            LocalDate.parse(original.date).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() > now } == true
    }
}
