package com.reguerta.user.data.calendar

import com.reguerta.user.data.access.AuthenticatedFunctionCaller
import com.reguerta.user.data.access.AuthenticatedFunctionException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class FirebaseDeliveryCalendarMutationClientTest {
    @Test
    fun `upsert resolves context then sends exact command and returns backend override`() = runBlocking {
        val caller = RecordingDeliveryCalendarFunctionCaller(
            transitionOverride = deliveryCalendarOverride(updatedBy = "server-member", updatedAtMillis = 42),
        )
        val client = FirebaseDeliveryCalendarMutationClient(
            functionCaller = caller,
            requestedEnvironment = { "production" },
            operationIdProvider = { "operation-001" },
        )

        val result = client.upsert(localOverride())

        assertEquals(listOf("resolveDeliveryCalendarMutationContext", "transitionDeliveryCalendarOverride"), caller.calls)
        assertEquals(
            setOf("schemaVersion", "environment", "weekKey"),
            caller.bodies.first().keys,
        )
        val command = caller.bodies.last()
        assertEquals(
            setOf(
                "schemaVersion",
                "environment",
                "operationId",
                "action",
                "weekKey",
                "expectedPlanningAuthority",
                "expectedOverrideDigest",
                "deliveryWeekday",
            ),
            command.keys,
        )
        assertEquals("production", command.string("environment"))
        assertEquals("operation-001", command.string("operationId"))
        assertEquals("upsert", command.string("action"))
        assertEquals("2026-W36", command.string("weekKey"))
        assertEquals("TUE", command.string("deliveryWeekday"))
        assertEquals(PLANNING_AUTHORITY, command.getValue("expectedPlanningAuthority"))
        assertEquals(JsonNull, command.getValue("expectedOverrideDigest"))
        assertEquals("server-member", result.updatedBy)
        assertEquals(42, result.updatedAtMillis)
    }

    @Test
    fun `delete omits weekday and requires a null backend override`() = runBlocking {
        val caller = RecordingDeliveryCalendarFunctionCaller(transitionOverride = null)
        val client = FirebaseDeliveryCalendarMutationClient(
            functionCaller = caller,
            requestedEnvironment = { "develop" },
            operationIdProvider = { "operation-002" },
        )

        client.delete("2026-W36")

        val command = caller.bodies.last()
        assertEquals("delete", command.string("action"))
        assertFalse(command.containsKey("deliveryWeekday"))
        assertEquals(JsonNull, command.getValue("expectedOverrideDigest"))
    }

    @Test
    fun `stale command conflict is surfaced without refreshing and retrying`() = runBlocking {
        val caller = RecordingDeliveryCalendarFunctionCaller(
            transitionError = AuthenticatedFunctionException(
                statusCode = 409,
                responseBody = """{"error":{"code":"delivery_calendar_authority_changed"}}""",
            ),
        )
        val client = FirebaseDeliveryCalendarMutationClient(
            functionCaller = caller,
            requestedEnvironment = { "develop" },
            operationIdProvider = { "operation-003" },
        )

        try {
            client.upsert(localOverride())
            throw AssertionError("Expected RepositoryException")
        } catch (error: RepositoryException) {
            assertEquals(RepositoryErrorKind.UNAVAILABLE, error.kind)
        }
        assertEquals(listOf("resolveDeliveryCalendarMutationContext", "transitionDeliveryCalendarOverride"), caller.calls)
    }
}

private class RecordingDeliveryCalendarFunctionCaller(
    private val transitionOverride: JsonObject? = deliveryCalendarOverride(),
    private val transitionError: Exception? = null,
) : AuthenticatedFunctionCaller {
    val calls = mutableListOf<String>()
    val bodies = mutableListOf<JsonObject>()

    override suspend fun post(functionName: String, body: JsonObject): JsonObject {
        calls += functionName
        bodies += body
        return when (functionName) {
            "resolveDeliveryCalendarMutationContext" -> buildJsonObject {
                put("ok", true)
                put("schemaVersion", 1)
                put("environment", body.getValue("environment"))
                put("weekKey", body.getValue("weekKey"))
                put("planningAuthority", PLANNING_AUTHORITY)
                put("overrideDigest", JsonNull)
            }
            "transitionDeliveryCalendarOverride" -> {
                transitionError?.let { throw it }
                buildJsonObject {
                    put("ok", true)
                    put("schemaVersion", 1)
                    put("environment", body.getValue("environment"))
                    put("operationId", body.getValue("operationId"))
                    put("action", body.getValue("action"))
                    put("weekKey", body.getValue("weekKey"))
                    put("commandDigest", CALENDAR_DIGEST)
                    put("planningAuthority", body.getValue("expectedPlanningAuthority").jsonObject)
                    put("priorOverrideDigest", body.getValue("expectedOverrideDigest"))
                    put("overrideDigest", transitionOverride?.let { JsonPrimitive(CALENDAR_DIGEST) } ?: JsonNull)
                    put("override", transitionOverride ?: JsonNull)
                    put("replayed", false)
                }
            }
            else -> error("Unexpected function $functionName")
        }
    }
}

private fun localOverride(): DeliveryCalendarOverride = DeliveryCalendarOverride(
    weekKey = "2026-W36",
    deliveryDateMillis = 1_788_235_200_000,
    ordersBlockedDateMillis = 1_788_321_600_000,
    ordersOpenAtMillis = 1_788_408_000_000,
    ordersCloseAtMillis = 1_788_796_799_000,
    updatedBy = "local-member",
    updatedAtMillis = 1,
)

private fun deliveryCalendarOverride(
    updatedBy: String = "member-001",
    updatedAtMillis: Long = 42,
): JsonObject = buildJsonObject {
    put("weekKey", "2026-W36")
    put("deliveryDateMillis", 1_788_235_200_000)
    put("ordersBlockedDateMillis", 1_788_321_600_000)
    put("ordersOpenAtMillis", 1_788_408_000_000)
    put("ordersCloseAtMillis", 1_788_796_799_000)
    put("updatedBy", updatedBy)
    put("updatedAtMillis", updatedAtMillis)
}

private fun JsonObject.string(key: String): String = getValue(key).jsonPrimitive.content

private val PLANNING_AUTHORITY = buildJsonObject {
    put("schemaVersion", 1)
    put("stateRevision", 7)
    put("writeEpoch", 3)
    put("activeRevision", "revision-001")
    put("activeDigest", "shift-planning:v1:sha256:${"a".repeat(64)}")
}

private const val CALENDAR_DIGEST =
    "delivery-calendar:v1:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
