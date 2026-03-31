package com.reguerta.user.presentation.access

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.R
import com.reguerta.user.data.access.ChainedMemberRepository
import com.reguerta.user.data.access.FirebaseAuthSessionProvider
import com.reguerta.user.data.access.FirestoreMemberRepository
import com.reguerta.user.data.access.InMemoryMemberRepository
import com.reguerta.user.data.freshness.DataStoreCriticalDataFreshnessLocalRepository
import com.reguerta.user.data.freshness.FirestoreCriticalDataFreshnessRemoteRepository
import com.reguerta.user.data.startup.FirestoreStartupVersionPolicyRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.startup.ResolveStartupVersionGateUseCase
import com.reguerta.user.domain.startup.StartupPlatform
import com.reguerta.user.domain.startup.StartupVersionGateDecision
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import com.reguerta.user.ui.components.auth.ReguertaFullButton
import com.reguerta.user.ui.components.auth.ReguertaInputField
import com.reguerta.user.ui.theme.ReguertaAdaptive
import com.reguerta.user.ui.theme.ReguertaThemeTokens
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

private const val SplashAnimationDurationMillis = 1_500

private enum class HomeDestination(
    val titleRes: Int,
) {
    HOME(R.string.home_title),
    MY_ORDER(R.string.module_my_order),
    MY_ORDERS(R.string.module_my_orders),
    SHIFTS(R.string.module_shifts),
    NEWS(R.string.home_shell_news_title),
    NOTIFICATIONS(R.string.home_shell_notifications),
    PROFILE(R.string.home_shell_action_profile),
    SETTINGS(R.string.home_shell_action_settings),
    PRODUCTS(R.string.home_shell_action_products),
    RECEIVED_ORDERS(R.string.home_shell_action_received_orders),
    USERS(R.string.home_shell_action_users),
    PUBLISH_NEWS(R.string.home_shell_action_publish_news),
    SEND_EXTRA_NOTIFICATION(R.string.home_shell_action_send_extra_notification),
}
private const val StartupPolicyFetchTimeoutMillis = 2_500L
private const val PasswordMinLength = 6
private const val PasswordMaxLength = 16
private val LoginEmailPatternRegex =
    "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$".toRegex(setOf(RegexOption.IGNORE_CASE))

