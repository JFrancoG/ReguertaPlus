package com.reguerta.user.presentation.access

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import coil3.compose.AsyncImage
import com.reguerta.user.R
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import java.io.File

@Composable
internal fun ReguertaImagePickerField(
    imageUrl: String,
    isUploading: Boolean,
    onPickImage: (Uri) -> Unit,
    onClearImage: () -> Unit,
    placeholderIcon: ImageVector,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    val context = LocalContext.current
    var showSourceDialog by rememberSaveable { mutableStateOf(false) }
    var showCameraPermissionDialog by rememberSaveable { mutableStateOf(false) }
    var pendingCameraUri by rememberSaveable { mutableStateOf<String?>(null) }
    val hasCameraPermission = remember {
        {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    val pickMediaLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia(),
    ) { selectedUri ->
        if (selectedUri != null) {
            // Persist read access when picker falls back to document providers.
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    selectedUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION,
                )
            }
            onPickImage(selectedUri)
        }
    }

    val takePictureLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture(),
    ) { didCapture ->
        val capturedUri = pendingCameraUri?.let(Uri::parse)
        pendingCameraUri = null
        if (didCapture && capturedUri != null) {
            onPickImage(capturedUri)
        } else if (capturedUri != null) {
            context.contentResolver.delete(capturedUri, null, null)
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            launchCameraCapture(
                context = context,
                onUriReady = { uri ->
                    pendingCameraUri = uri.toString()
                    takePictureLauncher.launch(uri)
                },
                onError = {
                    showCameraPermissionDialog = true
                },
            )
        } else {
            showCameraPermissionDialog = true
        }
    }

    Box(
        modifier = modifier
            .size(112.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        if (imageUrl.isNotBlank()) {
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Icon(
                imageVector = placeholderIcon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(40.dp),
            )
        }
    }

    if (!subtitle.isNullOrBlank()) {
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ReguertaButton(
            label = stringResource(R.string.products_pick_image_action),
            variant = ReguertaButtonVariant.SECONDARY,
            fullWidth = false,
            enabled = !isUploading,
            onClick = {
                showSourceDialog = true
            },
        )

        if (imageUrl.isNotBlank()) {
            ReguertaButton(
                label = stringResource(R.string.products_clear_image_action),
                variant = ReguertaButtonVariant.TEXT,
                fullWidth = false,
                enabled = !isUploading,
                onClick = onClearImage,
            )
        }

        if (isUploading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
            )
        }
    }

    if (showSourceDialog) {
        ReguertaDialog(
            type = ReguertaDialogType.INFO,
            title = stringResource(R.string.image_source_dialog_title),
            message = stringResource(R.string.image_source_dialog_message),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.image_source_action_gallery),
                onClick = {
                    showSourceDialog = false
                    pickMediaLauncher.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                    )
                },
            ),
            secondaryAction = ReguertaDialogAction(
                label = stringResource(R.string.image_source_action_camera),
                onClick = {
                    showSourceDialog = false
                    if (hasCameraPermission()) {
                        launchCameraCapture(
                            context = context,
                            onUriReady = { uri ->
                                pendingCameraUri = uri.toString()
                                takePictureLauncher.launch(uri)
                            },
                            onError = {
                                showCameraPermissionDialog = true
                            },
                        )
                    } else {
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                },
            ),
            onDismissRequest = { showSourceDialog = false },
        )
    }

    if (showCameraPermissionDialog) {
        ReguertaDialog(
            type = ReguertaDialogType.ERROR,
            title = stringResource(R.string.image_camera_permission_denied_title),
            message = stringResource(R.string.image_camera_permission_denied_message),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.common_action_accept),
                onClick = { showCameraPermissionDialog = false },
            ),
            onDismissRequest = { showCameraPermissionDialog = false },
        )
    }
}

private fun launchCameraCapture(
    context: Context,
    onUriReady: (Uri) -> Unit,
    onError: () -> Unit,
) {
    val cacheDirectory = File(context.cacheDir, "camera_capture").apply {
        if (!exists()) mkdirs()
    }
    val tempFile = runCatching {
        File.createTempFile("reguerta_camera_", ".jpg", cacheDirectory)
    }.getOrNull()
    if (tempFile == null) {
        onError()
        return
    }
    val uri = runCatching {
        FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            tempFile,
        )
    }.getOrNull()
    if (uri == null) {
        onError()
        return
    }
    onUriReady(uri)
}
