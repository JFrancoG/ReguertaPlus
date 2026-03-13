package com.reguerta.user.presentation.access

import android.annotation.SuppressLint
import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.R
import com.reguerta.user.data.access.ChainedMemberRepository
import com.reguerta.user.data.access.FirebaseAuthSessionProvider
import com.reguerta.user.data.access.FirestoreMemberRepository
import com.reguerta.user.data.access.InMemoryMemberRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaCard
import com.reguerta.user.ui.components.auth.ReguertaFeedbackKind
import com.reguerta.user.ui.components.auth.ReguertaInlineFeedback
import com.reguerta.user.ui.components.auth.ReguertaInputField
import com.reguerta.user.ui.theme.ReguertaThemeTokens

private const val SplashAnimationDurationMillis = 1_500
private val LoginEmailPatternRegex =
    "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$".toRegex(setOf(RegexOption.IGNORE_CASE))

@Composable
fun rememberSessionViewModel(): SessionViewModel {
    val repository = remember {
        val fallback = InMemoryMemberRepository()
        val primary = FirestoreMemberRepository(firestore = FirebaseFirestore.getInstance())
        ChainedMemberRepository(primary = primary, fallback = fallback)
    }
    return remember {
        SessionViewModel(
            repository = repository,
            authSessionProvider = FirebaseAuthSessionProvider(auth = FirebaseAuth.getInstance()),
            resolveAuthorizedSession = ResolveAuthorizedSessionUseCase(memberRepository = repository),
            upsertMemberByAdmin = UpsertMemberByAdminUseCase(memberRepository = repository),
        )
    }
}

@Composable
@SuppressLint("LocalContextGetResourceValueCall")
fun ReguertaRoot(
    viewModel: SessionViewModel = rememberSessionViewModel(),
    modifier: Modifier = Modifier,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    val spacing = ReguertaThemeTokens.spacing

    var shellState by remember { mutableStateOf(AuthShellState()) }
    val isAuthenticatedSession = state.mode is SessionMode.Authorized || state.mode is SessionMode.Unauthorized

    LaunchedEffect(viewModel) {
        viewModel.uiEvents.collect { event ->
            if (event is SessionUiEvent.ShowMessage) {
                snackbarHostState.showSnackbar(context.getString(event.messageRes))
            }
        }
    }

    LaunchedEffect(isAuthenticatedSession) {
        if (isAuthenticatedSession && shellState.currentRoute != AuthShellRoute.SPLASH) {
            shellState = reduceAuthShell(
                state = shellState,
                action = AuthShellAction.SessionAuthenticated,
            )
        }
    }

    BackHandler(enabled = shellState.canGoBack) {
        shellState = reduceAuthShell(state = shellState, action = AuthShellAction.Back)
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(innerPadding)
                .padding(spacing.lg),
            verticalArrangement = Arrangement.spacedBy(spacing.lg),
        ) {
            when (shellState.currentRoute) {
                AuthShellRoute.SPLASH -> SplashRoute(
                    onAnimationFinished = {
                        shellState = reduceAuthShell(
                            state = shellState,
                            action = AuthShellAction.SplashCompleted(isAuthenticated = isAuthenticatedSession),
                        )
                    },
                )

                AuthShellRoute.WELCOME -> WelcomeRoute(
                    onContinue = {
                        shellState = reduceAuthShell(
                            state = shellState,
                            action = AuthShellAction.ContinueFromWelcome,
                        )
                    },
                    onOpenRegister = {
                        shellState = reduceAuthShell(
                            state = shellState,
                            action = AuthShellAction.OpenRegisterFromWelcome,
                        )
                    },
                )

                AuthShellRoute.LOGIN -> LoginRoute(
                    state = state,
                    onSignIn = viewModel::signIn,
                    onOpenRegister = {
                        shellState = reduceAuthShell(
                            state = shellState,
                            action = AuthShellAction.OpenRegisterFromLogin,
                        )
                    },
                    onOpenRecover = {
                        shellState = reduceAuthShell(
                            state = shellState,
                            action = AuthShellAction.OpenRecoverFromLogin,
                        )
                    },
                    onEmailChanged = viewModel::onEmailChanged,
                    onPasswordChanged = viewModel::onPasswordChanged,
                )

                AuthShellRoute.REGISTER -> RegisterRoute(
                    state = state,
                    onSignUp = viewModel::signUp,
                    onEmailChanged = viewModel::onRegisterEmailChanged,
                    onPasswordChanged = viewModel::onRegisterPasswordChanged,
                    onRepeatPasswordChanged = viewModel::onRegisterRepeatPasswordChanged,
                    onBack = {
                        shellState = reduceAuthShell(
                            state = shellState,
                            action = AuthShellAction.Back,
                        )
                    },
                )

                AuthShellRoute.RECOVER_PASSWORD -> PlaceholderAuthRoute(
                    titleRes = R.string.recover_title,
                    subtitleRes = R.string.recover_subtitle,
                    actionLabelRes = R.string.common_action_back,
                    onAction = {
                        shellState = reduceAuthShell(
                            state = shellState,
                            action = AuthShellAction.Back,
                        )
                    },
                )

                AuthShellRoute.HOME -> HomeRoute(
                    mode = state.mode,
                    draft = state.memberDraft,
                    onDraftChanged = viewModel::onMemberDraftChanged,
                    onToggleAdmin = viewModel::toggleAdmin,
                    onToggleActive = viewModel::toggleActive,
                    onCreateMember = viewModel::createAuthorizedMember,
                    onSignOut = {
                        viewModel.signOut()
                        shellState = reduceAuthShell(
                            state = shellState,
                            action = AuthShellAction.SignedOut,
                        )
                    },
                )
            }
        }
    }
}

