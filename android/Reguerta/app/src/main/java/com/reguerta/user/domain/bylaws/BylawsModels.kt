package com.reguerta.user.domain.bylaws

data class BylawsDocument(
    val metadata: BylawsDocumentMetadata,
    val chunks: List<BylawsDocumentChunk>,
)

data class BylawsDocumentMetadata(
    val documentId: String,
    val title: String,
    val language: String,
    val sourceFileName: String,
    val sourceSha256: String,
    val pageCount: Int,
    val schemaVersion: Int,
)

data class BylawsDocumentChunk(
    val id: String,
    val kind: String,
    val articleNumber: Int?,
    val pageStart: Int,
    val pageEnd: Int,
    val title: String,
    val text: String,
    val searchAliases: List<String>,
)

fun interface BylawsKnowledgeSource {
    fun load(): BylawsDocument
}

data class BylawsEvidence(
    val chunkId: String,
    val articleNumber: Int?,
    val pageStart: Int,
    val pageEnd: Int,
    val title: String,
    val excerpt: String,
    val score: Float,
)

enum class BylawsAssistantStatus {
    CHECKING,
    AVAILABLE,
    DOWNLOADABLE,
    DOWNLOADING,
    UNAVAILABLE,
}

data class BylawsAssistantCapability(
    val status: BylawsAssistantStatus,
    val modelId: String? = null,
    val canRetry: Boolean = false,
) {
    companion object {
        val Checking = BylawsAssistantCapability(BylawsAssistantStatus.CHECKING)
        val Unavailable = BylawsAssistantCapability(BylawsAssistantStatus.UNAVAILABLE)

        fun retryableUnavailable(): BylawsAssistantCapability =
            BylawsAssistantCapability(
                status = BylawsAssistantStatus.UNAVAILABLE,
                canRetry = true,
            )
    }
}

data class BylawsGenerationRequest(
    val question: String,
    val evidence: List<BylawsEvidence>,
)

data class BylawsGenerationResult(
    val text: String,
    val modelId: String?,
    val inputTokenCount: Int,
    val suppliedEvidenceCount: Int,
)

interface BylawsOnDeviceAssistant {
    suspend fun checkCapability(): BylawsAssistantCapability

    suspend fun prepare(): BylawsAssistantCapability

    suspend fun generate(request: BylawsGenerationRequest): BylawsGenerationResult?

    fun close()
}

object PdfOnlyBylawsOnDeviceAssistant : BylawsOnDeviceAssistant {
    override suspend fun checkCapability(): BylawsAssistantCapability =
        BylawsAssistantCapability.Unavailable

    override suspend fun prepare(): BylawsAssistantCapability =
        BylawsAssistantCapability.Unavailable

    override suspend fun generate(request: BylawsGenerationRequest): BylawsGenerationResult? = null

    override fun close() = Unit
}
