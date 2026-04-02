package com.reguerta.user.presentation.access

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.annotation.StringRes
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Campaign
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
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.style.TextOverflow
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
import com.reguerta.user.data.devices.FirebaseAuthorizedDeviceRegistrar
import com.reguerta.user.data.devices.FirestoreDeviceRegistrationRepository
import com.reguerta.user.data.freshness.DataStoreCriticalDataFreshnessLocalRepository
import com.reguerta.user.data.freshness.FirestoreCriticalDataFreshnessRemoteRepository
import com.reguerta.user.data.news.ChainedNewsRepository
import com.reguerta.user.data.news.FirestoreNewsRepository
import com.reguerta.user.data.news.InMemoryNewsRepository
import com.reguerta.user.data.notifications.ChainedNotificationRepository
import com.reguerta.user.data.notifications.FirestoreNotificationRepository
import com.reguerta.user.data.notifications.InMemoryNotificationRepository
import com.reguerta.user.data.profiles.ChainedSharedProfileRepository
import com.reguerta.user.data.profiles.FirestoreSharedProfileRepository
import com.reguerta.user.data.profiles.InMemorySharedProfileRepository
import com.reguerta.user.data.shifts.ChainedShiftRepository
import com.reguerta.user.data.shifts.FirestoreShiftRepository
import com.reguerta.user.data.shifts.InMemoryShiftRepository
import com.reguerta.user.data.startup.FirestoreStartupVersionPolicyRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
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
import coil3.compose.AsyncImage
import java.text.DateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.WeekFields
import java.util.Locale