@Composable
private fun SplashRoute(
    onAnimationFinished: () -> Unit,
) {
    val spacing = ReguertaThemeTokens.spacing
    val progress = remember { Animatable(0f) }
    var completed by remember { mutableStateOf(false) }
    val latestOnAnimationFinished by rememberUpdatedState(onAnimationFinished)

    LaunchedEffect(Unit) {
        progress.snapTo(0f)
        progress.animateTo(
            targetValue = 1f,
            animationSpec = tween(
                durationMillis = SplashAnimationDurationMillis,
                easing = FastOutSlowInEasing,
            ),
        )
        if (!completed) {
            completed = true
            latestOnAnimationFinished()
        }
    }

    val fraction = progress.value
    val scale = lerp(0.84f, 1.34f, fraction)
    val rotation = lerp(-6f, 8f, fraction)
    val alpha = lerp(0.94f, 0f, fraction)

    ReguertaCard {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.xxl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(spacing.lg),
        ) {
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painter = painterResource(id = R.drawable.reguerta_logo),
                    contentDescription = stringResource(R.string.app_name),
                    modifier = Modifier
                        .height(120.dp)
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                            rotationZ = rotation
                            this.alpha = alpha
                        },
                    contentScale = ContentScale.Fit,
                )
            }
            Text(
                text = stringResource(R.string.auth_shell_splash_loading),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private fun lerp(start: Float, end: Float, fraction: Float): Float =
    start + (end - start) * fraction

@Composable
private fun WelcomeRoute(
    onContinue: () -> Unit,
    onOpenRegister: () -> Unit,
) {
    val spacing = ReguertaThemeTokens.spacing
    ReguertaCard {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.xl),
            verticalArrangement = Arrangement.spacedBy(spacing.md),
        ) {
            Text(
                text = stringResource(R.string.welcome_title_prefix),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = stringResource(R.string.welcome_title_brand),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = stringResource(R.string.welcome_subtitle),
                style = MaterialTheme.typography.bodyMedium,
            )
            ReguertaButton(
                label = stringResource(R.string.welcome_cta_enter),
                onClick = onContinue,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Start,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.welcome_not_registered),
                    style = MaterialTheme.typography.bodyMedium,
                )
                ReguertaButton(
                    label = stringResource(R.string.welcome_link_register),
                    onClick = onOpenRegister,
                    variant = ReguertaButtonVariant.TEXT,
                    fullWidth = false,
                )
            }
        }
    }
}

