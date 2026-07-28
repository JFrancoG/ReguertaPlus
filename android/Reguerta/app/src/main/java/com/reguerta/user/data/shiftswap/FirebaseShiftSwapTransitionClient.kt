package com.reguerta.user.data.shiftswap

import com.reguerta.user.data.access.AuthenticatedFunctionCaller
import com.reguerta.user.data.access.AuthenticatedFunctionException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.put

internal class FirebaseShiftSwapTransitionClient(
    private val functionCaller: AuthenticatedFunctionCaller,
    private val requestedEnvironment: () -> String,
) {
    suspend fun create(requestedShiftId: String, reason: String): String {
        val environment = requestedEnvironment()
        return try {
            val response = functionCaller.post(
                functionName = TRANSITION_SHIFT_SWAP_FUNCTION,
                body = buildJsonObject {
                    put("environment", environment)
                    put("action", "create")
                    put("requestedShiftId", requestedShiftId.trim())
                    put("reason", reason.trim())
                },
            )
            response.validatedTransitionResponse(
                expectedEnvironment = environment,
                expectedAction = "create",
                expectedRequestId = null,
            ).requestId
        } catch (error: Exception) {
            throw error.toShiftSwapTransitionException()
        }
    }

    suspend fun respond(
        requestId: String,
        candidateShiftId: String,
        response: ShiftSwapResponseStatus,
    ) {
        transition(
            action = "respond",
            requestId = requestId,
            candidateShiftId = candidateShiftId,
            response = response.wireValue(),
        )
    }

    suspend fun cancel(requestId: String) {
        transition(action = "cancel", requestId = requestId)
    }

    suspend fun apply(requestId: String, candidateShiftId: String) {
        transition(
            action = "apply",
            requestId = requestId,
            candidateShiftId = candidateShiftId,
        )
    }

    private suspend fun transition(
        action: String,
        requestId: String,
        candidateShiftId: String? = null,
        response: String? = null,
    ) {
        val environment = requestedEnvironment()
        val normalizedRequestId = requestId.trim()
        try {
            val result = functionCaller.post(
                functionName = TRANSITION_SHIFT_SWAP_FUNCTION,
                body = buildJsonObject {
                    put("environment", environment)
                    put("action", action)
                    put("requestId", normalizedRequestId)
                    candidateShiftId?.let { put("candidateShiftId", it.trim()) }
                    response?.let { put("response", it) }
                },
            )
            result.validatedTransitionResponse(
                expectedEnvironment = environment,
                expectedAction = action,
                expectedRequestId = normalizedRequestId,
            )
        } catch (error: Exception) {
            throw error.toShiftSwapTransitionException()
        }
    }

    private companion object {
        const val TRANSITION_SHIFT_SWAP_FUNCTION = "transitionShiftSwap"
    }
}

private data class ValidatedShiftSwapTransitionResponse(
    val requestId: String,
    val candidateCount: Int?,
)

private fun JsonObject.validatedTransitionResponse(
    expectedEnvironment: String,
    expectedAction: String,
    expectedRequestId: String?,
): ValidatedShiftSwapTransitionResponse {
    val ok = (this["ok"] as? JsonPrimitive)?.booleanOrNull
    val environment = primitiveString("environment")
    val action = primitiveString("action")
    val requestId = primitiveString("requestId")
    val candidateCount = when (val value = this["candidateCount"]) {
        null -> null
        is JsonPrimitive -> value.intOrNull?.takeIf { it >= 0 }
            ?: invalidTransitionResponse()
        else -> invalidTransitionResponse()
    }
    if (
        ok != true ||
        environment != expectedEnvironment ||
        action != expectedAction ||
        requestId.isBlank() ||
        (expectedRequestId != null && requestId != expectedRequestId)
    ) {
        invalidTransitionResponse()
    }
    return ValidatedShiftSwapTransitionResponse(
        requestId = requestId,
        candidateCount = candidateCount,
    )
}

private fun JsonObject.primitiveString(key: String): String =
    (this[key] as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf(String::isNotBlank)
        ?: invalidTransitionResponse()

private fun invalidTransitionResponse(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "shiftSwapRequests.transition.response",
)

private fun Throwable.toShiftSwapTransitionException(): Throwable = when (this) {
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
        resource = "shiftSwapRequests.transition",
        cause = this,
    )
    is IOException -> RepositoryException(
        kind = RepositoryErrorKind.UNAVAILABLE,
        resource = "shiftSwapRequests.transition",
        cause = this,
    )
    else -> RepositoryException(
        kind = RepositoryErrorKind.UNKNOWN,
        resource = "shiftSwapRequests.transition",
        cause = this,
    )
}

private fun ShiftSwapResponseStatus.wireValue(): String = when (this) {
    ShiftSwapResponseStatus.AVAILABLE -> "available"
    ShiftSwapResponseStatus.UNAVAILABLE -> "unavailable"
}
