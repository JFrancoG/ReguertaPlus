package com.reguerta.user.data.notifications

import com.reguerta.user.data.access.AuthenticatedFunctionCaller
import com.reguerta.user.data.access.AuthenticatedFunctionException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.notifications.ShiftNotificationDetail
import com.reguerta.user.domain.notifications.ShiftNotificationDetailRepository
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

internal class FirebaseShiftNotificationDetailRepository(
    private val functionCaller: AuthenticatedFunctionCaller,
    private val requestedEnvironment: () -> String,
) : ShiftNotificationDetailRepository {
    override suspend fun getCurrentDetail(
        eventId: String,
        memberId: String,
    ): ShiftNotificationDetail = try {
        val normalizedEventId = eventId.trim().takeIf(String::isNotBlank)
            ?: invalidDetailResponse()
        val normalizedMemberId = memberId.trim().takeIf(String::isNotBlank)
            ?: invalidDetailResponse()
        val response = functionCaller.post(
            functionName = RESOLVE_SHIFT_NOTIFICATION_DETAIL_FUNCTION,
            body = buildJsonObject {
                put("environment", requestedEnvironment())
                put("eventId", normalizedEventId)
            },
        )
        decodeShiftNotificationDetail(
            value = response,
            expectedEventId = normalizedEventId,
            expectedMemberId = normalizedMemberId,
        )
    } catch (error: Exception) {
        throw error.toShiftNotificationDetailException()
    }

    private companion object {
        const val RESOLVE_SHIFT_NOTIFICATION_DETAIL_FUNCTION = "resolveShiftNotificationDetail"
    }
}

internal fun decodeShiftNotificationDetail(
    value: JsonObject,
    expectedEventId: String,
    expectedMemberId: String,
): ShiftNotificationDetail {
    value.requireExactKeys(
        "schemaVersion",
        "eventId",
        "assignmentRevision",
        "documentRevision",
        "shift",
    )
    if (value.requiredLong("schemaVersion") != 1L) invalidDetailResponse()
    val eventId = value.requiredString("eventId")
    if (eventId != expectedEventId) invalidDetailResponse()
    val assignmentRevision = value.requiredPositiveLong("assignmentRevision")
    val documentRevision = value.requiredPositiveLong("documentRevision")
    if (assignmentRevision > documentRevision) invalidDetailResponse()
    val shiftValue = value["shift"] as? JsonObject ?: invalidDetailResponse()
    shiftValue.requireExactKeys(
        "id",
        "type",
        "dateMillis",
        "assignedUserIds",
        "helperUserId",
        "status",
        "source",
        "createdAtMillis",
        "updatedAtMillis",
    )
    val type = when (shiftValue.requiredString("type")) {
        "delivery" -> ShiftType.DELIVERY
        "market" -> ShiftType.MARKET
        else -> invalidDetailResponse()
    }
    val assignedUserIds = shiftValue.requiredStringArray("assignedUserIds")
    val expectedCount = if (type == ShiftType.DELIVERY) 1 else 3
    if (
        assignedUserIds.size != expectedCount ||
        expectedMemberId !in assignedUserIds
    ) {
        invalidDetailResponse()
    }
    val helperUserId = shiftValue.optionalString("helperUserId")
    if ((type == ShiftType.DELIVERY) == (helperUserId == null)) {
        invalidDetailResponse()
    }
    val status = when (shiftValue.requiredString("status")) {
        "planned" -> ShiftStatus.PLANNED
        "swap_pending" -> ShiftStatus.SWAP_PENDING
        "confirmed" -> ShiftStatus.CONFIRMED
        else -> invalidDetailResponse()
    }
    if (shiftValue.requiredString("source") != "app") invalidDetailResponse()
    val createdAtMillis = shiftValue.requiredLong("createdAtMillis")
    val updatedAtMillis = shiftValue.requiredLong("updatedAtMillis")
    if (updatedAtMillis < createdAtMillis) invalidDetailResponse()
    return ShiftNotificationDetail(
        eventId = eventId,
        assignmentRevision = assignmentRevision,
        documentRevision = documentRevision,
        shift = ShiftAssignment(
            id = shiftValue.requiredString("id"),
            type = type,
            dateMillis = shiftValue.requiredLong("dateMillis"),
            assignedUserIds = assignedUserIds,
            helperUserId = helperUserId,
            status = status,
            source = "app",
            createdAtMillis = createdAtMillis,
            updatedAtMillis = updatedAtMillis,
        ),
    )
}

private fun JsonObject.requireExactKeys(vararg expected: String) {
    if (keys != expected.toSet()) invalidDetailResponse()
}

private fun JsonObject.requiredString(key: String): String =
    (this[key] as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf(String::isNotBlank)
        ?: invalidDetailResponse()

private fun JsonObject.optionalString(key: String): String? = when (val value = this[key]) {
    JsonNull -> null
    is JsonPrimitive -> value.contentOrNull?.trim()?.takeIf(String::isNotBlank)
        ?: invalidDetailResponse()
    else -> invalidDetailResponse()
}

private fun JsonObject.requiredLong(key: String): Long =
    (this[key] as? JsonPrimitive)?.longOrNull ?: invalidDetailResponse()

private fun JsonObject.requiredPositiveLong(key: String): Long =
    requiredLong(key).takeIf { it > 0L } ?: invalidDetailResponse()

private fun JsonObject.requiredStringArray(key: String): List<String> =
    (this[key] as? JsonArray)?.map { value ->
        (value as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf(String::isNotBlank)
            ?: invalidDetailResponse()
    } ?: invalidDetailResponse()

private fun invalidDetailResponse(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "notifications.shiftDetail.response",
)

private fun Throwable.toShiftNotificationDetailException(): Throwable = when (this) {
    is CancellationException,
    is RepositoryException,
        -> this
    is AuthenticatedFunctionException -> RepositoryException(
        kind = when {
            statusCode == 401 || statusCode == 403 -> RepositoryErrorKind.PERMISSION_DENIED
            statusCode == 404 -> RepositoryErrorKind.NOT_FOUND
            statusCode == 408 || statusCode == 429 || statusCode >= 500 -> RepositoryErrorKind.UNAVAILABLE
            else -> RepositoryErrorKind.UNKNOWN
        },
        resource = "notifications.shiftDetail",
        cause = this,
    )
    is IOException -> RepositoryException(
        kind = RepositoryErrorKind.UNAVAILABLE,
        resource = "notifications.shiftDetail",
        cause = this,
    )
    else -> RepositoryException(
        kind = RepositoryErrorKind.UNKNOWN,
        resource = "notifications.shiftDetail",
        cause = this,
    )
}