@Composable
private fun LoginRoute(
    state: SessionUiState,
    onSignIn: () -> Unit,
    onOpenRegister: () -> Unit,
    onOpenRecover: () -> Unit,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
) {
    val spacing = ReguertaThemeTokens.spacing
    ReguertaCard {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.lg),
            verticalArrangement = Arrangement.spacedBy(spacing.md),
        ) {
            Text(
                text = stringResource(R.string.login_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            ReguertaInlineFeedback(
                message = stringResource(R.string.access_signed_out_hint),
                kind = ReguertaFeedbackKind.INFO,
            )
        }
    }

    SignInCard(
        state = state,
        onSignIn = onSignIn,
        onEmailChanged = onEmailChanged,
        onPasswordChanged = onPasswordChanged,
    )

    Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
        ReguertaButton(
            label = stringResource(R.string.login_link_register),
            onClick = onOpenRegister,
            variant = ReguertaButtonVariant.TEXT,
            fullWidth = false,
        )
        ReguertaButton(
            label = stringResource(R.string.login_link_forgot_password),
            onClick = onOpenRecover,
            variant = ReguertaButtonVariant.TEXT,
            fullWidth = false,
        )
    }
}

@Composable
private fun RegisterRoute(
    state: SessionUiState,
    onSignUp: () -> Unit,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onRepeatPasswordChanged: (String) -> Unit,
    onBack: () -> Unit,
) {
    val spacing = ReguertaThemeTokens.spacing
    ReguertaCard {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.lg),
            verticalArrangement = Arrangement.spacedBy(spacing.md),
        ) {
            Text(
                text = stringResource(R.string.register_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            ReguertaInlineFeedback(
                message = stringResource(R.string.access_signed_out_hint),
                kind = ReguertaFeedbackKind.INFO,
            )
        }
    }

    SignUpCard(
        state = state,
        onSignUp = onSignUp,
        onEmailChanged = onEmailChanged,
        onPasswordChanged = onPasswordChanged,
        onRepeatPasswordChanged = onRepeatPasswordChanged,
    )

    Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
        ReguertaButton(
            label = stringResource(R.string.common_action_back),
            onClick = onBack,
            variant = ReguertaButtonVariant.TEXT,
            fullWidth = false,
        )
    }
}

@Composable
private fun PlaceholderAuthRoute(
    titleRes: Int,
    subtitleRes: Int,
    actionLabelRes: Int,
    onAction: () -> Unit,
) {
    val spacing = ReguertaThemeTokens.spacing
    ReguertaCard {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.xl),
            verticalArrangement = Arrangement.spacedBy(spacing.md),
        ) {
            Text(
                text = stringResource(titleRes),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(subtitleRes),
                style = MaterialTheme.typography.bodyMedium,
            )
            ReguertaButton(
                label = stringResource(actionLabelRes),
                onClick = onAction,
            )
        }
    }
}

@Composable
private fun HomeRoute(
    mode: SessionMode,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
    onSignOut: () -> Unit,
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.home_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            TextButton(onClick = onSignOut) {
                Text(stringResource(R.string.access_action_sign_out))
            }
        }
    }

    when (mode) {
        is SessionMode.Unauthorized -> {
            UnauthorizedCard(mode = mode)
            OperationalModules(enabled = false)
        }

        is SessionMode.Authorized -> {
            AuthorizedHome(
                mode = mode,
                draft = draft,
                onDraftChanged = onDraftChanged,
                onToggleAdmin = onToggleAdmin,
                onToggleActive = onToggleActive,
                onCreateMember = onCreateMember,
            )
        }

        SessionMode.SignedOut -> {
            Text(stringResource(R.string.access_signed_out_hint))
        }
    }
}

