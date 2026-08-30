package com.reguerta.user.data.shiftplanning

import com.reguerta.user.data.access.AuthenticatedFunctionCaller
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Test

class FirebaseShiftPlanningRequestContextClientTest {
    @Test
    fun `resolves the exact environment and minimal lineage context`() = runBlocking {
        val caller = RecordingShiftPlanningContextCaller()
        val client = FirebaseShiftPlanningRequestContextClient(
            functionCaller = caller,
            requestedEnvironment = { "production" },
        )

        val result = client.resolve()

        assertEquals(listOf("resolveShiftPlanningRequestContext"), caller.calls)
        assertEquals(setOf("schemaVersion", "environment"), caller.bodies.single().keys)
        assertEquals("production", caller.bodies.single().getValue("environment").jsonPrimitive.content)
        assertEquals(
            ShiftPlanningRequestContext(
                environment = "production",
                expectedWriteEpoch = 7,
                expectedActiveRevision = "active-6",
            ),
            result,
        )
    }

    @Test
    fun `rejects an expanded or malformed response`() = runBlocking {
        for (response in listOf(
            validResponse().toMutableMap().also { it["activeDigest"] = JsonNull }.let(::JsonObject),
            validResponse().toMutableMap().also { it["expectedWriteEpoch"] = JsonNull }.let(::JsonObject),
        )) {
            val client = FirebaseShiftPlanningRequestContextClient(
                functionCaller = RecordingShiftPlanningContextCaller(response),
                requestedEnvironment = { "production" },
            )
            try {
                client.resolve()
                throw AssertionError("Expected RepositoryException")
            } catch (error: RepositoryException) {
                assertEquals(RepositoryErrorKind.INVALID_DATA, error.kind)
            }
        }
    }
}

private class RecordingShiftPlanningContextCaller(
    private val response: JsonObject = validResponse(),
) : AuthenticatedFunctionCaller {
    val calls = mutableListOf<String>()
    val bodies = mutableListOf<JsonObject>()

    override suspend fun post(functionName: String, body: JsonObject): JsonObject {
        calls += functionName
        bodies += body
        return response
    }
}

private fun validResponse(): JsonObject = buildJsonObject {
    put("ok", true)
    put("schemaVersion", 1)
    put("environment", "production")
    put("expectedWriteEpoch", 7)
    put("expectedActiveRevision", "active-6")
}
