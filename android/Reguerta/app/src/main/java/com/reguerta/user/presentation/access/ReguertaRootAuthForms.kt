package com.reguerta.user.presentation.access

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalFocusManager
import com.reguerta.user.R
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaFullButton
import com.reguerta.user.ui.components.auth.ReguertaInputField
import com.reguerta.user.ui.theme.ReguertaAdaptive
import com.reguerta.user.ui.theme.ReguertaThemeTokens
import androidx.compose.ui.res.stringResource

private const val PasswordMinLength = 6
private const val PasswordMaxLength = 16
private val LoginEmailPatternRegex =
    "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$".toRegex(setOf(RegexOption.IGNORE_CASE))

@Composable
internal fun RecoverPasswordCard(
    state: SessionUiState,
    onEmailChanged: (String) -> Unit,
    onSendReset: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val controlScale = ReguertaAdaptive.profile.tokenScale.controls
    val spacing = ReguertaThemeTokens.spacing
    val focusManager = LocalFocusManager.current
    val canSubmit = !state.isRecoveringPassword &&
        isValidEmail(state.recoverEmailInput)

    Box(
        modifier = modifier
            .fillMaxSize()
            .imePadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopStart)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(spacing.lg),
        ) {
            ReguertaInputField(
                label = stringResource(R.string.common_input_email_label),
                value = state.recoverEmailInput,
                onValueChange = onEmailChanged,
                placeholder = stringResource(R.string.common_input_tap_to_type),
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Email,
                errorMessage = state.recoverEmailErrorRes?.let { stringResource(it) },
                liveValidationErrorMessage = stringResource(R.string.feedback_email_invalid),
                liveValidation = ::isValidEmail,
                showClearAction = true,
            )
            Spacer(modifier = Modifier.height((96f * controlScale).dp))
        }

        ReguertaFullButton(
            label = stringResource(
                if (state.isRecoveringPassword) {
                    R.string.recover_action_sending
                } else {
                    R.string.recover_action_send_email
                },
            ),
            onClick = {
                focusManager.clearFocus(force = true)
                onSendReset()
            },
            enabled = canSubmit,
            loading = state.isRecoveringPassword,
            fullWidth = true,
            textStyle = MaterialTheme.typography.headlineSmall,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
        )
    }
}

@Composable
internal fun SignInCard(
    state: SessionUiState,
    onSignIn: () -> Unit,
    onOpenRecover: () -> Unit,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val controlScale = ReguertaAdaptive.profile.tokenScale.controls
    val spacing = ReguertaThemeTokens.spacing
    val focusManager = LocalFocusManager.current
    val canSubmit = !state.isAuthenticating &&
        isValidEmail(state.emailInput) &&
        isValidPassword(state.passwordInput) &&
        state.emailErrorRes == null &&
        state.passwordErrorRes == null

    Box(
        modifier = modifier
            .fillMaxSize()
            .imePadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopStart)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(spacing.xl),
        ) {
            ReguertaInputField(
                label = stringResource(R.string.common_input_email_label),
                value = state.emailInput,
                onValueChange = {
                    onEmailChanged(it)
                },
                placeholder = stringResource(R.string.common_input_tap_to_type),
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Email,
                errorMessage = state.emailErrorRes?.let { stringResource(it) },
                liveValidationErrorMessage = stringResource(R.string.feedback_email_invalid),
                liveValidation = ::isValidEmail,
                showClearAction = true,
            )
            ReguertaInputField(
                label = stringResource(R.string.common_input_password_label),
                value = state.passwordInput,
                onValueChange = {
                    onPasswordChanged(it)
                },
                placeholder = stringResource(R.string.common_input_tap_to_type),
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Password,
                isPassword = true,
                showPasswordToggle = true,
                errorMessage = state.passwordErrorRes?.let { stringResource(it) },
                liveValidationErrorMessage = stringResource(R.string.feedback_password_invalid_length),
                liveValidation = ::isValidPassword,
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                ReguertaButton(
                    label = stringResource(R.string.login_link_forgot_password),
                    onClick = onOpenRecover,
                    variant = ReguertaButtonVariant.TEXT,
                    fullWidth = false,
                )
            }
            Spacer(modifier = Modifier.height((96f * controlScale).dp))
        }

        ReguertaFullButton(
            label = stringResource(
                if (state.isAuthenticating) {
                    R.string.access_action_signing_in
                } else {
                    R.string.access_action_sign_in
                },
            ),
            onClick = {
                focusManager.clearFocus(force = true)
                onSignIn()
            },
            enabled = canSubmit,
            loading = state.isAuthenticating,
            fullWidth = true,
            textStyle = MaterialTheme.typography.headlineSmall,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
        )
    }
}