@Composable
fun rememberSessionViewModel(): SessionViewModel {
    val context = LocalContext.current
    val repository = remember {
        val fallback = InMemoryMemberRepository()
        val primary = FirestoreMemberRepository(firestore = FirebaseFirestore.getInstance())
        ChainedMemberRepository(primary = primary, fallback = fallback)
    }
    val freshnessLocalRepository = remember(context) {
        DataStoreCriticalDataFreshnessLocalRepository(context.applicationContext)
    }
    return remember {
        SessionViewModel(
            repository = repository,
            authSessionProvider = FirebaseAuthSessionProvider(auth = FirebaseAuth.getInstance()),
            resolveAuthorizedSession = ResolveAuthorizedSessionUseCase(memberRepository = repository),
            upsertMemberByAdmin = UpsertMemberByAdminUseCase(memberRepository = repository),
            resolveCriticalDataFreshness = ResolveCriticalDataFreshnessUseCase(
                remoteRepository = FirestoreCriticalDataFreshnessRemoteRepository(
                    firestore = FirebaseFirestore.getInstance(),
                ),
                localRepository = freshnessLocalRepository,
            ),
            criticalDataFreshnessLocalRepository = freshnessLocalRepository,
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
    val lifecycleOwner = LocalLifecycleOwner.current
    val spacing = ReguertaThemeTokens.spacing
    val installedVersion = remember(context) {
        resolveInstalledVersionName(context)
    }
    val startupVersionGateResolver = remember {
        ResolveStartupVersionGateUseCase(
            repository = FirestoreStartupVersionPolicyRepository(firestore = FirebaseFirestore.getInstance()),
        )
    }

    var shellState by remember { mutableStateOf(AuthShellState()) }
    var splashAnimationFinished by remember { mutableStateOf(false) }
    var startupGateState by remember {
        mutableStateOf<StartupGateUiState>(StartupGateUiState.Checking)
    }
    val isAuthenticatedSession = state.mode is SessionMode.Authorized || state.mode is SessionMode.Unauthorized

    LaunchedEffect(startupVersionGateResolver) {
        val decision = withTimeoutOrNull(StartupPolicyFetchTimeoutMillis) {
            startupVersionGateResolver(
                platform = StartupPlatform.ANDROID,
                installedVersion = installedVersion,
            )
        } ?: StartupVersionGateDecision.Allow

        startupGateState = when (decision) {
            StartupVersionGateDecision.Allow -> StartupGateUiState.Ready
            is StartupVersionGateDecision.OptionalUpdate -> StartupGateUiState.OptionalUpdate(
                storeUrl = decision.storeUrl,
            )

            is StartupVersionGateDecision.ForcedUpdate -> StartupGateUiState.ForcedUpdate(
                storeUrl = decision.storeUrl,
            )
        }
    }

    LaunchedEffect(viewModel) {
        viewModel.refreshSession(SessionRefreshTrigger.STARTUP)
    }

    LaunchedEffect(viewModel) {
        viewModel.uiEvents.collect { event ->
            if (event is SessionUiEvent.ShowMessage) {
                snackbarHostState.showSnackbar(context.getString(event.messageRes))
            }
        }
    }

    LaunchedEffect(state.mode) {
        if (isAuthenticatedSession && shellState.currentRoute != AuthShellRoute.SPLASH) {
            shellState = reduceAuthShell(
                state = shellState,
                action = AuthShellAction.SessionAuthenticated,
            )
        } else if (state.mode is SessionMode.SignedOut && shellState.currentRoute == AuthShellRoute.HOME) {
            shellState = reduceAuthShell(
                state = shellState,
                action = AuthShellAction.SignedOut,
            )
        }
    }

    DisposableEffect(lifecycleOwner, viewModel) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_START) {
                viewModel.refreshSession(SessionRefreshTrigger.FOREGROUND)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(
        shellState.currentRoute,
        splashAnimationFinished,
        startupGateState,
        isAuthenticatedSession,
    ) {
        if (shellState.currentRoute != AuthShellRoute.SPLASH) {
            return@LaunchedEffect
        }
        if (!splashAnimationFinished) {
            return@LaunchedEffect
        }
        if (!startupGateState.allowsContinuation) {
            return@LaunchedEffect
        }

        shellState = reduceAuthShell(
            state = shellState,
            action = AuthShellAction.SplashCompleted(isAuthenticated = isAuthenticatedSession),
        )
    }

    val clearRouteForm: (AuthShellRoute) -> Unit = { route ->
        when (route) {
            AuthShellRoute.LOGIN -> viewModel.clearLoginForm()
            AuthShellRoute.REGISTER -> viewModel.clearRegisterForm()
            AuthShellRoute.RECOVER_PASSWORD -> viewModel.clearRecoverForm()
            AuthShellRoute.SPLASH,
            AuthShellRoute.WELCOME,
            AuthShellRoute.HOME,
                -> Unit
        }
    }
    val routeToReauthentication = {
        viewModel.dismissSessionExpiredDialog()
        viewModel.clearLoginForm()
        shellState = reduceAuthShell(
            state = shellState,
            action = AuthShellAction.Reauthenticate,
        )
    }
    val signOutAndRoute = {
        viewModel.signOut()
        shellState = reduceAuthShell(
            state = shellState,
            action = AuthShellAction.SignedOut,
        )
    }

    BackHandler(enabled = shellState.canGoBack) {
        clearRouteForm(shellState.currentRoute)
        shellState = reduceAuthShell(state = shellState, action = AuthShellAction.Back)
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
    ) { innerPadding ->
        if (shellState.currentRoute == AuthShellRoute.HOME) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                HomeRoute(
                    modifier = Modifier.fillMaxSize(),
                    mode = state.mode,
                    myOrderFreshnessState = state.myOrderFreshnessState,
                    draft = state.memberDraft,
                    onDraftChanged = viewModel::onMemberDraftChanged,
                    onToggleAdmin = viewModel::toggleAdmin,
                    onToggleActive = viewModel::toggleActive,
                    onCreateMember = viewModel::createAuthorizedMember,
                    onRetryMyOrderFreshness = viewModel::refreshMyOrderFreshness,
                    onSignOut = signOutAndRoute,
                    installedVersion = installedVersion,
                )

                if (state.showUnauthorizedDialog) {
                    ReguertaDialog(
                        type = ReguertaDialogType.INFO,
                        title = stringResource(R.string.unauthorized_dialog_title),
                        message = stringResource(R.string.unauthorized_dialog_message),
                        primaryAction = ReguertaDialogAction(
                            label = stringResource(R.string.unauthorized_dialog_action),
                            onClick = signOutAndRoute,
                        ),
                        dismissible = false,
                        onDismissRequest = {},
                    )
                }
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(start = spacing.lg, end = spacing.lg, bottom = spacing.lg),
            ) {
                when (shellState.currentRoute) {
                    AuthShellRoute.SPLASH -> SplashRoute(
                        onAnimationFinished = {
                            splashAnimationFinished = true
                        },
                    )

                    AuthShellRoute.WELCOME -> WelcomeRoute(
                        onContinue = {
                            viewModel.clearLoginForm()
                            shellState = reduceAuthShell(
                                state = shellState,
                                action = AuthShellAction.ContinueFromWelcome,
                            )
                        },
                        onOpenRegister = {
                            viewModel.clearRegisterForm()
                            shellState = reduceAuthShell(
                                state = shellState,
                                action = AuthShellAction.OpenRegisterFromWelcome,
                            )
                        },
                    )

                    AuthShellRoute.LOGIN -> LoginRoute(
                        state = state,
                        onSignIn = viewModel::signIn,
                        onBack = {
                            clearRouteForm(AuthShellRoute.LOGIN)
                            shellState = reduceAuthShell(
                                state = shellState,
                                action = AuthShellAction.Back,
                            )
                        },
                        onOpenRecover = {
                            viewModel.clearRecoverForm()
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
                            clearRouteForm(AuthShellRoute.REGISTER)
                            shellState = reduceAuthShell(
                                state = shellState,
                                action = AuthShellAction.Back,
                            )
                        },
                    )

                    AuthShellRoute.RECOVER_PASSWORD -> RecoverPasswordRoute(
                        state = state,
                        onEmailChanged = viewModel::onRecoverEmailChanged,
                        onSendReset = viewModel::sendPasswordReset,
                        onResetEmailDialogAccepted = {
                            viewModel.dismissRecoverSuccessDialog()
                            clearRouteForm(AuthShellRoute.RECOVER_PASSWORD)
                            shellState = AuthShellState(backStack = listOf(AuthShellRoute.WELCOME))
                        },
                        onBack = {
                            clearRouteForm(AuthShellRoute.RECOVER_PASSWORD)
                            shellState = reduceAuthShell(
                                state = shellState,
                                action = AuthShellAction.Back,
                            )
                        },
                    )

                    AuthShellRoute.HOME -> Unit
                }

                if (shellState.currentRoute == AuthShellRoute.SPLASH) {
                    StartupVersionGateDialog(
                        state = startupGateState,
                        onUpdateNow = { storeUrl ->
                            openStoreUrl(context = context, storeUrl = storeUrl)
                        },
                        onDismissOptional = {
                            startupGateState = StartupGateUiState.OptionalDismissed
                        },
                    )
                }

                if (state.showSessionExpiredDialog) {
                    ReguertaDialog(
                        type = ReguertaDialogType.ERROR,
                        title = stringResource(R.string.session_expired_dialog_title),
                        message = stringResource(R.string.session_expired_dialog_message),
                        primaryAction = ReguertaDialogAction(
                            label = stringResource(R.string.session_expired_dialog_action),
                            onClick = routeToReauthentication,
                        ),
                        onDismissRequest = routeToReauthentication,
                    )
                }
            }
        }
    }
}

