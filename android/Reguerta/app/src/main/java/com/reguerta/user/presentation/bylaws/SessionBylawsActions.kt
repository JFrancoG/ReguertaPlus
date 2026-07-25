package com.reguerta.user.presentation.bylaws

import com.reguerta.user.R
import com.reguerta.user.domain.bylaws.BylawsAssistantCapability
import com.reguerta.user.domain.bylaws.BylawsAssistantStatus
import com.reguerta.user.domain.bylaws.BylawsEvidenceRetriever
import com.reguerta.user.domain.bylaws.BylawsGenerationRequest
import com.reguerta.user.domain.bylaws.BylawsKnowledgeSource
import com.reguerta.user.domain.bylaws.BylawsOnDeviceAssistant
import com.reguerta.user.presentation.root.BylawsAnswerDiagnostics
import com.reguerta.user.presentation.root.BylawsAnswerResult
import com.reguerta.user.presentation.root.BylawsCitation
import com.reguerta.user.presentation.root.BylawsEvidenceDiagnostic
import com.reguerta.user.presentation.root.SessionUiState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal class SessionBylawsActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val knowledgeSource: BylawsKnowledgeSource,
    private val evidenceRetriever: BylawsEvidenceRetriever,
    private val onDeviceAssistant: BylawsOnDeviceAssistant,
    private val emitMessage: (Int) -> Unit,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val retrievalDispatcher: CoroutineDispatcher = Dispatchers.Default,
    private val downloadStatusPollIntervalMillis: Long = 2_000L,
    private val downloadStatusMaximumPolls: Int = 30,
) {
    private var capabilityJob: Job? = null
    private var generationJob: Job? = null

    fun prepareBylawsRoute() {
        generationJob?.cancel()
        capabilityJob?.cancel()
        uiState.update {
            it.copy(
                bylawsAssistantCapability = BylawsAssistantCapability.Checking,
                bylawsAnswerResult = null,
                isAskingBylaws = false,
            )
        }
        capabilityJob = scope.launch {
            val capability = try {
                awaitSettledCapability(onDeviceAssistant.checkCapability())
            } catch (exception: CancellationException) {
                throw exception
            } catch (_: Exception) {
                BylawsAssistantCapability.retryableUnavailable()
            }
            uiState.update { state ->
                state.copy(
                    bylawsAssistantCapability = capability,
                    bylawsAnswerResult = state.bylawsAnswerResult
                        .takeIf { capability.status == BylawsAssistantStatus.AVAILABLE },
                )
            }
        }
    }

    fun prepareBylawsModel() {
        if (uiState.value.bylawsAssistantCapability.status != BylawsAssistantStatus.DOWNLOADABLE) return

        capabilityJob?.cancel()
        uiState.update {
            it.copy(
                bylawsAssistantCapability = BylawsAssistantCapability(BylawsAssistantStatus.DOWNLOADING),
                bylawsAnswerResult = null,
            )
        }
        capabilityJob = scope.launch {
            val capability = try {
                awaitSettledCapability(onDeviceAssistant.prepare())
            } catch (exception: CancellationException) {
                throw exception
            } catch (_: Exception) {
                BylawsAssistantCapability.retryableUnavailable()
            }
            uiState.update {
                it.copy(
                    bylawsAssistantCapability = capability,
                    bylawsAnswerResult = null,
                )
            }
        }
    }

    fun onBylawsQueryChanged(value: String) {
        generationJob?.cancel()
        generationJob = null
        uiState.update {
            it.copy(
                bylawsQueryInput = value,
                bylawsAnswerResult = null,
                isAskingBylaws = false,
            )
        }
    }

    fun cancelBylawsConsultation() {
        generationJob?.cancel()
        generationJob = null
        capabilityJob?.cancel()
        capabilityJob = null
        uiState.update {
            it.copy(
                bylawsAnswerResult = null,
                isAskingBylaws = false,
            )
        }
    }

    fun clearBylawsResult() {
        generationJob?.cancel()
        uiState.update {
            it.copy(
                bylawsQueryInput = "",
                bylawsAnswerResult = null,
                isAskingBylaws = false,
            )
        }
    }

    fun askBylawsQuestion() {
        val query = uiState.value.bylawsQueryInput.trim()
        if (query.isBlank()) {
            emitMessage(R.string.bylaws_query_required)
            return
        }
        if (uiState.value.bylawsAssistantCapability.status != BylawsAssistantStatus.AVAILABLE) {
            emitMessage(R.string.bylaws_local_unavailable)
            return
        }

        generationJob?.cancel()
        uiState.update {
            it.copy(
                isAskingBylaws = true,
                bylawsAnswerResult = null,
            )
        }
        generationJob = scope.launch {
            val outcome = try {
                resolveAnswer(query)
            } catch (exception: CancellationException) {
                throw exception
            } catch (_: Exception) {
                AnswerOutcome.Failure
            }

            when (outcome) {
                is AnswerOutcome.Answer -> uiState.update {
                    it.copy(
                        isAskingBylaws = false,
                        bylawsAnswerResult = outcome.result,
                    )
                }

                AnswerOutcome.NoAnswer -> {
                    uiState.update {
                        it.copy(
                            bylawsAssistantCapability = BylawsAssistantCapability.retryableUnavailable(),
                            isAskingBylaws = false,
                            bylawsAnswerResult = null,
                        )
                    }
                    emitMessage(R.string.bylaws_answer_not_found)
                }

                AnswerOutcome.Failure -> {
                    uiState.update {
                        it.copy(
                            bylawsAssistantCapability = BylawsAssistantCapability.retryableUnavailable(),
                            isAskingBylaws = false,
                            bylawsAnswerResult = null,
                        )
                    }
                    emitMessage(R.string.bylaws_answer_unavailable)
                }
            }
        }
    }

    private suspend fun awaitSettledCapability(
        initialCapability: BylawsAssistantCapability,
    ): BylawsAssistantCapability {
        var capability = initialCapability
        repeat(downloadStatusMaximumPolls.coerceAtLeast(0)) {
            if (capability.status != BylawsAssistantStatus.DOWNLOADING) return capability
            delay(downloadStatusPollIntervalMillis.coerceAtLeast(1L))
            capability = onDeviceAssistant.checkCapability()
        }
        return capability.takeIf { it.status != BylawsAssistantStatus.DOWNLOADING }
            ?: BylawsAssistantCapability.retryableUnavailable()
    }

    private suspend fun resolveAnswer(query: String): AnswerOutcome {
        val document = withContext(ioDispatcher) { knowledgeSource.load() }
        val evidence = withContext(retrievalDispatcher) {
            evidenceRetriever.retrieve(question = query, document = document)
        }
        if (evidence.isEmpty()) return AnswerOutcome.NoAnswer

        val generation = onDeviceAssistant.generate(
            BylawsGenerationRequest(question = query, evidence = evidence),
        ) ?: return AnswerOutcome.NoAnswer
        val suppliedEvidence = evidence.take(
            generation.suppliedEvidenceCount.coerceIn(0, evidence.size),
        )
        val answer = generation.text.trim()
        if (
            suppliedEvidence.isEmpty() ||
            answer.isBlank() ||
            noAnswerSentinelRegex.containsMatchIn(answer) ||
            containsGeneratedReference(answer)
        ) {
            return AnswerOutcome.NoAnswer
        }

        return AnswerOutcome.Answer(
            BylawsAnswerResult(
                answer = answer,
                citations = suppliedEvidence.map { item ->
                    BylawsCitation(
                        articleNumber = item.articleNumber,
                        title = item.title,
                        pageStart = item.pageStart,
                        pageEnd = item.pageEnd,
                        excerpt = item.excerpt,
                    )
                },
                diagnostics = BylawsAnswerDiagnostics(
                    modelId = generation.modelId,
                    inputTokenCount = generation.inputTokenCount,
                    evidence = suppliedEvidence.map { item ->
                        BylawsEvidenceDiagnostic(
                            chunkId = item.chunkId,
                            score = item.score,
                        )
                    },
                ),
            ),
        )
    }

    private fun containsGeneratedReference(answer: String): Boolean =
        articleReferenceRegex.containsMatchIn(answer) || pageReferenceRegex.containsMatchIn(answer)

    private sealed interface AnswerOutcome {
        data class Answer(val result: BylawsAnswerResult) : AnswerOutcome
        data object NoAnswer : AnswerOutcome
        data object Failure : AnswerOutcome
    }

    private companion object {
        val noAnswerSentinelRegex = Regex("\\bno[_\\s]+consta\\b", RegexOption.IGNORE_CASE)
        val articleReferenceRegex = Regex(
            "\\b(?:art(?:[ií]culo(?:s)?|s)?)\\b\\.?",
            RegexOption.IGNORE_CASE,
        )
        val pageReferenceRegex = Regex(
            "\\b(?:p[aá]g(?:ina(?:s)?|s)?|pp?)\\b\\.?",
            RegexOption.IGNORE_CASE,
        )
    }
}