@Composable
private fun SignInCard(
    state: SessionUiState,
    onSignIn: () -> Unit,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
) {
    val spacing = ReguertaThemeTokens.spacing
    val canSubmit = !state.isAuthenticating &&
        state.emailInput.trim().matches(LoginEmailPatternRegex) &&
        state.passwordInput.isNotBlank()

    ReguertaCard {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.lg),
            verticalArrangement = Arrangement.spacedBy(spacing.md),
        ) {
            Text(stringResource(R.string.access_card_authentication))
            ReguertaInputField(
                label = stringResource(R.string.common_input_email_label),
                value = state.emailInput,
                onValueChange = {
                    onEmailChanged(it)
                },
                helperMessage = stringResource(R.string.access_signed_out_hint),
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Email,
                errorMessage = state.emailErrorRes?.let { stringResource(it) },
            )
            ReguertaInputField(
                label = stringResource(R.string.common_input_password_label),
                value = state.passwordInput,
                onValueChange = {
                    onPasswordChanged(it)
                },
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Password,
                isPassword = true,
                errorMessage = state.passwordErrorRes?.let { stringResource(it) },
            )
            ReguertaButton(
                label = stringResource(
                    if (state.isAuthenticating) {
                        R.string.access_action_signing_in
                    } else {
                        R.string.access_action_sign_in
                    },
                ),
                onClick = {
                    onSignIn()
                },
                enabled = canSubmit,
                loading = state.isAuthenticating,
            )
        }
    }
}

@Composable
private fun SignUpCard(
    state: SessionUiState,
    onSignUp: () -> Unit,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onRepeatPasswordChanged: (String) -> Unit,
) {
    val spacing = ReguertaThemeTokens.spacing
    val canSubmit = !state.isRegistering &&
        state.registerEmailInput.trim().matches(LoginEmailPatternRegex) &&
        state.registerPasswordInput.isNotBlank() &&
        state.registerRepeatPasswordInput == state.registerPasswordInput &&
        state.registerRepeatPasswordInput.isNotBlank()

    ReguertaCard {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.lg),
            verticalArrangement = Arrangement.spacedBy(spacing.md),
        ) {
            Text(stringResource(R.string.access_card_authentication))
            ReguertaInputField(
                label = stringResource(R.string.common_input_email_label),
                value = state.registerEmailInput,
                onValueChange = onEmailChanged,
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Email,
                errorMessage = state.registerEmailErrorRes?.let { stringResource(it) },
            )
            ReguertaInputField(
                label = stringResource(R.string.common_input_password_label),
                value = state.registerPasswordInput,
                onValueChange = onPasswordChanged,
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Password,
                isPassword = true,
                errorMessage = state.registerPasswordErrorRes?.let { stringResource(it) },
            )
            ReguertaInputField(
                label = stringResource(R.string.register_repeat_password_label),
                value = state.registerRepeatPasswordInput,
                onValueChange = onRepeatPasswordChanged,
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Password,
                isPassword = true,
                errorMessage = state.registerRepeatPasswordErrorRes?.let { stringResource(it) },
            )
            ReguertaButton(
                label = stringResource(
                    if (state.isRegistering) {
                        R.string.register_action_creating
                    } else {
                        R.string.register_action_create_account
                    },
                ),
                onClick = onSignUp,
                enabled = canSubmit,
                loading = state.isRegistering,
            )
        }
    }
}

@Composable
private fun UnauthorizedCard(mode: SessionMode.Unauthorized) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                stringResource(R.string.auth_error_member_unauthorized),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(stringResource(R.string.access_signed_in_email_format, mode.email))
            Text(stringResource(R.string.auth_info_member_restricted_mode))
            Text(
                stringResource(R.string.common_reason_format, stringResource(mode.reason.toMessageResId())),
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun AuthorizedHome(
    mode: SessionMode.Authorized,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val context = LocalContext.current
            Text(
                stringResource(R.string.home_welcome_format, mode.member.displayName),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(stringResource(R.string.common_roles_format, mode.member.roles.toPrettyRoles(context)))
            Text(
                stringResource(
                    R.string.common_status_format,
                    stringResource(if (mode.member.isActive) R.string.common_status_active else R.string.common_status_inactive),
                ),
            )
        }
    }

    OperationalModules(enabled = true)

    if (mode.member.isAdmin) {
        AdminMembersCard(
            members = mode.members,
            draft = draft,
            onDraftChanged = onDraftChanged,
            onToggleAdmin = onToggleAdmin,
            onToggleActive = onToggleActive,
            onCreateMember = onCreateMember,
        )
    }
}

