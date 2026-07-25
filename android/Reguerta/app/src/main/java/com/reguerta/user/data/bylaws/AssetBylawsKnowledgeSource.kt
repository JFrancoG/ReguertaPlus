package com.reguerta.user.data.bylaws

import android.content.Context
import com.reguerta.user.domain.bylaws.BylawsDocument
import com.reguerta.user.domain.bylaws.BylawsDocumentChunk
import com.reguerta.user.domain.bylaws.BylawsDocumentMetadata
import com.reguerta.user.domain.bylaws.BylawsKnowledgeSource
import kotlinx.serialization.json.Json

class AssetBylawsKnowledgeSource(
    private val appContext: Context,
    private val decoder: BylawsKnowledgeDecoder = BylawsKnowledgeDecoder(),
) : BylawsKnowledgeSource {
    @Volatile
    private var cached: BylawsDocument? = null

    override fun load(): BylawsDocument {
        cached?.let { return it }
        val parsed = appContext.assets.open("bylaws/bylaws-index-es.json").use { input ->
            val raw = input.bufferedReader().use { it.readText() }
            decoder.decode(raw)
        }
        cached = parsed
        return parsed
    }
}

class BylawsKnowledgeDecoder(
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    fun decode(raw: String): BylawsDocument =
        json.decodeFromString<BylawsKnowledgeIndexDTO>(raw).toDomain()
}

class InMemoryBylawsKnowledgeSource(
    private val index: BylawsDocument = emptyBylawsDocument(),
) : BylawsKnowledgeSource {
    override fun load(): BylawsDocument = index
}

private fun BylawsKnowledgeIndexDTO.toDomain(): BylawsDocument =
    BylawsDocument(
        metadata = BylawsDocumentMetadata(
            documentId = metadata.documentId,
            title = metadata.title,
            language = metadata.language,
            sourceFileName = metadata.sourceFileName,
            sourceSha256 = metadata.sourceSha256,
            pageCount = metadata.pageCount,
            schemaVersion = metadata.schemaVersion,
        ),
        chunks = chunks.map { chunk ->
            BylawsDocumentChunk(
                id = chunk.id,
                kind = chunk.kind,
                articleNumber = chunk.articleNumber,
                pageStart = chunk.pageStart,
                pageEnd = chunk.pageEnd,
                title = chunk.title,
                text = chunk.text,
                searchAliases = chunk.searchAliases,
            )
        },
    )

private fun emptyBylawsDocument(): BylawsDocument =
    BylawsDocument(
        metadata = BylawsDocumentMetadata(
            documentId = "empty",
            title = "",
            language = "es",
            sourceFileName = "",
            sourceSha256 = "",
            pageCount = 0,
            schemaVersion = 1,
        ),
        chunks = emptyList(),
    )
