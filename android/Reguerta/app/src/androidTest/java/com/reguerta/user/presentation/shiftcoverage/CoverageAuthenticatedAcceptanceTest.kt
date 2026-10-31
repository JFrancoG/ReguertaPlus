package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.platform.app.InstrumentationRegistry
import com.reguerta.user.data.access.AuthenticatedFirebaseFunctionsClient
import com.reguerta.user.data.access.FirebaseIdTokenProvider
import com.reguerta.user.data.access.FirebaseJsonPostTransport
import com.reguerta.user.data.access.FirebaseProjectIdProvider
import com.reguerta.user.data.shiftcoverage.FirebaseShiftCoverageRepository
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.domain.notifications.ShiftNotificationPushReference
import com.reguerta.user.presentation.shifts.ShiftsRoute
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

/** Real normal route, shared client and repository; transport fixtures perform no external Auth or Firebase writes. */
class CoverageAuthenticatedAcceptanceTest {
    @get:Rule val compose = createComposeRule()
    private val session = ShiftCoverageSession("auth-a", "member-a", 4, "production")
    private val requests = mutableListOf<String>()
    private var enabled = true
    private var committed = false
    private var opened by mutableStateOf(false)
    private lateinit var model: CoverageRouteViewModel

    @Test fun normalShiftsEntryCanConfirmDepartureWithoutASecondLogin() {
        start()
        compose.waitUntil(10_000) { model.isAvailable }
        compose.onNodeWithTag("shifts.coverage").assertIsDisplayed().performClick()
        compose.waitUntil(10_000) { model.coverage.state.value.snapshot != null && !model.coverage.state.value.isBusy }
        compose.onNodeWithTag("coverage.email").assertDoesNotExist()
        compose.onNodeWithTag("coverage.signOut").assertDoesNotExist()
        show("coverage.administration")
        compose.onNodeWithTag("coverage.administration").performClick()
        compose.waitUntil(10_000) { model.coverage.state.value.administration != null && !model.coverage.state.value.isBusy }
        show("coverage.admin.departure.departing-member")
        compose.onNodeWithTag("coverage.admin.departure.departing-member").performClick()
        compose.onNodeWithTag("coverage.admin.reason").performScrollTo().performTextInput("Permanent departure confirmed")
        compose.onNodeWithTag("coverage.admin.confirm").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(10_000) { !model.coverage.state.value.isBusy && model.coverage.state.value.administration?.members?.single()?.permanentDeparture == true }
        compose.runOnIdle {
            val member = model.coverage.state.value.administration!!.members.single()
            assertEquals(0, member.credits.single().pendingCount)
            assertEquals(5, member.credits.single().cancelledCount)
            assertNull(model.coverage.state.value.pendingAdministration)
            assertEquals(1, requests.count { it.contains("\"action\":\"reconcileMembership\"") })
            assertTrue(requests.none { it.contains("expectedPolicyRevision") || it.contains("actor") })
        }
    }

    @Test fun closedAdmissionShowsUnavailableAndCannotPresentPrivateForms() {
        enabled = false
        start()
        compose.waitUntil(10_000) { requests.isNotEmpty() }
        compose.onNodeWithTag("shifts.coverage").assertDoesNotExist()
        compose.runOnIdle {
            assertTrue(!model.isAvailable)
            assertEquals(1, requests.size)
            model.acceptPush(checkNotNull(ShiftNotificationPushReference.validated("coverage-" + "a".repeat(64), "shift_updated", "users")))
            opened = true
        }
        compose.waitUntil(10_000) { model.coverage.state.value.failure != null && !model.coverage.state.value.isBusy }
        show("coverage.failure")
        compose.onNodeWithTag("coverage.failure").assertIsDisplayed()
        show("coverage.open")
        compose.onNodeWithTag("coverage.open").assertIsNotEnabled()
        compose.onNodeWithTag("coverage.administration").assertDoesNotExist()
        compose.onNodeWithTag("coverage.email").assertDoesNotExist()
        compose.runOnIdle {
            assertNull(model.coverage.state.value.snapshot)
            assertNull(model.draft)
            assertEquals(2, requests.size)
            assertTrue(requests.none { it.contains("\"action\"") })
        }
    }