@Composable
private fun OperationalModules(enabled: Boolean) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(stringResource(R.string.operational_modules_title))
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_my_order))
            }
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_catalog))
            }
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_shifts))
            }
        }
    }
}

@Composable
private fun AdminMembersCard(
    members: List<Member>,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                stringResource(R.string.admin_manage_members_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(stringResource(R.string.admin_manage_members_subtitle))

            members.forEach { member ->
                MemberRow(member = member, onToggleAdmin = onToggleAdmin, onToggleActive = onToggleActive)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(stringResource(R.string.admin_create_pre_authorized_member), fontWeight = FontWeight.Medium)

            OutlinedTextField(
                value = draft.displayName,
                onValueChange = { onDraftChanged(draft.copy(displayName = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.admin_input_display_name_label)) },
                singleLine = true,
            )
            OutlinedTextField(
                value = draft.email,
                onValueChange = { onDraftChanged(draft.copy(email = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.common_input_email_label)) },
                singleLine = true,
            )

            RoleCheckboxRow(
                checked = draft.isMember,
                label = stringResource(R.string.role_member),
                onCheckedChange = { onDraftChanged(draft.copy(isMember = it)) },
            )
            RoleCheckboxRow(
                checked = draft.isProducer,
                label = stringResource(R.string.role_producer),
                onCheckedChange = { onDraftChanged(draft.copy(isProducer = it)) },
            )
            RoleCheckboxRow(
                checked = draft.isAdmin,
                label = stringResource(R.string.role_admin),
                onCheckedChange = { onDraftChanged(draft.copy(isAdmin = it)) },
            )
            RoleCheckboxRow(
                checked = draft.isActive,
                label = stringResource(R.string.role_active),
                onCheckedChange = { onDraftChanged(draft.copy(isActive = it)) },
            )

            Button(onClick = onCreateMember, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.admin_action_create_member))
            }
        }
    }
}

@Composable
private fun RoleCheckboxRow(
    checked: Boolean,
    label: String,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Checkbox(checked = checked, onCheckedChange = onCheckedChange)
        Text(label)
    }
}

@Composable
private fun MemberRow(
    member: Member,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
) {
    val context = LocalContext.current
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(member.displayName, fontWeight = FontWeight.Medium)
            Text(member.normalizedEmail)
            Text(stringResource(R.string.common_roles_format, member.roles.toPrettyRoles(context)))
            Text(
                stringResource(
                    R.string.member_auth_linked_format,
                    stringResource(if (member.authUid == null) R.string.common_no else R.string.common_yes),
                ),
            )
            Text(
                stringResource(
                    R.string.common_status_format,
                    stringResource(if (member.isActive) R.string.common_status_active else R.string.common_status_inactive),
                ),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onToggleAdmin(member.id) }) {
                    Text(
                        stringResource(
                            if (member.isAdmin) {
                                R.string.admin_action_revoke_admin
                            } else {
                                R.string.admin_action_grant_admin
                            },
                        ),
                    )
                }
                Button(onClick = { onToggleActive(member.id) }) {
                    Text(
                        stringResource(
                            if (member.isActive) {
                                R.string.admin_action_deactivate
                            } else {
                                R.string.admin_action_activate
                            },
                        ),
                    )
                }
            }
        }
    }
}

private fun Set<MemberRole>.toPrettyRoles(context: Context): String =
    this.joinToString(separator = ", ") { role ->
        when (role) {
            MemberRole.MEMBER -> context.getString(R.string.role_value_member)
            MemberRole.PRODUCER -> context.getString(R.string.role_value_producer)
            MemberRole.ADMIN -> context.getString(R.string.role_value_admin)
        }
    }

private fun UnauthorizedReason.toMessageResId(): Int =
    when (this) {
        UnauthorizedReason.USER_NOT_AUTHORIZED -> R.string.auth_error_member_unauthorized
    }