@Composable
private fun SplashRoute(
    onAnimationFinished: () -> Unit,
) {
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
private fun StartupVersionGateDialog(
    state: StartupGateUiState,
    onUpdateNow: (String) -> Unit,
    onDismissOptional: () -> Unit,
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

        StartupGateUiState.Checking,
        StartupGateUiState.Ready,
        StartupGateUiState.OptionalDismissed,
            -> Unit
    }
}

private fun openStoreUrl(
    context: Context,
    storeUrl: String,
) {
    val uri = runCatching { Uri.parse(storeUrl) }.getOrNull() ?: return
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(intent) }
}

private fun resolveInstalledVersionName(context: Context): String =
    runCatching {
        @Suppress("DEPRECATION")
        context.packageManager.getPackageInfo(context.packageName, 0).versionName.orEmpty()
    }.getOrDefault("")

@Composable
private fun WelcomeRoute(
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
private fun LoginRoute(
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
private fun RegisterRoute(
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
private fun RecoverPasswordRoute(
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

@Composable
private fun RecoverPasswordCard(
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
private fun HomeRoute(
    modifier: Modifier = Modifier,
    mode: SessionMode,
    myOrderFreshnessState: MyOrderFreshnessUiState,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
    onRetryMyOrderFreshness: () -> Unit,
    onSignOut: () -> Unit,
    installedVersion: String,
) {
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var currentDestination by rememberSaveable { mutableStateOf(HomeDestination.HOME) }
    var showSignOutConfirmation by rememberSaveable { mutableStateOf(false) }
    val member = when (mode) {
        is SessionMode.Authorized -> mode.member
        SessionMode.SignedOut,
        is SessionMode.Unauthorized,
            -> null
    }
    val closeDrawer: () -> Unit = {
        scope.launch { drawerState.close() }
    }

    BackHandler(enabled = drawerState.isOpen) {
        scope.launch { drawerState.close() }
    }

    LaunchedEffect(member) {
        if (member == null) {
            currentDestination = HomeDestination.HOME
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.widthIn(max = 320.dp),
                windowInsets = WindowInsets(0.dp),
            ) {
                HomeDrawerContent(
                    member = member,
                    currentDestination = currentDestination,
                    installedVersion = installedVersion,
                    onCloseDrawer = { closeDrawer() },
                    onDestinationSelected = { destination ->
                        currentDestination = destination
                        closeDrawer()
                    },
                    onSignOutRequested = {
                        closeDrawer()
                        showSignOutConfirmation = true
                    },
                )
            }
        },
        modifier = modifier,
        gesturesEnabled = true,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HomeShellTopBar(
                title = stringResource(currentDestination.titleRes),
                onOpenMenu = {
                    scope.launch { drawerState.open() }
                },
                onOpenNotifications = {
                    if (member != null) {
                        currentDestination = HomeDestination.NOTIFICATIONS
                    }
                },
                notificationsEnabled = member != null,
            )

            when (currentDestination) {
                HomeDestination.HOME -> {
                    WeeklyContextCard()

                    when (mode) {
                        is SessionMode.Unauthorized -> Unit

                        is SessionMode.Authorized -> {
                            AuthorizedHome(
                                mode = mode,
                                myOrderFreshnessState = myOrderFreshnessState,
                                draft = draft,
                                onDraftChanged = onDraftChanged,
                                onToggleAdmin = onToggleAdmin,
                                onToggleActive = onToggleActive,
                                onCreateMember = onCreateMember,
                                onRetryMyOrderFreshness = onRetryMyOrderFreshness,
                                onOpenMyOrder = { currentDestination = HomeDestination.MY_ORDER },
                                onOpenShifts = { currentDestination = HomeDestination.SHIFTS },
                            )
                        }

                        SessionMode.SignedOut -> {
                            Card {
                                Text(
                                    text = stringResource(R.string.access_signed_out_hint),
                                    modifier = Modifier.padding(16.dp),
                                )
                            }
                        }
                    }

                    LatestNewsCard()
                }

                HomeDestination.SETTINGS -> {
                    SettingsPlaceholderRoute(
                        member = member,
                        onBackHome = { currentDestination = HomeDestination.HOME },
                    )
                }

                else -> {
                    HomePlaceholderRoute(
                        destination = currentDestination,
                        onBackHome = { currentDestination = HomeDestination.HOME },
                    )
                }
            }
        }
    }

    if (showSignOutConfirmation) {
        ReguertaDialog(
            type = ReguertaDialogType.INFO,
            title = stringResource(R.string.sign_out_confirm_title),
            message = stringResource(R.string.sign_out_confirm_message),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.access_action_sign_out),
                onClick = {
                    showSignOutConfirmation = false
                    onSignOut()
                },
            ),
            secondaryAction = ReguertaDialogAction(
                label = stringResource(R.string.common_action_cancel),
                onClick = { showSignOutConfirmation = false },
            ),
            onDismissRequest = { showSignOutConfirmation = false },
        )
    }
}

@Composable
private fun HomeShellTopBar(
    title: String,
    onOpenMenu: () -> Unit,
    onOpenNotifications: () -> Unit,
    notificationsEnabled: Boolean,
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onOpenMenu) {
                Icon(
                    imageVector = Icons.Filled.Menu,
                    contentDescription = stringResource(R.string.home_shell_menu),
                )
            }

            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            IconButton(
                onClick = onOpenNotifications,
                enabled = notificationsEnabled,
            ) {
                Icon(
                    imageVector = Icons.Filled.Notifications,
                    contentDescription = stringResource(R.string.home_shell_notifications),
                )
            }
        }
    }
}

