package com.reguerta.user.presentation.bylaws

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.reguerta.user.R
import com.reguerta.user.domain.bylaws.BylawsAssistantCapability
import com.reguerta.user.domain.bylaws.BylawsAssistantStatus
import com.reguerta.user.presentation.root.BylawsAnswerDiagnostics
import com.reguerta.user.presentation.root.BylawsAnswerResult
import com.reguerta.user.presentation.root.BylawsCitation
import com.reguerta.user.presentation.root.BylawsEvidenceDiagnostic
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BylawsRouteTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun pdfOnlyModeKeepsSingleEmbeddedPdfActionAndHidesQuestionComposerAndRetry() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        composeRule.setContent {
            ReguertaTheme {
                BylawsRoute(
                    queryInput = "",
                    answerResult = null,
                    assistantCapability = BylawsAssistantCapability.Unavailable,
                    isLoading = false,
                    onQueryChanged = {},
                    onAsk = {},
                    onClear = {},
                    onCancel = {},
                    onPrepareModel = {},
                    onRetryCapability = {},
                    isDevelopBuild = false,
                )
            }
        }

        composeRule.onAllNodesWithText(context.getString(R.string.bylaws_open_pdf_action))
            .assertCountEquals(1)
        composeRule.onNodeWithText(context.getString(R.string.bylaws_open_pdf_action))
            .assertIsDisplayed()
        composeRule.onNodeWithText(context.getString(R.string.bylaws_open_pdf_action)).performClick()
        composeRule.onNodeWithText(context.getString(R.string.bylaws_title)).assertIsDisplayed()
        composeRule.onAllNodesWithText(context.getString(R.string.bylaws_input_label)).assertCountEquals(0)
        composeRule.onAllNodesWithText(context.getString(R.string.bylaws_retry_capability_action)).assertCountEquals(0)
    }

    @Test
    fun productionSummaryShowsFullEvidenceAndHidesDevelopmentDiagnostics() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val fullEvidence = "Artículo 5. Las personas asociadas tienen derecho a participar sin discriminación en todas las actividades de la Asociación."
        composeRule.setContent {
            ReguertaTheme {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    BylawsRoute(
                        queryInput = "¿Cuáles son los derechos?",
                        answerResult = BylawsAnswerResult(
                            answer = "Las personas asociadas pueden participar en las actividades.",
                            citations = listOf(
                                BylawsCitation(
                                    articleNumber = 5,
                                    title = "Artículo 5. Derechos de las personas asociadas",
                                    pageStart = 4,
                                    pageEnd = 4,
                                    excerpt = fullEvidence,
                                ),
                            ),
                            diagnostics = BylawsAnswerDiagnostics(
                                modelId = "evaluation-model-id",
                                inputTokenCount = 180,
                                evidence = listOf(BylawsEvidenceDiagnostic("article-5", 12f)),
                            ),
                        ),
                        assistantCapability = BylawsAssistantCapability(BylawsAssistantStatus.AVAILABLE),
                        isLoading = false,
                        onQueryChanged = {},
                        onAsk = {},
                        onClear = {},
                        onCancel = {},
                        onPrepareModel = {},
                        onRetryCapability = {},
                        isDevelopBuild = false,
                    )
                }
            }
        }

        composeRule.onNodeWithText(fullEvidence, substring = true)
            .performScrollTo()
            .assertIsDisplayed()
        composeRule.onNodeWithText("Artículo 5. Derechos de las personas asociadas")
            .performScrollTo()
            .assertIsDisplayed()
        composeRule.onAllNodesWithText("evaluation-model-id", substring = true).assertCountEquals(0)
        composeRule.onAllNodesWithText(context.getString(R.string.bylaws_develop_details_title)).assertCountEquals(0)
    }
}
