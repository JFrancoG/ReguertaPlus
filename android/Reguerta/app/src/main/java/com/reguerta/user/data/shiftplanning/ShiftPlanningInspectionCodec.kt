package com.reguerta.user.data.shiftplanning

import com.google.firebase.Timestamp
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftPlanningCandidate
import com.reguerta.user.domain.shifts.ShiftPlanningCandidatePosition
import com.reguerta.user.domain.shifts.ShiftPlanningCandidateReference
import com.reguerta.user.domain.shifts.ShiftPlanningCompletedSummary
import com.reguerta.user.domain.shifts.ShiftPlanningFailure
import com.reguerta.user.domain.shifts.ShiftPlanningMode
import com.reguerta.user.domain.shifts.ShiftPlanningRequestObservation
import com.reguerta.user.domain.shifts.ShiftPlanningRequestStatus
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftPlanningSubplanSummary

internal fun decodeShiftPlanningObservation(
    documentId: String,
    data: Map<String, Any?>,
): ShiftPlanningRequestObservation? {
    if (data["schemaVersion"].asInspectionLong() != 2L) return null
    val requestId = data.inspectionString("requestId")
    if (requestId != documentId) invalidInspectionData("shiftPlanningRequests.document")
    val mode = when (data.inspectionString("mode")) {
        "preview" -> ShiftPlanningMode.PREVIEW
        "stage" -> ShiftPlanningMode.STAGE
        "activate" -> ShiftPlanningMode.ACTIVATE
        else -> invalidInspectionData("shiftPlanningRequests.mode")
    }
    val status = when (data.inspectionString("status")) {
        "requested" -> ShiftPlanningRequestStatus.REQUESTED
        "processing" -> ShiftPlanningRequestStatus.PROCESSING
        "completed" -> ShiftPlanningRequestStatus.COMPLETED
        "failed" -> ShiftPlanningRequestStatus.FAILED
        else -> invalidInspectionData("shiftPlanningRequests.status")
    }
    val environment = data.inspectionString("environment")
    if (environment != "develop" && environment != "production") {
        invalidInspectionData("shiftPlanningRequests.environment")
    }
    val lifecycle = data["lifecycle"].asInspectionMap()
    if (status == ShiftPlanningRequestStatus.REQUESTED && lifecycle != null) {
        invalidInspectionData("shiftPlanningRequests.lifecycle")
    }
    if (status != ShiftPlanningRequestStatus.REQUESTED && lifecycle?.inspectionString("state") != status.wireValue()) {
        invalidInspectionData("shiftPlanningRequests.lifecycle")
    }
    val bundleId = data.inspectionString("bundleId")
    val summary = lifecycle?.get("summary").asInspectionMap()
    val completedSummary = if (status == ShiftPlanningRequestStatus.COMPLETED) {
        decodeCompletedSummary(summary, mode, bundleId)
    } else {
        null
    }
    val failure = if (status == ShiftPlanningRequestStatus.FAILED) decodeFailure(summary, mode, bundleId) else null
    val artifact = lifecycle?.get("artifact").asInspectionMap()
    val candidateReference = artifact?.takeIf { it.inspectionString("kind") == "candidate" }?.let {
        val bundleRevision = completedSummary?.let { summary?.inspectionString("bundleRevision") }
            ?: data["binding"].asInspectionMap()?.inspectionString("bundleRevision")
            ?: invalidInspectionData("shiftPlanningRequests.candidateReference")
        val bundleDigest = completedSummary?.let { summary?.inspectionString("bundleDigest") }
            ?: data["binding"].asInspectionMap()?.inspectionString("bundleDigest")
            ?: invalidInspectionData("shiftPlanningRequests.candidateReference")
        ShiftPlanningCandidateReference(
            candidateId = it.inspectionString("candidateId"),
            candidateDigest = it.inspectionString("candidateDigest"),
            bundleRevision = bundleRevision,
            bundleDigest = bundleDigest,
            environment = environment,
        )
    }
    return ShiftPlanningRequestObservation(
        id = requestId,
        bundleId = bundleId,
        requestedByUserId = data.inspectionString("requestedByUserId"),
        requestedAtMillis = (data["requestedAt"] as? Timestamp)?.toDate()?.time
            ?: invalidInspectionData("shiftPlanningRequests.requestedAt"),
        mode = mode,
        status = status,
        completedSummary = completedSummary,
        failure = failure,
        candidateReference = candidateReference,
    )
}

