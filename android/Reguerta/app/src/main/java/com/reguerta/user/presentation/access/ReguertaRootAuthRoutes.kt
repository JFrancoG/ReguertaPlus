package com.reguerta.user.presentation.access

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reguerta.user.R
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import com.reguerta.user.ui.components.auth.ReguertaFullButton
import com.reguerta.user.ui.theme.ReguertaAdaptive
import com.reguerta.user.ui.theme.ReguertaThemeTokens
@Composable
internal fun WelcomeRoute(
    onContinue: () -> Unit,
    onOpenRegister: () -> Unit,
) {
    val adaptiveProfile = ReguertaAdaptive.profile
    val spacing = ReguertaThemeTokens.spacing
    val typeScale = adaptiveProfile.typographyScale
    val controlScale = adaptiveProfile.tokenScale.controls
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val compactHeight = maxHeight < 760.dp || maxWidth < 390.dp
        val logoWidth = if (compactHeight) 0.68f else 0.74f
        val buttonWidth = if (compactHeight) maxWidth * 0.84f else maxWidth * 0.88f
        val topSpacing = if (compactHeight) (8f * controlScale).dp else (44f * controlScale).dp
        val bottomSpacing = if (compactHeight) (6f * controlScale).dp else (10f * controlScale).dp
        val titleToLogoWeight = if (compactHeight) 0.18f else 0.35f
        val middleSectionWeight = if (compactHeight) 0.62f else 0.9f
        val prefixStyle = if (compactHeight) {
            MaterialTheme.typography.headlineSmall.copy(
                fontWeight = FontWeight.Normal,
                fontSize = (22f * typeScale).sp,
                lineHeight = (28f * typeScale).sp,
            )
        } else {
            MaterialTheme.typography.displayLarge.copy(
                fontWeight = FontWeight.Normal,
                fontSize = (26f * typeScale).sp,
                lineHeight = (32f * typeScale).sp,
            )
        }
        val brandStyle = if (compactHeight) {
            MaterialTheme.typography.displayLarge.copy(
                fontSize = (46f * typeScale).sp,
                lineHeight = (50f * typeScale).sp,
            )
        } else {
            MaterialTheme.typography.displayLarge.copy(
                fontSize = (56f * typeScale).sp,
                lineHeight = (62f * typeScale).sp,
            )
        }
        val ctaStyle = if (compactHeight) {
            MaterialTheme.typography.titleLarge.copy(
                fontSize = (26f * typeScale).sp,
                lineHeight = (30f * typeScale).sp,
            )
        } else {
            MaterialTheme.typography.headlineSmall.copy(
                fontSize = (34f * typeScale).sp,
                lineHeight = (38f * typeScale).sp,
            )
        }

        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(topSpacing))

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = stringResource(R.string.welcome_title_prefix),
                    style = prefixStyle,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = stringResource(R.string.welcome_title_brand),
                    style = brandStyle,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = spacing.sm),
                )
            }

            Spacer(modifier = Modifier.weight(titleToLogoWeight))

            Image(
                painter = painterResource(id = R.drawable.reguerta_logo),
                contentDescription = stringResource(R.string.app_name),
                modifier = Modifier
                    .fillMaxWidth(logoWidth)
                    .aspectRatio(1f),
                contentScale = ContentScale.Fit,
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(middleSectionWeight),
                contentAlignment = Alignment.Center,
            ) {
                ReguertaFullButton(
                    label = stringResource(R.string.welcome_cta_enter),
                    onClick = onContinue,
                    textStyle = ctaStyle,
                    fullWidth = false,
                    modifier = Modifier.width(buttonWidth),
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.welcome_not_registered),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                    color = MaterialTheme.colorScheme.onSurface,
                )
                ReguertaFlatButton(
                    label = stringResource(R.string.welcome_link_register),
                    onClick = onOpenRegister,
                    textStyle = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                )
            }

            Spacer(modifier = Modifier.height(bottomSpacing))
        }
    }
}

@Composable
internal fun LoginRoute(
    state: SessionUiState,
    onSignIn: () -> Unit,
    onBack: () -> Unit,
    onOpenRecover: () -> Unit,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
) {
    val adaptiveProfile = ReguertaAdaptive.profile
    val spacing = ReguertaThemeTokens.spacing
    Column(
        modifier = Modifier
            .fillMaxSize()
            .offset(y = (-20f * adaptiveProfile.tokenScale.controls).dp),
    ) {
        AuthBackButton(onBack = onBack)

        Text(
            text = stringResource(R.string.login_title),
            style = MaterialTheme.typography.displayLarge,
            color = MaterialTheme.colorScheme.primary,
        )

        Spacer(modifier = Modifier.height(spacing.xl))

        SignInCard(
            state = state,
            onSignIn = onSignIn,
            onOpenRecover = onOpenRecover,
            onEmailChanged = onEmailChanged,
            onPasswordChanged = onPasswordChanged,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@Composable
internal fun RegisterRoute(
    state: SessionUiState,
    onSignUp: () -> Unit,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onRepeatPasswordChanged: (String) -> Unit,
    onBack: () -> Unit,
) {
    val adaptiveProfile = ReguertaAdaptive.profile
    val spacing = ReguertaThemeTokens.spacing
    Column(
        modifier = Modifier
            .fillMaxSize()
            .offset(y = (-20f * adaptiveProfile.tokenScale.controls).dp),
    ) {
        AuthBackButton(onBack = onBack)
        Text(
            text = stringResource(R.string.register_title),
            style = MaterialTheme.typography.displayLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(modifier = Modifier.height(spacing.xl))

        SignUpCard(
            state = state,
            onSignUp = onSignUp,
            onEmailChanged = onEmailChanged,
            onPasswordChanged = onPasswordChanged,
            onRepeatPasswordChanged = onRepeatPasswordChanged,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@Composable
internal fun RecoverPasswordRoute(
    state: SessionUiState,
    onEmailChanged: (String) -> Unit,
    onSendReset: () -> Unit,
    onResetEmailDialogAccepted: () -> Unit,
    onBack: () -> Unit,
) {
    val adaptiveProfile = ReguertaAdaptive.profile
    val spacing = ReguertaThemeTokens.spacing
    Column(
        modifier = Modifier
            .fillMaxSize()
            .offset(y = (-20f * adaptiveProfile.tokenScale.controls).dp),
    ) {
        AuthBackButton(onBack = onBack)
        Text(
            text = stringResource(R.string.recover_title),
            style = MaterialTheme.typography.displayLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(modifier = Modifier.height(spacing.xl))

        RecoverPasswordCard(
            state = state,
            onEmailChanged = onEmailChanged,
            onSendReset = onSendReset,
            modifier = Modifier.fillMaxSize(),
        )

        if (state.showRecoverSuccessDialog) {
            ReguertaDialog(
                type = ReguertaDialogType.INFO,
                title = stringResource(R.string.recover_success_dialog_title),
                message = stringResource(R.string.recover_success_dialog_message),
                primaryAction = ReguertaDialogAction(
                    label = stringResource(R.string.common_action_accept),
                    onClick = onResetEmailDialogAccepted,
                ),
                onDismissRequest = onResetEmailDialogAccepted,
            )
        }
    }
}

@Composable
private fun AuthBackButton(onBack: () -> Unit) {
    val controlScale = ReguertaAdaptive.profile.tokenScale.controls
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start,
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = stringResource(R.string.common_action_back),
            tint = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier
                .offset(x = (-2f * controlScale).dp)
                .size((24f * controlScale).dp)
                .clickable(onClick = onBack),
        )
    }
}
