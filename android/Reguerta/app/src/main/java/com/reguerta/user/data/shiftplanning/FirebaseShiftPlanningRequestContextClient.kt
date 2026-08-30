package com.reguerta.user.data.shiftplanning

import com.reguerta.user.data.access.AuthenticatedFunctionCaller
import com.reguerta.user.data.access.AuthenticatedFunctionException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

internal data class ShiftPlanningRequestContext(
    val environment: String,
    val expectedWriteEpoch: Long,
    val expectedActiveRevision: String?,
)

internal class FirebaseShiftPlanningRequestContextClient(
    private val functionCaller: AuthenticatedFunctionCaller,
    private val requestedEnvironment: () -> String,
) {
    suspend fun resolve(): ShiftPlanningRequestContext {
        val environment = requestedEnvironment()
        try {
            val response = functionCaller.post(
                functionName = RESOLVE_CONTEXT_FUNCTION,
                body = buildJsonObject {
                    put("schemaVersion", SCHEMA_VERSION)
                    put("environment", environment)
                },
            )
            if (
                response.keys != RESPONSE_FIELDS ||
                response.boolean("ok") != true ||
                response.nonNegativeLong("schemaVersion") != SCHEMA_VERSION.toLong() ||
                response.string("environment") != environment
            ) {
                invalidContextResponse()
            }
            return ShiftPlanningRequestContext(
                environment = environment,
                expectedWriteEpoch = response.nonNegativeLong("expectedWriteEpoch") ?: invalidContextResponse(),
                expectedActiveRevision = response.nullableIdentifier("expectedActiveRevision"),
            )
        } catch (error: Exception) {
            throw error.toShiftPlanningContextException()
        }
    }

    private companion object {
        const val SCHEMA_VERSION = 1
        const val RESOLVE_CONTEXT_FUNCTION = "resolveShiftPlanningRequestContext"
        val RESPONSE_FIELDS = setOf(
            "ok",
            "schemaVersion",
            "environment",
            "expectedWriteEpoch",
            "expectedActiveRevision",
        )
    }
}

private fun JsonObject.boolean(key: String): Boolean? = (this[key] as? JsonPrimitive)?.booleanOrNull

private fun JsonObject.nonNegativeLong(key: String): Long? =
    (this[key] as? JsonPrimitive)?.longOrNull?.takeIf { it >= 0 }

private fun JsonObject.string(key: String): String =
    (this[key] as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf(String::isNotBlank)
        ?: invalidContextResponse()

private fun JsonObject.nullableIdentifier(key: String): String? = when (val value = this[key]) {
    JsonNull -> null
    is JsonPrimitive -> value.contentOrNull
        ?.trim()
        ?.takeIf { PLANNING_IDENTIFIER.matches(it) }
        ?: invalidContextResponse()
    else -> invalidContextResponse()
}

private fun invalidContextResponse(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "shiftPlanningRequests.context.response",
)

private fun Throwable.toShiftPlanningContextException(): Throwable = when (this) {
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
        resource = "shiftPlanningRequests.context",
        cause = this,
    )
    is IOException -> RepositoryException(
        kind = RepositoryErrorKind.UNAVAILABLE,
        resource = "shiftPlanningRequests.context",
        cause = this,
    )
    else -> RepositoryException(
        kind = RepositoryErrorKind.UNKNOWN,
        resource = "shiftPlanningRequests.context",
        cause = this,
    )
}

private val PLANNING_IDENTIFIER = Regex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