@Composable
private fun HomePlaceholderRoute(
    destination: HomeDestination,
    onBackHome: () -> Unit,
) {
    val noteRes = when (destination) {
        HomeDestination.MY_ORDERS -> R.string.home_placeholder_my_orders_history_note
        HomeDestination.RECEIVED_ORDERS -> R.string.home_placeholder_received_orders_history_note
        else -> null
    }

    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(destination.titleRes),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.home_placeholder_ready_message),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (noteRes != null) {
                Text(
                    text = stringResource(noteRes),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Button(onClick = onBackHome, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.home_placeholder_back_home))
            }
        }
    }
}

@Composable
private fun SettingsPlaceholderRoute(
    member: Member?,
    onBackHome: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.home_shell_action_settings),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.home_placeholder_settings_intro),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            HomeDrawerSection(title = stringResource(R.string.home_shell_section_common))
            Text(text = stringResource(R.string.home_shell_action_profile), style = MaterialTheme.typography.bodyMedium)
            Text(text = stringResource(R.string.home_shell_notifications), style = MaterialTheme.typography.bodyMedium)

            if (member?.isProducer == true) {
                HomeDrawerSection(title = stringResource(R.string.home_shell_section_producer))
                Text(text = stringResource(R.string.home_shell_action_products), style = MaterialTheme.typography.bodyMedium)
            }

            if (member?.isAdmin == true) {
                HomeDrawerSection(title = stringResource(R.string.home_shell_section_admin))
                Text(text = stringResource(R.string.home_shell_action_users), style = MaterialTheme.typography.bodyMedium)
                Text(text = stringResource(R.string.home_shell_action_publish_news), style = MaterialTheme.typography.bodyMedium)
                Text(text = stringResource(R.string.home_shell_action_send_extra_notification), style = MaterialTheme.typography.bodyMedium)
            }

            Button(onClick = onBackHome, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.home_placeholder_back_home))
            }
        }
    }
}

