package com.reguerta.user.presentation.shiftcoverage

import com.reguerta.user.data.access.AuthenticatedFirebaseFunctionsClient
import com.reguerta.user.data.access.AuthenticatedFunctionException
import com.reguerta.user.data.access.FirebaseIdTokenProvider
import com.reguerta.user.data.access.FirebaseProjectIdProvider
import com.reguerta.user.data.access.FirebaseJsonPostTransport
import kotlinx.serialization.json.JsonObject
import com.reguerta.user.data.shiftcoverage.FirebaseShiftCoverageRepository
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import java.io.IOException
import java.util.Base64
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import com.reguerta.user.domain.notifications.ShiftNotificationPushReference
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAccess
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageRepository
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.*
import org.junit.Test

/** Signed-credential seam and independent server fixtures exercise the normal authenticated repository/state pipeline. */
class FirebaseShiftCoverageIntegrationTest {
    @Test fun aProductionSessionCanAcceptWithoutUsingTheRehearsalAuth() = runTest {
        val harness = Harness()
        harness.model.refresh()
        val snapshot = checkNotNull(harness.model.state.value.snapshot)
        val draft = CoverageCommandDraft(ShiftCoverageCommand.Action.accept, snapshot.cases.single(), snapshot, harness.model.nowMillis)
        harness.model.submit(checkNotNull(draft.command))
        assertEquals(ShiftCoverageSnapshot.Status.accepted, harness.model.state.value.snapshot!!.cases.single().status)
        assertNull(harness.model.state.value.pendingCommand)
        assertEquals(1, harness.transport.commands.size)
        assertFalse(harness.transport.commands.single().contains("expectedPolicyRevision"))
        assertFalse(harness.transport.commands.single().contains("actor"))
        assertTrue(harness.transport.urls.all { it.startsWith("https://europe-west1-reguerta-integration.cloudfunctions.net/") })
    }

    @Test fun disabledMissingAndMalformedAccessCannotReadPrivateCoverageOrWrite() = runTest {
        for (access in listOf("disabled", "false-with-policy", "true-without-policy", "foreign-member", "foreign-environment", "unavailable")) {
            val harness = Harness()
            harness.transport.accessFault = access
            harness.model.refresh()
            assertNull(harness.model.state.value.snapshot)
            assertTrue(harness.transport.commands.isEmpty())
            assertEquals(0, harness.transport.businessReads)
            if (access == "disabled") assertEquals(ShiftCoverageFailure.Disabled, harness.model.state.value.failure)
            else if (access == "unavailable") assertEquals(ShiftCoverageFailure.Unavailable, harness.model.state.value.failure)
            else assertEquals(ShiftCoverageFailure.InvalidResponse, harness.model.state.value.failure)
        }
    }

