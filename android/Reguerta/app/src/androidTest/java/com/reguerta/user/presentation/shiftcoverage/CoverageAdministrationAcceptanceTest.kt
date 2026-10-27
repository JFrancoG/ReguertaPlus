package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.compose.ui.unit.Density
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.matcher.RootMatchers.isDialog
import androidx.test.espresso.matcher.ViewMatchers.isRoot
import androidx.test.platform.app.InstrumentationRegistry
import com.reguerta.user.data.shiftcoverage.CoverageHttpResponse
import com.reguerta.user.data.shiftcoverage.CoverageHttpTransport
import com.reguerta.user.data.shiftcoverage.LocalShiftCoverageRepository
import com.reguerta.user.domain.shiftcoverage.CoverageRehearsalAccess
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.ui.theme.ReguertaTheme
import java.util.Base64
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** Production UI and HTTP pipeline with deterministic transport; no real Auth, Sheets or Firebase writes. */
class CoverageAdministrationAcceptanceTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var model: CoverageRehearsalViewModel
    private lateinit var transport: Transport

    @Test fun permanentDepartureCanBeCancelledAtLargeTextWithTheKeyboardVisible() {
        start()
        show("coverage.admin.departure.departing-member")
        compose.onNodeWithTag("coverage.admin.departure.departing-member").performClick()
        compose.onNodeWithTag("coverage.admin.reason").performScrollTo().performClick().performTextInput("Cancellation rehearsal")
        lateinit var dialogView: android.view.View
        onView(isRoot()).inRoot(isDialog()).check { view, _ -> dialogView = view }
        compose.waitUntil(5_000) {
            compose.runOnIdle { ViewCompat.getRootWindowInsets(dialogView)?.isVisible(WindowInsetsCompat.Type.ime()) == true }
        }
        compose.onNodeWithTag("coverage.admin.dismiss").performScrollTo().assertIsDisplayed().performTouchInput { click() }
        compose.onNodeWithTag("coverage.admin.dismiss").assertDoesNotExist()
        compose.runOnIdle {
            assertNull(model.administrationDraft)
            assertTrue(transport.commands.isEmpty())
            assertEquals(2, model.coverage.state.value.administration!!.members.single().credits.single().pendingCount)
        }
    }

    @Test fun departureConfirmationAndSpacingConfirmationRefreshTheirOwnExactTargets() {
        start()
        show("coverage.admin.departure.departing-member")
        compose.onNodeWithTag("coverage.admin.departure.departing-member").performClick()
        compose.onNodeWithTag("coverage.admin.reason").performScrollTo().performTextInput("Permanent departure confirmed")
        compose.onNodeWithTag("coverage.admin.confirm").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(10_000) { !model.coverage.state.value.isBusy && model.coverage.state.value.administration?.members?.single()?.permanentDeparture == true }
        compose.runOnIdle {
            assertEquals(0, model.coverage.state.value.administration!!.members.single().credits.single().pendingCount)
            assertEquals(5, model.coverage.state.value.administration!!.members.single().credits.single().cancelledCount)
            assertEquals(1, transport.commands.size)
        }
        show("coverage.admin.spacing.pair-a")
        compose.onNodeWithTag("coverage.admin.spacing.pair-a").performClick()
        compose.onNodeWithTag("coverage.admin.reason").performScrollTo().performTextInput("The shift would otherwise remain empty")
        compose.onNodeWithTag("coverage.admin.confirm").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(10_000) { !model.coverage.state.value.isBusy && model.coverage.state.value.administration?.spacingCandidates?.isEmpty() == true }
        compose.runOnIdle {
            assertEquals(2, transport.commands.size)
            assertNull(model.coverage.state.value.pendingAdministration)
            assertNotNullOverview()
        }
    }

    private fun assertNotNullOverview() { assertTrue(model.coverage.state.value.snapshot != null) }

    private fun start() {
        transport = Transport()
        val session = ShiftCoverageSession("auth-a", "member-a", 1)
        val repository = LocalShiftCoverageRepository(port = 8799, currentSession = { session },
            tokenProvider = { token() }, transport = transport)
        model = CoverageRehearsalViewModel(object : CoverageRehearsalAccess {
            override val repository = repository
            override suspend fun signIn(email: String, password: String) = session
            override fun signOut() { }
        })
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 2f)) {
                ReguertaTheme { CoverageScreen(model) }
            }
        }
        compose.runOnIdle { model.coverage.bind(session); model.refresh() }
        compose.waitUntil(10_000) { model.coverage.state.value.snapshot != null && !model.coverage.state.value.isBusy }
        show("coverage.administration")
        compose.onNodeWithTag("coverage.administration").performClick()
        compose.waitUntil(10_000) { model.coverage.state.value.administration != null && !model.coverage.state.value.isBusy }
    }

    private fun show(tag: String) { compose.onNode(hasScrollAction()).performScrollToNode(hasTestTag(tag)) }

    private class Transport : CoverageHttpTransport {
        var administration = InstrumentationRegistry.getInstrumentation().context.assets.open("coverage-administration.json")
            .bufferedReader().use { it.readText() }
        val commands = mutableListOf<String>()
        override suspend fun post(url: String, token: String, body: String): CoverageHttpResponse {
            val command = Json.parseToJsonElement(body).jsonObject
            val action = command.getValue("action").jsonPrimitive.content
            if (action == "overview") return CoverageHttpResponse(200, """{"ok":true,"data":{"schemaVersion":1,
                "environment":"develop","memberId":"member-a","isAdmin":true,"eligible":true,"serverTimeMillis":1800000000000,
                "policyRevision":"hu084-provisional-v1","policy":{"maximumOfferWindowMillis":86400000,
                "volunteerWindowMillis":null,"drawAvailable":false},"cases":[],"credits":[],"reserves":[]}}""")
            if (action == "administration") return CoverageHttpResponse(200, administration)
            commands += body
            if (action == "reconcileMembership") {
                administration = administration.replace("\"permanentDeparture\":false", "\"permanentDeparture\":true")
                    .replace("\"pendingCount\":2", "\"pendingCount\":0").replace("\"cancelledCount\":3", "\"cancelledCount\":5")
                    .replace("\"membershipRevision\":5", "\"membershipRevision\":6")
            } else {
                val envelope = Json.parseToJsonElement(administration).jsonObject
                val data = envelope.getValue("data").jsonObject.toMutableMap()
                data["spacingCandidates"] = kotlinx.serialization.json.JsonArray(emptyList())
                administration = kotlinx.serialization.json.JsonObject(envelope + ("data" to kotlinx.serialization.json.JsonObject(data))).toString()
            }
            val operationId = command.getValue("operationId").jsonPrimitive.content
            val userId = command.getValue("userId").jsonPrimitive.content
            val revision = if (action == "reconcileMembership") "6" else "null"
            val exceptionId = if (action == "reconcileMembership") "null" else "\"approved-pair\""
            return CoverageHttpResponse(200, """{"ok":true,"data":{"schemaVersion":1,"environment":"develop",
                "operationId":"$operationId","action":"$action","userId":"$userId","replayed":false,
                "membershipRevision":$revision,"exceptionId":$exceptionId}}""")
        }
    }

    private fun token(): String = listOf("""{"alg":"none"}""", """{"aud":"demo-reguerta-hu084-coverage",
        "iss":"https://securetoken.google.com/demo-reguerta-hu084-coverage","sub":"auth-a"}""")
        .joinToString(".") { Base64.getUrlEncoder().withoutPadding().encodeToString(it.toByteArray()) } + "."
}
