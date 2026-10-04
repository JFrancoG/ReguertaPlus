package com.reguerta.user.presentation.shiftcoverage

import com.reguerta.user.data.shiftcoverage.CoverageHttpResponse
import com.reguerta.user.data.shiftcoverage.CoverageHttpTransport
import com.reguerta.user.data.shiftcoverage.LocalShiftCoverageRepository
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import java.io.IOException
import java.util.Base64
import kotlinx.coroutines.yield
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
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

class ShiftCoverageClientTest {
    @Test fun returningDuringRequestRestoresOverviewWithoutReplayingUncertainCommand() = runTest {
        for (command in listOf(false, true)) {
            val harness = Harness()
            harness.model.openNotification("coverage-fixture-event")
            harness.transport.loseFirstCommandResponse = command
            harness.transport.whileRequestPending = {
                harness.transport.whileRequestPending = null
                yield()
                assertTrue(harness.model.state.value.isBusy)
                harness.model.refreshOverview()
            }
            if (command) harness.model.submit(harness.command) else harness.model.refresh()
            assertNull(harness.model.state.value.snapshot?.notification)
            assertNotNull(harness.model.state.value.snapshot)
            assertFalse(harness.model.state.value.isBusy)
            assertEquals(if (command) harness.command else null, harness.model.state.value.pendingCommand)
            assertEquals(if (command) 1 else 0, harness.transport.commands.size)
            harness.model.refresh()
            assertNull(harness.model.state.value.snapshot?.notification)
            assertEquals(if (command) 1 else 0, harness.transport.commands.size)
        }
    }

    @Test fun notificationRefreshRetainsItsAuthorityUntilReturningToOverview() = runTest {
        val harness = Harness()
        assertEquals("case-a", harness.model.openNotification("coverage-fixture-event"))
        harness.model.refresh()
        assertEquals(ShiftCoverageSnapshot.Status.accepted, harness.model.state.value.snapshot?.cases?.first()?.status)
        harness.model.refreshOverview()
        assertEquals(ShiftCoverageSnapshot.Status.offered, harness.model.state.value.snapshot?.cases?.first()?.status)
        assertTrue(harness.transport.commands.isEmpty())
    }

    @Test fun notificationLoadsCurrentCaseWithoutReplayingOldOffer() = runTest {
        val harness = Harness()
        harness.model.refresh()
        assertEquals("case-a", harness.model.openNotification("coverage-fixture-event"))
        assertEquals(ShiftCoverageSnapshot.Status.accepted, harness.model.state.value.snapshot?.cases?.first()?.status)
        assertEquals(3L, harness.model.state.value.snapshot?.cases?.first()?.revision)
        assertTrue(harness.transport.commands.isEmpty())
    }

    @Test fun mismatchedNotificationCannotEnableNavigation() = runTest {
        for ((from, to) in listOf(
            "coverage-fixture-event" to "another-event",
            "\"caseRevision\": 2" to "\"caseRevision\": 4",
            "\"memberId\": \"member-a\"" to "\"memberId\": \"someone-else\"",
            "\"caseId\": \"case-a\",\n      \"caseRevision\"" to "\"caseId\": \"wrong-case\",\n      \"caseRevision\"",
        )) {
            val harness = Harness()
            harness.transport.notification = harness.transport.notification.replace(from, to)
            assertNull(harness.model.openNotification("coverage-fixture-event"))
            assertNull(harness.model.state.value.snapshot)
            assertEquals(ShiftCoverageFailure.InvalidResponse, harness.model.state.value.failure)
        }
    }

    @Test fun notificationAfterSessionChangeCannotNavigateOrRestorePrivateState() = runTest {
        val harness = Harness()
        harness.transport.beforeResponse = { harness.bind(2) }
        assertNull(harness.model.openNotification("coverage-fixture-event"))
        assertNull(harness.model.state.value.snapshot)
        assertEquals(2L, harness.model.state.value.session?.authorizationRevision)
    }