    private fun start() {
        val caller = AuthenticatedFirebaseFunctionsClient(
            FirebaseIdTokenProvider { token() }, FirebaseProjectIdProvider { "reguerta-acceptance" },
            FirebaseJsonPostTransport { url, _, body ->
                requests += body.toString()
                val action = body["action"]?.jsonPrimitive?.content
                val response = when {
                    url.endsWith("/resolveShiftCoverageAccess") -> """{"schemaVersion":1,"environment":"production","memberId":"member-a",
                        "enabled":$enabled,"policyRevision":${if (enabled) "\"hu084-provisional-v1\"" else "null"}}"""
                    action == "administration" -> administration()
                    action == "overview" -> """{"ok":true,"data":{"schemaVersion":1,"environment":"production","memberId":"member-a",
                        "isAdmin":true,"eligible":true,"serverTimeMillis":1800000000000,"policyRevision":"hu084-provisional-v1",
                        "policy":{"maximumOfferWindowMillis":86400000,"volunteerWindowMillis":null,"drawAvailable":false},
                        "cases":[],"credits":[],"reserves":[]}}"""
                    action == "reconcileMembership" -> {
                        committed = true
                        """{"ok":true,"data":{"schemaVersion":1,"environment":"production","operationId":${body.getValue("operationId")},
                            "action":"reconcileMembership","userId":"departing-member","membershipRevision":6,"exceptionId":null,"replayed":false}}"""
                    }
                    else -> error("Unexpected request $action")
                }
                Json.parseToJsonElement(response).jsonObject
            },
        )
        model = CoverageRouteViewModel(FirebaseShiftCoverageRepository(caller, { session }))
        compose.setContent {
            ReguertaTheme {
                if (opened) CoverageScreen(model, expectedSession = session) else ShiftsRoute(
                    shifts = emptyList(), shiftSwapRequests = emptyList(), dismissedShiftSwapRequestIds = emptySet(),
                    acknowledgedShiftSwapCreates = emptyMap(), deliveryCalendarOverrides = emptyList(), currentMember = null,
                    members = emptyList(), isLoading = false, isUpdatingShiftSwapRequest = false, nowMillis = 1800000000000,
                    onRequestShiftSwap = {}, onAcceptShiftSwapRequest = { _, _ -> }, onRejectShiftSwapRequest = { _, _ -> },
                    onCancelShiftSwapRequest = {}, onConfirmShiftSwapRequest = { _, _ -> }, onDismissShiftSwapActivity = {},
                    onOpenCoverage = if (model.isAvailableFor(session)) ({ model.refresh(); opened = true }) else null,
                )
            }
        }
        compose.runOnIdle { model.bindSession(session) }
    }

    private fun administration(): String {
        var value = InstrumentationRegistry.getInstrumentation().context.assets.open("coverage-administration.json")
            .bufferedReader().use { it.readText() }.replace("\"develop\"", "\"production\"")
        if (committed) value = value.replace("\"permanentDeparture\":false", "\"permanentDeparture\":true")
            .replace("\"pendingCount\":2", "\"pendingCount\":0").replace("\"cancelledCount\":3", "\"cancelledCount\":5")
            .replace("\"membershipRevision\":5", "\"membershipRevision\":6")
        return value
    }

    private fun show(tag: String) { compose.onNode(hasScrollAction()).performScrollToNode(hasTestTag(tag)) }
    private fun token(): String = listOf("""{"alg":"RS256"}""", """{"aud":"reguerta-acceptance",
        "iss":"https://securetoken.google.com/reguerta-acceptance","sub":"auth-a"}""")
        .joinToString(".") { Base64.getUrlEncoder().withoutPadding().encodeToString(it.toByteArray()) } + ".fixture-signature"
}
