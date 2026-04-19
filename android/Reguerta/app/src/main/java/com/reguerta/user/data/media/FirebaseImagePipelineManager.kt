package com.reguerta.user.data.media

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import com.reguerta.user.data.firestore.ReguertaRuntimeEnvironment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
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
            val stagedSourceFile = stageSourceToCache(
                contentResolver = context.contentResolver,
                sourceUri = sourceUri,
            ) ?: run {
                Log.w(Tag, "Unable to stage source image for uri=$sourceUri")
                return@withContext null
            }

            try {
                val decoded = decodeBitmapFromFile(stagedSourceFile.absolutePath) ?: run {
                    Log.w(Tag, "Unable to decode staged image at ${stagedSourceFile.absolutePath}")
                    return@withContext null
                }
                val scaledSize = ImagePipelineSizingContract.scaledDimensions(
                    sourceWidth = decoded.width,
                    sourceHeight = decoded.height,
                    targetShortSidePx = OutputSidePx,
                ) ?: run {
                    Log.w(Tag, "Unable to compute scaled size for ${decoded.width}x${decoded.height}")
                    return@withContext null
                }
                val resized = Bitmap.createScaledBitmap(decoded, scaledSize.width, scaledSize.height, true)
                if (resized != decoded) decoded.recycle()

                val cropSquare = ImagePipelineSizingContract.centerCropSquare(
                    sourceWidth = resized.width,
                    sourceHeight = resized.height,
                    targetSidePx = OutputSidePx,
                ) ?: run {
                    Log.w(Tag, "Unable to crop resized image ${resized.width}x${resized.height}")
                    return@withContext null
                }
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
                    if (!didCompress) {
                        Log.w(Tag, "JPEG compression returned false for uri=$sourceUri")
                        return@withContext null
                    }
                    output.toByteArray()
                }
                cropped.recycle()

                if (imageBytes.isEmpty()) {
                    Log.w(Tag, "Compressed image payload is empty for uri=$sourceUri")
                    return@withContext null
                }

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
                if (downloadUrl.isEmpty()) {
                    Log.w(Tag, "Download URL came back empty for path=$storagePath")
                    return@withContext null
                }

                ImageUploadResult(
                    downloadUrl = downloadUrl,
                    widthPx = OutputSidePx,
                    heightPx = OutputSidePx,
                    byteSize = imageBytes.size,
                    mimeType = MimeTypeJpeg,
                )
            } finally {
                stagedSourceFile.delete()
            }
        }.onFailure { error ->
            Log.e(
                Tag,
                "processAndUpload failed for namespace=${namespace.pathComponent}, owner=$ownerId, uri=$sourceUri",
                error,
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

    private fun stageSourceToCache(
        contentResolver: ContentResolver,
        sourceUri: Uri,
    ): File? {
        val stagingDirectory = File(context.cacheDir, "image_pipeline_source")
        if (!stagingDirectory.exists() && !stagingDirectory.mkdirs()) return null

        val stagedFile = runCatching {
            File.createTempFile("reguerta_image_", ".tmp", stagingDirectory)
        }.getOrNull() ?: return null

        return try {
            val copied = contentResolver.openInputStream(sourceUri)?.use { input ->
                FileOutputStream(stagedFile).use { output ->
                    input.copyTo(output)
                }
                true
            } ?: false

            if (!copied || stagedFile.length() <= 0L) {
                stagedFile.delete()
                null
            } else {
                stagedFile
            }
        } catch (error: Throwable) {
            Log.e(Tag, "Unable to stage source image uri=$sourceUri", error)
            stagedFile.delete()
            null
        }
    }

    private fun decodeBitmapFromFile(
        sourcePath: String,
    ): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(sourcePath, bounds)

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
        return BitmapFactory.decodeFile(sourcePath, decodeOptions)
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
        const val Tag = "ReguertaImagePipeline"
        const val OutputSidePx = 300
        const val DefaultJpegQuality = 82
        const val MimeTypeJpeg = "image/jpeg"
    }
}