    @Test fun aDisabledGateAfterReadingTheFormDoesNotSendItsMutation() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.accessFault = "disabled"
        harness.model.submit(harness.command)
        assertTrue(harness.transport.commands.isEmpty())
        assertEquals(harness.command, harness.model.state.value.pendingCommand)
        assertNull(harness.model.state.value.snapshot)
        assertEquals(ShiftCoverageFailure.Disabled, harness.model.state.value.failure)
    }

    @Test fun refreshedPolicyCannotReinterpretAnUncertainIntent() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.loseFirstCommandResponse = true
        harness.model.submit(harness.command)
        assertEquals(harness.command, harness.model.state.value.pendingCommand)
        harness.transport.policy = "new-approved-policy"
        harness.model.refresh()
        assertEquals("new-approved-policy", harness.model.state.value.snapshot!!.policyRevision)
        harness.model.retryPending()
        assertEquals(harness.command, harness.model.state.value.pendingCommand)
        assertEquals(ShiftCoverageFailure.Unavailable, harness.model.state.value.failure)
        assertEquals(1, harness.transport.commands.size)
        harness.transport.policy = POLICY
        harness.model.retryPending()
        assertNull(harness.model.state.value.pendingCommand)
        assertEquals(2, harness.transport.commands.size)
        assertEquals(harness.transport.commands.first(), harness.transport.commands.last())
    }

    @Test fun uncertainResponseRetriesOnlyTheOriginalProductionIntent() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.loseFirstCommandResponse = true
        harness.model.submit(harness.command)
        harness.model.submit(harness.command.copy(operationId = "another-write"))
        assertEquals(1, harness.transport.commands.size)
        harness.model.retryPending()
        assertEquals(2, harness.transport.commands.size)
        assertEquals(harness.transport.commands.first(), harness.transport.commands.last())
        assertNull(harness.model.state.value.pendingCommand)
        assertEquals(ShiftCoverageSnapshot.Status.accepted, harness.model.state.value.snapshot!!.cases.single().status)
    }

    @Test fun closingAdmissionDefersAnUnknownWriteUntilTheSameGateReopens() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.loseFirstCommandResponse = true
        harness.model.submit(harness.command)
        harness.transport.accessFault = "disabled"
        harness.model.retryPending()
        assertEquals(harness.command, harness.model.state.value.pendingCommand)
        assertEquals(1, harness.transport.commands.size)
        harness.transport.accessFault = null
        harness.model.retryPending()
        assertNull(harness.model.state.value.pendingCommand)
        assertEquals(harness.transport.commands.first(), harness.transport.commands.last())
    }

    @Test fun aBackendAdmissionConflictDoesNotClaimThatAnUnknownWriteWasRejected() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.loseFirstCommandResponse = true
        harness.model.submit(harness.command)
        harness.transport.commandStatus = 409
        harness.transport.commandCode = "coverage_unavailable"
        harness.model.retryPending()
        assertEquals(harness.command, harness.model.state.value.pendingCommand)
        assertEquals(ShiftCoverageFailure.Unavailable, harness.model.state.value.failure)
        harness.transport.commandStatus = 200
        harness.model.retryPending()
        assertNull(harness.model.state.value.pendingCommand)
        assertEquals(3, harness.transport.commands.size)
        assertTrue(harness.transport.commands.all { it == harness.transport.commands.first() })
    }

    @Test fun backendSessionAndEnvironmentReplacementInvalidateTheOldPrivateContext() = runTest {
        for (code in listOf("coverage_session_changed", "coverage_environment_changed")) {
            val harness = Harness()
            harness.model.refresh()
            harness.transport.loseFirstCommandResponse = true
            harness.model.submit(harness.command)
            assertEquals(harness.command, harness.model.state.value.pendingCommand)
            harness.transport.commandStatus = 409
            harness.transport.commandCode = code
            harness.model.retryPending()
            assertEquals(ShiftCoverageFailure.SessionChanged, harness.model.state.value.failure)
            assertNull(harness.model.state.value.session)
            assertNull(harness.model.state.value.snapshot)
            assertNull(harness.model.state.value.pendingCommand)
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test fun availabilityReadsOnlyAccessAndAReplacementSessionRejectsTheLateAnswer() = runTest {
        val harness = Harness()
        val deferred = mutableListOf<CompletableDeferred<ShiftCoverageAccess>>()
        val repository = object : ShiftCoverageRepository by harness.repository {
            override suspend fun resolveAccess(session: ShiftCoverageSession): ShiftCoverageAccess =
                CompletableDeferred<ShiftCoverageAccess>().also { deferred += it }.await()
        }
        val route = CoverageRouteViewModel(repository, this)
        route.bindSession(harness.current)
        runCurrent()
        assertFalse(route.isAvailable)
        val oldSession = harness.current
        harness.current = oldSession.copy(authorizationRevision = 2)
        route.bindSession(harness.current)
        runCurrent()
        deferred[1].complete(ShiftCoverageAccess(1, "production", "member-a", false, null))
        runCurrent()
        deferred[0].complete(ShiftCoverageAccess(1, "production", "member-a", true, POLICY))
        runCurrent()
        assertFalse(route.isAvailable)
        assertNull(route.coverage.state.value.snapshot)
        assertEquals(0, harness.transport.businessReads)
        route.refreshAvailability()
        runCurrent()
        deferred[2].complete(ShiftCoverageAccess(1, "production", "member-a", true, POLICY))
        runCurrent()
        assertTrue(route.isAvailable)
        assertTrue(route.isAvailableFor(harness.current))
        assertFalse(route.isAvailableFor(harness.current.copy(authorizationRevision = 3)))
        assertFalse(route.isAvailableFor(harness.current.copy(environment = "develop")))
        assertFalse(route.isAvailableFor(null))
        route.coverage.refresh()
        route.present(ShiftCoverageCommand.Action.accept, route.coverage.state.value.snapshot!!.cases.single())
        route.refreshAvailability()
        runCurrent()
        deferred[3].completeExceptionally(ShiftCoverageFailure.SessionChanged)
        runCurrent()
        assertFalse(route.isAvailable)
        assertNull(route.coverage.state.value.session)
        assertNull(route.coverage.state.value.snapshot)
        assertNull(route.draft)
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test fun metadataRefreshWithTheSameEpochDropsTheOldAdminFormAndLatePrivateResponse() = runTest {
        for (changeRoles in listOf(true, false)) {
            val harness = Harness()
            val member = Member("member-a", "Real account", normalizedEmail = "real@example.test", authUid = "auth-a",
                roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN), isActive = true, producerCatalogEnabled = false)
            val mode = SessionMode.Authorized(AuthPrincipal("auth-a", member.normalizedEmail), member, member, listOf(member))
            val initial = SessionUiState(sessionEpoch = 1, sessionEnvironment = "production", mode = mode)
            harness.current = checkNotNull(initial.coverageSession())
            harness.transport.overviewAdmin = true
            val route = CoverageRouteViewModel(harness.repository, this)
            route.bindSession(harness.current)
            route.refresh()
            advanceUntilIdle()
            route.openAdministration()
            advanceUntilIdle()
            route.presentMembership(route.coverage.state.value.administration!!.members.single(), permanentDeparture = true)
            route.administrationDraft!!.reason = "Previously admitted form"
            assertTrue(route.canConfirmAdministrationDraft())
            val released = CompletableDeferred<Unit>()
            val started = CompletableDeferred<Unit>()
            harness.transport.beforeBusinessResponse = { started.complete(Unit); released.await() }
            route.refresh()
            runCurrent()
            assertTrue(started.isCompleted)
            val refreshedMember = if (changeRoles) member.copy(roles = setOf(MemberRole.MEMBER))
                else member.copy(isCommonPurchaseManager = true)
            val refreshed = initial.copy(mode = mode.copy(authenticatedMember = refreshedMember, member = refreshedMember))
            harness.current = checkNotNull(refreshed.coverageSession())
            assertEquals(initial.sessionEpoch, refreshed.sessionEpoch)
            assertFalse(route.isAvailableFor(harness.current))
            route.bindSession(harness.current)
            assertNull(route.administrationDraft)
            assertNull(route.coverage.state.value.administration)
            assertNull(route.coverage.state.value.snapshot)
            assertFalse(route.canConfirmAdministrationDraft())
            harness.transport.beforeBusinessResponse = null
            released.complete(Unit)
            advanceUntilIdle()
            assertNull(route.coverage.state.value.administration)
            assertNull(route.coverage.state.value.snapshot)
            assertTrue(harness.transport.commands.isEmpty())
        }
    }

    @Test fun acknowledgedCommandIsNotReplayedWhenTheReadBackFails() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.failReadBack = true
        harness.model.submit(harness.command)
        assertNull(harness.model.state.value.pendingCommand)
        assertNull(harness.model.state.value.snapshot)
        harness.model.retryPending()
        assertEquals(1, harness.transport.commands.size)
    }

    @Test fun credentialRefreshCannotSendForAnOldSession() = runTest {
        val harness = Harness()
        harness.onCredentials = { harness.current = harness.current.copy(authorizationRevision = 2) }
        harness.model.refresh()
        assertTrue(harness.transport.urls.isEmpty())
        assertNull(harness.model.state.value.snapshot)
        assertEquals(ShiftCoverageFailure.SessionChanged, harness.model.state.value.failure)
    }

    @Test fun lastWriteFenceChecksBothTheUiEpochAndSdkIdentity() = runTest {
        for (sdkOnly in listOf(false, true)) {
            val harness = Harness()
            harness.model.refresh()
            harness.transport.beforeMutationWrite = {
                if (sdkOnly) harness.sdkUid = "another-sdk-user"
                else harness.current = harness.current.copy(authorizationRevision = 2)
            }
            harness.model.submit(harness.command)
            assertTrue(harness.transport.commands.isEmpty())
            assertNull(harness.model.state.value.snapshot)
            assertNull(harness.model.state.value.pendingCommand)
        }
    }

    @Test fun lateResponseCannotRestorePrivateDataAfterSessionReplacement() = runTest {
        val harness = Harness()
        harness.transport.beforeBusinessResponse = {
            harness.current = harness.current.copy(authorizationRevision = 2)
            harness.model.bind(harness.current)
        }
        harness.model.refresh()
        assertNull(harness.model.state.value.snapshot)
        assertEquals(2, harness.model.state.value.session!!.authorizationRevision.toInt())
    }

    @Test fun demoUnsignedAndForeignCredentialsNeverReachTheSharedEndpoint() = runTest {
        for ((project, token) in listOf(
            "demo-reguerta-hu084-coverage" to token("demo-reguerta-hu084-coverage", algorithm = "none", signature = ""),
            PROJECT to token(algorithm = "none", signature = ""),
            PROJECT to token(uid = "other-user"),
            PROJECT to token(audience = "foreign-project"),
            PROJECT to token(issuer = "https://foreign.example.test"),
        )) {
            val harness = Harness()
            harness.project = project
            harness.bearer = token
            harness.model.refresh()
            assertTrue(harness.transport.urls.isEmpty())
            assertNull(harness.model.state.value.snapshot)
        }
    }

    @Test fun canonicalRejectionsAreTerminalAndUnavailableResponsesStayUncertain() = runTest {
        for (status in listOf(400, 401, 403, 409, 404, 408, 429, 500, 302)) {
            val harness = Harness()
            harness.model.refresh()
            harness.transport.commandStatus = status
            harness.model.submit(harness.command)
            assertEquals(status !in listOf(400, 401, 403, 409), harness.model.state.value.pendingCommand != null)
            assertEquals(1, harness.transport.commands.size)
            assertNull(harness.model.state.value.snapshot)
        }
    }

    @Test fun administrationUsesTheSamePolicyGateAndAuthenticatedReadBack() = runTest {
        val harness = Harness()
        harness.transport.overviewAdmin = true
        harness.model.refresh()
        harness.model.openAdministration()
        val snapshot = checkNotNull(harness.model.state.value.administration)
        val draft = CoverageAdministrationDraft(member = snapshot.members.first(), permanentDeparture = true,
            environment = snapshot.environment, expectedPolicyRevision = snapshot.policyRevision)
        draft.reason = "Permanent departure confirmed"
        harness.model.submitAdministration(checkNotNull(draft.command))
        val member = harness.model.state.value.administration!!.members.first()
        assertTrue(member.permanentDeparture)
        assertEquals(0, member.credits.first().pendingCount)
        assertEquals(1, member.credits.first().cancelledCount)
        assertNull(harness.model.state.value.pendingAdministration)
        assertNotNull(harness.model.state.value.snapshot)
        assertEquals(1, harness.transport.commands.size)
        assertFalse(harness.transport.commands.single().contains("expectedPolicyRevision"))
    }

    @Test fun spacingSendsTheExactSelectedServerPairAndReadsBackItsRemoval() = runTest {
        val harness = Harness()
        harness.transport.overviewAdmin = true
        harness.model.refresh()
        harness.model.openAdministration()
        val snapshot = checkNotNull(harness.model.state.value.administration)
        val draft = CoverageAdministrationDraft(spacing = snapshot.spacingCandidates.single(), environment = snapshot.environment,
            expectedPolicyRevision = snapshot.policyRevision)
        draft.reason = "Avoid leaving the shift empty"
        harness.model.submitAdministration(checkNotNull(draft.command))
        val request = Json.parseToJsonElement(harness.transport.commands.single()).jsonObject
        assertEquals("bundle-2027", request.getValue("planningRequestId").jsonPrimitive.content)
        assertEquals("2027-01-06", request.getValue("previousDate").jsonPrimitive.content)
        assertEquals("3", request.getValue("previousRoundNumber").jsonPrimitive.content)
        assertEquals("2027-02-17", request.getValue("date").jsonPrimitive.content)
        assertEquals("4", request.getValue("roundNumber").jsonPrimitive.content)
        assertEquals(snapshot.members, harness.model.state.value.administration!!.members)
        assertTrue(harness.model.state.value.administration!!.spacingCandidates.isEmpty())
        assertNull(harness.model.state.value.pendingAdministration)
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test fun normalPushOpensTheAuthenticatedCaseOnceWithoutRehearsalLogin() = runTest {
        val harness = Harness()
        val route = CoverageRouteViewModel(harness.repository, this)
        route.bindSession(harness.current)
        val event = "coverage-" + "a".repeat(64)
        harness.transport.notificationEventId = event
        route.acceptPush(checkNotNull(ShiftNotificationPushReference.validated(event, "shift_updated", "users")))
        route.openPendingPush()
        advanceUntilIdle()
        assertEquals("case-a", route.selectedCaseId)
        assertNull(route.pendingPushEventId)
        assertEquals(event, route.coverage.state.value.snapshot!!.notification!!.eventId)
        route.openPendingPush()
        advanceUntilIdle()
        assertEquals(1, harness.transport.businessReads)
        assertTrue(harness.transport.commands.isEmpty())
    }

    @Test fun unknownAdministrationRetainsItsIntentAcrossGateAndPolicyChanges() = runTest {
        for (admission in listOf("disabled", "changed-policy")) {
            val harness = Harness()
            harness.transport.overviewAdmin = true
            harness.model.refresh()
            harness.model.openAdministration()
            val snapshot = checkNotNull(harness.model.state.value.administration)
            val draft = CoverageAdministrationDraft(member = snapshot.members.first(), permanentDeparture = true,
                environment = snapshot.environment, expectedPolicyRevision = snapshot.policyRevision)
            draft.reason = "Confirmed permanent departure"
            val command = checkNotNull(draft.command)
            harness.transport.loseFirstCommandResponse = true
            harness.model.submitAdministration(command)
            if (admission == "disabled") harness.transport.accessFault = "disabled" else harness.transport.policy = "new-policy"
            harness.model.retryPending()
            assertEquals(command, harness.model.state.value.pendingAdministration)
            assertEquals(1, harness.transport.commands.size)
            harness.transport.accessFault = null
            harness.transport.policy = POLICY
            harness.model.retryPending()
            assertNull(harness.model.state.value.pendingAdministration)
            assertEquals(2, harness.transport.commands.size)
            assertEquals(harness.transport.commands.first(), harness.transport.commands.last())
            assertEquals(1, harness.model.state.value.administration!!.members.first().credits.first().cancelledCount)
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test fun normalRouteCapturesPolicyAndDropsPrivateFormsAndPushOnSessionChange() = runTest {
        val harness = Harness()
        harness.transport.overviewAdmin = true
        val route = CoverageRouteViewModel(harness.repository, this)
        route.bindSession(harness.current)
        route.refresh()
        advanceUntilIdle()
        route.openAdministration()
        advanceUntilIdle()
        val snapshot = checkNotNull(route.coverage.state.value.administration)
        route.presentMembership(snapshot.members.first(), permanentDeparture = true)
        route.administrationDraft!!.reason = "Confirmed departure"
        assertEquals("production", route.administrationDraft!!.command!!.environment)
        assertEquals(POLICY, route.administrationDraft!!.command!!.expectedPolicyRevision)
        route.acceptPush(checkNotNull(ShiftNotificationPushReference.validated("coverage-" + "a".repeat(64), "shift_updated", "users")))
        harness.current = harness.current.copy(authorizationRevision = 2)
        route.bindSession(harness.current)
        assertNull(route.administrationDraft)
        assertNull(route.pendingPushEventId)
        assertNull(route.coverage.state.value.administration)
        assertFalse(route.canConfirmAdministrationDraft())
        assertTrue(harness.transport.commands.isEmpty())
    }

    private class Harness {
        var current = ShiftCoverageSession("auth-a", "member-a", 1, "production")
        var sdkUid = "auth-a"
        var project = PROJECT
        var bearer = token()
        var onCredentials: (() -> Unit)? = null
        val transport = Transport()
        val caller = AuthenticatedFirebaseFunctionsClient(
            idTokenProvider = FirebaseIdTokenProvider { onCredentials?.invoke(); bearer },
            projectIdProvider = FirebaseProjectIdProvider { project },
            transport = transport,
        )
        val repository = FirebaseShiftCoverageRepository(
            functionCaller = caller, currentSession = { current }, sdkIdentityMatches = { it.uid == sdkUid },
        )
        val model = ShiftCoverageViewModel(repository).also { it.bind(current) }
        val command = ShiftCoverageCommand("case-a", "accept-once", 2, 4, ShiftCoverageCommand.Action.accept,
            environment = "production", expectedPolicyRevision = POLICY)
    }

    private class Transport : FirebaseJsonPostTransport {
        val urls = mutableListOf<String>()
        val commands = mutableListOf<String>()
        var businessReads = 0
        var accessFault: String? = null
        var policy = POLICY
        var overviewAdmin = false
        var loseFirstCommandResponse = false
        var failReadBack = false
        var commandStatus = 200
        var commandCode = "coverage_rejected"
        var notificationEventId = "coverage-fixture-event"
        var beforeMutationWrite: (() -> Unit)? = null
        var beforeBusinessResponse: (suspend () -> Unit)? = null
        private var committed = false
        private var committedAction: String? = null

        private fun reply(status: Int, body: String): JsonObject {
            if (status != 200) throw AuthenticatedFunctionException(status, body)
            return Json.parseToJsonElement(body).jsonObject
        }

        override suspend fun post(url: String, bearerToken: String, body: JsonObject): JsonObject =
            postAuthorized(url, bearerToken, body, {})

        override suspend fun postAuthorized(url: String, bearerToken: String, body: JsonObject, validateAuthorization: () -> Unit): JsonObject {
            val value = body
            val action = value["action"]?.jsonPrimitive?.content
            if (action != null && action !in listOf("overview", "detail", "notification", "administration")) beforeMutationWrite?.invoke()
            validateAuthorization()
            urls += url
            if (value.getValue("environment").jsonPrimitive.content != "production") {
                return reply(400, """{"error":{"code":"environment_mismatch","message":"Invalid"}}""")
            }
            if (url.endsWith("/resolveShiftCoverageAccess")) {
                if (accessFault == "unavailable") return reply(404, "Unavailable")
                val enabled = accessFault !in listOf("disabled", "false-with-policy")
                val revision = if (accessFault in listOf("disabled", "true-without-policy")) "null" else "\"$policy\""
                val member = if (accessFault == "foreign-member") "foreign-member" else "member-a"
                val environment = if (accessFault == "foreign-environment") "develop" else "production"
                return reply(200, """{"schemaVersion":1,"environment":"$environment","memberId":"$member",
                    "enabled":$enabled,"policyRevision":$revision}""")
            }
            if (action in listOf("overview", "detail", "notification", "administration")) {
                businessReads++
                if (failReadBack && commands.isNotEmpty()) throw IOException("Read back unavailable")
                val fixture = when (action) {
                    "administration" -> if (committedAction == "reconcileMembership") "shift-coverage-administration-after-departure.json" else "shift-coverage-administration.json"
                    "notification" -> "shift-coverage-notification.json"
                    else -> "shift-coverage-overview.json"
                }
                var response = resource(fixture).replace("\"develop\"", "\"production\"").replace(POLICY, policy)
                    .replace("coverage-fixture-event", notificationEventId)
                if (action == "administration" && committedAction == "authorizeDeliverySpacingException") {
                    val envelope = Json.parseToJsonElement(response).jsonObject
                    val data = envelope.getValue("data").jsonObject.toMutableMap()
                    data["spacingCandidates"] = kotlinx.serialization.json.JsonArray(emptyList())
                    response = JsonObject(envelope + ("data" to JsonObject(data))).toString()
                }
                if (overviewAdmin) response = response.replace("\"isAdmin\": false", "\"isAdmin\": true")
                if (committed && action != "administration") {
                    response = response.replace("\"offered\"", "\"accepted\"").replace("\"revision\": 2", "\"revision\": 3")
                }
                beforeBusinessResponse?.invoke()
                return reply(200, response)
            }
            commands += body.toString()
            if (commandStatus != 200) return reply(commandStatus, """{"error":{"code":"$commandCode","message":"Rejected"}}""")
            committed = true
            committedAction = action
            if (loseFirstCommandResponse && commands.size == 1) throw IOException("Committed response lost")
            val operation = value.getValue("operationId").jsonPrimitive.content
            val response = if (action == "reconcileMembership") """{"ok":true,"data":{"schemaVersion":1,"environment":"production",
                "operationId":"$operation","action":"reconcileMembership","userId":"member-b","replayed":false,
                "membershipRevision":5,"exceptionId":null}}""" else if (action == "authorizeDeliverySpacingException") """{"ok":true,"data":{
                "schemaVersion":1,"environment":"production","operationId":"$operation","action":"authorizeDeliverySpacingException",
                "userId":"member-c","replayed":false,"membershipRevision":null,"exceptionId":"approved-spacing"}}""" else """{"ok":true,"data":{"schemaVersion":1,"environment":"production",
                "operationId":"$operation","caseId":"case-a","revision":3,"replayed":${commands.size > 1}}}"""
            return reply(200, response)
        }
    }

    private companion object {
        const val PROJECT = "reguerta-integration"
        const val POLICY = "hu084-provisional-v1"
        fun resource(name: String): String = checkNotNull(javaClass.classLoader?.getResourceAsStream(name)).bufferedReader().use { it.readText() }
        fun token(project: String = PROJECT, uid: String = "auth-a", algorithm: String = "RS256", signature: String = "signature",
            audience: String = project, issuer: String = "https://securetoken.google.com/$project"): String =
            listOf("""{"alg":"$algorithm"}""", """{"aud":"$audience","iss":"$issuer","sub":"$uid"}""")
                .joinToString(".") { Base64.getUrlEncoder().withoutPadding().encodeToString(it.toByteArray()) } + ".$signature"
    }
}