internal fun decodeShiftPlanningCandidate(
    documentId: String,
    data: Map<String, Any?>,
    positionDocuments: List<Pair<String, Map<String, Any?>>>,
    reference: ShiftPlanningCandidateReference,
): ShiftPlanningCandidate {
    if (
        data["schemaVersion"].asInspectionLong() != 1L ||
        data.inspectionString("status") != "staged" ||
        documentId != reference.candidateId ||
        data.inspectionString("bundleId") != reference.candidateId ||
        data.inspectionString("environment") != reference.environment ||
        data.inspectionString("bundleRevision") != reference.bundleRevision ||
        data.inspectionString("bundleDigest") != reference.bundleDigest ||
        data.inspectionString("candidateDigest") != reference.candidateDigest
    ) {
        invalidInspectionData("shiftPlanningCandidates.document")
    }
    val candidate = data["candidate"].asInspectionMap()
        ?: invalidInspectionData("shiftPlanningCandidates.candidate")
    if (candidate.inspectionString("candidateId") != reference.candidateId) {
        invalidInspectionData("shiftPlanningCandidates.candidate")
    }
    val manifest = candidate["positionManifest"].asInspectionMap()
        ?: invalidInspectionData("shiftPlanningCandidates.positionManifest")
    val documentCount = manifest.inspectionNonNegativeInt("positionDocumentCount")
    val assignmentCount = manifest.inspectionNonNegativeInt("assignmentPositionCount")
    if (positionDocuments.size != documentCount || positionDocuments.map(Pair<String, *>::first).toSet().size != documentCount) {
        invalidInspectionData("shiftPlanningCandidates.positions")
    }
    val positions = positionDocuments.map { (positionId, positionData) ->
        decodeCandidatePosition(positionId, positionData, reference)
    }.sortedWith(compareBy(ShiftPlanningCandidatePosition::scheduledDate, ShiftPlanningCandidatePosition::id))
    if (positions.sumOf { it.assignedUserIds.size } != assignmentCount) {
        invalidInspectionData("shiftPlanningCandidates.assignmentPositions")
    }
    return ShiftPlanningCandidate(
        id = documentId,
        bundleRevision = reference.bundleRevision,
        bundleDigest = reference.bundleDigest,
        candidateDigest = reference.candidateDigest,
        positionDocumentCount = documentCount,
        assignmentPositionCount = assignmentCount,
        positions = positions,
    )
}

private fun decodeCandidatePosition(
    documentId: String,
    data: Map<String, Any?>,
    reference: ShiftPlanningCandidateReference,
): ShiftPlanningCandidatePosition {
    val position = data["position"].asInspectionMap()
        ?: invalidInspectionData("shiftPlanningCandidates.position")
    if (
        data["schemaVersion"].asInspectionLong() != 1L ||
        data.inspectionString("candidateId") != reference.candidateId ||
        data.inspectionString("candidateDigest") != reference.candidateDigest ||
        data.inspectionString("positionId") != documentId ||
        position.inspectionString("positionId") != documentId ||
        position.inspectionString("candidateId") != reference.candidateId ||
        position.inspectionString("bundleRevision") != reference.bundleRevision ||
        position.inspectionString("bundleDigest") != reference.bundleDigest
    ) {
        invalidInspectionData("shiftPlanningCandidates.position")
    }
    val type = when (position.inspectionString("type")) {
        "delivery" -> ShiftPlanningRequestType.DELIVERY
        "market" -> ShiftPlanningRequestType.MARKET
        else -> invalidInspectionData("shiftPlanningCandidates.position.type")
    }
    val assignedUserIds = (position["assignedUserIds"] as? List<*>)
        ?.map { it as? String ?: invalidInspectionData("shiftPlanningCandidates.position.assignees") }
        ?.takeIf { ids -> ids.isNotEmpty() && ids.all { it.isNotBlank() } }
        ?: invalidInspectionData("shiftPlanningCandidates.position.assignees")
    val helper = position["helperUserId"]?.let {
        (it as? String)?.takeIf(String::isNotBlank)
            ?: invalidInspectionData("shiftPlanningCandidates.position.helper")
    }
    return ShiftPlanningCandidatePosition(
        id = documentId,
        type = type,
        scheduledDate = position.inspectionString("scheduledDate"),
        assignedUserIds = assignedUserIds,
        helperUserId = helper,
    )
}

