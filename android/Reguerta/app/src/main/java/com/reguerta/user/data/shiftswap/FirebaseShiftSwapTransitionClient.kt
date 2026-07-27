package com.reguerta.user.data.shiftswap

import com.reguerta.user.data.access.AuthenticatedFunctionCaller
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

internal class FirebaseShiftSwapTransitionClient(
    private val functionCaller: AuthenticatedFunctionCaller,
    private val requestedEnvironment: () -> String,
) {
    suspend fun create(requestedShiftId: String, reason: String): String {
        val response = functionCaller.post(
            functionName = TRANSITION_SHIFT_SWAP_FUNCTION,
            body = buildJsonObject {
                put("environment", requestedEnvironment())
                put("action", "create")
                put("requestedShiftId", requestedShiftId.trim())
                put("reason", reason.trim())
            },
        )
        return requireNotNull(response["requestId"]?.jsonPrimitive?.contentOrNull?.trim()?.takeIf(String::isNotBlank)) {
            "transitionShiftSwap response is missing requestId"
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
        functionCaller.post(
            functionName = TRANSITION_SHIFT_SWAP_FUNCTION,
            body = buildJsonObject {
                put("environment", requestedEnvironment())
                put("action", action)
                put("requestId", requestId.trim())
                candidateShiftId?.let { put("candidateShiftId", it.trim()) }
                response?.let { put("response", it) }
            },
        )
    }

    private companion object {
        const val TRANSITION_SHIFT_SWAP_FUNCTION = "transitionShiftSwap"
    }
}

private fun ShiftSwapResponseStatus.wireValue(): String = when (this) {
    ShiftSwapResponseStatus.AVAILABLE -> "available"
    ShiftSwapResponseStatus.UNAVAILABLE -> "unavailable"
}
