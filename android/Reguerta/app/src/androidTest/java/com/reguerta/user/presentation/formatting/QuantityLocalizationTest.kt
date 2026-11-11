package com.reguerta.user.presentation.formatting

import android.content.res.Configuration
import android.content.res.Resources
import android.os.LocaleList
import androidx.test.platform.app.InstrumentationRegistry
import com.reguerta.user.R
import com.reguerta.user.presentation.orders.localizedGenericOrderHistoryQuantityLabel
import org.junit.Assert.assertEquals
import org.junit.Test

class QuantityLocalizationTest {
    @Test
    fun unitQuantitiesRespectEnglishAndSpanishGrammar() {
        val cases = listOf(
            QuantityCopy("en", 0, "0 units"),
            QuantityCopy("en", 1, "1 unit"),
            QuantityCopy("en", 2, "2 units"),
            QuantityCopy("en", 1_000_000, "1000000 units"),
            QuantityCopy("es", 0, "0 uds."),
            QuantityCopy("es", 1, "1 ud."),
            QuantityCopy("es", 2, "2 uds."),
            QuantityCopy("es", 1_000_000, "1000000 uds."),
        )

        cases.forEach { case ->
            val resources = resourcesFor(case.language)
            assertEquals(
                case.expected,
                resources.getQuantityString(R.plurals.my_order_quantity, case.count, case.count),
            )
        }
    }

    @Test
    fun waitingCandidatesRespectEnglishAndSpanishGrammar() {
        val cases = listOf(
            QuantityCopy("en", 0, "Waiting for responses from 0 possible members."),
            QuantityCopy("en", 1, "Waiting for a response from 1 possible member."),
            QuantityCopy("en", 2, "Waiting for responses from 2 possible members."),
            QuantityCopy("en", 1_000_000, "Waiting for responses from 1000000 possible members."),
            QuantityCopy("es", 0, "Pendiente de respuesta de 0 socios posibles."),
            QuantityCopy("es", 1, "Pendiente de respuesta de 1 socio posible."),
            QuantityCopy("es", 2, "Pendiente de respuesta de 2 socios posibles."),
            QuantityCopy("es", 1_000_000, "Pendiente de respuesta de 1000000 socios posibles."),
        )

        cases.forEach { case ->
            val resources = resourcesFor(case.language)
            assertEquals(
                case.expected,
                resources.getQuantityString(R.plurals.shift_swap_request_waiting, case.count, case.count),
            )
        }
    }

    @Test
    fun historicalGenericUnitLabelsUseTheActiveQuantityResources() {
        val cases = listOf(
            HistoricalCopy("en", "0 uds.", "0 units"),
            HistoricalCopy("en", "1 ud.", "1 unit"),
            HistoricalCopy("en", "2 ud(s).", "2 units"),
            HistoricalCopy("es", "0 uds.", "0 uds."),
            HistoricalCopy("es", "1 ud.", "1 ud."),
            HistoricalCopy("es", "2 ud(s).", "2 uds."),
        )

        cases.forEach { case ->
            val resources = resourcesFor(case.language)
            val actual = localizedGenericOrderHistoryQuantityLabel(case.rawLabel) { count ->
                resources.getQuantityString(R.plurals.my_order_quantity, count, count)
            }
            assertEquals(case.expected, actual)
        }
    }

    @Test
    fun shiftPlanningMessagesKeepBothIndependentCounts() {
        val cases = listOf(
            PlanningCopy(
                0, 0,
                "Delivery shifts: 0 · Market shifts: 0",
                "Turnos de reparto: 0 · Turnos de mercado: 0",
                "Staged candidate — shifts: 0 · assignments: 0",
                "Candidato preparado — turnos: 0 · asignaciones: 0",
            ),
            PlanningCopy(
                0, 1,
                "Delivery shifts: 0 · Market shifts: 1",
                "Turnos de reparto: 0 · Turnos de mercado: 1",
                "Staged candidate — shifts: 0 · assignments: 1",
                "Candidato preparado — turnos: 0 · asignaciones: 1",
            ),
            PlanningCopy(
                0, 2,
                "Delivery shifts: 0 · Market shifts: 2",
                "Turnos de reparto: 0 · Turnos de mercado: 2",
                "Staged candidate — shifts: 0 · assignments: 2",
                "Candidato preparado — turnos: 0 · asignaciones: 2",
            ),
            PlanningCopy(
                1, 0,
                "Delivery shifts: 1 · Market shifts: 0",
                "Turnos de reparto: 1 · Turnos de mercado: 0",
                "Staged candidate — shifts: 1 · assignments: 0",
                "Candidato preparado — turnos: 1 · asignaciones: 0",
            ),
            PlanningCopy(
                1, 1,
                "Delivery shifts: 1 · Market shifts: 1",
                "Turnos de reparto: 1 · Turnos de mercado: 1",
                "Staged candidate — shifts: 1 · assignments: 1",
                "Candidato preparado — turnos: 1 · asignaciones: 1",
            ),
            PlanningCopy(
                1, 2,
                "Delivery shifts: 1 · Market shifts: 2",
                "Turnos de reparto: 1 · Turnos de mercado: 2",
                "Staged candidate — shifts: 1 · assignments: 2",
                "Candidato preparado — turnos: 1 · asignaciones: 2",
            ),
            PlanningCopy(
                2, 0,
                "Delivery shifts: 2 · Market shifts: 0",
                "Turnos de reparto: 2 · Turnos de mercado: 0",
                "Staged candidate — shifts: 2 · assignments: 0",
                "Candidato preparado — turnos: 2 · asignaciones: 0",
            ),
            PlanningCopy(
                2, 1,
                "Delivery shifts: 2 · Market shifts: 1",
                "Turnos de reparto: 2 · Turnos de mercado: 1",
                "Staged candidate — shifts: 2 · assignments: 1",
                "Candidato preparado — turnos: 2 · asignaciones: 1",
            ),
            PlanningCopy(
                2, 2,
                "Delivery shifts: 2 · Market shifts: 2",
                "Turnos de reparto: 2 · Turnos de mercado: 2",
                "Staged candidate — shifts: 2 · assignments: 2",
                "Candidato preparado — turnos: 2 · asignaciones: 2",
            ),
        )
        val english = resourcesFor("en")
        val spanish = resourcesFor("es")

        cases.forEach { case ->
            assertEquals(
                case.englishSummary,
                english.getString(R.string.settings_shift_planning_summary_format, case.first, case.second),
            )
            assertEquals(
                case.spanishSummary,
                spanish.getString(R.string.settings_shift_planning_summary_format, case.first, case.second),
            )
            assertEquals(
                case.englishCandidate,
                english.getString(R.string.settings_shift_planning_candidate_format, case.first, case.second),
            )
            assertEquals(
                case.spanishCandidate,
                spanish.getString(R.string.settings_shift_planning_candidate_format, case.first, case.second),
            )
        }
    }

    private fun resourcesFor(language: String): Resources {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val configuration = Configuration(context.resources.configuration).apply {
            setLocales(LocaleList.forLanguageTags(language))
        }
        return context.createConfigurationContext(configuration).resources
    }
}

private data class QuantityCopy(val language: String, val count: Int, val expected: String)

private data class HistoricalCopy(val language: String, val rawLabel: String, val expected: String)

private data class PlanningCopy(
    val first: Int,
    val second: Int,
    val englishSummary: String,
    val spanishSummary: String,
    val englishCandidate: String,
    val spanishCandidate: String,
)