private const val SplashAnimationDurationMillis = 1_500
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
    val newsRepository = remember {
        val fallback = InMemoryNewsRepository()
        val primary = FirestoreNewsRepository(firestore = FirebaseFirestore.getInstance())
        ChainedNewsRepository(primary = primary, fallback = fallback)
    }
    val notificationRepository = remember {
        val fallback = InMemoryNotificationRepository()
        val primary = FirestoreNotificationRepository(firestore = FirebaseFirestore.getInstance())
        ChainedNotificationRepository(primary = primary, fallback = fallback)
    }
    val sharedProfileRepository = remember {
        val fallback = InMemorySharedProfileRepository()
        val primary = FirestoreSharedProfileRepository(firestore = FirebaseFirestore.getInstance())
        ChainedSharedProfileRepository(primary = primary, fallback = fallback)
    }
    val shiftRepository = remember {
        val fallback = InMemoryShiftRepository()
        val primary = FirestoreShiftRepository(firestore = FirebaseFirestore.getInstance())
        ChainedShiftRepository(primary = primary, fallback = fallback)
    }
    val freshnessLocalRepository = remember(context) {
        DataStoreCriticalDataFreshnessLocalRepository(context.applicationContext)
    }
    val deviceRegistrationRepository = remember {
        FirestoreDeviceRegistrationRepository(firestore = FirebaseFirestore.getInstance())
    }
    val authorizedDeviceRegistrar = remember(context.applicationContext) {
        FirebaseAuthorizedDeviceRegistrar(
            context = context.applicationContext,
            repository = deviceRegistrationRepository,
        )
    }
    return remember {
        SessionViewModel(
            repository = repository,
            newsRepository = newsRepository,
            notificationRepository = notificationRepository,
            sharedProfileRepository = sharedProfileRepository,
            shiftRepository = shiftRepository,
            authSessionProvider = FirebaseAuthSessionProvider(auth = FirebaseAuth.getInstance()),
            resolveAuthorizedSession = ResolveAuthorizedSessionUseCase(memberRepository = repository),
            upsertMemberByAdmin = UpsertMemberByAdminUseCase(memberRepository = repository),
            authorizedDeviceRegistrar = authorizedDeviceRegistrar,
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
                    latestNews = state.latestNews,
                    newsFeed = state.newsFeed,
                    newsDraft = state.newsDraft,
                    notificationsFeed = state.notificationsFeed,
                    notificationDraft = state.notificationDraft,
                    sharedProfiles = state.sharedProfiles,
                    sharedProfileDraft = state.sharedProfileDraft,
                    shiftsFeed = state.shiftsFeed,
                    nextDeliveryShift = state.nextDeliveryShift,
                    nextMarketShift = state.nextMarketShift,
                    editingNewsId = state.editingNewsId,
                    isLoadingNews = state.isLoadingNews,
                    isSavingNews = state.isSavingNews,
                    isLoadingNotifications = state.isLoadingNotifications,
                    isSendingNotification = state.isSendingNotification,
                    isLoadingSharedProfiles = state.isLoadingSharedProfiles,
                    isSavingSharedProfile = state.isSavingSharedProfile,
                    isDeletingSharedProfile = state.isDeletingSharedProfile,
                    isLoadingShifts = state.isLoadingShifts,
                    onDraftChanged = viewModel::onMemberDraftChanged,
                    onNewsDraftChanged = viewModel::onNewsDraftChanged,
                    onNotificationDraftChanged = viewModel::onNotificationDraftChanged,
                    onSharedProfileDraftChanged = viewModel::onSharedProfileDraftChanged,
                    onToggleAdmin = viewModel::toggleAdmin,
                    onToggleActive = viewModel::toggleActive,
                    onCreateMember = viewModel::createAuthorizedMember,
                    onStartCreatingNews = viewModel::startCreatingNews,
                    onStartCreatingNotification = viewModel::startCreatingNotification,
                    onStartEditingNews = viewModel::startEditingNews,
                    onSaveNews = viewModel::saveNews,
                    onSendNotification = viewModel::sendNotification,
                    onDeleteNews = viewModel::deleteNews,
                    onRefreshNews = viewModel::refreshNews,
                    onRefreshNotifications = viewModel::refreshNotifications,
                    onRefreshSharedProfiles = viewModel::refreshSharedProfiles,
                    onRefreshShifts = viewModel::refreshShifts,
                    onClearNewsEditor = viewModel::clearNewsEditor,
                    onClearNotificationEditor = viewModel::clearNotificationEditor,
                    onSaveSharedProfile = viewModel::saveSharedProfile,
                    onDeleteSharedProfile = viewModel::deleteSharedProfile,
                    onRetryMyOrderFreshness = viewModel::refreshMyOrderFreshness,
                    onOpenShifts = viewModel::refreshShifts,
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

private enum class HomeDestination {
    DASHBOARD,
    MY_ORDER,
    MY_ORDERS,
    SHIFTS,
    NEWS,
    NOTIFICATIONS,
    PROFILE,
    SETTINGS,
    PRODUCTS,
    RECEIVED_ORDERS,
    USERS,
    PUBLISH_NEWS,
    ADMIN_BROADCAST,
}

@Composable
private fun HomeRoute(
    modifier: Modifier = Modifier,
    mode: SessionMode,
    myOrderFreshnessState: MyOrderFreshnessUiState,
    draft: MemberDraft,
    latestNews: List<NewsArticle>,
    newsFeed: List<NewsArticle>,
    newsDraft: NewsDraft,
    notificationsFeed: List<NotificationEvent>,
    notificationDraft: NotificationDraft,
    sharedProfiles: List<SharedProfile>,
    sharedProfileDraft: SharedProfileDraft,
    shiftsFeed: List<ShiftAssignment>,
    nextDeliveryShift: ShiftAssignment?,
    nextMarketShift: ShiftAssignment?,
    editingNewsId: String?,
    isLoadingNews: Boolean,
    isSavingNews: Boolean,
    isLoadingNotifications: Boolean,
    isSendingNotification: Boolean,
    isLoadingSharedProfiles: Boolean,
    isSavingSharedProfile: Boolean,
    isDeletingSharedProfile: Boolean,
    isLoadingShifts: Boolean,
    onDraftChanged: (MemberDraft) -> Unit,
    onNewsDraftChanged: (NewsDraft) -> Unit,
    onNotificationDraftChanged: (NotificationDraft) -> Unit,
    onSharedProfileDraftChanged: (SharedProfileDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
    onStartCreatingNews: () -> Unit,
    onStartCreatingNotification: () -> Unit,
    onStartEditingNews: (String) -> Unit,
    onSaveNews: (onSuccess: () -> Unit) -> Unit,
    onSendNotification: (onSuccess: () -> Unit) -> Unit,
    onDeleteNews: (String, () -> Unit) -> Unit,
    onRefreshNews: () -> Unit,
    onRefreshNotifications: () -> Unit,
    onRefreshSharedProfiles: () -> Unit,
    onRefreshShifts: () -> Unit,
    onClearNewsEditor: () -> Unit,
    onClearNotificationEditor: () -> Unit,
    onSaveSharedProfile: (onSuccess: () -> Unit) -> Unit,
    onDeleteSharedProfile: (onSuccess: () -> Unit) -> Unit,
    onRetryMyOrderFreshness: () -> Unit,
    onOpenShifts: () -> Unit,
    onSignOut: () -> Unit,
    installedVersion: String,
) {
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var currentDestination by rememberSaveable { mutableStateOf(HomeDestination.DASHBOARD) }
    var newsPendingDeletionId by rememberSaveable { mutableStateOf<String?>(null) }
    val member = when (mode) {
        is SessionMode.Authorized -> mode.member
        SessionMode.SignedOut,
        is SessionMode.Unauthorized,
            -> null
    }

    BackHandler(enabled = drawerState.isOpen) {
        scope.launch { drawerState.close() }
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
                    onNavigate = { destination ->
                        currentDestination = destination
                        if (destination == HomeDestination.NEWS) {
                            onRefreshNews()
                        } else if (destination == HomeDestination.NOTIFICATIONS) {
                            onRefreshNotifications()
                        } else if (destination == HomeDestination.PROFILE) {
                            onRefreshSharedProfiles()
                        } else if (destination == HomeDestination.SHIFTS) {
                            onRefreshShifts()
                        } else if (destination == HomeDestination.PUBLISH_NEWS) {
                            onStartCreatingNews()
                        } else if (destination == HomeDestination.ADMIN_BROADCAST) {
                            onStartCreatingNotification()
                        }
                        scope.launch { drawerState.close() }
                    },
                    onCloseDrawer = {
                        scope.launch { drawerState.close() }
                    },
                    onSignOut = {
                        scope.launch { drawerState.close() }
                        onSignOut()
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
                .imePadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HomeShellTopBar(
                title = stringResource(currentDestination.titleRes()),
                canNavigateBack = currentDestination != HomeDestination.DASHBOARD,
                onBack = {
                    if (currentDestination == HomeDestination.PUBLISH_NEWS) {
                        onClearNewsEditor()
                    } else if (currentDestination == HomeDestination.ADMIN_BROADCAST) {
                        onClearNotificationEditor()
                    }
                    currentDestination = when (currentDestination) {
                        HomeDestination.PUBLISH_NEWS -> HomeDestination.NEWS
                        HomeDestination.ADMIN_BROADCAST -> HomeDestination.NOTIFICATIONS
                        else -> HomeDestination.DASHBOARD
                    }
                },
                onOpenMenu = {
                    scope.launch { drawerState.open() }
                },
                onOpenNotifications = {
                    currentDestination = HomeDestination.NOTIFICATIONS
                    onRefreshNotifications()
                },
            )
            when (currentDestination) {
                HomeDestination.DASHBOARD -> {
                    NextShiftsCard(
                        nextDeliveryShift = nextDeliveryShift,
                        nextMarketShift = nextMarketShift,
                        isLoading = isLoadingShifts,
                        members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                        onViewAll = {
                            currentDestination = HomeDestination.SHIFTS
                            onRefreshShifts()
                        },
                    )
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
                                onOpenShifts = {
                                    currentDestination = HomeDestination.SHIFTS
                                    onRefreshShifts()
                                },
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
                    LatestNewsCard(
                        news = latestNews,
                        onViewAll = {
                            currentDestination = HomeDestination.NEWS
                            onRefreshNews()
                        },
                    )
                }

                HomeDestination.NEWS -> NewsFeedRoute(
                    articles = newsFeed,
                    isLoading = isLoadingNews,
                    isAdmin = member?.isAdmin == true,
                    onRefresh = onRefreshNews,
                    onCreateNews = {
                        onStartCreatingNews()
                        currentDestination = HomeDestination.PUBLISH_NEWS
                    },
                    onEditNews = { newsId ->
                        onStartEditingNews(newsId)
                        currentDestination = HomeDestination.PUBLISH_NEWS
                    },
                    onRequestDeleteNews = { newsId ->
                        newsPendingDeletionId = newsId
                    },
                )

                HomeDestination.PUBLISH_NEWS -> NewsEditorRoute(
                    draft = newsDraft,
                    isSaving = isSavingNews,
                    isEditing = editingNewsId != null,
                    onDraftChanged = onNewsDraftChanged,
                    onCancel = {
                        onClearNewsEditor()
                        currentDestination = HomeDestination.NEWS
                    },
                    onSave = {
                        onSaveNews {
                            currentDestination = HomeDestination.NEWS
                        }
                    },
                )

                HomeDestination.NOTIFICATIONS -> NotificationsFeedRoute(
                    notifications = notificationsFeed,
                    isLoading = isLoadingNotifications,
                    isAdmin = member?.isAdmin == true,
                    onRefresh = onRefreshNotifications,
                    onCreateNotification = {
                        onStartCreatingNotification()
                        currentDestination = HomeDestination.ADMIN_BROADCAST
                    },
                )

                HomeDestination.ADMIN_BROADCAST -> NotificationEditorRoute(
                    draft = notificationDraft,
                    isSending = isSendingNotification,
                    onDraftChanged = onNotificationDraftChanged,
                    onCancel = {
                        onClearNotificationEditor()
                        currentDestination = HomeDestination.NOTIFICATIONS
                    },
                    onSend = {
                        onSendNotification {
                            currentDestination = HomeDestination.NOTIFICATIONS
                        }
                    },
                )

                HomeDestination.PROFILE -> SharedProfileRoute(
                    currentMember = member,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    profiles = sharedProfiles,
                    draft = sharedProfileDraft,
                    isLoading = isLoadingSharedProfiles,
                    isSaving = isSavingSharedProfile,
                    isDeleting = isDeletingSharedProfile,
                    onDraftChanged = onSharedProfileDraftChanged,
                    onRefresh = onRefreshSharedProfiles,
                    onSave = {
                        onSaveSharedProfile { currentDestination = HomeDestination.PROFILE }
                    },
                    onDelete = {
                        onDeleteSharedProfile { currentDestination = HomeDestination.PROFILE }
                    },
                )

                HomeDestination.SHIFTS -> ShiftsRoute(
                    shifts = shiftsFeed,
                    nextDeliveryShift = nextDeliveryShift,
                    nextMarketShift = nextMarketShift,
                    currentMember = member,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    isLoading = isLoadingShifts,
                    onRefresh = onRefreshShifts,
                )

                else -> HomePlaceholderRoute(
                    title = stringResource(currentDestination.titleRes()),
                    subtitle = stringResource(currentDestination.subtitleRes()),
                    onBackHome = {
                        currentDestination = HomeDestination.DASHBOARD
                    },
                )
            }
        }
    }

    newsPendingDeletionId?.let { pendingId ->
        val title = newsFeed.firstOrNull { it.id == pendingId }?.title.orEmpty()
        ReguertaDialog(
            type = ReguertaDialogType.ERROR,
            title = stringResource(R.string.news_delete_dialog_title),
            message = stringResource(R.string.news_delete_dialog_message, title),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.news_delete_action_confirm),
                onClick = {
                    onDeleteNews(pendingId) {
                        newsPendingDeletionId = null
                    }
                },
            ),
            secondaryAction = ReguertaDialogAction(
                label = stringResource(R.string.news_delete_action_cancel),
                onClick = { newsPendingDeletionId = null },
            ),
            onDismissRequest = { newsPendingDeletionId = null },
        )
    }
}

@Composable
private fun HomeShellTopBar(
    title: String,
    canNavigateBack: Boolean,
    onBack: () -> Unit,
    onOpenMenu: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = if (canNavigateBack) onBack else onOpenMenu) {
                Icon(
                    imageVector = if (canNavigateBack) Icons.AutoMirrored.Filled.ArrowBack else Icons.Filled.Menu,
                    contentDescription = if (canNavigateBack) {
                        stringResource(R.string.common_action_back)
                    } else {
                        stringResource(R.string.home_shell_menu)
                    },
                )
            }

            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            IconButton(onClick = onOpenNotifications) {
                Icon(
                    imageVector = Icons.Filled.Notifications,
                    contentDescription = stringResource(R.string.home_shell_notifications),
                )
            }
        }
    }
}

