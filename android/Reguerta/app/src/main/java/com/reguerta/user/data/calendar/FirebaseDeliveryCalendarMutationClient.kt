package com.reguerta.user.data.calendar

import com.reguerta.user.data.access.AuthenticatedFunctionCaller
import com.reguerta.user.data.access.AuthenticatedFunctionException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import java.io.IOException
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

internal class FirebaseDeliveryCalendarMutationClient(
    private val functionCaller: AuthenticatedFunctionCaller,
    private val requestedEnvironment: () -> String,
    private val operationIdProvider: () -> String = { UUID.randomUUID().toString().lowercase() },
) {
    suspend fun upsert(override: DeliveryCalendarOverride): DeliveryCalendarOverride {
        val deliveryWeekday = override.deliveryWeekday()
        val result = transition(
            action = "upsert",
            weekKey = override.weekKey,
            deliveryWeekday = deliveryWeekday,
        )
        return result.override ?: invalidMutationResponse()
    }

    suspend fun delete(weekKey: String) {
        val result = transition(action = "delete", weekKey = weekKey)
        if (result.override != null) invalidMutationResponse()
    }

    private suspend fun transition(
        action: String,
        weekKey: String,
        deliveryWeekday: DeliveryWeekday? = null,
    ): DeliveryCalendarMutationResult {
        val environment = requestedEnvironment()
        val normalizedWeekKey = weekKey.trim()
        val operationId = operationIdProvider().trim()
        try {
            val contextResponse = functionCaller.post(
                functionName = RESOLVE_CONTEXT_FUNCTION,
                body = buildJsonObject {
                    put("schemaVersion", SCHEMA_VERSION)
                    put("environment", environment)
                    put("weekKey", normalizedWeekKey)
                },
            )
            val context = contextResponse.validatedMutationContext(
                expectedEnvironment = environment,
                expectedWeekKey = normalizedWeekKey,
            )
            val transitionResponse = functionCaller.post(
                functionName = TRANSITION_FUNCTION,
                body = buildJsonObject {
                    put("schemaVersion", SCHEMA_VERSION)
                    put("environment", environment)
                    put("operationId", operationId)
                    put("action", action)
                    put("weekKey", normalizedWeekKey)
                    put("expectedPlanningAuthority", context.planningAuthority)
                    put("expectedOverrideDigest", context.overrideDigest?.let(::JsonPrimitive) ?: JsonNull)
                    deliveryWeekday?.let { put("deliveryWeekday", it.wireValue) }
                },
            )
            return transitionResponse.validatedMutationResult(
                expectedEnvironment = environment,
                expectedOperationId = operationId,
                expectedAction = action,
                expectedWeekKey = normalizedWeekKey,
                expectedPlanningAuthority = context.planningAuthority,
                expectedPriorOverrideDigest = context.overrideDigest,
            )
        } catch (error: Exception) {
            throw error.toDeliveryCalendarMutationException()
        }
    }

    private companion object {
        const val SCHEMA_VERSION = 1
        const val RESOLVE_CONTEXT_FUNCTION = "resolveDeliveryCalendarMutationContext"
        const val TRANSITION_FUNCTION = "transitionDeliveryCalendarOverride"
    }
}

private data class DeliveryCalendarMutationContext(
    val planningAuthority: JsonObject,
    val overrideDigest: String?,
)

private data class DeliveryCalendarMutationResult(
    val override: DeliveryCalendarOverride?,
)

private fun JsonObject.validatedMutationContext(
    expectedEnvironment: String,
    expectedWeekKey: String,
): DeliveryCalendarMutationContext {
    if (
        boolean("ok") != true ||
        integer("schemaVersion") != 1 ||
        string("environment") != expectedEnvironment ||
        string("weekKey") != expectedWeekKey
    ) {
        invalidMutationResponse()
    }
    return DeliveryCalendarMutationContext(
        planningAuthority = requiredPlanningAuthority("planningAuthority"),
        overrideDigest = nullableDigest("overrideDigest"),
    )
}

private fun JsonObject.validatedMutationResult(
    expectedEnvironment: String,
    expectedOperationId: String,
    expectedAction: String,
    expectedWeekKey: String,
    expectedPlanningAuthority: JsonObject,
    expectedPriorOverrideDigest: String?,
): DeliveryCalendarMutationResult {
    val responseOverride = when (val value = this["override"]) {
        JsonNull -> null
        is JsonObject -> value.deliveryCalendarOverride()
        else -> invalidMutationResponse()
    }
    val overrideDigest = nullableDigest("overrideDigest")
    requiredDigest("commandDigest")
    if (
        boolean("ok") != true ||
        integer("schemaVersion") != 1 ||
        string("environment") != expectedEnvironment ||
        string("operationId") != expectedOperationId ||
        string("action") != expectedAction ||
        string("weekKey") != expectedWeekKey ||
        requiredPlanningAuthority("planningAuthority") != expectedPlanningAuthority ||
        nullableDigest("priorOverrideDigest") != expectedPriorOverrideDigest ||
        (overrideDigest == null) != (responseOverride == null) ||
        boolean("replayed") == null ||
        (expectedAction == "upsert") != (responseOverride != null) ||
        responseOverride?.weekKey?.let { it != expectedWeekKey } == true
    ) {
        invalidMutationResponse()
    }
    return DeliveryCalendarMutationResult(override = responseOverride)
}