private fun decodeCompletedSummary(
    summary: Map<String, Any?>?,
    mode: ShiftPlanningMode,
    bundleId: String,
): ShiftPlanningCompletedSummary {
    val value = summary ?: invalidInspectionData("shiftPlanningRequests.summary")
    if (
        value["schemaVersion"].asInspectionLong() != 1L ||
        value.inspectionString("status") != "completed" ||
        value.inspectionString("mode") != mode.wireValue() ||
        value.inspectionString("bundleId") != bundleId
    ) {
        invalidInspectionData("shiftPlanningRequests.summary")
    }
    return ShiftPlanningCompletedSummary(
        bundleRevision = value.inspectionString("bundleRevision"),
        bundleDigest = value.inspectionString("bundleDigest"),
        delivery = decodeSubplan(value["delivery"].asInspectionMap()),
        market = decodeSubplan(value["market"].asInspectionMap()),
    )
}

private fun decodeSubplan(value: Map<String, Any?>?): ShiftPlanningSubplanSummary {
    val subplan = value ?: invalidInspectionData("shiftPlanningRequests.subplan")
    val seasons = (subplan["affectedProjectionSeasonStartYears"] as? List<*>)
        ?.map { season ->
            val value = season.asInspectionLong() ?: invalidInspectionData("shiftPlanningRequests.seasons")
            if (value < 0L || value > Int.MAX_VALUE) invalidInspectionData("shiftPlanningRequests.seasons")
            value.toInt()
        }
        ?: invalidInspectionData("shiftPlanningRequests.seasons")
    return ShiftPlanningSubplanSummary(
        targetSeasonStartYear = subplan.inspectionNonNegativeInt("targetSeasonStartYear"),
        generatedShiftCount = subplan.inspectionNonNegativeInt("generatedShiftCount"),
        affectedProjectionSeasonStartYears = seasons,
    )
}

private fun decodeFailure(
    summary: Map<String, Any?>?,
    mode: ShiftPlanningMode,
    bundleId: String,
): ShiftPlanningFailure {
    val value = summary ?: invalidInspectionData("shiftPlanningRequests.summary")
    if (
        value["schemaVersion"].asInspectionLong() != 1L ||
        value.inspectionString("status") != "failed" ||
        value.inspectionString("mode") != mode.wireValue() ||
        value.inspectionString("bundleId") != bundleId
    ) {
        invalidInspectionData("shiftPlanningRequests.summary")
    }
    val failure = value["failure"].asInspectionMap()
        ?: invalidInspectionData("shiftPlanningRequests.failure")
    return ShiftPlanningFailure(
        scope = failure.inspectionString("scope"),
        code = failure.inspectionString("code"),
        messageKey = failure.inspectionString("messageKey"),
    )
}

private fun Map<String, Any?>.inspectionString(field: String): String =
    (this[field] as? String)?.trim()?.takeIf(String::isNotEmpty)
        ?: invalidInspectionData("shiftPlanning.$field")

private fun Map<String, Any?>.inspectionNonNegativeInt(field: String): Int {
    val value = this[field].asInspectionLong() ?: invalidInspectionData("shiftPlanning.$field")
    if (value < 0L || value > Int.MAX_VALUE) invalidInspectionData("shiftPlanning.$field")
    return value.toInt()
}

@Suppress("UNCHECKED_CAST")
private fun Any?.asInspectionMap(): Map<String, Any?>? = this as? Map<String, Any?>

private fun Any?.asInspectionLong(): Long? = when (this) {
    is Long -> this
    is Int -> toLong()
    else -> null
}

private fun ShiftPlanningRequestStatus.wireValue(): String = name.lowercase()

private fun ShiftPlanningMode.wireValue(): String = name.lowercase()

private fun invalidInspectionData(resource: String): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = resource,
)
