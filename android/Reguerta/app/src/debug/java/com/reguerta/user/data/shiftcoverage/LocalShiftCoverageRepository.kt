package com.reguerta.user.data.shiftcoverage

import androidx.annotation.MainThread
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageRepository
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

internal data class CoverageHttpResponse(val status: Int, val body: String)
internal fun interface CoverageHttpTransport {
    suspend fun post(url: String, token: String, body: String): CoverageHttpResponse
}

/** Debug only; never wired to the live graph. The server verifies Auth after this local credential fence. */
@MainThread
internal class LocalShiftCoverageRepository(
    port: Int,
    emulatorHost: Boolean = true,
    private val currentSession: () -> ShiftCoverageSession?,
    private val tokenProvider: suspend () -> String,
    private val transport: CoverageHttpTransport = LocalCoverageHttpTransport(),
) : ShiftCoverageRepository {
    private val endpoint: String
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }

    init {
        if (port !in 1..65535) throw ShiftCoverageFailure.LocalOnly
        val host = if (emulatorHost) "10.0.2.2" else "127.0.0.1"
        endpoint = "http://$host:$port/coverage"
    }

    override suspend fun read(caseId: String?, session: ShiftCoverageSession): ShiftCoverageSnapshot {
        val result = resolveMember(caseId, session)
        if (result.memberId != session.memberId) throw ShiftCoverageFailure.InvalidResponse
        return result
    }

    suspend fun resolveMember(caseId: String? = null, session: ShiftCoverageSession): ShiftCoverageSnapshot {
        val query = Query(action = if (caseId == null) "overview" else "detail", caseId = caseId)
        val result: ShiftCoverageSnapshot = post(json.encodeToString(query), session)
        if (result.schemaVersion != 1 || result.environment != "develop" ||
            result.policyRevision != "hu084-provisional-v1" || result.memberId.isEmpty()
        ) throw ShiftCoverageFailure.InvalidResponse
        return result
    }

    override suspend fun execute(command: ShiftCoverageCommand, session: ShiftCoverageSession) {
        if (command.expectedRevision !in 0 until 9_007_199_254_740_991L) throw ShiftCoverageFailure.InvalidResponse
        val result: Receipt = post(json.encodeToString(command), session)
        if (result.schemaVersion != 1 || result.environment != "develop" || result.caseId != command.caseId ||
            result.operationId != command.operationId || result.revision != command.expectedRevision + 1
        ) throw ShiftCoverageFailure.InvalidResponse
    }

    private suspend inline fun <reified Value> post(body: String, session: ShiftCoverageSession): Value {
        requireCurrent(session)
        val token = tokenProvider()
        requireCurrent(session)
        requireEmulatorToken(token, session.uid)
        val response = transport.post(endpoint, token, body)
        requireCurrent(session)
        if (response.status != 200) {
            val rejection = runCatching { json.decodeFromString<Rejection>(response.body) }.getOrNull()
            if (response.status in listOf(400, 401, 403, 409) && rejection?.ok == false) {
                throw ShiftCoverageFailure.Rejected(response.status, rejection.code)
            }
            throw ShiftCoverageFailure.Unavailable
        }
        val envelope = try {
            json.decodeFromString<Envelope<Value>>(response.body)
        } catch (_: Exception) {
            throw ShiftCoverageFailure.InvalidResponse
        }
        if (!envelope.ok) throw ShiftCoverageFailure.InvalidResponse
        return envelope.data
    }

    private suspend fun requireCurrent(session: ShiftCoverageSession) {
        if (currentSession() != session) throw ShiftCoverageFailure.SessionChanged
        currentCoroutineContext().ensureActive()
    }

    private fun requireEmulatorToken(token: String, uid: String) {
        val parts = token.split('.')
        if (parts.size != 3 || parts[2].isNotEmpty()) throw ShiftCoverageFailure.LocalOnly
        try {
            val header = json.decodeFromString<TokenHeader>(String(Base64.getUrlDecoder().decode(parts[0]), Charsets.UTF_8))
            val claims = json.decodeFromString<TokenClaims>(String(Base64.getUrlDecoder().decode(parts[1]), Charsets.UTF_8))
            if (header.alg != "none" || claims.aud != "demo-reguerta-hu084-coverage" ||
                claims.iss != "https://securetoken.google.com/demo-reguerta-hu084-coverage" || claims.sub != uid
            ) throw ShiftCoverageFailure.LocalOnly
        } catch (_: Exception) {
            throw ShiftCoverageFailure.LocalOnly
        }
    }

    @Serializable
    private data class Query(val action: String, val caseId: String?) {
        val schemaVersion: Int = 1
        val environment: String = "develop"
    }
    @Serializable
    private data class Envelope<T>(val ok: Boolean, val data: T)
    @Serializable
    private data class Rejection(val ok: Boolean, val code: String)
    @Serializable
    private data class Receipt(
        val schemaVersion: Int,
        val environment: String,
        val caseId: String,
        val operationId: String,
        val revision: Long,
        val replayed: Boolean,
    )
    @Serializable
    private data class TokenHeader(val alg: String)
    @Serializable
    private data class TokenClaims(val aud: String, val iss: String, val sub: String)
}

internal class LocalCoverageHttpTransport : CoverageHttpTransport {
    override suspend fun post(url: String, token: String, body: String): CoverageHttpResponse =
        withContext(Dispatchers.IO) {
            val connection = URL(url).openConnection() as HttpURLConnection
            try {
                connection.instanceFollowRedirects = false
                connection.useCaches = false
                connection.requestMethod = "POST"
                connection.connectTimeout = 10_000
                connection.readTimeout = 15_000
                connection.doOutput = true
                if (token.isNotEmpty()) connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json")
                currentCoroutineContext().ensureActive()
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                val stream = if (status == 200) connection.inputStream else connection.errorStream
                val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                currentCoroutineContext().ensureActive()
                CoverageHttpResponse(status, responseBody)
            } finally {
                connection.disconnect()
            }
        }
}
