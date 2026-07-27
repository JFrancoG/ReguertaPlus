package com.reguerta.user.data.shiftswap

import com.reguerta.user.data.access.AuthenticatedFunctionCaller
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class FirebaseShiftSwapTransitionClientTest {
    @Test
    fun `create delegates candidate selection and actor identity to backend`() = runBlocking {
        val caller = RecordingShiftSwapFunctionCaller()
        val client = FirebaseShiftSwapTransitionClient(
            functionCaller = caller,
            requestedEnvironment = { "develop" },
        )

        val requestId = client.create(requestedShiftId = "shift_001", reason = "Cambio")

        assertEquals("request_001", requestId)
        assertEquals("transitionShiftSwap", caller.functionName)
        assertEquals("develop", caller.body.string("environment"))
        assertEquals("create", caller.body.string("action"))
        assertEquals("shift_001", caller.body.string("requestedShiftId"))
        assertEquals("Cambio", caller.body.string("reason"))
        assertFalse(caller.body.containsKey("requesterUserId"))
        assertFalse(caller.body.containsKey("candidates"))
        assertFalse(caller.body.containsKey("actorAuthUid"))
    }

    @Test
    fun `response cancel and apply use narrow authenticated transitions`() = runBlocking {
        val caller = RecordingShiftSwapFunctionCaller()
        val client = FirebaseShiftSwapTransitionClient(
            functionCaller = caller,
            requestedEnvironment = { "production" },
        )

        client.respond("request_001", "shift_002", ShiftSwapResponseStatus.AVAILABLE)
        assertEquals(
            mapOf(
                "environment" to "production",
                "action" to "respond",
                "requestId" to "request_001",
                "candidateShiftId" to "shift_002",
                "response" to "available",
            ),
            caller.body.mapValues { (_, value) -> value.jsonPrimitive.content },
        )

        client.cancel("request_001")
        assertEquals(setOf("environment", "action", "requestId"), caller.body.keys)
        assertEquals("cancel", caller.body.string("action"))

        client.apply("request_001", "shift_002")
        assertEquals(setOf("environment", "action", "requestId", "candidateShiftId"), caller.body.keys)
        assertEquals("apply", caller.body.string("action"))
    }
}

private class RecordingShiftSwapFunctionCaller : AuthenticatedFunctionCaller {
    var functionName: String? = null
    var body: JsonObject = JsonObject(emptyMap())

    override suspend fun post(functionName: String, body: JsonObject): JsonObject {
        this.functionName = functionName
        this.body = body
        return JsonObject(mapOf("requestId" to JsonPrimitive("request_001")))
    }
}

private fun JsonObject.string(key: String): String = getValue(key).jsonPrimitive.content
