package com.reguerta.user.domain.shiftcoverage

import kotlinx.serialization.Serializable

@Serializable
internal data class ShiftCoverageSnapshot(
    val schemaVersion: Int,
    val environment: String,
    val memberId: String,
    val isAdmin: Boolean,
    val eligible: Boolean,
    val serverTimeMillis: Long,
    val policyRevision: String,
    val policy: Policy,
    val cases: List<Case>,
    val credits: List<Credit>,
    val reserves: List<Reserve>,
) {
    @Serializable
    enum class Kind { delivery, market }
    @Serializable
    enum class Status { open, offered, accepted, completed, cancelled, failed }
    @Serializable
    enum class Phase { reserve, volunteers, drawRequired, draw, adminRequired }
    @Serializable
    enum class OfferSource { admin, reserve, volunteer, draw }
    @Serializable
    enum class CreditState { pending, consumed }

    @Serializable
    data class Policy(
        val maximumOfferWindowMillis: Long,
        val volunteerWindowMillis: Long?,
        val drawAvailable: Boolean,
    )

    @Serializable
    data class Case(
        val caseId: String,
        val shiftId: String,
        val type: Kind,
        val positionIndex: Int,
        val status: Status,
        val revision: Long,
        val shiftRevision: Long,
        val scheduledAtMillis: Long,
        val writable: Boolean,
        val absentUserId: String,
        val acceptedUserId: String?,
        val offer: Offer?,
        val selectionPhase: Phase?,
        val volunteerClosesAtMillis: Long?,
        val volunteered: Boolean,
        val updatedAtMillis: Long,
        val administration: Administration?,
    )

    @Serializable
    data class Offer(val userId: String, val source: OfferSource, val expiresAtMillis: Long)

    @Serializable
    data class Administration(val openedByUserId: String, val reason: String, val volunteerCount: Int)

    @Serializable
    data class Credit(
        val creditId: String,
        val shiftId: String,
        val type: Kind,
        val state: CreditState,
        val earnedAtMillis: Long,
        val consumedAtMillis: Long?,
    )

    @Serializable
    data class Reserve(val type: Kind, val active: Boolean, val enteredAtMillis: Long)
}

/** Change the revision on logout/relogin, UID, member, environment or authorization changes. */
internal data class ShiftCoverageSession(val uid: String, val memberId: String, val authorizationRevision: Long)

/** Preserve this complete value for explicit replay after an uncertain response. Never put actor identity here. */
@Serializable
internal data class ShiftCoverageCommand(
    val caseId: String,
    val operationId: String,
    val expectedRevision: Long,
    val expectedShiftRevision: Long,
    val action: Action,
    val shiftId: String? = null,
    val absentUserId: String? = null,
    val reason: String? = null,
    val userId: String? = null,
    val expiresAtMillis: Long? = null,
) {
    val schemaVersion: Int = 1
    val environment: String = "develop"

    @Serializable
    enum class Action {
        open, offer, accept, decline, expire, complete, startSelection, volunteer, withdrawVolunteer,
        commitDraw, revealDraw, offerNext, offerAdmin, resumeAdmin, cancel, fail,
    }
}

internal sealed class ShiftCoverageFailure : Exception() {
    data object SessionChanged : ShiftCoverageFailure()
    data object LocalOnly : ShiftCoverageFailure()
    data object InvalidResponse : ShiftCoverageFailure()
    data object Unavailable : ShiftCoverageFailure()
    data class Rejected(val status: Int, val code: String) : ShiftCoverageFailure()
}

internal interface ShiftCoverageRepository {
    suspend fun read(caseId: String?, session: ShiftCoverageSession): ShiftCoverageSnapshot
    suspend fun execute(command: ShiftCoverageCommand, session: ShiftCoverageSession)
}
