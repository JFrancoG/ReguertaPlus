package com.reguerta.user.data.shiftcoverage

import com.reguerta.user.data.access.AuthenticatedFirebaseFunctionsClient
import com.reguerta.user.data.access.AuthenticatedFunctionException
import com.reguerta.user.data.access.functionErrorCode
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAccess
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministration
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministrationCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageRepository
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import java.util.Base64
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Uses the canonical signed-in session; every transport boundary rechecks its thread-safe current snapshot. */
internal class FirebaseShiftCoverageRepository(
    private val functionCaller: AuthenticatedFirebaseFunctionsClient,
    private val currentSession: () -> ShiftCoverageSession?,
    private val sdkIdentityMatches: (ShiftCoverageSession) -> Boolean = { true },
) : ShiftCoverageRepository {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }

    override suspend fun resolveAccess(session: ShiftCoverageSession): ShiftCoverageAccess {
        val body = send("resolveShiftCoverageAccess", json.encodeToString(AccessRequest(environment = session.environment)), session)
        val result = decode<ShiftCoverageAccess>(body)
        val keys = runCatching { json.parseToJsonElement(body).jsonObject.keys }.getOrNull()
        if (keys != setOf("schemaVersion", "environment", "memberId", "enabled", "policyRevision") ||
            result.schemaVersion != 1 || result.environment != session.environment || result.memberId != session.memberId ||
            result.policyRevision?.isBlank() == true || result.enabled && result.policyRevision == null ||
            !result.enabled && result.policyRevision != null
        ) throw ShiftCoverageFailure.InvalidResponse
        return result
    }

    override suspend fun read(caseId: String?, session: ShiftCoverageSession): ShiftCoverageSnapshot {
        val access = admitted(session)
        val result: ShiftCoverageSnapshot = request(Query(environment = session.environment,
            action = if (caseId == null) "overview" else "detail", caseId = caseId), session)
        validateSnapshot(result, access, session)
        return result
    }

    override suspend fun readNotification(eventId: String, session: ShiftCoverageSession): ShiftCoverageSnapshot {
        val access = admitted(session)
        val result: ShiftCoverageSnapshot = request(Query(environment = session.environment, action = "notification", eventId = eventId), session)
        validateSnapshot(result, access, session)
        val reference = result.notification
        val item = result.cases.singleOrNull()
        if (reference?.eventId != eventId || reference.caseRevision <= 0 || item?.caseId != reference.caseId ||
            item.revision < reference.caseRevision) throw ShiftCoverageFailure.InvalidResponse
        return result
    }

    override suspend fun readAdministration(session: ShiftCoverageSession): ShiftCoverageAdministration {
        val access = admitted(session)
        val result: ShiftCoverageAdministration = request(Query(environment = session.environment, action = "administration"), session)
        if (result.schemaVersion != 1 || result.environment != session.environment || result.memberId != session.memberId ||
            result.policyRevision != access.policyRevision || !result.isAdmin ||
            result.members.map { it.userId }.distinct().size != result.members.size ||
            result.members.any { !validId(it.userId) || it.contextDigest.isBlank() || it.membershipRevision !in 0 until MAX_REVISION ||
                it.credits.any { credit -> credit.pendingCount < 0 || credit.consumedCount < 0 || credit.cancelledCount < 0 } } ||
            result.spacingCandidates.map { it.id }.distinct().size != result.spacingCandidates.size ||
            result.spacingCandidates.any { !validId(it.id) || !validId(it.userId) || !validId(it.planningRequestId) ||
                it.contextDigest.isBlank() || it.previousRoundNumber < 1 || it.roundNumber <= it.previousRoundNumber ||
                !validSpacingDates(it.previousDate, it.date) }
        ) throw ShiftCoverageFailure.InvalidResponse
        return result
    }

    override suspend fun execute(command: ShiftCoverageCommand, session: ShiftCoverageSession) {
        if (command.environment != session.environment || command.expectedRevision !in 0 until MAX_REVISION) {
            throw ShiftCoverageFailure.InvalidResponse
        }
        requirePolicy(command.expectedPolicyRevision, admitted(session))
        val result: Receipt = request(command, session)
        if (result.schemaVersion != 1 || result.environment != session.environment || result.operationId != command.operationId ||
            result.caseId != command.caseId || result.revision != command.expectedRevision + 1
        ) throw ShiftCoverageFailure.InvalidResponse
    }

    override suspend fun executeAdministration(command: ShiftCoverageAdministrationCommand, session: ShiftCoverageSession) {
        if (command.environment != session.environment) throw ShiftCoverageFailure.InvalidResponse
        requirePolicy(command.expectedPolicyRevision, admitted(session))
        val result: AdministrationReceipt = request(command, session)
        val correctResult = when (command.action) {
            ShiftCoverageAdministrationCommand.Action.reconcileMembership -> command.expectedRevision?.let {
                result.membershipRevision != null && result.membershipRevision in it until MAX_REVISION && result.exceptionId == null
            } == true
            ShiftCoverageAdministrationCommand.Action.authorizeDeliverySpacingException ->
                result.membershipRevision == null && result.exceptionId?.let(::validId) == true
        }
        if (result.schemaVersion != 1 || result.environment != session.environment || result.operationId != command.operationId ||
            result.action != command.action || result.userId != command.userId || !correctResult
        ) throw ShiftCoverageFailure.InvalidResponse
    }

    private suspend fun admitted(session: ShiftCoverageSession): ShiftCoverageAccess = resolveAccess(session).also {
        if (!it.enabled) throw ShiftCoverageFailure.Disabled
    }

    private fun requirePolicy(expected: String?, access: ShiftCoverageAccess) {
        if (expected == null || access.policyRevision != expected) {
            throw ShiftCoverageFailure.Unavailable
        }
    }

    private fun validateSnapshot(value: ShiftCoverageSnapshot, access: ShiftCoverageAccess, session: ShiftCoverageSession) {
        if (value.schemaVersion != 1 || value.environment != session.environment || value.memberId != session.memberId ||
            value.policyRevision != access.policyRevision) throw ShiftCoverageFailure.InvalidResponse
    }

    private suspend inline fun <reified Request, reified Result> request(value: Request, session: ShiftCoverageSession): Result =
        decode<Envelope<Result>>(send("shiftCoverage", json.encodeToString(value), session)).let {
            if (!it.ok) throw ShiftCoverageFailure.InvalidResponse
            it.data
        }

    private inline fun <reified Value> decode(body: String): Value = try {
        json.decodeFromString<Value>(body)
    } catch (_: Exception) {
        throw ShiftCoverageFailure.InvalidResponse
    }

    private suspend fun send(function: String, body: String, session: ShiftCoverageSession): String {
        requireCurrent(session)
        try {
            val result = functionCaller.postAuthorized(
                functionName = function,
                body = json.parseToJsonElement(body).jsonObject,
                validateAuthorization = { requireCurrent(session) },
                validateCredential = { project, token -> requireSignedCredential(project, token, session.uid) },
            )
            currentCoroutineContext().ensureActive()
            requireCurrent(session)
            return result.toString()
        } catch (error: AuthenticatedFunctionException) {
            requireCurrent(session)
            val code = error.functionErrorCode()
            if (code in setOf("environment_changed", "session_changed", "coverage_environment_changed", "coverage_session_changed")) {
                throw ShiftCoverageFailure.SessionChanged
            }
            if (error.statusCode == 409 && code == "coverage_unavailable") throw ShiftCoverageFailure.Unavailable
            if (error.statusCode in listOf(400, 401, 403, 409) && !code.isNullOrBlank()) {
                throw ShiftCoverageFailure.Rejected(error.statusCode, code)
            }
            throw ShiftCoverageFailure.Unavailable
        }
    }

    private fun requireCurrent(session: ShiftCoverageSession) {
        if (session.environment !in setOf("develop", "production") || currentSession() != session || !sdkIdentityMatches(session)) {
            throw ShiftCoverageFailure.SessionChanged
        }
    }

    private fun requireSignedCredential(projectId: String, token: String, uid: String) {
        try {
            if (!projectId.matches(Regex("[a-z][a-z0-9-]{4,61}[a-z0-9]")) || projectId.startsWith("demo-")) {
                throw ShiftCoverageFailure.SessionChanged
            }
            val parts = token.split('.')
            if (parts.size != 3 || parts[2].isEmpty()) throw ShiftCoverageFailure.SessionChanged
            fun claims(part: String) = json.parseToJsonElement(String(Base64.getUrlDecoder().decode(part), Charsets.UTF_8)).jsonObject
            val header = claims(parts[0])
            val payload = claims(parts[1])
            if (header["alg"]?.jsonPrimitive?.content != "RS256" ||
                payload["aud"]?.jsonPrimitive?.content != projectId || payload["sub"]?.jsonPrimitive?.content != uid ||
                payload["iss"]?.jsonPrimitive?.content != "https://securetoken.google.com/${projectId}"
            ) throw ShiftCoverageFailure.SessionChanged
        } catch (_: Exception) { throw ShiftCoverageFailure.SessionChanged }
    }

    private fun validId(value: String): Boolean = value.matches(Regex("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"))
    private fun validSpacingDates(previous: String, date: String): Boolean = runCatching {
        java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.parse(previous), java.time.LocalDate.parse(date)) in 1..69
    }.getOrDefault(false)

    @Serializable private data class AccessRequest(val schemaVersion: Int = 1, val environment: String)
    @Serializable private data class Query(val schemaVersion: Int = 1, val environment: String, val action: String,
        val caseId: String? = null, val eventId: String? = null)
    @Serializable private data class Envelope<Value>(val ok: Boolean, val data: Value)
    @Serializable private data class Receipt(val schemaVersion: Int, val environment: String, val operationId: String,
        val caseId: String, val revision: Long, val replayed: Boolean)
    @Serializable private data class AdministrationReceipt(val schemaVersion: Int, val environment: String,
        val operationId: String, val action: ShiftCoverageAdministrationCommand.Action, val userId: String,
        val replayed: Boolean, val membershipRevision: Long?, val exceptionId: String?)

    companion object {
        private const val MAX_REVISION = 9_007_199_254_740_991L
        fun create(
            auth: FirebaseAuth,
            app: FirebaseApp,
            currentSession: () -> ShiftCoverageSession?,
            functionCaller: AuthenticatedFirebaseFunctionsClient = AuthenticatedFirebaseFunctionsClient.create(auth, app),
        ) = FirebaseShiftCoverageRepository(
            functionCaller = functionCaller,
            currentSession = currentSession,
            sdkIdentityMatches = { auth.currentUser?.uid == it.uid && auth.app.name == app.name },
        )
    }
}