    @Test fun notificationDoesNotDiscardUncertainCommand() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.loseFirstCommandResponse = true
        harness.model.submit(harness.command)
        val requests = harness.transport.requests
        assertNull(harness.model.openNotification("coverage-fixture-event"))
        assertEquals(requests, harness.transport.requests)
        assertEquals(harness.command, harness.model.state.value.pendingCommand)
    }

    @Test fun inboxAndAcceptanceUsePrivateProjectionAndReadBack() = runTest {
        val harness = Harness()
        harness.model.refresh()
        assertEquals(ShiftCoverageSnapshot.Status.offered, harness.model.state.value.snapshot?.cases?.first()?.status)
        assertEquals(ShiftCoverageSnapshot.CreditState.pending, harness.model.state.value.snapshot?.credits?.first()?.state)
        assertNull(harness.model.state.value.snapshot?.cases?.first()?.administration)
        harness.model.submit(harness.command)
        assertEquals(ShiftCoverageSnapshot.Status.accepted, harness.model.state.value.snapshot?.cases?.first()?.status)
        assertNull(harness.model.state.value.pendingCommand)
        assertEquals(1, harness.transport.commands.size)
    }

    @Test fun uncertainAcceptanceRetriesExactIntentAndPreventsAnotherMutation() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.loseFirstCommandResponse = true
        harness.model.submit(harness.command)
        assertNull(harness.model.state.value.snapshot)
        assertEquals(harness.command, harness.model.state.value.pendingCommand)
        harness.model.submit(harness.command.copy(operationId = "another-intent"))
        assertEquals(1, harness.transport.commands.size)
        harness.model.retryPending()
        assertEquals(2, harness.transport.commands.size)
        assertEquals(harness.transport.commands.first(), harness.transport.commands.last())
        assertNull(harness.model.state.value.pendingCommand)
        assertEquals(ShiftCoverageSnapshot.Status.accepted, harness.model.state.value.snapshot?.cases?.first()?.status)
    }

    @Test fun acknowledgedWriteWithFailedReadBackIsNotReplayed() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.failReadBack = true
        harness.model.submit(harness.command)
        assertNull(harness.model.state.value.snapshot)
        assertNull(harness.model.state.value.pendingCommand)
        harness.model.retryPending()
        assertEquals(1, harness.transport.commands.size)
        harness.transport.failReadBack = false
        harness.model.refresh()
        assertEquals(ShiftCoverageSnapshot.Status.accepted, harness.model.state.value.snapshot?.cases?.first()?.status)
    }

    @Test fun authorizationChangeDuringTokenRefreshPreventsHTTP() = runTest {
        val harness = Harness()
        harness.onToken = { harness.bind(2) }
        harness.model.refresh()
        assertEquals(0, harness.transport.requests)
        assertNull(harness.model.state.value.snapshot)
        assertEquals(2L, harness.model.state.value.session?.authorizationRevision)
        harness.onToken = null
        harness.model.refresh()
        assertNotNull(harness.model.state.value.snapshot)
    }

    @Test fun oldSessionHTTPCompletionCannotPopulateNewSession() = runTest {
        val harness = Harness()
        harness.transport.beforeResponse = { harness.bind(2) }
        harness.model.refresh()
        assertNull(harness.model.state.value.snapshot)
        assertFalse(harness.model.state.value.isBusy)
        harness.transport.beforeResponse = null
        harness.model.refresh()
        assertNotNull(harness.model.state.value.snapshot)
    }

    @Test fun productionAndMismatchedCredentialsNeverReachHTTP() = runTest {
        for (invalid in listOf(
            token() + "signature",
            token(project = "reguerta-real"),
            token(uid = "auth-b"),
        )) {
            val harness = Harness()
            harness.token = invalid
            harness.model.refresh()
            assertEquals(ShiftCoverageFailure.LocalOnly, harness.model.state.value.failure)
            assertEquals(0, harness.transport.requests)
        }
    }

    @Test fun incompatibleOrForeignInboxCannotEnableCommands() = runTest {
        for ((from, to) in listOf(
            "\"memberId\": \"member-a\"" to "\"memberId\": \"someone-else\"",
            "\"schemaVersion\": 1" to "\"schemaVersion\": 2",
            "\"offered\"" to "\"unknown\"",
            "hu084-provisional-v1" to "unratified-v2",
        )) {
            val harness = Harness()
            harness.transport.overview = harness.transport.overview.replace(from, to)
            harness.model.refresh()
            harness.model.submit(harness.command)
            assertEquals(ShiftCoverageFailure.InvalidResponse, harness.model.state.value.failure)
            assertNull(harness.model.state.value.snapshot)
            assertTrue(harness.transport.commands.isEmpty())
        }
    }

    @Test fun mismatchedReceiptStaysUncertainAndRevocationDropsPrivateState() = runTest {
        val harness = Harness()
        harness.model.refresh()
        harness.transport.wrongReceipt = true
        harness.model.submit(harness.command)
        assertNotNull(harness.model.state.value.pendingCommand)
        harness.transport.rejectionStatus = 401
        harness.model.retryPending()
        assertNull(harness.model.state.value.session)
        assertNull(harness.model.state.value.snapshot)
        assertNull(harness.model.state.value.pendingCommand)
    }

    @Test fun definitiveRejectionClearsIntentAndRequiresFreshAuthority() = runTest {
        for (status in listOf(400, 403, 409)) {
            val harness = Harness()
            harness.model.refresh()
            harness.transport.rejectionStatus = status
            harness.model.submit(harness.command)
            assertNull(harness.model.state.value.pendingCommand)
            assertNull(harness.model.state.value.snapshot)
            assertFalse(harness.model.state.value.isBusy)
            assertEquals(status == 403, harness.model.state.value.session == null)
            harness.model.retryPending()
            assertEquals(1, harness.transport.commands.size)
        }
    }

    @Test fun cancellationAfterSendingKeepsIntentForExplicitReplay() = runTest {
        val harness = Harness()
        harness.model.refresh()
        var running: Job? = null
        harness.transport.beforeResponse = { running?.cancel() }
        running = launch { harness.model.submit(harness.command) }
        running.join()
        assertEquals(harness.command, harness.model.state.value.pendingCommand)
        assertNull(harness.model.state.value.snapshot)
        assertFalse(harness.model.state.value.isBusy)
        harness.transport.beforeResponse = null
        harness.model.retryPending()
        assertNull(harness.model.state.value.pendingCommand)
        assertEquals(2, harness.transport.commands.size)
        assertEquals(ShiftCoverageSnapshot.Status.accepted, harness.model.state.value.snapshot?.cases?.first()?.status)
    }

    private class Harness {
        val transport = Transport()
        var current = ShiftCoverageSession("auth-a", "member-a", 1)
        var token = token()
        var onToken: (() -> Unit)? = null
        val command = ShiftCoverageCommand("case-a", "accept-once", 2, 4, ShiftCoverageCommand.Action.accept)
        val model = ShiftCoverageViewModel(LocalShiftCoverageRepository(
            port = 8799,
            currentSession = { current },
            tokenProvider = { onToken?.invoke(); token },
            transport = transport,
        )).also { it.bind(current) }

        fun bind(revision: Long) {
            current = current.copy(authorizationRevision = revision)
            model.bind(current)
        }
    }

    private class Transport : CoverageHttpTransport {
        var overview = checkNotNull(javaClass.classLoader?.getResourceAsStream("shift-coverage-overview.json"))
            .bufferedReader().use { it.readText() }
        var notification = checkNotNull(javaClass.classLoader?.getResourceAsStream("shift-coverage-notification.json"))
            .bufferedReader().use { it.readText() }
        val commands = mutableListOf<String>()
        var requests = 0
        var loseFirstCommandResponse = false
        var failReadBack = false
        var wrongReceipt = false
        var rejectionStatus: Int? = null
        var whileRequestPending: (suspend () -> Unit)? = null
        var beforeResponse: (() -> Unit)? = null

        override suspend fun post(url: String, token: String, body: String): CoverageHttpResponse {
            requests++
            val action = Json.parseToJsonElement(body).jsonObject.getValue("action").jsonPrimitive.content
            whileRequestPending?.invoke()
            var response = overview
            if (action == "notification") {
                response = notification
            } else if (action != "overview" && action != "detail") {
                commands += body
                if (loseFirstCommandResponse && commands.size == 1) throw IOException("Lost response")
                val operationId = if (wrongReceipt) "wrong-operation" else "accept-once"
                response = """{"ok":true,"data":{"schemaVersion":1,"environment":"develop","caseId":"case-a",
                    "operationId":"$operationId","revision":3,"replayed":${commands.size > 1}}}"""
            } else if (commands.isNotEmpty()) {
                if (failReadBack) throw IOException("Failed read-back")
                response = overview.replace("\"offered\"", "\"accepted\"")
            }
            beforeResponse?.invoke()
            if (rejectionStatus != null) response = """{"ok":false,"code":"auth_invalid"}"""
            return CoverageHttpResponse(rejectionStatus ?: 200, response)
        }
    }

    private companion object {
        fun token(project: String = "demo-reguerta-hu084-coverage", uid: String = "auth-a"): String =
            listOf("""{"alg":"none"}""", """{"aud":"$project","iss":"https://securetoken.google.com/$project","sub":"$uid"}""")
                .joinToString(".") { Base64.getUrlEncoder().withoutPadding().encodeToString(it.toByteArray()) } + "."
    }
}