@Composable
private fun HomeDrawerContent(
    member: Member?,
    currentDestination: HomeDestination,
    installedVersion: String,
    onCloseDrawer: () -> Unit,
    onDestinationSelected: (HomeDestination) -> Unit,
    onSignOutRequested: () -> Unit,
) {
    val context = LocalContext.current

    Column(
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Start,
            ) {
                IconButton(onClick = onCloseDrawer) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.common_action_back),
                    )
                }
            }

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(76.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.AccountCircle,
                        contentDescription = stringResource(R.string.home_shell_profile_placeholder),
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(44.dp),
                    )
                }
                if (member != null) {
                    Text(
                        text = member.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = member.normalizedEmail,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            HomeDrawerItem(
                icon = Icons.Filled.Home,
                label = stringResource(R.string.home_title),
                selected = currentDestination == HomeDestination.HOME,
                onClick = { onDestinationSelected(HomeDestination.HOME) },
            )

            HomeDrawerSection(title = stringResource(R.string.home_shell_section_common))
            HomeDrawerItem(
                icon = Icons.Filled.ShoppingCart,
                label = stringResource(R.string.module_my_order),
                selected = currentDestination == HomeDestination.MY_ORDER,
                onClick = { onDestinationSelected(HomeDestination.MY_ORDER) },
            )
            HomeDrawerItem(
                icon = Icons.AutoMirrored.Filled.Article,
                label = stringResource(R.string.module_my_orders),
                selected = currentDestination == HomeDestination.MY_ORDERS,
                onClick = { onDestinationSelected(HomeDestination.MY_ORDERS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.CalendarToday,
                label = stringResource(R.string.module_shifts),
                selected = currentDestination == HomeDestination.SHIFTS,
                onClick = { onDestinationSelected(HomeDestination.SHIFTS) },
            )
            HomeDrawerItem(
                icon = Icons.AutoMirrored.Filled.Article,
                label = stringResource(R.string.home_shell_news_title),
                selected = currentDestination == HomeDestination.NEWS,
                onClick = { onDestinationSelected(HomeDestination.NEWS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Notifications,
                label = stringResource(R.string.home_shell_notifications),
                selected = currentDestination == HomeDestination.NOTIFICATIONS,
                onClick = { onDestinationSelected(HomeDestination.NOTIFICATIONS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Person,
                label = stringResource(R.string.home_shell_action_profile),
                selected = currentDestination == HomeDestination.PROFILE,
                onClick = { onDestinationSelected(HomeDestination.PROFILE) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Settings,
                label = stringResource(R.string.home_shell_action_settings),
                selected = currentDestination == HomeDestination.SETTINGS,
                onClick = { onDestinationSelected(HomeDestination.SETTINGS) },
            )

            if (member?.isProducer == true) {
                HomeDrawerSection(title = stringResource(R.string.home_shell_section_producer))
                HomeDrawerItem(
                    icon = Icons.Filled.Storefront,
                    label = stringResource(R.string.home_shell_action_products),
                    selected = currentDestination == HomeDestination.PRODUCTS,
                    onClick = { onDestinationSelected(HomeDestination.PRODUCTS) },
                )
                HomeDrawerItem(
                    icon = Icons.Filled.Inbox,
                    label = stringResource(R.string.home_shell_action_received_orders),
                    selected = currentDestination == HomeDestination.RECEIVED_ORDERS,
                    onClick = { onDestinationSelected(HomeDestination.RECEIVED_ORDERS) },
                )
            }

            if (member?.isAdmin == true) {
                HomeDrawerSection(title = stringResource(R.string.home_shell_section_admin))
                HomeDrawerItem(
                    icon = Icons.Filled.Group,
                    label = stringResource(R.string.home_shell_action_users),
                    selected = currentDestination == HomeDestination.USERS,
                    onClick = { onDestinationSelected(HomeDestination.USERS) },
                )
                HomeDrawerItem(
                    icon = Icons.AutoMirrored.Filled.Article,
                    label = stringResource(R.string.home_shell_action_publish_news),
                    selected = currentDestination == HomeDestination.PUBLISH_NEWS,
                    onClick = { onDestinationSelected(HomeDestination.PUBLISH_NEWS) },
                )
                HomeDrawerItem(
                    icon = Icons.Filled.Notifications,
                    label = stringResource(R.string.home_shell_action_send_extra_notification),
                    selected = currentDestination == HomeDestination.SEND_EXTRA_NOTIFICATION,
                    onClick = { onDestinationSelected(HomeDestination.SEND_EXTRA_NOTIFICATION) },
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            HorizontalDivider()
            TextButton(
                onClick = onSignOutRequested,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.access_action_sign_out))
            }
            Text(
                text = stringResource(R.string.home_shell_version_format, installedVersion.ifBlank { "0.0.0" }),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = stringResource(R.string.common_roles_format, member?.roles?.toPrettyRoles(context) ?: "-"),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun HomeDrawerSection(
    title: String,
) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun HomeDrawerItem(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(
                if (selected) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                } else {
                    MaterialTheme.colorScheme.surface
                },
            )
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun WeeklyContextCard() {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = stringResource(R.string.home_shell_weekly_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            WeeklyContextRow(
                title = stringResource(R.string.home_shell_weekly_responsible),
                value = stringResource(R.string.home_shell_weekly_pending),
            )
            WeeklyContextRow(
                title = stringResource(R.string.home_shell_weekly_support),
                value = stringResource(R.string.home_shell_weekly_pending),
            )
            WeeklyContextRow(
                title = stringResource(R.string.home_shell_weekly_main_producer),
                value = stringResource(R.string.home_shell_weekly_pending),
            )
            WeeklyContextRow(
                title = stringResource(R.string.home_shell_weekly_delivery),
                value = stringResource(R.string.home_shell_weekly_delivery_default),
            )
        }
    }
}

@Composable
private fun WeeklyContextRow(
    title: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun LatestNewsCard() {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = stringResource(R.string.home_shell_news_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.home_shell_news_intro),
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = "\u2022 ${stringResource(R.string.home_shell_news_item_one)}",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                text = "\u2022 ${stringResource(R.string.home_shell_news_item_two)}",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun SignInCard(
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
private fun SignUpCard(
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

@Composable
private fun UnauthorizedCard(
    mode: SessionMode.Unauthorized,
    onSignOut: () -> Unit,
) {
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
            Text(
                stringResource(R.string.auth_info_member_unauthorized_explanation),
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(stringResource(R.string.access_signed_in_email_format, mode.email))
            Text(stringResource(R.string.auth_info_member_restricted_mode))
            Text(
                stringResource(R.string.auth_info_member_contact_admin),
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                stringResource(R.string.common_reason_format, stringResource(mode.reason.toMessageResId())),
                style = MaterialTheme.typography.bodySmall,
            )
            Button(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.access_action_sign_out))
            }
        }
    }
}

@Composable
private fun AuthorizedHome(
    mode: SessionMode.Authorized,
    myOrderFreshnessState: MyOrderFreshnessUiState,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
    onRetryMyOrderFreshness: () -> Unit,
    onOpenMyOrder: () -> Unit,
    onOpenShifts: () -> Unit,
) {
    OperationalModules(
        modulesEnabled = true,
        myOrderFreshnessState = myOrderFreshnessState,
        onRetryMyOrderFreshness = onRetryMyOrderFreshness,
        onOpenMyOrder = onOpenMyOrder,
        onOpenShifts = onOpenShifts,
    )

    if (mode.member.isAdmin) {
        AdminToolsCard(
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
private fun AdminToolsCard(
    members: List<Member>,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }

    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        stringResource(R.string.admin_manage_members_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        stringResource(R.string.admin_manage_members_subtitle),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                IconButton(onClick = { expanded = !expanded }) {
                    Icon(
                        imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                        contentDescription = null,
                    )
                }
            }

            if (expanded) {
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
}

@Composable
private fun OperationalModules(
    modulesEnabled: Boolean,
    myOrderFreshnessState: MyOrderFreshnessUiState,
    onRetryMyOrderFreshness: () -> Unit,
    onOpenMyOrder: () -> Unit = {},
    onOpenShifts: () -> Unit = {},
    disabledMessage: String? = null,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(stringResource(R.string.operational_modules_title))
            Button(
                onClick = onOpenMyOrder,
                enabled = modulesEnabled && myOrderFreshnessState == MyOrderFreshnessUiState.Ready,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.module_my_order))
            }
            Button(onClick = {}, enabled = modulesEnabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_catalog))
            }
            Button(onClick = onOpenShifts, enabled = modulesEnabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_shifts))
            }

            if (!modulesEnabled && disabledMessage != null) {
                Text(
                    text = disabledMessage,
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            when (myOrderFreshnessState) {
                MyOrderFreshnessUiState.Checking -> {
                    Text(
                        text = stringResource(R.string.my_order_freshness_checking),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }

                MyOrderFreshnessUiState.TimedOut,
                MyOrderFreshnessUiState.Unavailable,
                    -> {
                        Text(
                            text = stringResource(R.string.my_order_freshness_error_title),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = stringResource(R.string.my_order_freshness_error_message),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        TextButton(onClick = onRetryMyOrderFreshness) {
                            Text(stringResource(R.string.my_order_freshness_retry))
                        }
                    }

                MyOrderFreshnessUiState.Idle,
                MyOrderFreshnessUiState.Ready,
                    -> Unit
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

private val Member.isProducer: Boolean
    get() = roles.contains(MemberRole.PRODUCER)

private fun UnauthorizedReason.toMessageResId(): Int =
    when (this) {
        UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS,
        UnauthorizedReason.USER_ACCESS_RESTRICTED,
            -> R.string.auth_error_member_unauthorized
    }

private fun isValidEmail(email: String): Boolean =
    email.trim().matches(LoginEmailPatternRegex)

private fun isValidPassword(password: String): Boolean =
    password.length in PasswordMinLength..PasswordMaxLength

private sealed interface StartupGateUiState {
    data object Checking : StartupGateUiState

    data object Ready : StartupGateUiState

    data class OptionalUpdate(val storeUrl: String) : StartupGateUiState

    data class ForcedUpdate(val storeUrl: String) : StartupGateUiState

    data object OptionalDismissed : StartupGateUiState
}

private val StartupGateUiState.allowsContinuation: Boolean
    get() = this == StartupGateUiState.Ready || this == StartupGateUiState.OptionalDismissed
