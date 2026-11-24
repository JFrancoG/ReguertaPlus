package com.reguerta.user.presentation.shiftcoverage

import com.reguerta.user.data.shiftcoverage.CoverageHttpResponse
import com.reguerta.user.data.shiftcoverage.CoverageHttpTransport
import com.reguerta.user.data.shiftcoverage.LocalShiftCoverageRepository
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministrationCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import java.io.IOException
import java.util.Base64
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ShiftCoverageAdministrationTest {
    @Test fun departureReadsBackBothViewsAndRetainsCancelledCreditHistory() = runTest {
        val harness = Harness()
        harness.open()
        val draft = CoverageAdministrationDraft(member = harness.member(), permanentDeparture = true)
        assertNull(draft.command)
        draft.reason = "Permanent departure confirmed by the member"
        harness.model.submitAdministration(checkNotNull(draft.command))
        val member = harness.member()
        assertTrue(member.permanentDeparture)
        assertEquals(0, member.credits.single().pendingCount)
        assertEquals(5, member.credits.single().cancelledCount)
        assertNotNull(harness.model.state.value.snapshot)
        assertNull(harness.model.state.value.pendingAdministration)
        assertEquals(2, harness.transport.overviewReads)
        assertEquals(2, harness.transport.administrationReads)
    }

    @Test fun inactivityReconciliationKeepsCreditsAndAllowsNoOpReceipt() = runTest {
        val harness = Harness()
        harness.open()
        harness.transport.noOp = true
        val draft = CoverageAdministrationDraft(member = harness.member())
        harness.model.submitAdministration(checkNotNull(draft.command))
        assertEquals(5, harness.member().membershipRevision.toInt())
        assertEquals(2, harness.member().credits.single().pendingCount)
        assertFalse(harness.member().permanentDeparture)
        assertNull(harness.model.state.value.pendingAdministration)
    }

    @Test fun uncertainDepartureKeepsOriginalIntentAfterRefreshAndBlocksOtherChanges() = runTest {
        val harness = Harness()
        harness.open()
        harness.transport.loseFirstResponse = true
        val draft = CoverageAdministrationDraft(member = harness.member(), permanentDeparture = true)
        draft.reason = "Permanent departure"
        val command = checkNotNull(draft.command)
        harness.model.submitAdministration(command)
        assertEquals(command, harness.model.state.value.pendingAdministration)
        assertNull(harness.model.openNotification("coverage-fixture-event"))
        harness.model.refresh()
        harness.model.submitAdministration(command.copy(operationId = "second-change"))
        assertEquals(1, harness.transport.commands.size)
        harness.model.retryPending()
        assertEquals(2, harness.transport.commands.size)
        assertEquals(harness.transport.commands.first(), harness.transport.commands.last())
        assertNull(harness.model.state.value.pendingAdministration)
        assertEquals(5, harness.member().credits.single().cancelledCount)
    }

    @Test fun failedReadAfterAcknowledgementNeverReplaysTheDeparture() = runTest {
        val harness = Harness()
        harness.open()
        harness.transport.failReadBack = true
        val draft = CoverageAdministrationDraft(member = harness.member())
        harness.model.submitAdministration(checkNotNull(draft.command))
        assertNull(harness.model.state.value.pendingAdministration)
        assertNull(harness.model.state.value.administration)
        harness.model.retryPending()
        assertEquals(1, harness.transport.commands.size)
        harness.transport.failReadBack = false
        harness.model.refresh()
        assertNotNull(harness.model.state.value.administration)
    }

    @Test fun changedContextAndClosedMaintenanceInvalidateConfirmation() = runTest {
        val harness = Harness()
        harness.open()
        val snapshot = checkNotNull(harness.model.state.value.administration)
        val draft = CoverageAdministrationDraft(member = harness.member())
        assertTrue(draft.isCurrent(snapshot, harness.model.nowMillis))
        assertFalse(draft.isCurrent(snapshot.copy(membershipWritable = false), harness.model.nowMillis))
        assertFalse(draft.isCurrent(snapshot.copy(members = snapshot.members.map { it.copy(contextDigest = "new-source") }), harness.model.nowMillis))
        harness.transport.administration = harness.transport.administration.replace("context-a", "new-source")
        harness.model.refresh()
        harness.model.submitAdministration(checkNotNull(draft.command))
        assertTrue(harness.transport.commands.isEmpty())
    }

    @Test fun activeMemberCannotBeDeclaredPermanentlyDeparted() = runTest {
        val harness = Harness()
        harness.open()
        val draft = CoverageAdministrationDraft(member = harness.member().copy(sourceActive = true), permanentDeparture = true)
        draft.reason = "Must first use account administration"
        assertNull(draft.command)
        assertTrue(harness.transport.commands.isEmpty())
    }

    @Test fun spacingUsesServerPairAndRejectsExpiredOrChangedProposal() = runTest {
        val harness = Harness()
        harness.open()
        val snapshot = checkNotNull(harness.model.state.value.administration)
        val pair = snapshot.spacingCandidates.single()
        val draft = CoverageAdministrationDraft(spacing = pair)
        assertNull(draft.command)
        draft.reason = "The delivery would otherwise be left empty"
        assertTrue(draft.isCurrent(snapshot, harness.model.nowMillis))
        assertFalse(draft.isCurrent(snapshot.copy(spacingCandidates = listOf(pair.copy(contextDigest = "new-proposal"))), harness.model.nowMillis))
        assertFalse(draft.isCurrent(snapshot, 1_896_134_400_000L)) // 2030-02-01, exactly the proposed date.
        harness.model.submitAdministration(checkNotNull(draft.command))
        assertTrue(harness.model.state.value.administration!!.spacingCandidates.isEmpty())
        assertNull(harness.model.state.value.pendingAdministration)
        assertFalse(harness.transport.commands.single().contains("actor"))
    }

    @Test fun foreignReceiptRemainsUncertainAndExactRetryCanAcknowledge() = runTest {
        for (fault in listOf("operation", "user", "action", "result")) {
            val harness = Harness()
            harness.open()
            harness.transport.receiptFault = fault
            val draft = CoverageAdministrationDraft(spacing = harness.model.state.value.administration!!.spacingCandidates.single())
            draft.reason = "Avoid leaving the shift empty"
            harness.model.submitAdministration(checkNotNull(draft.command))
            assertNotNull(harness.model.state.value.pendingAdministration)
            assertEquals(ShiftCoverageFailure.InvalidResponse, harness.model.state.value.failure)
            harness.transport.receiptFault = null
            harness.model.retryPending()
            assertNull(harness.model.state.value.pendingAdministration)
            assertEquals(harness.transport.commands.first(), harness.transport.commands.last())
        }
    }

    @Test fun staleRejectionDiscardsIntentAndRevocationDiscardsPrivateAdministration() = runTest {
        for (status in listOf(409, 403)) {
            val harness = Harness()
            harness.open()
            harness.transport.rejection = status
            val draft = CoverageAdministrationDraft(member = harness.member())
            harness.model.submitAdministration(checkNotNull(draft.command))
            assertNull(harness.model.state.value.pendingAdministration)
            assertNull(harness.model.state.value.administration)
            assertEquals(status == 403, harness.model.state.value.session == null)
            harness.model.retryPending()
            assertEquals(1, harness.transport.commands.size)
        }
    }

    @Test fun logoutDuringAdministrationResponseCannotRestorePrivateState() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.beforeAdministrationResponse = {
            harness.current = harness.current.copy(authorizationRevision = 2)
            harness.model.bind(harness.current)
        }
        harness.model.openAdministration()
        assertNull(harness.model.state.value.administration)
        assertNull(harness.model.state.value.snapshot)
        assertEquals(2, harness.model.state.value.session!!.authorizationRevision.toInt())
        assertFalse(harness.model.state.value.isBusy)
    }

    private class Harness {
        val transport = Transport()
        var current = ShiftCoverageSession("auth-a", "member-a", 1)
        val model = ShiftCoverageViewModel(LocalShiftCoverageRepository(
            port = 8799,
            currentSession = { current },
            tokenProvider = { token() },
            transport = transport,
        )).also { it.bind(current) }
        suspend fun open() { model.refresh(); model.openAdministration() }
        fun member() = checkNotNull(model.state.value.administration).members.single()
    }

    private class Transport : CoverageHttpTransport {
        var administration = administrationFixture
        val commands = mutableListOf<String>()
        var overviewReads = 0
        var administrationReads = 0
        var noOp = false
        var loseFirstResponse = false
        var failReadBack = false
        var receiptFault: String? = null
        var rejection: Int? = null
        var beforeAdministrationResponse: (() -> Unit)? = null
        private val overview = checkNotNull(javaClass.classLoader?.getResourceAsStream("shift-coverage-overview.json"))
            .bufferedReader().use { it.readText() }.replace("\"isAdmin\": false", "\"isAdmin\": true")

        override suspend fun post(url: String, token: String, body: String): CoverageHttpResponse {
            val request = Json.parseToJsonElement(body).jsonObject
            val action = request.getValue("action").jsonPrimitive.content
            if (action == "overview") {
                overviewReads++
                if (commands.isNotEmpty() && failReadBack) throw IOException("Read back unavailable")
                return CoverageHttpResponse(200, overview)
            }
            if (action == "administration") {
                administrationReads++
                beforeAdministrationResponse?.invoke()
                return CoverageHttpResponse(200, administration)
            }
            commands += body
            rejection?.let { return CoverageHttpResponse(it, """{"ok":false,"code":"coverage_conflict"}""") }
            if (action == "reconcileMembership" && request.containsKey("permanentDepartureReason")) {
                administration = administration.replace("\"permanentDeparture\":false", "\"permanentDeparture\":true")
                    .replace("\"pendingCount\":2", "\"pendingCount\":0").replace("\"cancelledCount\":3", "\"cancelledCount\":5")
                    .replace("\"membershipRevision\":5", "\"membershipRevision\":6")
            }
            if (action == "authorizeDeliverySpacingException") {
                val fixture = Json.parseToJsonElement(administration).jsonObject
                val data = fixture.getValue("data").jsonObject.toMutableMap()
                data["spacingCandidates"] = kotlinx.serialization.json.JsonArray(emptyList())
                administration = kotlinx.serialization.json.JsonObject(fixture + ("data" to kotlinx.serialization.json.JsonObject(data))).toString()
            }
            if (loseFirstResponse && commands.size == 1) throw IOException("Response lost after commit")
            val operationId = if (receiptFault == "operation") "foreign-operation" else request.getValue("operationId").jsonPrimitive.content
            val userId = if (receiptFault == "user") "foreign-member" else request.getValue("userId").jsonPrimitive.content
            val receiptAction = if (receiptFault == "action") "reconcileMembership" else action
            val membershipRevision = if (action == "reconcileMembership") (if (noOp) 5 else 6).toString() else "null"
            val exceptionId = if (action == "authorizeDeliverySpacingException" && receiptFault != "result") "\"approved-pair\"" else "null"
            return CoverageHttpResponse(200, """{"ok":true,"data":{"schemaVersion":1,"environment":"develop",
                "operationId":"$operationId","action":"$receiptAction","userId":"$userId","replayed":${commands.size > 1},
                "membershipRevision":$membershipRevision,"exceptionId":$exceptionId}}""")
        }
    }

    private companion object {
        fun token(): String = listOf("""{"alg":"none"}""", """{"aud":"demo-reguerta-hu084-coverage",
            "iss":"https://securetoken.google.com/demo-reguerta-hu084-coverage","sub":"auth-a"}""")
            .joinToString(".") { Base64.getUrlEncoder().withoutPadding().encodeToString(it.toByteArray()) } + "."

        val administrationFixture = """{"ok":true,"data":{"schemaVersion":1,"environment":"develop","memberId":"member-a",
            "isAdmin":true,"serverTimeMillis":1800000000000,"policyRevision":"hu084-provisional-v1","membershipWritable":true,
            "members":[{"userId":"departing-member","displayName":"Socio de ensayo","membershipRevision":5,"sourceActive":false,
            "eligible":false,"permanentDeparture":false,"pendingQueueTransition":false,"contextDigest":"context-a",
            "reserves":[{"type":"delivery","active":false,"enteredAtMillis":1700000000000,"admissionAfterRound":2}],
            "credits":[{"type":"delivery","pendingCount":2,"consumedCount":1,"cancelledCount":3}]}],
            "spacingCandidates":[{"id":"pair-a","userId":"member-b","displayName":"Responsable de ensayo","planningRequestId":"bundle-a",
            "previousDate":"2030-01-01","previousRoundNumber":2,"date":"2030-02-01","roundNumber":3,"contextDigest":"spacing-context"}],
            "spacingUnavailableReason":null}}"""
    }
}
