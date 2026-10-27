package com.reguerta.user.domain.shiftcoverage

import kotlinx.serialization.Serializable

@Serializable
internal data class ShiftCoverageAdministration(
    val schemaVersion: Int,
    val environment: String,
    val memberId: String,
    val isAdmin: Boolean,
    val serverTimeMillis: Long,
    val policyRevision: String,
    val membershipWritable: Boolean,
    val members: List<Member>,
    val spacingCandidates: List<SpacingCandidate>,
    val spacingUnavailableReason: String?,
) {
    @Serializable
    data class Member(
        val userId: String,
        val displayName: String,
        val membershipRevision: Long,
        val sourceActive: Boolean?,
        val eligible: Boolean,
        val permanentDeparture: Boolean,
        val pendingQueueTransition: Boolean,
        val contextDigest: String,
        val reserves: List<Reserve>,
        val credits: List<CreditSummary>,
    ) {
        val allowsPermanentDeparture: Boolean get() = sourceActive != true && !permanentDeparture
    }

    @Serializable
    data class Reserve(
        val type: ShiftCoverageSnapshot.Kind,
        val active: Boolean,
        val enteredAtMillis: Long,
        val admissionAfterRound: Long?,
    )

    @Serializable
    data class CreditSummary(
        val type: ShiftCoverageSnapshot.Kind,
        val pendingCount: Int,
        val consumedCount: Int,
        val cancelledCount: Int,
    )

    @Serializable
    data class SpacingCandidate(
        val id: String,
        val userId: String,
        val displayName: String,
        val planningRequestId: String,
        val previousDate: String,
        val previousRoundNumber: Long,
        val date: String,
        val roundNumber: Long,
        val contextDigest: String,
    )
}

/** Keep this complete server-bound intent for explicit retry after an uncertain response. */
@Serializable
internal data class ShiftCoverageAdministrationCommand(
    val action: Action,
    val operationId: String,
    val userId: String,
    val expectedContextDigest: String,
    val expectedRevision: Long? = null,
    val permanentDepartureReason: String? = null,
    val proposalId: String? = null,
    val planningRequestId: String? = null,
    val previousDate: String? = null,
    val previousRoundNumber: Long? = null,
    val date: String? = null,
    val roundNumber: Long? = null,
    val reason: String? = null,
) {
    val schemaVersion: Int = 1
    val environment: String = "develop"

    @Serializable
    enum class Action { reconcileMembership, authorizeDeliverySpacingException }
}
