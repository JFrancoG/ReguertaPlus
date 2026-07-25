package com.reguerta.user.presentation.bylaws

import com.reguerta.user.R
import com.reguerta.user.domain.bylaws.BylawsAssistantCapability
import com.reguerta.user.domain.bylaws.BylawsAssistantStatus
import com.reguerta.user.domain.bylaws.BylawsDocument
import com.reguerta.user.domain.bylaws.BylawsDocumentChunk
import com.reguerta.user.domain.bylaws.BylawsDocumentMetadata
import com.reguerta.user.domain.bylaws.BylawsEvidenceRetriever
import com.reguerta.user.domain.bylaws.BylawsGenerationRequest
import com.reguerta.user.domain.bylaws.BylawsGenerationResult
import com.reguerta.user.domain.bylaws.BylawsKnowledgeSource
import com.reguerta.user.domain.bylaws.BylawsOnDeviceAssistant
import com.reguerta.user.presentation.root.SessionUiState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionBylawsActionsTest {
    @Test
    fun `downloadable model is prepared locally before the composer becomes available`() = runTest {
        val assistant = FakeAssistant(
            capability = BylawsAssistantCapability(BylawsAssistantStatus.DOWNLOADABLE),
            preparedCapability = BylawsAssistantCapability(
                status = BylawsAssistantStatus.AVAILABLE,
                modelId = "local-test-model",
            ),
        )
        val fixture = fixture(assistant = assistant)

        fixture.actions.prepareBylawsRoute()
        advanceUntilIdle()

        assertEquals(BylawsAssistantStatus.DOWNLOADABLE, fixture.state.value.bylawsAssistantCapability.status)

        fixture.actions.prepareBylawsModel()
        assertEquals(BylawsAssistantStatus.DOWNLOADING, fixture.state.value.bylawsAssistantCapability.status)
        advanceUntilIdle()

        assertEquals(BylawsAssistantStatus.AVAILABLE, fixture.state.value.bylawsAssistantCapability.status)
        assertEquals(1, assistant.prepareCalls)
    }

    @Test
    fun `downloading status is polled until the local model becomes available`() = runTest {
        val assistant = FakeAssistant(
            checkCapabilities = listOf(
                BylawsAssistantCapability(BylawsAssistantStatus.DOWNLOADING),
                BylawsAssistantCapability(BylawsAssistantStatus.DOWNLOADING),
                BylawsAssistantCapability(
                    status = BylawsAssistantStatus.AVAILABLE,
                    modelId = "evaluated-local-model",
                ),
            ),
        )
        val fixture = fixture(assistant = assistant)

        fixture.actions.prepareBylawsRoute()
        advanceUntilIdle()

        assertEquals(BylawsAssistantStatus.AVAILABLE, fixture.state.value.bylawsAssistantCapability.status)
        assertEquals("evaluated-local-model", fixture.state.value.bylawsAssistantCapability.modelId)
        assertEquals(3, assistant.checkCalls)
    }

    @Test
    fun `stalled downloading status becomes retryable PDF only instead of remaining indefinite`() = runTest {
        val assistant = FakeAssistant(
            capability = BylawsAssistantCapability(BylawsAssistantStatus.DOWNLOADING),
        )
        val fixture = fixture(assistant = assistant)

        fixture.actions.prepareBylawsRoute()
        advanceUntilIdle()

        assertEquals(BylawsAssistantStatus.UNAVAILABLE, fixture.state.value.bylawsAssistantCapability.status)
        assertTrue(fixture.state.value.bylawsAssistantCapability.canRetry)
        assertEquals(4, assistant.checkCalls)
    }

    @Test
    fun `unavailable device never invokes generation and remains PDF only`() = runTest {
        val assistant = FakeAssistant(capability = BylawsAssistantCapability.Unavailable)
        val fixture = fixture(
            initialState = availableQuestionState().copy(
                bylawsAssistantCapability = BylawsAssistantCapability.Unavailable,
            ),
            assistant = assistant,
        )

        fixture.actions.askBylawsQuestion()

        assertEquals(0, assistant.generateCalls)
        assertEquals(listOf(R.string.bylaws_local_unavailable), fixture.messages)
        assertNull(fixture.state.value.bylawsAnswerResult)
        assertFalse(fixture.state.value.bylawsAssistantCapability.canRetry)
    }

    @Test
    fun `available local model returns answer with citations owned by retrieved evidence`() = runTest {
        val assistant = FakeAssistant(
            generationResult = BylawsGenerationResult(
                text = "Las personas asociadas pueden participar en las actividades.",
                modelId = "local-test-model",
                inputTokenCount = 312,
                suppliedEvidenceCount = 1,
            ),
        )
        val fixture = fixture(
            initialState = availableQuestionState(),
            assistant = assistant,
        )

        fixture.actions.askBylawsQuestion()
        advanceUntilIdle()

        val result = requireNotNull(fixture.state.value.bylawsAnswerResult)
        assertEquals(1, assistant.generateCalls)
        assertEquals(5, result.citations.single().articleNumber)
        assertEquals(4, result.citations.single().pageStart)
        assertEquals(document().chunks.single().text, result.citations.single().excerpt)
        assertEquals("local-test-model", result.diagnostics.modelId)
        assertEquals(312, result.diagnostics.inputTokenCount)
        assertFalse(fixture.state.value.isAskingBylaws)
        assertTrue(fixture.messages.isEmpty())
    }

    @Test
    fun `NO CONSTA output is discarded and directs the user to the PDF`() = runTest {
        listOf("NO_CONSTA", "NO CONSTA", "No consta.").forEach { noAnswerOutput ->
            val fixture = fixture(
                initialState = availableQuestionState(),
                assistant = FakeAssistant(
                    generationResult = BylawsGenerationResult(
                        text = noAnswerOutput,
                        modelId = "local-test-model",
                        inputTokenCount = 120,
                        suppliedEvidenceCount = 1,
                    ),
                ),
            )

            fixture.actions.askBylawsQuestion()
            advanceUntilIdle()

            assertNull(noAnswerOutput, fixture.state.value.bylawsAnswerResult)
            assertEquals(BylawsAssistantStatus.UNAVAILABLE, fixture.state.value.bylawsAssistantCapability.status)
            assertEquals(listOf(R.string.bylaws_answer_not_found), fixture.messages)
        }
    }

    @Test
    fun `empty model output is discarded and directs the user to the PDF`() = runTest {
        val fixture = fixture(
            initialState = availableQuestionState(),
            assistant = FakeAssistant(
                generationResult = BylawsGenerationResult(
                    text = "  ",
                    modelId = "local-test-model",
                    inputTokenCount = 120,
                    suppliedEvidenceCount = 1,
                ),
            ),
        )

        fixture.actions.askBylawsQuestion()
        advanceUntilIdle()

        assertNull(fixture.state.value.bylawsAnswerResult)
        assertEquals(BylawsAssistantStatus.UNAVAILABLE, fixture.state.value.bylawsAssistantCapability.status)
        assertEquals(listOf(R.string.bylaws_answer_not_found), fixture.messages)
    }

    @Test
    fun `generation failure exposes no synthetic answer and keeps PDF fallback`() = runTest {
        val fixture = fixture(
            initialState = availableQuestionState(),
            assistant = FakeAssistant(generationFailure = IllegalStateException("model failed")),
        )

        fixture.actions.askBylawsQuestion()
        advanceUntilIdle()

        assertNull(fixture.state.value.bylawsAnswerResult)
        assertFalse(fixture.state.value.isAskingBylaws)
        assertEquals(BylawsAssistantStatus.UNAVAILABLE, fixture.state.value.bylawsAssistantCapability.status)
        assertTrue(fixture.state.value.bylawsAssistantCapability.canRetry)
        assertEquals(listOf(R.string.bylaws_answer_unavailable), fixture.messages)
    }

    @Test
    fun `leaving bylaws cancels generation without publishing an error or late answer`() = runTest {
        val assistant = FakeAssistant(suspendGeneration = true)
        val fixture = fixture(
            initialState = availableQuestionState(),
            assistant = assistant,
        )

        fixture.actions.askBylawsQuestion()
        runCurrent()
        assertEquals(1, assistant.generateCalls)

        fixture.actions.cancelBylawsConsultation()
        advanceUntilIdle()

        assertNull(fixture.state.value.bylawsAnswerResult)
        assertFalse(fixture.state.value.isAskingBylaws)
        assertTrue(fixture.messages.isEmpty())
    }

    @Test
    fun `generated article references are rejected so citations remain app owned`() = runTest {
        listOf(
            "El artículo 99 permite esta actuación.",
            "El art. 99 permite esta actuación.",
            "El artículo n.º 99 permite esta actuación.",
            "Los artículos 5 y 99 permiten esta actuación.",
            "Los arts. 5 y 99 permiten esta actuación.",
            "El artículo quince permite esta actuación.",
            "El artículo número 99 permite esta actuación.",
        ).forEach { unsupportedReference ->
            val fixture = fixture(
                initialState = availableQuestionState(),
                assistant = FakeAssistant(
                    generationResult = BylawsGenerationResult(
                        text = unsupportedReference,
                        modelId = "local-test-model",
                        inputTokenCount = 120,
                        suppliedEvidenceCount = 1,
                    ),
                ),
            )

            fixture.actions.askBylawsQuestion()
            advanceUntilIdle()

            assertNull(unsupportedReference, fixture.state.value.bylawsAnswerResult)
            assertEquals(BylawsAssistantStatus.UNAVAILABLE, fixture.state.value.bylawsAssistantCapability.status)
            assertEquals(listOf(R.string.bylaws_answer_not_found), fixture.messages)
        }
    }

    @Test
    fun `generated page references are rejected so citations remain app owned`() = runTest {
        listOf(
            "Según la página 99, se permite esta actuación.",
            "Según la pág. 99, se permite esta actuación.",
            "Según la p. 99, se permite esta actuación.",
            "Según las páginas 4-99, se permite esta actuación.",
            "Según las pp. 10-11, se permite esta actuación.",
            "Según la página noventa y nueve, se permite esta actuación.",
        ).forEach { unsupportedReference ->
            val fixture = fixture(
                initialState = availableQuestionState(),
                assistant = FakeAssistant(
                    generationResult = BylawsGenerationResult(
                        text = unsupportedReference,
                        modelId = "local-test-model",
                        inputTokenCount = 120,
                        suppliedEvidenceCount = 1,
                    ),
                ),
            )

            fixture.actions.askBylawsQuestion()
            advanceUntilIdle()

            assertNull(unsupportedReference, fixture.state.value.bylawsAnswerResult)
            assertEquals(BylawsAssistantStatus.UNAVAILABLE, fixture.state.value.bylawsAssistantCapability.status)
            assertEquals(listOf(R.string.bylaws_answer_not_found), fixture.messages)
        }
    }

    private fun TestScope.fixture(
        initialState: SessionUiState = SessionUiState(),
        assistant: FakeAssistant = FakeAssistant(),
    ): Fixture {
        val state = MutableStateFlow(initialState)
        val messages = mutableListOf<Int>()
        val dispatcher = StandardTestDispatcher(testScheduler)
        val actions = SessionBylawsActions(
            uiState = state,
            scope = this,
            knowledgeSource = BylawsKnowledgeSource { document() },
            evidenceRetriever = BylawsEvidenceRetriever(),
            onDeviceAssistant = assistant,
            emitMessage = messages::add,
            ioDispatcher = dispatcher,
            retrievalDispatcher = dispatcher,
            downloadStatusPollIntervalMillis = 1L,
            downloadStatusMaximumPolls = 3,
        )
        return Fixture(state = state, actions = actions, messages = messages)
    }

    private fun availableQuestionState() = SessionUiState(
        bylawsQueryInput = "¿Cuáles son los derechos de las personas asociadas?",
        bylawsAssistantCapability = BylawsAssistantCapability(
            status = BylawsAssistantStatus.AVAILABLE,
            modelId = "local-test-model",
        ),
    )

    private fun document() = BylawsDocument(
        metadata = BylawsDocumentMetadata(
            documentId = "test-bylaws",
            title = "Estatutos",
            language = "es",
            sourceFileName = "estatutos.pdf",
            sourceSha256 = "test-sha",
            pageCount = 13,
            schemaVersion = 2,
        ),
        chunks = listOf(
            BylawsDocumentChunk(
                id = "article-5",
                kind = "article",
                articleNumber = 5,
                pageStart = 4,
                pageEnd = 4,
                title = "Artículo 5. Derechos de las personas asociadas",
                text = "Artículo 5. Las personas asociadas tienen derecho a participar en las actividades.",
                searchAliases = listOf("derechos de los asociados", "participación de socios"),
            ),
        ),
    )

    private data class Fixture(
        val state: MutableStateFlow<SessionUiState>,
        val actions: SessionBylawsActions,
        val messages: MutableList<Int>,
    )

    private class FakeAssistant(
        private val capability: BylawsAssistantCapability = BylawsAssistantCapability(
            status = BylawsAssistantStatus.AVAILABLE,
            modelId = "local-test-model",
        ),
        private val preparedCapability: BylawsAssistantCapability = capability,
        private val generationResult: BylawsGenerationResult? = null,
        private val generationFailure: Throwable? = null,
        private val suspendGeneration: Boolean = false,
        private val checkCapabilities: List<BylawsAssistantCapability> = emptyList(),
    ) : BylawsOnDeviceAssistant {
        var checkCalls: Int = 0
            private set
        var prepareCalls: Int = 0
            private set
        var generateCalls: Int = 0
            private set

        override suspend fun checkCapability(): BylawsAssistantCapability {
            val result = checkCapabilities.getOrNull(checkCalls)
                ?: checkCapabilities.lastOrNull()
                ?: capability
            checkCalls += 1
            return result
        }

        override suspend fun prepare(): BylawsAssistantCapability {
            prepareCalls += 1
            return preparedCapability
        }

        override suspend fun generate(request: BylawsGenerationRequest): BylawsGenerationResult? {
            generateCalls += 1
            if (suspendGeneration) awaitCancellation()
            generationFailure?.let { throw it }
            return generationResult
        }

        override fun close() = Unit
    }
}
