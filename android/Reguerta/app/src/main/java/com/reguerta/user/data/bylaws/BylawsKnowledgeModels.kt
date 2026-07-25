package com.reguerta.user.data.bylaws

import kotlinx.serialization.Serializable

@Serializable
internal data class BylawsKnowledgeIndexDTO(
    val metadata: BylawsKnowledgeMetadata,
    val chunks: List<BylawsKnowledgeChunk>,
)

@Serializable
internal data class BylawsKnowledgeMetadata(
    val documentId: String,
    val title: String,
    val language: String,
    val sourceFileName: String,
    val sourceDriveUrl: String,
    val sourceSha256: String,
    val pageCount: Int,
    val generatedAtUtc: String,
    val schemaVersion: Int,
)

@Serializable
internal data class BylawsKnowledgeChunk(
    val id: String,
    val kind: String = "page",
    val articleNumber: Int? = null,
    val pageStart: Int,
    val pageEnd: Int,
    val title: String,
    val text: String,
    val searchAliases: List<String> = emptyList(),
)
