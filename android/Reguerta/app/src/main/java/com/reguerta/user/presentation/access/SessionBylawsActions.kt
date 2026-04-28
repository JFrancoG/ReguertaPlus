package com.reguerta.user.presentation.access

import com.reguerta.user.R
import com.reguerta.user.data.bylaws.BylawsKnowledgeSource
import com.reguerta.user.data.bylaws.BylawsCloudGateway
import com.reguerta.user.data.bylaws.BylawsKnowledgeChunk
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.max

internal class SessionBylawsActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val knowledgeSource: BylawsKnowledgeSource,
    private val cloudGateway: BylawsCloudGateway,
    private val emitMessage: (Int) -> Unit,
    private val localModelId: String = "google/gemma-4-e2b",
    private val cloudTimeoutMillis: Int = 8_000,
) {
    fun onBylawsQueryChanged(value: String) {
        uiState.update {
            it.copy(
                bylawsQueryInput = value,
            )
        }
    }

    fun clearBylawsResult() {
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

        uiState.update { it.copy(isAskingBylaws = true) }

        scope.launch {
            val index = withContext(Dispatchers.IO) { knowledgeSource.load() }
            val localMatch = withContext(Dispatchers.Default) {
                resolveLocalMatch(query = query, chunks = index.chunks)
            }

            if (localMatch == null) {
                val fallbackTrace = BylawsDecisionTrace(
                    shouldEscalate = true,
                    reasons = listOf("sin_cobertura_local"),
                    localCoverage = 0f,
                    localConfidence = 0f,
                )
                uiState.update {
                    it.copy(
                        isAskingBylaws = false,
                        bylawsAnswerResult = BylawsAnswerResult(
                            mode = BylawsAnswerMode.FALLBACK,
                            answer = fallbackAnswer(query),
                            citedPages = emptyList(),
                            trace = fallbackTrace,
                        ),
                    )
                }
                return@launch
            }

            val trace = evaluateEscalationTrace(query = query, match = localMatch)
            if (!trace.shouldEscalate) {
                uiState.update {
                    it.copy(
                        isAskingBylaws = false,
                        bylawsAnswerResult = BylawsAnswerResult(
                            mode = BylawsAnswerMode.LOCAL,
                            answer = localMatch.answer,
                            citedPages = localMatch.pages,
                            trace = trace,
                        ),
                    )
                }
                return@launch
            }

            val cloudResult = withTimeoutOrNull(cloudTimeoutMillis.toLong()) {
                cloudGateway.requestAnswer(
                    question = query,
                    localContext = localMatch.context,
                    modelId = localModelId,
                    timeoutMillis = cloudTimeoutMillis,
                )
            }

            val answerResult = if (cloudResult != null) {
                BylawsAnswerResult(
                    mode = BylawsAnswerMode.CLOUD,
                    answer = cloudResult.answer,
                    citedPages = if (cloudResult.citedPages.isNotEmpty()) {
                        cloudResult.citedPages
                    } else {
                        localMatch.pages
                    },
                    trace = trace,
                )
            } else {
                BylawsAnswerResult(
                    mode = BylawsAnswerMode.FALLBACK,
                    answer = fallbackAnswer(query, localMatch.answer),
                    citedPages = localMatch.pages,
                    trace = trace,
                )
            }

            uiState.update {
                it.copy(
                    isAskingBylaws = false,
                    bylawsAnswerResult = answerResult,
                )
            }
        }
    }

    private fun fallbackAnswer(query: String, localAnswer: String? = null): String {
        val guidance = "No he podido completar el escalado a nube en este momento. " +
            "Te recomiendo abrir el PDF completo para validar el detalle jurídico."
        return if (localAnswer.isNullOrBlank()) {
            "Pregunta: \"$query\". $guidance"
        } else {
            "$localAnswer\n\n$guidance"
        }
    }

    private fun evaluateEscalationTrace(query: String, match: LocalMatch): BylawsDecisionTrace {
        val reasons = mutableListOf<String>()
        if (match.coverage < 0.45f) reasons += "cobertura_baja"
        if (match.confidence < 0.12f) reasons += "confianza_baja"
        if (isComplexIntent(query)) reasons += "intencion_compleja"
        if (isExplicitDeepRequest(query)) reasons += "solicitud_explicita_profunda"

        return BylawsDecisionTrace(
            shouldEscalate = reasons.isNotEmpty(),
            reasons = reasons,
            localCoverage = match.coverage,
            localConfidence = match.confidence,
        )
    }

    private fun resolveLocalMatch(query: String, chunks: List<BylawsKnowledgeChunk>): LocalMatch? {
        val queryTerms = tokenize(query).filterNot(::isStopWord).distinct()
        if (queryTerms.isEmpty()) return null

        val ranked = chunks.mapNotNull { chunk ->
            val chunkText = chunk.text.lowercase()
            val overlapTerms = queryTerms.filter { term -> chunkText.contains(term) }
            if (overlapTerms.isEmpty()) return@mapNotNull null

            val overlap = overlapTerms.size.toFloat()
            val coverage = overlap / queryTerms.size
            val phraseBonus = if (chunkText.contains(query.lowercase())) 0.2f else 0f
            val titleBonus = if (queryTerms.any { chunk.title.lowercase().contains(it) }) 0.15f else 0f
            val score = coverage + phraseBonus + titleBonus

            RankedChunk(
                chunk = chunk,
                score = score,
                coverage = coverage,
            )
        }.sortedByDescending { it.score }

        if (ranked.isEmpty()) return null

        val top = ranked.first()
        val secondScore = ranked.getOrNull(1)?.score ?: 0f
        val confidence = max(0f, top.score - secondScore)

        val pages = ranked.take(3).map { it.chunk.pageStart }.distinct().sorted()
        val context = ranked.take(3).joinToString("\n\n") { item ->
            "Página ${item.chunk.pageStart} - ${item.chunk.title}\n${item.chunk.text}"
        }
        val answer = buildLocalAnswer(top.chunk, ranked.getOrNull(1)?.chunk)

        return LocalMatch(
            answer = answer,
            context = context,
            pages = pages,
            coverage = top.coverage,
            confidence = confidence,
        )
    }

    private fun buildLocalAnswer(primary: BylawsKnowledgeChunk, secondary: BylawsKnowledgeChunk?): String {
        val primarySnippet = trimSnippet(primary.text)
        val secondarySnippet = secondary?.let { trimSnippet(it.text) }
        return buildString {
            append("Según ")
            append(primary.title)
            append(" (página ")
            append(primary.pageStart)
            append("): ")
            append(primarySnippet)
            if (!secondarySnippet.isNullOrBlank()) {
                append("\n\nTambién puede ayudarte revisar ")
                append(secondary.title)
                append(" (página ")
                append(secondary.pageStart)
                append("): ")
                append(secondarySnippet)
            }
        }
    }

    private fun trimSnippet(text: String, maxLength: Int = 480): String {
        val trimmed = text.trim()
        if (trimmed.length <= maxLength) return trimmed
        val cut = trimmed.take(maxLength)
        val sentenceEnd = cut.lastIndexOfAny(charArrayOf('.', ';', ':'))
        return if (sentenceEnd > 200) cut.take(sentenceEnd + 1) else "$cut…"
    }

    private fun tokenize(value: String): List<String> =
        Regex("[\\p{L}\\p{N}]+").findAll(value.lowercase()).map { it.value }.toList()

    private fun isStopWord(token: String): Boolean = token in stopWords

    private fun isComplexIntent(query: String): Boolean {
        val normalized = query.lowercase()
        if (tokenize(normalized).size >= 18) return true
        return complexityHints.any { normalized.contains(it) }
    }

    private fun isExplicitDeepRequest(query: String): Boolean {
        val normalized = query.lowercase()
        return deepRequestHints.any { normalized.contains(it) }
    }

    private data class RankedChunk(
        val chunk: BylawsKnowledgeChunk,
        val score: Float,
        val coverage: Float,
    )

    private data class LocalMatch(
        val answer: String,
        val context: String,
        val pages: List<Int>,
        val coverage: Float,
        val confidence: Float,
    )

    private companion object {
        val complexityHints = listOf(
            "compar",
            "diferenc",
            "paso a paso",
            "procedimiento",
            "excepción",
            "si dimite",
            "revocar",
            "mayoría",
            "quórum",
            "extraordinaria",
        )
        val deepRequestHints = listOf(
            "explica",
            "en detalle",
            "a fondo",
            "razona",
            "justifica",
            "analiza",
        )
        val stopWords = setOf(
            "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o",
            "que", "se", "del", "al", "en", "para", "por", "con", "sin", "como",
            "es", "son", "ser", "qué", "que", "cual", "cuál", "cuales", "cuáles",
            "puede", "pueden", "hay", "hacer", "hace", "sobre", "si", "más", "menos",
            "a", "lo", "le", "les", "su", "sus", "mi", "mis",
        )
    }
}