private fun JsonObject.requiredPlanningAuthority(key: String): JsonObject {
    val authority = this[key] as? JsonObject ?: invalidMutationResponse()
    if (
        authority.keys != setOf("schemaVersion", "stateRevision", "writeEpoch", "activeRevision", "activeDigest") ||
        authority.integer("schemaVersion") != 1 ||
        authority.nonNegativeLong("stateRevision") == null ||
        authority.nonNegativeLong("writeEpoch") == null
    ) {
        invalidMutationResponse()
    }
    val activeRevision = authority.nullableString("activeRevision")
    val activeDigest = authority.nullableString("activeDigest")
    if (
        (activeRevision == null) != (activeDigest == null) ||
        activeDigest?.let { !SHIFT_PLANNING_DIGEST.matches(it) } == true
    ) {
        invalidMutationResponse()
    }
    return authority
}

private fun JsonObject.deliveryCalendarOverride(): DeliveryCalendarOverride {
    if (
        keys != setOf(
            "weekKey",
            "deliveryDateMillis",
            "ordersBlockedDateMillis",
            "ordersOpenAtMillis",
            "ordersCloseAtMillis",
            "updatedBy",
            "updatedAtMillis",
        )
    ) {
        invalidMutationResponse()
    }
    return DeliveryCalendarOverride(
        weekKey = string("weekKey"),
        deliveryDateMillis = nonNegativeLong("deliveryDateMillis") ?: invalidMutationResponse(),
        ordersBlockedDateMillis = nonNegativeLong("ordersBlockedDateMillis") ?: invalidMutationResponse(),
        ordersOpenAtMillis = nonNegativeLong("ordersOpenAtMillis") ?: invalidMutationResponse(),
        ordersCloseAtMillis = nonNegativeLong("ordersCloseAtMillis") ?: invalidMutationResponse(),
        updatedBy = string("updatedBy"),
        updatedAtMillis = nonNegativeLong("updatedAtMillis") ?: invalidMutationResponse(),
    )
}

private fun JsonObject.boolean(key: String): Boolean? = (this[key] as? JsonPrimitive)?.booleanOrNull

private fun JsonObject.integer(key: String): Int? = (this[key] as? JsonPrimitive)?.intOrNull

private fun JsonObject.nonNegativeLong(key: String): Long? =
    (this[key] as? JsonPrimitive)?.longOrNull?.takeIf { it >= 0 }

private fun JsonObject.string(key: String): String =
    (this[key] as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf(String::isNotBlank)
        ?: invalidMutationResponse()

private fun JsonObject.nullableString(key: String): String? = when (val value = this[key]) {
    JsonNull -> null
    is JsonPrimitive -> value.contentOrNull?.trim()?.takeIf(String::isNotBlank) ?: invalidMutationResponse()
    else -> invalidMutationResponse()
}

private fun JsonObject.nullableDigest(key: String): String? {
    val value = nullableString(key)
    if (value != null && !DELIVERY_CALENDAR_DIGEST.matches(value)) invalidMutationResponse()
    return value
}

private fun JsonObject.requiredDigest(key: String): String =
    nullableDigest(key) ?: invalidMutationResponse()

private fun DeliveryCalendarOverride.deliveryWeekday(): DeliveryWeekday {
    val weekday = when (Instant.ofEpochMilli(deliveryDateMillis).atZone(MADRID_ZONE_ID).dayOfWeek) {
        java.time.DayOfWeek.TUESDAY -> DeliveryWeekday.TUESDAY
        java.time.DayOfWeek.THURSDAY -> DeliveryWeekday.THURSDAY
        java.time.DayOfWeek.FRIDAY -> DeliveryWeekday.FRIDAY
        else -> invalidMutationResponse()
    }
    return weekday
}

private fun invalidMutationResponse(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "deliveryCalendar.mutation.response",
)

private fun Throwable.toDeliveryCalendarMutationException(): Throwable = when (this) {
    is CancellationException,
    is RepositoryException,
        -> this
    is AuthenticatedFunctionException -> RepositoryException(
        kind = when {
            statusCode == 401 || statusCode == 403 -> RepositoryErrorKind.PERMISSION_DENIED
            statusCode == 404 -> RepositoryErrorKind.NOT_FOUND
            statusCode == 408 || statusCode == 409 || statusCode == 429 || statusCode >= 500 ->
                RepositoryErrorKind.UNAVAILABLE
            statusCode == 400 -> RepositoryErrorKind.INVALID_DATA
            else -> RepositoryErrorKind.UNKNOWN
        },
        resource = "deliveryCalendar.mutation",
        cause = this,
    )
    is IOException -> RepositoryException(
        kind = RepositoryErrorKind.UNAVAILABLE,
        resource = "deliveryCalendar.mutation",
        cause = this,
    )
    else -> RepositoryException(
        kind = RepositoryErrorKind.UNKNOWN,
        resource = "deliveryCalendar.mutation",
        cause = this,
    )
}

private val MADRID_ZONE_ID: ZoneId = ZoneId.of("Europe/Madrid")
private val DELIVERY_CALENDAR_DIGEST = Regex("^delivery-calendar:v1:sha256:[a-f0-9]{64}$")
private val SHIFT_PLANNING_DIGEST = Regex("^shift-planning:v1:sha256:[a-f0-9]{64}$")
