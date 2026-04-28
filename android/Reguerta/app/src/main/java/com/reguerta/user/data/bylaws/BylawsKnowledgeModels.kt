package com.reguerta.user.data.bylaws

import kotlinx.serialization.Serializable

@Serializable
data class BylawsKnowledgeIndex(
    val metadata: BylawsKnowledgeMetadata,
    val chunks: List<BylawsKnowledgeChunk>,
)

@Serializable
data class BylawsKnowledgeMetadata(
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
data class BylawsKnowledgeChunk(
    val id: String,
    val pageStart: Int,
    val pageEnd: Int,
    val title: String,
    val text: String,
)
