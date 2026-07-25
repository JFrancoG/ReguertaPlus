package com.reguerta.user.domain.bylaws

import java.text.Normalizer
import kotlin.math.ln

class BylawsEvidenceRetriever(
    private val maximumEvidenceCount: Int = 3,
) {
    fun retrieve(
        question: String,
        document: BylawsDocument,
    ): List<BylawsEvidence> {
        val queryTerms = expandQueryTerms(
            tokenize(question)
                .filterNot(stopWords::contains)
                .distinct(),
        )
        if (queryTerms.isEmpty()) return emptyList()

        val searchableChunks = document.chunks.filter { chunk ->
            chunk.text.isNotBlank() && chunk.pageStart in 1..document.metadata.pageCount
        }
        if (searchableChunks.isEmpty()) return emptyList()

        val documentFrequency = queryTerms.associateWith { term ->
            searchableChunks.count { chunk -> chunk.searchableTokens().contains(term) }
        }
        val normalizedQuestion = normalize(question)

        return searchableChunks
            .mapNotNull { chunk ->
                val titleTokens = tokenize(chunk.title).toSet()
                val aliasTokens = chunk.searchAliases.flatMap(::tokenize).toSet()
                val textTokens = tokenize(chunk.text).toSet()
                val strongFieldTokens = titleTokens + aliasTokens
                val matchedTerms = queryTerms.filter { term ->
                    term in titleTokens || term in aliasTokens || term in textTokens
                }
                if (matchedTerms.isEmpty()) return@mapNotNull null

                val weightedTermScore = matchedTerms.sumOf { term ->
                    val inverseDocumentFrequency = ln(
                        (searchableChunks.size + 1.0) / ((documentFrequency[term] ?: 0) + 1.0),
                    ) + 1.0
                    val fieldWeight = when {
                        term in aliasTokens -> 4.0
                        term in titleTokens -> 3.0
                        else -> 1.0
                    }
                    inverseDocumentFrequency * fieldWeight
                }
                val aliasPhraseBonus = chunk.searchAliases.sumOf { alias ->
                    val normalizedAlias = normalize(alias)
                    when {
                        normalizedAlias.isBlank() -> 0.0
                        normalizedQuestion.contains(normalizedAlias) -> 8.0
                        else -> 0.0
                    }
                }
                val titlePhraseMatch = normalizedTitleWithoutArticle(chunk.title)
                    .takeIf { title -> title.isNotBlank() }
                    ?.let { title -> normalizedQuestion.contains(title) }
                    ?: false
                val coverage = matchedTerms.size.toFloat() / queryTerms.size.toFloat()
                val articleBonus = explicitArticleNumber(normalizedQuestion)
                    ?.takeIf { it == chunk.articleNumber }
                    ?.let { 20.0 }
                    ?: 0.0
                val score = weightedTermScore + aliasPhraseBonus + (coverage * 5.0) + articleBonus
                val strongFieldMatchCount = matchedTerms.count(strongFieldTokens::contains)
                val rareBodyMatchCount = matchedTerms.count { term ->
                    term in textTokens && (documentFrequency[term] ?: Int.MAX_VALUE) <= MAXIMUM_RARE_TERM_DOCUMENT_FREQUENCY
                }
                val hasUniqueRareBodyMatch = matchedTerms.any { term ->
                    term.length >= MINIMUM_UNIQUE_RARE_TERM_LENGTH &&
                        term in textTokens &&
                        documentFrequency[term] == 1
                }
                val hasStrongMatch =
                    aliasPhraseBonus > 0.0 ||
                        titlePhraseMatch ||
                        strongFieldMatchCount >= MINIMUM_DISCRIMINATIVE_TERM_MATCHES ||
                        hasUniqueRareBodyMatch ||
                        rareBodyMatchCount >= MINIMUM_DISCRIMINATIVE_TERM_MATCHES
                val meetsMinimumQuality =
                    hasStrongMatch &&
                        coverage >= MINIMUM_QUERY_COVERAGE &&
                        score >= MINIMUM_EVIDENCE_SCORE
                if (articleBonus == 0.0 && !meetsMinimumQuality) {
                    return@mapNotNull null
                }

                BylawsEvidence(
                    chunkId = chunk.id,
                    articleNumber = chunk.articleNumber,
                    pageStart = chunk.pageStart,
                    pageEnd = chunk.pageEnd,
                    title = chunk.title,
                    excerpt = normalizedEvidenceText(chunk.text),
                    score = score.toFloat(),
                )
            }
            .sortedWith(
                compareByDescending<BylawsEvidence> { evidence -> evidence.score }
                    .thenBy { evidence -> evidence.pageStart }
                    .thenBy { evidence -> evidence.chunkId },
            )
            .take(maximumEvidenceCount)
    }

    private fun BylawsDocumentChunk.searchableTokens(): Set<String> =
        buildSet {
            addAll(tokenize(title))
            addAll(tokenize(text))
            searchAliases.forEach { alias -> addAll(tokenize(alias)) }
        }

    private fun expandQueryTerms(terms: List<String>): List<String> = buildSet {
        addAll(terms)
        if ("presupuest" in terms) {
            addAll(listOf("elaborar", "aprobar", "refrendar"))
        }
        if ("pago" in terms) {
            addAll(listOf("ordenar", "autorizad"))
        }
        if ("modificar" in terms) {
            add("modificacion")
        }
    }.toList()

    private fun tokenize(value: String): List<String> =
        tokenRegex.findAll(normalize(value))
            .map { match -> normalizeToken(match.value) }
            .filter(String::isNotBlank)
            .toList()

    private fun normalizeToken(value: String): String {
        val withoutClitic = value
            .takeIf { token ->
                token.length > 7 &&
                    token.endsWith("los") &&
                    token.dropLast(3).let { verb ->
                        verb.endsWith("ar") || verb.endsWith("er") || verb.endsWith("ir")
                    }
            }
            ?.dropLast(3)
            ?: value
        val withoutAdverb = withoutClitic
            .takeIf { it.length > 8 && it.endsWith("mente") }
            ?.dropLast(5)
            ?: withoutClitic
        val singular = when {
            withoutAdverb.length > 6 && withoutAdverb.endsWith("ciones") ->
                withoutAdverb.dropLast(5) + "cion"
            withoutAdverb.length > 5 && withoutAdverb.endsWith("es") -> withoutAdverb.dropLast(2)
            withoutAdverb.length > 4 && withoutAdverb.endsWith("s") -> withoutAdverb.dropLast(1)
            else -> withoutAdverb
        }
        val withoutVerbEnding = when {
            singular.length > 7 && singular.endsWith("ara") -> singular.dropLast(3)
            singular.length > 6 && singular.endsWith("ia") -> singular.dropLast(2)
            else -> singular
        }
        return if (
            withoutVerbEnding.length > 5 &&
            withoutVerbEnding.last() in setOf('a', 'e', 'i', 'o')
        ) {
            withoutVerbEnding.dropLast(1)
        } else {
            withoutVerbEnding
        }
    }

    private fun normalize(value: String): String =
        Normalizer.normalize(value.lowercase(), Normalizer.Form.NFD)
            .replace(combiningMarksRegex, "")
            .replace('ü', 'u')

    private fun explicitArticleNumber(question: String): Int? =
        articleRegex.find(question)?.groupValues?.getOrNull(1)?.toIntOrNull()

    private fun normalizedTitleWithoutArticle(title: String): String =
        normalize(title).replace(articleTitlePrefixRegex, "").trim(' ', '.', ':', '-')

    private fun normalizedEvidenceText(text: String): String =
        text.replace(whitespaceRegex, " ").trim()

    private companion object {
        val tokenRegex = Regex("[a-z0-9]+")
        val combiningMarksRegex = Regex("\\p{M}+")
        val whitespaceRegex = Regex("\\s+")
        val articleRegex = Regex("articulo\\s+(\\d+)")
        val articleTitlePrefixRegex = Regex("^articulo\\s+\\d+[.:]?\\s*")
        const val MINIMUM_QUERY_COVERAGE = 0.15f
        const val MINIMUM_EVIDENCE_SCORE = 6.0
        const val MINIMUM_DISCRIMINATIVE_TERM_MATCHES = 2
        const val MINIMUM_UNIQUE_RARE_TERM_LENGTH = 7
        const val MAXIMUM_RARE_TERM_DOCUMENT_FREQUENCY = 3
        val stopWords = setOf(
            "a", "al", "algo", "como", "con", "cual", "cuales", "de", "del", "el", "ella",
            "en", "entre", "es", "esta", "este", "hay", "la", "las", "le", "les", "lo", "los", "me",
            "para", "pero", "por", "que", "se", "si", "sin", "su", "sus", "un", "una", "uno",
            "y", "ya", "articul", "asociacion", "reguert",
        )
    }
}
