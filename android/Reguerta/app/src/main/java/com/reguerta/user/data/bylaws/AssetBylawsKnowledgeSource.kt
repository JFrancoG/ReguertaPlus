package com.reguerta.user.data.bylaws

import android.content.Context
import kotlinx.serialization.json.Json

interface BylawsKnowledgeSource {
    fun load(): BylawsKnowledgeIndex
}

class AssetBylawsKnowledgeSource(
    private val appContext: Context,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : BylawsKnowledgeSource {
    @Volatile
    private var cached: BylawsKnowledgeIndex? = null

    override fun load(): BylawsKnowledgeIndex {
        cached?.let { return it }
        val parsed = appContext.assets.open("bylaws/bylaws-index-es.json").use { input ->
            val raw = input.bufferedReader().use { it.readText() }
            json.decodeFromString<BylawsKnowledgeIndex>(raw)
        }
        cached = parsed
        return parsed
    }
}

class InMemoryBylawsKnowledgeSource(
    private val index: BylawsKnowledgeIndex = emptyBylawsKnowledgeIndex(),
) : BylawsKnowledgeSource {
    override fun load(): BylawsKnowledgeIndex = index
}

private fun emptyBylawsKnowledgeIndex(): BylawsKnowledgeIndex =
    BylawsKnowledgeIndex(
        metadata = BylawsKnowledgeMetadata(
            documentId = "empty",
            title = "",
            language = "es",
            sourceFileName = "",
            sourceDriveUrl = "",
            sourceSha256 = "",
            pageCount = 0,
            generatedAtUtc = "",
            schemaVersion = 1,
        ),
        chunks = emptyList(),
    )
