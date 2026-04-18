package com.reguerta.user.data.media

import android.net.Uri

enum class ImageUploadNamespace(val pathComponent: String) {
    PRODUCTS("products"),
    NEWS("news"),
    SHARED_PROFILES("shared_profiles"),
}

data class ImageUploadResult(
    val downloadUrl: String,
    val widthPx: Int,
    val heightPx: Int,
    val byteSize: Int,
    val mimeType: String,
)

interface ImagePipelineManager {
    suspend fun processAndUpload(
        sourceUri: Uri,
        ownerId: String,
        namespace: ImageUploadNamespace,
        entityId: String? = null,
        nameHint: String? = null,
    ): ImageUploadResult?
}
