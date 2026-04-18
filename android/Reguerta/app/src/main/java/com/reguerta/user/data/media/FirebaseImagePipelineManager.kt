package com.reguerta.user.data.media

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import com.reguerta.user.data.firestore.ReguertaRuntimeEnvironment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.util.UUID

class FirebaseImagePipelineManager(
    private val context: Context,
    private val storage: FirebaseStorage,
    private val jpegQuality: Int = DefaultJpegQuality,
) : ImagePipelineManager {
    override suspend fun processAndUpload(
        sourceUri: Uri,
        ownerId: String,
        namespace: ImageUploadNamespace,
        entityId: String?,
        nameHint: String?,
    ): ImageUploadResult? = withContext(Dispatchers.IO) {
        runCatching {
            val decoded = decodeBitmapFromUri(context.contentResolver, sourceUri) ?: return@withContext null
            val scaledSize = ImagePipelineSizingContract.scaledDimensions(
                sourceWidth = decoded.width,
                sourceHeight = decoded.height,
                targetShortSidePx = OutputSidePx,
            ) ?: return@withContext null
            val resized = Bitmap.createScaledBitmap(decoded, scaledSize.width, scaledSize.height, true)
            if (resized != decoded) decoded.recycle()

            val cropSquare = ImagePipelineSizingContract.centerCropSquare(
                sourceWidth = resized.width,
                sourceHeight = resized.height,
                targetSidePx = OutputSidePx,
            ) ?: return@withContext null
            val cropped = Bitmap.createBitmap(
                resized,
                cropSquare.left,
                cropSquare.top,
                cropSquare.size,
                cropSquare.size,
            )
            if (cropped != resized) resized.recycle()

            val imageBytes = ByteArrayOutputStream().use { output ->
                val didCompress = cropped.compress(Bitmap.CompressFormat.JPEG, jpegQuality, output)
                if (!didCompress) return@withContext null
                output.toByteArray()
            }
            cropped.recycle()

            if (imageBytes.isEmpty()) return@withContext null

            val storagePath = buildStoragePath(
                ownerId = ownerId,
                namespace = namespace,
                entityId = entityId,
                nameHint = nameHint,
            )
            val metadata = StorageMetadata.Builder()
                .setContentType(MimeTypeJpeg)
                .build()
            val imageReference = storage.reference.child(storagePath)
            Tasks.await(imageReference.putBytes(imageBytes, metadata))
            val downloadUrl = Tasks.await(imageReference.downloadUrl).toString().trim()
            if (downloadUrl.isEmpty()) return@withContext null

            ImageUploadResult(
                downloadUrl = downloadUrl,
                widthPx = OutputSidePx,
                heightPx = OutputSidePx,
                byteSize = imageBytes.size,
                mimeType = MimeTypeJpeg,
            )
        }.getOrNull()
    }

    private fun buildStoragePath(
        ownerId: String,
        namespace: ImageUploadNamespace,
        entityId: String?,
        nameHint: String?,
    ): String {
        val sanitizedOwnerId = sanitizePathComponent(ownerId, fallback = "unknown-owner")
        val normalizedEntityId = sanitizePathComponent(entityId, fallback = "new")
        val namePrefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint = nameHint,
            namespace = namespace,
        )
        val uniqueSuffix = UUID.randomUUID().toString()
        val environment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
        return "$environment/images/${namespace.pathComponent}/$sanitizedOwnerId/${namePrefix}_${normalizedEntityId}_$uniqueSuffix.jpg"
    }

    private fun sanitizePathComponent(rawValue: String?, fallback: String): String =
        rawValue
            ?.trim()
            ?.replace("/", "_")
            ?.takeIf { it.isNotBlank() }
            ?: fallback

    private fun decodeBitmapFromUri(
        contentResolver: ContentResolver,
        sourceUri: Uri,
    ): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contentResolver.openInputStream(sourceUri)?.use { input ->
            BitmapFactory.decodeStream(input, null, bounds)
        } ?: return null

        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        val sampleSize = computeSampleSize(
            width = bounds.outWidth,
            height = bounds.outHeight,
            minSidePx = OutputSidePx,
        )
        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = sampleSize
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        return contentResolver.openInputStream(sourceUri)?.use { input ->
            BitmapFactory.decodeStream(input, null, decodeOptions)
        }
    }

    private fun computeSampleSize(
        width: Int,
        height: Int,
        minSidePx: Int,
    ): Int {
        var inSampleSize = 1
        var sampledWidth = width
        var sampledHeight = height
        while (sampledWidth / 2 >= minSidePx && sampledHeight / 2 >= minSidePx) {
            sampledWidth /= 2
            sampledHeight /= 2
            inSampleSize *= 2
        }
        return inSampleSize.coerceAtLeast(1)
    }

    private companion object {
        const val OutputSidePx = 300
        const val DefaultJpegQuality = 82
        const val MimeTypeJpeg = "image/jpeg"
    }
}