@Composable
private fun HomeDrawerContent(
    member: Member?,
    currentDestination: HomeDestination,
    installedVersion: String,
    onNavigate: (HomeDestination) -> Unit,
    onCloseDrawer: () -> Unit,
    onSignOut: () -> Unit,
) {
    val drawerScrollState = rememberScrollState()
    Column(
        modifier = Modifier
            .fillMaxSize()
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

        Column(
            modifier = Modifier
                .weight(1f, fill = true)
                .verticalScroll(drawerScrollState),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HomeDrawerSection(title = stringResource(R.string.home_shell_section_common))
            HomeDrawerItem(
                icon = Icons.Filled.Home,
                label = stringResource(R.string.home_title),
                selected = currentDestination == HomeDestination.DASHBOARD,
                onClick = { onNavigate(HomeDestination.DASHBOARD) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.ShoppingCart,
                label = stringResource(R.string.module_my_order),
                selected = currentDestination == HomeDestination.MY_ORDER,
                onClick = { onNavigate(HomeDestination.MY_ORDER) },
            )
            HomeDrawerItem(
                icon = Icons.AutoMirrored.Filled.Article,
                label = stringResource(R.string.module_my_orders),
                selected = currentDestination == HomeDestination.MY_ORDERS,
                onClick = { onNavigate(HomeDestination.MY_ORDERS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.CalendarToday,
                label = stringResource(R.string.module_shifts),
                selected = currentDestination == HomeDestination.SHIFTS,
                onClick = { onNavigate(HomeDestination.SHIFTS) },
            )
            HomeDrawerItem(
                icon = Icons.AutoMirrored.Filled.Article,
                label = stringResource(R.string.home_shell_news_title),
                selected = currentDestination == HomeDestination.NEWS,
                onClick = { onNavigate(HomeDestination.NEWS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Notifications,
                label = stringResource(R.string.home_shell_notifications),
                selected = currentDestination == HomeDestination.NOTIFICATIONS,
                onClick = { onNavigate(HomeDestination.NOTIFICATIONS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Group,
                label = stringResource(R.string.home_shell_action_profile),
                selected = currentDestination == HomeDestination.PROFILE,
                onClick = { onNavigate(HomeDestination.PROFILE) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Settings,
                label = stringResource(R.string.home_shell_action_settings),
                selected = currentDestination == HomeDestination.SETTINGS,
                onClick = { onNavigate(HomeDestination.SETTINGS) },
            )

            if (member?.isProducer == true) {
                HomeDrawerSection(title = stringResource(R.string.home_shell_section_producer))
                HomeDrawerItem(
                    icon = Icons.Filled.Storefront,
                    label = stringResource(R.string.home_shell_action_products),
                    selected = currentDestination == HomeDestination.PRODUCTS,
                    onClick = { onNavigate(HomeDestination.PRODUCTS) },
                )
                HomeDrawerItem(
                    icon = Icons.Filled.Inbox,
                    label = stringResource(R.string.home_shell_action_received_orders),
                    selected = currentDestination == HomeDestination.RECEIVED_ORDERS,
                    onClick = { onNavigate(HomeDestination.RECEIVED_ORDERS) },
                )
            }

            if (member?.isAdmin == true) {
                HomeDrawerSection(title = stringResource(R.string.home_shell_section_admin))
                HomeDrawerItem(
                    icon = Icons.Filled.Group,
                    label = stringResource(R.string.home_shell_action_users),
                    selected = currentDestination == HomeDestination.USERS,
                    onClick = { onNavigate(HomeDestination.USERS) },
                )
                HomeDrawerItem(
                    icon = Icons.Filled.Add,
                    label = stringResource(R.string.home_shell_action_publish_news),
                    selected = currentDestination == HomeDestination.PUBLISH_NEWS,
                    onClick = { onNavigate(HomeDestination.PUBLISH_NEWS) },
                )
                HomeDrawerItem(
                    icon = Icons.Filled.Campaign,
                    label = stringResource(R.string.home_shell_action_admin_broadcast),
                    selected = currentDestination == HomeDestination.ADMIN_BROADCAST,
                    onClick = { onNavigate(HomeDestination.ADMIN_BROADCAST) },
                )
            }
        }

        HorizontalDivider()
        TextButton(
            onClick = onSignOut,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.access_action_sign_out))
        }
        Text(
            text = stringResource(R.string.home_shell_version_format, installedVersion.ifBlank { "0.0.0" }),
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.fillMaxWidth(),
        )
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
    selected: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(
                if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.10f) else MaterialTheme.colorScheme.surface,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 10.dp),
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
private fun NextShiftsCard(
    nextDeliveryShift: ShiftAssignment?,
    nextMarketShift: ShiftAssignment?,
    isLoading: Boolean,
    members: List<Member>,
    onViewAll: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.shifts_next_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.shifts_next_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (isLoading) {
                Text(
                    text = stringResource(R.string.shifts_loading),
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                ShiftSummaryRow(
                    label = stringResource(R.string.shifts_next_delivery),
                    shift = nextDeliveryShift,
                    members = members,
                )
                ShiftSummaryRow(
                    label = stringResource(R.string.shifts_next_market),
                    shift = nextMarketShift,
                    members = members,
                )
            }
            Button(onClick = onViewAll) {
                Text(text = stringResource(R.string.shifts_view_all))
            }
        }
    }
}

@Composable
private fun ShiftSummaryRow(
    label: String,
    shift: ShiftAssignment?,
    members: List<Member>,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = shift?.toSummaryLine(members).orEmpty().ifBlank {
                stringResource(R.string.shifts_next_pending)
            },
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun ShiftsRoute(
    shifts: List<ShiftAssignment>,
    nextDeliveryShift: ShiftAssignment?,
    nextMarketShift: ShiftAssignment?,
    currentMember: Member?,
    members: List<Member>,
    isLoading: Boolean,
    onRefresh: () -> Unit,
) {
    var selectedSegment by rememberSaveable { mutableStateOf(ShiftBoardSegment.DELIVERY) }
    val deliveryShifts = remember(shifts) {
        shifts.filter { it.type == ShiftType.DELIVERY }.sortedBy { it.dateMillis }
    }
    val marketShifts = remember(shifts) {
        shifts.filter { it.type == ShiftType.MARKET }.sortedBy { it.dateMillis }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Card {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = stringResource(R.string.shifts_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = stringResource(R.string.shifts_list_subtitle),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(onClick = onRefresh) {
                    Text(text = stringResource(R.string.shifts_refresh_action))
                }
            }
        }

        NextShiftsCard(
            nextDeliveryShift = nextDeliveryShift,
            nextMarketShift = nextMarketShift,
            isLoading = isLoading,
            members = members,
            onViewAll = onRefresh,
        )

        if (isLoading) {
            Card {
                Text(
                    text = stringResource(R.string.shifts_loading),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else if (shifts.isEmpty()) {
            Card {
                Text(
                    text = stringResource(R.string.shifts_empty_state),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else {
            ShiftBoardSegmentSelector(
                selectedSegment = selectedSegment,
                onSegmentSelected = { selectedSegment = it },
            )

            val boardShifts = when (selectedSegment) {
                ShiftBoardSegment.DELIVERY -> deliveryShifts
                ShiftBoardSegment.MARKET -> marketShifts
            }

            if (boardShifts.isEmpty()) {
                Card {
                    Text(
                        text = stringResource(R.string.shifts_empty_state),
                        modifier = Modifier.padding(16.dp),
                    )
                }
            } else {
                boardShifts.forEach { shift ->
                    ShiftBoardCard(
                        shift = shift,
                        members = members,
                        isAssignedToCurrentMember = currentMember?.let {
                            shift.isAssignedTo(it.id)
                        } == true,
                    )
                }
            }
        }
    }
}

@Composable
private fun ShiftBoardSegmentSelector(
    selectedSegment: ShiftBoardSegment,
    onSegmentSelected: (ShiftBoardSegment) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        ShiftBoardSegment.entries.forEach { segment ->
            val isSelected = selectedSegment == segment
            TextButton(
                onClick = { onSegmentSelected(segment) },
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        if (isSelected) {
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)
                        } else {
                            MaterialTheme.colorScheme.surface.copy(alpha = 0f)
                        }
                    ),
            ) {
                Text(
                    text = stringResource(segment.labelRes),
                    color = if (isSelected) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                )
            }
        }
    }
}

@Composable
private fun ShiftBoardCard(
    shift: ShiftAssignment,
    members: List<Member>,
    isAssignedToCurrentMember: Boolean,
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column(
                modifier = Modifier.weight(0.38f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = shift.leftBoardTitle(),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = shift.leftBoardSubtitle(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Column(
                modifier = Modifier.weight(0.62f),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                val primaryNames = shift.primaryBoardNames(members)
                primaryNames.forEachIndexed { index, name ->
                    Text(
                        text = name,
                        style = if (index == 0) {
                            MaterialTheme.typography.bodyLarge
                        } else {
                            MaterialTheme.typography.bodyMedium
                        },
                        fontWeight = if (index == 0) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (index == 0 && isAssignedToCurrentMember) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        },
                    )
                }
                Text(
                    text = stringResource(shift.status.labelRes()),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private enum class ShiftBoardSegment(@StringRes val labelRes: Int) {
    DELIVERY(R.string.shifts_type_delivery),
    MARKET(R.string.shifts_type_market),
}

@Composable
private fun LatestNewsCard(
    news: List<NewsArticle>,
    onViewAll: () -> Unit,
) {
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
            if (news.isEmpty()) {
                Text(
                    text = stringResource(R.string.news_empty_state),
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                news.forEach { article ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = article.title,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = article.body,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 3,
                        )
                    }
                }
            }
            ReguertaFlatButton(
                label = stringResource(R.string.news_view_all),
                onClick = onViewAll,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun NewsFeedRoute(
    articles: List<NewsArticle>,
    isLoading: Boolean,
    isAdmin: Boolean,
    onRefresh: () -> Unit,
    onCreateNews: () -> Unit,
    onEditNews: (String) -> Unit,
    onRequestDeleteNews: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = stringResource(R.string.home_shell_news_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = stringResource(R.string.news_list_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (isAdmin) {
                    ReguertaFullButton(
                        label = stringResource(R.string.news_create_action),
                        onClick = onCreateNews,
                        fullWidth = true,
                    )
                }
                ReguertaFlatButton(
                    label = stringResource(R.string.news_refresh_action),
                    onClick = onRefresh,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (isLoading) {
            Card {
                Text(
                    text = stringResource(R.string.news_loading),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else if (articles.isEmpty()) {
            Card {
                Text(
                    text = stringResource(R.string.news_empty_state),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else {
            articles.forEach { article ->
                Card {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = article.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = stringResource(R.string.news_meta_format, article.publishedBy),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (!article.active) {
                            Text(
                                text = stringResource(R.string.news_inactive_badge),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        Text(
                            text = article.body,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        article.urlImage?.let { url ->
                            Text(
                                text = url,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        if (isAdmin) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ReguertaFlatButton(
                                    label = stringResource(R.string.news_edit_action),
                                    onClick = { onEditNews(article.id) },
                                )
                                TextButton(onClick = { onRequestDeleteNews(article.id) }) {
                                    Text(stringResource(R.string.news_delete_action))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NewsEditorRoute(
    draft: NewsDraft,
    isSaving: Boolean,
    isEditing: Boolean,
    onDraftChanged: (NewsDraft) -> Unit,
    onCancel: () -> Unit,
    onSave: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(
                    if (isEditing) R.string.news_editor_title_edit else R.string.news_editor_title_create,
                ),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            OutlinedTextField(
                value = draft.title,
                onValueChange = { onDraftChanged(draft.copy(title = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.news_field_title)) },
                enabled = !isSaving,
            )
            OutlinedTextField(
                value = draft.body,
                onValueChange = { onDraftChanged(draft.copy(body = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.news_field_body)) },
                minLines = 6,
                enabled = !isSaving,
            )
            OutlinedTextField(
                value = draft.urlImage,
                onValueChange = { onDraftChanged(draft.copy(urlImage = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.news_field_url_image)) },
                enabled = !isSaving,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(text = stringResource(R.string.news_field_active))
                Switch(
                    checked = draft.active,
                    onCheckedChange = { onDraftChanged(draft.copy(active = it)) },
                    enabled = !isSaving,
                )
            }
            ReguertaFullButton(
                label = stringResource(
                    if (isSaving) {
                        R.string.news_save_action_saving
                    } else if (isEditing) {
                        R.string.news_save_action_update
                    } else {
                        R.string.news_save_action_create
                    },
                ),
                onClick = {
                    focusManager.clearFocus(force = true)
                    onSave()
                },
                fullWidth = true,
                enabled = !isSaving,
            )
            ReguertaFlatButton(
                label = stringResource(R.string.common_action_back),
                onClick = {
                    focusManager.clearFocus(force = true)
                    onCancel()
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSaving,
            )
            Spacer(modifier = Modifier.height(64.dp))
        }
    }
}

@Composable
private fun NotificationsFeedRoute(
    notifications: List<NotificationEvent>,
    isLoading: Boolean,
    isAdmin: Boolean,
    onRefresh: () -> Unit,
    onCreateNotification: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = stringResource(R.string.home_shell_notifications),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = stringResource(R.string.notifications_list_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (isAdmin) {
                    ReguertaFullButton(
                        label = stringResource(R.string.notifications_create_action),
                        onClick = onCreateNotification,
                        fullWidth = true,
                    )
                }
                ReguertaFlatButton(
                    label = stringResource(R.string.notifications_refresh_action),
                    onClick = onRefresh,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (isLoading) {
            Card {
                Text(
                    text = stringResource(R.string.notifications_loading),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else if (notifications.isEmpty()) {
            Card {
                Text(
                    text = stringResource(R.string.notifications_empty_state),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else {
            notifications.forEach { event ->
                Card {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = event.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = stringResource(
                                R.string.notifications_meta_format,
                                event.sentAtMillis.toLocalizedDateTime(),
                            ),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = event.body,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = stringResource(event.audienceLabelRes()),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationEditorRoute(
    draft: NotificationDraft,
    isSending: Boolean,
    onDraftChanged: (NotificationDraft) -> Unit,
    onCancel: () -> Unit,
    onSend: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.notifications_editor_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.notifications_editor_subtitle),
                style = MaterialTheme.typography.bodyMedium,
            )
            OutlinedTextField(
                value = draft.title,
                onValueChange = { onDraftChanged(draft.copy(title = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.notifications_field_title)) },
                enabled = !isSending,
            )
            OutlinedTextField(
                value = draft.body,
                onValueChange = { onDraftChanged(draft.copy(body = it)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 5,
                label = { Text(stringResource(R.string.notifications_field_body)) },
                enabled = !isSending,
            )
            Text(
                text = stringResource(R.string.notifications_field_audience),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            NotificationAudience.values().forEach { audience ->
                ReguertaFlatButton(
                    label = buildString {
                        if (draft.audience == audience) append("• ")
                        append(stringResource(audience.labelRes()))
                    },
                    onClick = { onDraftChanged(draft.copy(audience = audience)) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isSending,
                )
            }
            ReguertaFullButton(
                label = stringResource(
                    if (isSending) {
                        R.string.notifications_send_action_sending
                    } else {
                        R.string.notifications_send_action_send
                    },
                ),
                onClick = {
                    focusManager.clearFocus(force = true)
                    onSend()
                },
                enabled = !isSending,
                fullWidth = true,
            )
            ReguertaFlatButton(
                label = stringResource(R.string.common_action_back),
                onClick = {
                    focusManager.clearFocus(force = true)
                    onCancel()
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSending,
            )
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

@Composable
private fun HomePlaceholderRoute(
    title: String,
    subtitle: String,
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
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
            )
            ReguertaFlatButton(
                label = stringResource(R.string.common_action_back),
                onClick = onBackHome,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun SharedProfileRoute(
    currentMember: Member?,
    members: List<Member>,
    profiles: List<SharedProfile>,
    draft: SharedProfileDraft,
    isLoading: Boolean,
    isSaving: Boolean,
    isDeleting: Boolean,
    onDraftChanged: (SharedProfileDraft) -> Unit,
    onRefresh: () -> Unit,
    onSave: (onSuccess: () -> Unit) -> Unit,
    onDelete: () -> Unit,
) {
    val member = currentMember ?: return
    var selectedProfileUserId by rememberSaveable { mutableStateOf<String?>(null) }
    var isEditingOwnProfile by rememberSaveable { mutableStateOf(false) }
    val sortedProfiles = profiles.sortedBy {
        members.firstOrNull { memberItem -> memberItem.id == it.userId }?.displayName ?: it.userId
    }
    val selectedProfile = sortedProfiles.firstOrNull { it.userId == selectedProfileUserId }
    val isOwnSelectedProfile = selectedProfile?.userId == member.id

    when {
        isEditingOwnProfile -> {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = if (profiles.any { it.userId == member.id }) {
                            stringResource(R.string.profile_shared_editor_title_edit)
                        } else {
                            stringResource(R.string.profile_shared_editor_title_create)
                        },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(R.string.profile_shared_editor_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                    )

                    OutlinedTextField(
                        value = draft.familyNames,
                        onValueChange = { onDraftChanged(draft.copy(familyNames = it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.profile_shared_family_names_label)) },
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = draft.photoUrl,
                        onValueChange = { onDraftChanged(draft.copy(photoUrl = it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.profile_shared_photo_url_label)) },
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = draft.about,
                        onValueChange = { onDraftChanged(draft.copy(about = it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.profile_shared_about_label)) },
                        minLines = 5,
                    )

                    ReguertaFullButton(
                        label = stringResource(
                            if (isSaving) {
                                R.string.profile_shared_action_saving
                            } else if (profiles.any { it.userId == member.id }) {
                                R.string.profile_shared_action_save
                            } else {
                                R.string.profile_shared_action_create
                            },
                        ),
                        onClick = {
                            onSave {
                                isEditingOwnProfile = false
                                selectedProfileUserId = null
                            }
                        },
                        enabled = !isSaving,
                        loading = isSaving,
                        fullWidth = true,
                    )
                    ReguertaFlatButton(
                        label = stringResource(R.string.common_action_back),
                        onClick = { isEditingOwnProfile = false },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        selectedProfile != null -> {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    SharedProfileCard(
                        profile = selectedProfile,
                        member = members.firstOrNull { it.id == selectedProfile.userId },
                    )

                    if (isOwnSelectedProfile) {
                        ReguertaFullButton(
                            label = stringResource(R.string.profile_shared_action_edit),
                            onClick = { isEditingOwnProfile = true },
                            fullWidth = true,
                        )
                        ReguertaFlatButton(
                            label = stringResource(
                                if (isDeleting) {
                                    R.string.profile_shared_action_deleting
                                } else {
                                    R.string.profile_shared_action_delete
                                },
                            ),
                            onClick = {
                                onDelete()
                                selectedProfileUserId = null
                            },
                            enabled = !isDeleting,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    ReguertaFlatButton(
                        label = stringResource(R.string.common_action_back),
                        onClick = { selectedProfileUserId = null },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        else -> {
            Column(
                modifier = Modifier
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Card {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = stringResource(R.string.profile_shared_hub_title),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = stringResource(R.string.profile_shared_hub_subtitle),
                            style = MaterialTheme.typography.bodyMedium,
                        )

                        ReguertaFullButton(
                            label = stringResource(
                                if (profiles.any { it.userId == member.id }) {
                                    R.string.profile_shared_action_view_my_profile
                                } else {
                                    R.string.profile_shared_action_create
                                },
                            ),
                            onClick = {
                                if (profiles.any { it.userId == member.id }) {
                                    selectedProfileUserId = member.id
                                } else {
                                    isEditingOwnProfile = true
                                }
                            },
                            fullWidth = true,
                        )
                    }
                }

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
                                    text = stringResource(R.string.profile_shared_community_title),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    text = stringResource(R.string.profile_shared_community_subtitle),
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            TextButton(onClick = onRefresh) {
                                Text(stringResource(R.string.notifications_refresh_action))
                            }
                        }

                        if (isLoading) {
                            Text(
                                text = stringResource(R.string.profile_shared_loading),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        } else if (sortedProfiles.isEmpty()) {
                            Text(
                                text = stringResource(R.string.profile_shared_empty),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        } else {
                            sortedProfiles.forEach { profile ->
                                SharedProfileListRow(
                                    profile = profile,
                                    member = members.firstOrNull { it.id == profile.userId },
                                    onClick = { selectedProfileUserId = profile.userId },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SharedProfileListRow(
    profile: SharedProfile,
    member: Member?,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f))
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = member?.displayName ?: profile.userId,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            if (profile.familyNames.isNotBlank()) {
                Text(
                    text = profile.familyNames,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = null,
            modifier = Modifier.graphicsLayer { rotationZ = 180f },
        )
    }
}

@Composable
private fun SharedProfileCard(
    profile: SharedProfile,
    member: Member?,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        if (!profile.photoUrl.isNullOrBlank()) {
            AsyncImage(
                model = profile.photoUrl,
                contentDescription = member?.displayName ?: profile.userId,
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
        } else {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.Person,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = member?.displayName ?: profile.userId,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (profile.familyNames.isNotBlank()) {
                Text(
                    text = profile.familyNames,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
            }
            if (profile.about.isNotBlank()) {
                Text(
                    text = profile.about,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

private fun HomeDestination.titleRes(): Int = when (this) {
    HomeDestination.DASHBOARD -> R.string.home_title
    HomeDestination.MY_ORDER -> R.string.module_my_order
    HomeDestination.MY_ORDERS -> R.string.module_my_orders
    HomeDestination.SHIFTS -> R.string.module_shifts
    HomeDestination.NEWS -> R.string.home_shell_news_title
    HomeDestination.NOTIFICATIONS -> R.string.home_shell_notifications
    HomeDestination.PROFILE -> R.string.home_shell_action_profile
    HomeDestination.SETTINGS -> R.string.home_shell_action_settings
    HomeDestination.PRODUCTS -> R.string.home_shell_action_products
    HomeDestination.RECEIVED_ORDERS -> R.string.home_shell_action_received_orders
    HomeDestination.USERS -> R.string.home_shell_action_users
    HomeDestination.PUBLISH_NEWS -> R.string.home_shell_action_publish_news
    HomeDestination.ADMIN_BROADCAST -> R.string.home_shell_action_admin_broadcast
}

private fun HomeDestination.subtitleRes(): Int = when (this) {
    HomeDestination.DASHBOARD -> R.string.home_placeholder_subtitle
    HomeDestination.MY_ORDER -> R.string.home_placeholder_my_order
    HomeDestination.MY_ORDERS -> R.string.home_placeholder_my_orders
    HomeDestination.SHIFTS -> R.string.home_placeholder_shifts
    HomeDestination.NEWS -> R.string.news_list_subtitle
    HomeDestination.NOTIFICATIONS -> R.string.notifications_list_subtitle
    HomeDestination.PROFILE -> R.string.home_placeholder_profile
    HomeDestination.SETTINGS -> R.string.home_placeholder_settings
    HomeDestination.PRODUCTS -> R.string.home_placeholder_products
    HomeDestination.RECEIVED_ORDERS -> R.string.home_placeholder_received_orders
    HomeDestination.USERS -> R.string.home_placeholder_users
    HomeDestination.PUBLISH_NEWS -> R.string.news_editor_subtitle
    HomeDestination.ADMIN_BROADCAST -> R.string.notifications_editor_subtitle
}

@StringRes
private fun ShiftType.labelRes(): Int = when (this) {
    ShiftType.DELIVERY -> R.string.shifts_type_delivery
    ShiftType.MARKET -> R.string.shifts_type_market
}

@StringRes
private fun ShiftStatus.labelRes(): Int = when (this) {
    ShiftStatus.PLANNED -> R.string.shifts_status_planned
    ShiftStatus.SWAP_PENDING -> R.string.shifts_status_swap_pending
    ShiftStatus.CONFIRMED -> R.string.shifts_status_confirmed
}

private fun ShiftAssignment.toSummaryLine(members: List<Member>): String =
    "${dateMillis.toLocalizedDateTime()} · ${assignedUserIds.toMemberNames(members)}"

private fun ShiftAssignment.leftBoardTitle(): String = when (type) {
    ShiftType.DELIVERY -> {
        val week = dateMillis.toLocalDate()
            .get(WeekFields.of(Locale.getDefault()).weekOfWeekBasedYear())
        "W$week"
    }
    ShiftType.MARKET -> {
        val formatter = DateTimeFormatter.ofPattern("LLLL", Locale.getDefault())
        formatter.format(dateMillis.toLocalDate())
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
    }
}

private fun ShiftAssignment.leftBoardSubtitle(): String = when (type) {
    ShiftType.DELIVERY -> {
        val date = dateMillis.toLocalDate()
        val start = date.with(java.time.DayOfWeek.MONDAY)
        val end = date.with(java.time.DayOfWeek.SUNDAY)
        val formatter = DateTimeFormatter.ofPattern("d MMM", Locale.getDefault())
        "${formatter.format(start)} - ${formatter.format(end)}"
    }
    ShiftType.MARKET -> {
        val formatter = DateTimeFormatter.ofPattern("EEEE d MMM", Locale.getDefault())
        formatter.format(dateMillis.toLocalDate())
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
    }
}

private fun ShiftAssignment.primaryBoardNames(members: List<Member>): List<String> = when (type) {
    ShiftType.DELIVERY -> buildList {
        assignedUserIds.firstOrNull()?.let { add(members.displayNameFor(it)) }
        helperUserId?.let { add(members.displayNameFor(it)) }
    }.ifEmpty { listOf("—") }
    ShiftType.MARKET -> assignedUserIds
        .map { memberId -> members.displayNameFor(memberId) }
        .ifEmpty { listOf("—") }
}

private fun List<String>.toMemberNames(members: List<Member>): String =
    map { memberId -> members.displayNameFor(memberId) }
        .joinToString(separator = ", ")
        .ifBlank { "—" }

private fun List<Member>.displayNameFor(memberId: String): String =
    firstOrNull { member -> member.id == memberId }?.displayName ?: memberId

private fun Long.toLocalDate(): LocalDate =
    Instant.ofEpochMilli(this)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()

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
    onOpenShifts: () -> Unit,
) {
    OperationalModules(
        modulesEnabled = true,
        myOrderFreshnessState = myOrderFreshnessState,
        onRetryMyOrderFreshness = onRetryMyOrderFreshness,
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
    onOpenShifts: () -> Unit,
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
                onClick = {},
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

private fun NotificationAudience.labelRes(): Int =
    when (this) {
        NotificationAudience.ALL -> R.string.notifications_target_all
        NotificationAudience.MEMBERS -> R.string.notifications_target_members
        NotificationAudience.PRODUCERS -> R.string.notifications_target_producers
        NotificationAudience.ADMINS -> R.string.notifications_target_admins
    }

private fun NotificationEvent.audienceLabelRes(): Int =
    when {
        target == "all" -> R.string.notifications_target_all
        target == "users" -> R.string.notifications_target_users
        segmentType == "role" && targetRole == MemberRole.MEMBER -> R.string.notifications_target_members
        segmentType == "role" && targetRole == MemberRole.PRODUCER -> R.string.notifications_target_producers
        segmentType == "role" && targetRole == MemberRole.ADMIN -> R.string.notifications_target_admins
        else -> R.string.notifications_target_all
    }

private fun Long.toLocalizedDateTime(): String =
    DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(java.util.Date(this))

private sealed interface StartupGateUiState {
    data object Checking : StartupGateUiState

    data object Ready : StartupGateUiState

    data class OptionalUpdate(val storeUrl: String) : StartupGateUiState

    data class ForcedUpdate(val storeUrl: String) : StartupGateUiState

    data object OptionalDismissed : StartupGateUiState
}

private val StartupGateUiState.allowsContinuation: Boolean
    get() = this == StartupGateUiState.Ready || this == StartupGateUiState.OptionalDismissed