@Composable
internal fun SignUpCard(
    state: SessionUiState,
    onSignUp: () -> Unit,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onRepeatPasswordChanged: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val controlScale = ReguertaAdaptive.profile.tokenScale.controls
    val spacing = ReguertaThemeTokens.spacing
    val focusManager = LocalFocusManager.current
    var registerPasswordVisible by rememberSaveable { mutableStateOf(false) }
    val repeatRequiredMessage = stringResource(R.string.feedback_password_repeat_required)
    val invalidPasswordMessage = stringResource(R.string.feedback_password_invalid_length)
    val passwordMismatchMessage = stringResource(R.string.feedback_password_mismatch)
    val canSubmit = !state.isRegistering &&
        isValidEmail(state.registerEmailInput) &&
        isValidPassword(state.registerPasswordInput) &&
        state.registerRepeatPasswordInput == state.registerPasswordInput &&
        isValidPassword(state.registerRepeatPasswordInput) &&
        state.registerEmailErrorRes == null &&
        state.registerPasswordErrorRes == null &&
        state.registerRepeatPasswordErrorRes == null

    Box(
        modifier = modifier
            .fillMaxSize()
            .imePadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopStart)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(spacing.xl),
        ) {
            ReguertaInputField(
                label = stringResource(R.string.common_input_email_label),
                value = state.registerEmailInput,
                onValueChange = onEmailChanged,
                placeholder = stringResource(R.string.common_input_tap_to_type),
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Email,
                errorMessage = state.registerEmailErrorRes?.let { stringResource(it) },
                liveValidationErrorMessage = stringResource(R.string.feedback_email_invalid),
                liveValidation = ::isValidEmail,
                showClearAction = true,
            )
            ReguertaInputField(
                label = stringResource(R.string.common_input_password_label),
                value = state.registerPasswordInput,
                onValueChange = onPasswordChanged,
                placeholder = stringResource(R.string.common_input_tap_to_type),
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Password,
                isPassword = true,
                showPasswordToggle = true,
                passwordVisible = registerPasswordVisible,
                onPasswordVisibilityChange = { registerPasswordVisible = it },
                errorMessage = state.registerPasswordErrorRes?.let { stringResource(it) },
                liveValidationErrorMessage = stringResource(R.string.feedback_password_invalid_length),
                liveValidation = ::isValidPassword,
            )
            ReguertaInputField(
                label = stringResource(R.string.register_repeat_password_label),
                value = state.registerRepeatPasswordInput,
                onValueChange = onRepeatPasswordChanged,
                placeholder = stringResource(R.string.common_input_tap_to_type),
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Password,
                isPassword = true,
                showPasswordToggle = true,
                passwordVisible = registerPasswordVisible,
                onPasswordVisibilityChange = { registerPasswordVisible = it },
                errorMessage = state.registerRepeatPasswordErrorRes?.let { stringResource(it) },
                liveValidationErrorProvider = { repeatedPassword ->
                    when {
                        repeatedPassword.isBlank() -> repeatRequiredMessage
                        !isValidPassword(repeatedPassword) -> invalidPasswordMessage
                        repeatedPassword != state.registerPasswordInput -> passwordMismatchMessage
                        else -> null
                    }
                },
            )
            Spacer(modifier = Modifier.height((96f * controlScale).dp))
        }

        ReguertaFullButton(
            label = stringResource(
                if (state.isRegistering) {
                    R.string.register_action_creating
                } else {
                    R.string.register_action_create_account
                },
            ),
            onClick = {
                focusManager.clearFocus(force = true)
                onSignUp()
            },
            enabled = canSubmit,
            loading = state.isRegistering,
            fullWidth = true,
            textStyle = MaterialTheme.typography.headlineSmall,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
        )
    }
}

private fun isValidEmail(email: String): Boolean =
    email.trim().matches(LoginEmailPatternRegex)

private fun isValidPassword(password: String): Boolean =
    password.length in PasswordMinLength..PasswordMaxLength
