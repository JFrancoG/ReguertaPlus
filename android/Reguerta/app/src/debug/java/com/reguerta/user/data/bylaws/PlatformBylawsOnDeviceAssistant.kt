package com.reguerta.user.data.bylaws

import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import com.reguerta.user.domain.bylaws.BylawsAssistantCapability
import com.reguerta.user.domain.bylaws.BylawsAssistantStatus
import com.reguerta.user.domain.bylaws.BylawsGenerationRequest
import com.reguerta.user.domain.bylaws.BylawsGenerationResult
import com.reguerta.user.domain.bylaws.BylawsOnDeviceAssistant
import com.reguerta.user.domain.bylaws.BylawsPromptBuilder
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.collect

/**
 * Evaluation-only adapter for authenticated develop testers on supported hardware.
 * Its model identifier is returned with diagnostics so Spanish quality can be evaluated
 * before any future model family is approved for production.
 */
fun createPlatformBylawsOnDeviceAssistant(): BylawsOnDeviceAssistant =
    MlKitBylawsOnDeviceAssistant()

private class MlKitBylawsOnDeviceAssistant(
    private val model: GenerativeModel = Generation.getClient(),
) : BylawsOnDeviceAssistant {
    override suspend fun checkCapability(): BylawsAssistantCapability = try {
        capabilityFor(model.checkStatus()).also { capability ->
            if (capability.status == BylawsAssistantStatus.AVAILABLE) {
                warmupIgnoringFailure()
            }
        }
    } catch (exception: CancellationException) {
        throw exception
    } catch (_: Exception) {
        BylawsAssistantCapability.retryableUnavailable()
    }

    override suspend fun prepare(): BylawsAssistantCapability = try {
        when (model.checkStatus()) {
            FeatureStatus.DOWNLOADABLE -> {
                var failed = false
                model.download().collect { status ->
                    if (status is DownloadStatus.DownloadFailed) {
                        failed = true
                    }
                }
                if (failed) {
                    BylawsAssistantCapability.retryableUnavailable()
                } else {
                    capabilityFor(model.checkStatus())
                }
            }

            else -> capabilityFor(model.checkStatus())
        }
    } catch (exception: CancellationException) {
        throw exception
    } catch (_: Exception) {
        BylawsAssistantCapability.retryableUnavailable()
    }

    override suspend fun generate(request: BylawsGenerationRequest): BylawsGenerationResult? {
        if (model.checkStatus() != FeatureStatus.AVAILABLE) return null

        val tokenLimit = model.getTokenLimit()
        var suppliedEvidence = request.evidence.take(MAXIMUM_EVIDENCE_COUNT)
        while (suppliedEvidence.isNotEmpty()) {
            val prompt = BylawsPromptBuilder.build(
                question = request.question,
                evidence = suppliedEvidence,
            )
            val contentRequest = generateContentRequest(TextPart(prompt)) {
                temperature = TEMPERATURE
                topK = TOP_K
                candidateCount = 1
                seed = SEED
                maxOutputTokens = MAXIMUM_OUTPUT_TOKENS
            }
            val inputTokenCount = model.countTokens(contentRequest).totalTokens
            if (inputTokenCount + MAXIMUM_OUTPUT_TOKENS <= tokenLimit) {
                val response = model.generateContent(contentRequest)
                return BylawsGenerationResult(
                    text = response.candidates.firstOrNull()?.text.orEmpty(),
                    modelId = modelIdOrNull(),
                    inputTokenCount = inputTokenCount,
                    suppliedEvidenceCount = suppliedEvidence.size,
                )
            }
            suppliedEvidence = suppliedEvidence.dropLast(1)
        }

        return null
    }

    override fun close() {
        model.close()
    }

    private suspend fun capabilityFor(status: Int): BylawsAssistantCapability = when (status) {
        FeatureStatus.AVAILABLE -> BylawsAssistantCapability(
            status = BylawsAssistantStatus.AVAILABLE,
            modelId = modelIdOrNull(),
        )

        FeatureStatus.DOWNLOADABLE -> BylawsAssistantCapability(BylawsAssistantStatus.DOWNLOADABLE)
        FeatureStatus.DOWNLOADING -> BylawsAssistantCapability(BylawsAssistantStatus.DOWNLOADING)
        else -> BylawsAssistantCapability.Unavailable
    }

    private suspend fun warmupIgnoringFailure() {
        try {
            model.warmup()
        } catch (exception: CancellationException) {
            throw exception
        } catch (_: Exception) {
            // Warmup is only an optimization; availability remains valid if it fails.
        }
    }

    private suspend fun modelIdOrNull(): String? = try {
        model.getBaseModelName()
    } catch (exception: CancellationException) {
        throw exception
    } catch (_: Exception) {
        null
    }

    private companion object {
        const val MAXIMUM_EVIDENCE_COUNT = 3
        const val MAXIMUM_OUTPUT_TOKENS = 256
        const val TOP_K = 10
        const val SEED = 7
        const val TEMPERATURE = 0.2f
    }
}
