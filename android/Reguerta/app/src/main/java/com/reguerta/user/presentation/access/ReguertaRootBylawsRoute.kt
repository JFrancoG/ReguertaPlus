package com.reguerta.user.presentation.access

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import java.io.File
import java.io.IOException

@Composable
internal fun BylawsRoute(
    queryInput: String,
    answerResult: BylawsAnswerResult?,
    isLoading: Boolean,
    onQueryChanged: (String) -> Unit,
    onAsk: () -> Unit,
    onClear: () -> Unit,
) {
    var isPdfViewerVisible by rememberSaveable { mutableStateOf(false) }

    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.bylaws_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = stringResource(R.string.bylaws_subtitle),
                style = MaterialTheme.typography.bodyMedium,
            )

            OutlinedTextField(
                value = queryInput,
                onValueChange = onQueryChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.bylaws_input_label)) },
                placeholder = { Text(stringResource(R.string.bylaws_input_placeholder)) },
                minLines = 2,
                enabled = !isLoading,
            )

            Button(
                onClick = onAsk,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading,
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(end = 8.dp),
                        strokeWidth = 2.dp,
                    )
                }
                Text(stringResource(if (isLoading) R.string.bylaws_ask_loading else R.string.bylaws_ask_action))
            }

            TextButton(
                onClick = { isPdfViewerVisible = true },
                enabled = !isLoading,
            ) {
                Text(stringResource(R.string.bylaws_open_pdf_action))
            }

            answerResult?.let { result ->
                BylawsAnswerCard(result = result, onClear = onClear)
            }
        }
    }

    if (isPdfViewerVisible) {
        BylawsPdfViewerDialog(
            onDismissRequest = { isPdfViewerVisible = false },
        )
    }
}

@Composable
private fun BylawsAnswerCard(
    result: BylawsAnswerResult,
    onClear: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = when (result.mode) {
                    BylawsAnswerMode.LOCAL -> stringResource(R.string.bylaws_mode_local)
                    BylawsAnswerMode.CLOUD -> stringResource(R.string.bylaws_mode_cloud)
                    BylawsAnswerMode.FALLBACK -> stringResource(R.string.bylaws_mode_fallback)
                },
                style = MaterialTheme.typography.titleSmall,
            )
            Text(
                text = stringResource(
                    R.string.bylaws_trace_format,
                    "%.2f".format(result.trace.localCoverage),
                    "%.2f".format(result.trace.localConfidence),
                    result.trace.reasons.joinToString(", ").ifBlank { "sin_escalado" },
                ),
                style = MaterialTheme.typography.bodySmall,
            )
            if (result.citedPages.isNotEmpty()) {
                Text(
                    text = stringResource(
                        R.string.bylaws_pages_format,
                        result.citedPages.joinToString(", ")
                    ),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(
                text = result.answer,
                style = MaterialTheme.typography.bodyMedium,
            )
            TextButton(onClick = onClear) {
                Text(stringResource(R.string.common_action_clear))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BylawsPdfViewerDialog(
    onDismissRequest: () -> Unit,
) {
    val context = LocalContext.current
    val loadState by produceState<BylawsPdfLoadState>(
        initialValue = BylawsPdfLoadState.Loading,
        key1 = context,
    ) {
        value = runCatching { renderBylawsPdfPages(context) }
            .fold(
                onSuccess = { pages -> BylawsPdfLoadState.Ready(pages) },
                onFailure = { BylawsPdfLoadState.Error },
            )
    }

    val renderedPages = (loadState as? BylawsPdfLoadState.Ready)?.pages.orEmpty()
    DisposableEffect(renderedPages) {
        onDispose {
            renderedPages.forEach { page ->
                if (!page.bitmap.isRecycled) {
                    page.bitmap.recycle()
                }
            }
        }
    }

    androidx.compose.ui.window.Dialog(
        onDismissRequest = onDismissRequest,
        properties = androidx.compose.ui.window.DialogProperties(
            usePlatformDefaultWidth = false,
        ),
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(text = stringResource(R.string.bylaws_title)) },
                    navigationIcon = {
                        TextButton(onClick = onDismissRequest) {
                            Text(stringResource(R.string.common_action_back))
                        }
                    },
                )
            },
            modifier = Modifier.safeDrawingPadding(),
        ) { paddingValues ->
            when (loadState) {
                BylawsPdfLoadState.Loading -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(paddingValues)
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(28.dp))
                        Text(
                            text = stringResource(R.string.bylaws_ask_loading),
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                BylawsPdfLoadState.Error -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(paddingValues)
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = stringResource(R.string.bylaws_pdf_viewer_unavailable),
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                        )
                        Button(onClick = onDismissRequest) {
                            Text(stringResource(R.string.common_action_back))
                        }
                    }
                }

                is BylawsPdfLoadState.Ready -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(paddingValues)
                            .statusBarsPadding(),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(renderedPages) { page ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp),
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Text(
                                        text = stringResource(
                                            R.string.bylaws_pages_format,
                                            page.number.toString(),
                                        ),
                                        style = MaterialTheme.typography.labelMedium,
                                    )
                                    Image(
                                        bitmap = page.bitmap.asImageBitmap(),
                                        contentDescription = null,
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private sealed interface BylawsPdfLoadState {
    data object Loading : BylawsPdfLoadState
    data object Error : BylawsPdfLoadState
    data class Ready(val pages: List<BylawsRenderedPage>) : BylawsPdfLoadState
}

private data class BylawsRenderedPage(
    val number: Int,
    val bitmap: Bitmap,
)

private fun renderBylawsPdfPages(context: Context): List<BylawsRenderedPage> {
    val pdfFile = ensureLocalBylawsPdfFile(context)
    val fileDescriptor = ParcelFileDescriptor.open(pdfFile, ParcelFileDescriptor.MODE_READ_ONLY)

    return fileDescriptor.use { descriptor ->
        PdfRenderer(descriptor).use { renderer ->
            buildList(capacity = renderer.pageCount) {
                for (pageIndex in 0 until renderer.pageCount) {
                    renderer.openPage(pageIndex).use { page ->
                        val bitmap = Bitmap.createBitmap(
                            page.width,
                            page.height,
                            Bitmap.Config.ARGB_8888,
                        )
                        bitmap.eraseColor(Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        add(
                            BylawsRenderedPage(
                                number = pageIndex + 1,
                                bitmap = bitmap,
                            ),
                        )
                    }
                }
            }
        }
    }
}

@Throws(IOException::class)
private fun ensureLocalBylawsPdfFile(context: Context): File {
    val bylawsDir = File(context.filesDir, "bylaws").apply { mkdirs() }
    val pdfFile = File(bylawsDir, "reguerta-estatutos.pdf")
    if (pdfFile.exists()) {
        return pdfFile
    }

    context.assets.open("bylaws/reguerta-estatutos.pdf").use { input ->
        pdfFile.outputStream().use { output ->
            input.copyTo(output)
        }
    }
    return pdfFile
}
