package com.reguerta.user.presentation.root

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.startup.StartupVersionGateDecision
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import kotlin.time.Duration

private const val SplashAnimationDurationMillis = 1_500
@Composable
internal fun SplashRoute(
    animationFinished: Boolean,
    onAnimationFinished: () -> Unit,
) {
    val progress = remember(animationFinished) {
        Animatable(if (animationFinished) 1f else 0f)
    }
    val latestOnAnimationFinished by rememberUpdatedState(onAnimationFinished)

    LaunchedEffect(animationFinished) {
        if (animationFinished) {
            progress.snapTo(1f)
            return@LaunchedEffect
        }
        progress.snapTo(0f)
        progress.animateTo(
            targetValue = 1f,
            animationSpec = tween(
                durationMillis = SplashAnimationDurationMillis,
                easing = FastOutSlowInEasing,
            ),
        )
        latestOnAnimationFinished()
    }

    val fraction = progress.value
    val scale = lerp(0.2f, 18f, fraction)
    val rotation = lerp(0f, 720f, fraction)
    val alpha = lerp(1f, 0f, fraction)

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painter = painterResource(id = R.drawable.ic_splash_logo),
            contentDescription = stringResource(R.string.app_name),
            modifier = Modifier
                .height(100.dp)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    rotationZ = rotation
                    this.alpha = alpha
                },
            contentScale = ContentScale.Fit,
        )
    }
}

private fun lerp(start: Float, end: Float, fraction: Float): Float =
    start + (end - start) * fraction

@Composable
internal fun StartupVersionGateDialog(
    state: StartupGateUiState,
    onUpdateNow: (String) -> Unit,
    onDismissOptional: () -> Unit,
    onRetry: () -> Unit,
    onContinue: () -> Unit,
) {
    when (state) {
        is StartupGateUiState.OptionalUpdate -> {
            ReguertaDialog(
                type = ReguertaDialogType.INFO,
                title = stringResource(R.string.startup_update_optional_title),
                message = stringResource(R.string.startup_update_message),
                primaryAction = ReguertaDialogAction(
                    label = stringResource(R.string.startup_update_action_update),
                    onClick = {
                        onUpdateNow(state.storeUrl)
                        onDismissOptional()
                    },
                ),
                secondaryAction = ReguertaDialogAction(
                    label = stringResource(R.string.startup_update_action_later),
                    onClick = onDismissOptional,
                ),
                onDismissRequest = onDismissOptional,
            )
        }

        is StartupGateUiState.ForcedUpdate -> {
            ReguertaDialog(
                type = ReguertaDialogType.ERROR,
                title = stringResource(R.string.startup_update_forced_title),
                message = stringResource(R.string.startup_update_message),
                primaryAction = ReguertaDialogAction(
                    label = stringResource(R.string.startup_update_action_update),
                    onClick = { onUpdateNow(state.storeUrl) },
                ),
                onDismissRequest = {},
            )
        }

        StartupGateUiState.TimedOut -> {
            StartupVersionGateFailureDialog(
                title = stringResource(R.string.startup_version_timeout_title),
                message = stringResource(R.string.startup_version_timeout_message),
                onRetry = onRetry,
                onContinue = onContinue,
            )
        }

        StartupGateUiState.Unavailable -> {
            StartupVersionGateFailureDialog(
                title = stringResource(R.string.startup_version_unavailable_title),
                message = stringResource(R.string.startup_version_unavailable_message),
                onRetry = onRetry,
                onContinue = onContinue,
            )
        }

        StartupGateUiState.Checking,
        StartupGateUiState.Ready,
            -> Unit
    }
}

@Composable
private fun StartupVersionGateFailureDialog(
    title: String,
    message: String,
    onRetry: () -> Unit,
    onContinue: () -> Unit,
) {
    ReguertaDialog(
        type = ReguertaDialogType.ERROR,
        title = title,
        message = message,
        primaryAction = ReguertaDialogAction(
            label = stringResource(R.string.startup_version_action_retry),
            onClick = onRetry,
        ),
        secondaryAction = ReguertaDialogAction(
            label = stringResource(R.string.startup_version_action_continue),
            onClick = onContinue,
        ),
        onDismissRequest = {},
    )
}

internal fun openStoreUrl(
    context: Context,
    storeUrl: String,
) {
    val uri = runCatching { Uri.parse(storeUrl) }.getOrNull() ?: return
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(intent) }
}

internal sealed interface StartupGateUiState {
    data object Checking : StartupGateUiState

    data object Ready : StartupGateUiState

    data class OptionalUpdate(val storeUrl: String) : StartupGateUiState

    data class ForcedUpdate(val storeUrl: String) : StartupGateUiState

    data object TimedOut : StartupGateUiState

    data object Unavailable : StartupGateUiState
}

internal val StartupGateUiState.allowsContinuation: Boolean
    get() = this == StartupGateUiState.Ready

internal suspend fun resolveStartupGateUiState(
    timeout: Duration,
    resolve: suspend () -> StartupVersionGateDecision,
): StartupGateUiState = try {
    withTimeout(timeout) {
        when (val decision = resolve()) {
            StartupVersionGateDecision.Allow -> StartupGateUiState.Ready
            is StartupVersionGateDecision.OptionalUpdate -> StartupGateUiState.OptionalUpdate(
                storeUrl = decision.storeUrl,
            )

            is StartupVersionGateDecision.ForcedUpdate -> StartupGateUiState.ForcedUpdate(
                storeUrl = decision.storeUrl,
            )
        }
    }
} catch (_: TimeoutCancellationException) {
    StartupGateUiState.TimedOut
} catch (error: CancellationException) {
    throw error
} catch (_: Exception) {
    StartupGateUiState.Unavailable
}
