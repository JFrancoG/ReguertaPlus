package com.reguerta.user.presentation.shiftcoverage

import com.reguerta.user.data.shiftcoverage.CoverageHttpResponse
import com.reguerta.user.data.shiftcoverage.CoverageHttpTransport
import com.reguerta.user.data.shiftcoverage.LocalCoverageRehearsalAccess
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand.Action
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import java.util.Base64
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.*
import org.junit.Test

class CoverageRehearsalTest {
    @Test fun loginResolvesCanonicalMemberAndLogoutPreventsFurtherHTTP() = runTest {
        val transport = LoginTransport()
        val access = LocalCoverageRehearsalAccess(transport = transport)
        val session = access.signIn("a@example.test", "fixture")
        assertEquals("auth-a", session.uid)
        assertEquals("member-a", session.memberId)
        assertEquals(2, transport.urls.size)
        assertTrue(transport.urls.first().startsWith("http://10.0.2.2:9098/"))
        access.signOut()
        assertEquals(ShiftCoverageFailure.SessionChanged, runCatching { access.repository.read(caseId = null, session = session) }.exceptionOrNull())
        assertEquals(2, transport.urls.size)
    }

    @Test fun foreignTokenOrConcurrentLogoutCannotReachCoverage() = runTest {
        for (logout in listOf(false, true)) {
            val transport = LoginTransport()
            val access = LocalCoverageRehearsalAccess(transport = transport)
            if (logout) transport.beforeLoginResponse = access::signOut else transport.project = "real-project"
            val error = runCatching { access.signIn("a@example.test", "fixture") }.exceptionOrNull()
            assertEquals(if (logout) ShiftCoverageFailure.SessionChanged else ShiftCoverageFailure.LocalOnly, error)
            assertEquals(1, transport.urls.size)
        }
    }

    @Test fun drawActionsAdvanceAndWithdrawnVolunteersCannotReenter() = runTest {
        val transport = LoginTransport()
        val access = LocalCoverageRehearsalAccess(transport = transport)
        val session = access.signIn("a@example.test", "fixture")
        val model = ShiftCoverageViewModel(access.repository)
        model.bind(session)
        transport.overview = transport.overview.replace("\"isAdmin\": false", "\"isAdmin\": true")
            .replace("\"drawAvailable\": false", "\"drawAvailable\": true")
            .replace("\"offered\"", "\"open\"")
            .replace("\"selectionPhase\": \"reserve\"", "\"selectionPhase\": \"drawRequired\"")
        model.refresh()
        assertTrue(model.actions(model.state.value.snapshot!!.cases.first()).contains(Action.commitDraw))
        transport.overview = transport.overview.replace("\"administration\": null",
            "\"administration\": null, \"drawCommitted\": true, \"drawAvailableAtMillis\": 1799999999999")
        model.refresh()
        val actions = model.actions(model.state.value.snapshot!!.cases.first())
        assertTrue(actions.contains(Action.revealDraw))
        assertFalse(actions.contains(Action.commitDraw))
        transport.overview = transport.overview.replace("\"drawRequired\"", "\"volunteers\"")
            .replace("\"volunteerClosesAtMillis\": null", "\"volunteerClosesAtMillis\": 1800003600000")
            .replace("\"administration\": null", "\"administration\": null, \"hasVolunteered\": true")
        model.refresh()
        assertFalse(model.actions(model.state.value.snapshot!!.cases.first()).contains(Action.volunteer))
    }

    @Test fun newAbsenceNeedsAssignedMemberAndReasonAndPreservesIntentIdentity() {
        val snapshot = snapshot()
        val draft = CoverageCommandDraft(Action.open, null, snapshot, snapshot.serverTimeMillis)
        assertNull(draft.command)
        draft.memberId = "member-b"
        draft.reason = "Family appointment"
        assertNull(draft.command)
        draft.memberId = "member-a"
        assertEquals(7L, draft.command!!.expectedShiftRevision)
        assertEquals("member-a", draft.command!!.absentUserId)
        assertEquals("market-next", draft.command!!.shiftId)
        assertEquals(draft.command!!.operationId, draft.command!!.operationId)
        assertNull(draft.command!!.userId)
        assertNull(draft.command!!.expiresAtMillis)
    }

    @Test fun sessionChangeInvalidatesOpenConfirmation() = runTest {
        val transport = LoginTransport()
        val access = LocalCoverageRehearsalAccess(transport = transport)
        val model = CoverageRehearsalViewModel(access)
        val session = access.signIn("a@example.test", "fixture")
        model.coverage.bind(session)
        model.coverage.refresh()
        model.present(Action.accept, model.coverage.state.value.snapshot!!.cases.first())
        assertTrue(model.canConfirmDraft())
        transport.overview = transport.overview.replace("1800003600000", "1799999999999")
        model.coverage.refresh()
        assertFalse(model.canConfirmDraft())
        model.coverage.bind(session.copy(authorizationRevision = session.authorizationRevision + 1))
        assertFalse(model.canConfirmDraft())
        model.signOut()
        assertNull(model.draft)
    }

    private fun snapshot(): ShiftCoverageSnapshot = json.decodeFromString(
        Json.parseToJsonElement(fixture()).jsonObject.getValue("data").toString())

    private class LoginTransport : CoverageHttpTransport {
        val urls = mutableListOf<String>()
        var project = "demo-reguerta-hu084-coverage"
        var overview = fixture()
        var beforeLoginResponse: (() -> Unit)? = null
        override suspend fun post(url: String, token: String, body: String): CoverageHttpResponse {
            urls += url
            if (url.contains(":9098/")) {
                beforeLoginResponse?.invoke()
                val parts = listOf("""{"alg":"none"}""", """{"aud":"$project","iss":"https://securetoken.google.com/$project","sub":"auth-a"}""")
                val value = parts.joinToString(".") { Base64.getUrlEncoder().withoutPadding().encodeToString(it.toByteArray()) } + "."
                return CoverageHttpResponse(200, """{"localId":"auth-a","idToken":"$value"}""")
            }
            return CoverageHttpResponse(200, overview)
        }
    }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        private fun fixture(): String = requireNotNull(CoverageRehearsalTest::class.java.classLoader)
            .getResourceAsStream("shift-coverage-overview.json")!!.bufferedReader().use { it.readText() }
    }
}
