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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Image
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.reguerta.user.data.calendar.ChainedDeliveryCalendarRepository
import com.reguerta.user.data.calendar.FirestoreDeliveryCalendarRepository
import com.reguerta.user.data.calendar.InMemoryDeliveryCalendarRepository
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
import com.reguerta.user.data.products.ChainedProductRepository
import com.reguerta.user.data.products.FirestoreProductRepository
import com.reguerta.user.data.products.InMemoryProductRepository
import com.reguerta.user.data.shiftplanning.ChainedShiftPlanningRequestRepository
import com.reguerta.user.data.shiftplanning.FirestoreShiftPlanningRequestRepository
import com.reguerta.user.data.shiftplanning.InMemoryShiftPlanningRequestRepository
import com.reguerta.user.data.shifts.ChainedShiftRepository
import com.reguerta.user.data.shifts.FirestoreShiftRepository
import com.reguerta.user.data.shifts.InMemoryShiftRepository
import com.reguerta.user.data.shiftswap.ChainedShiftSwapRequestRepository
import com.reguerta.user.data.shiftswap.FirestoreShiftSwapRequestRepository
import com.reguerta.user.data.shiftswap.InMemoryShiftSwapRequestRepository
import com.reguerta.user.data.startup.FirestoreStartupVersionPolicyRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.products.CommonPurchaseType
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
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
import java.time.Month
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

private const val StartupPolicyFetchTimeoutMillis = 2_500L

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
                    productsFeed = state.productsFeed,
                    productDraft = state.productDraft,
                    sharedProfiles = state.sharedProfiles,
                    sharedProfileDraft = state.sharedProfileDraft,
                    shiftsFeed = state.shiftsFeed,
                    deliveryCalendarOverrides = state.deliveryCalendarOverrides,
                    defaultDeliveryDayOfWeek = state.defaultDeliveryDayOfWeek,
                    shiftSwapRequests = state.shiftSwapRequests,
                    dismissedShiftSwapRequestIds = state.dismissedShiftSwapRequestIds,
                    shiftSwapDraft = state.shiftSwapDraft,
                    nextDeliveryShift = state.nextDeliveryShift,
                    nextMarketShift = state.nextMarketShift,
                    editingProductId = state.editingProductId,
                    editingNewsId = state.editingNewsId,
                    isLoadingNews = state.isLoadingNews,
                    isSavingNews = state.isSavingNews,
                    isLoadingNotifications = state.isLoadingNotifications,
                    isSendingNotification = state.isSendingNotification,
                    isLoadingProducts = state.isLoadingProducts,
                    isSavingProduct = state.isSavingProduct,
                    isUpdatingProducerCatalogVisibility = state.isUpdatingProducerCatalogVisibility,
                    isLoadingSharedProfiles = state.isLoadingSharedProfiles,
                    isSavingSharedProfile = state.isSavingSharedProfile,
                    isDeletingSharedProfile = state.isDeletingSharedProfile,
                    isLoadingShifts = state.isLoadingShifts,
                    isLoadingDeliveryCalendar = state.isLoadingDeliveryCalendar,
                    isSavingDeliveryCalendar = state.isSavingDeliveryCalendar,
                    isSubmittingShiftPlanningRequest = state.isSubmittingShiftPlanningRequest,
                    isSavingShiftSwapRequest = state.isSavingShiftSwapRequest,
                    isUpdatingShiftSwapRequest = state.isUpdatingShiftSwapRequest,
                    onDraftChanged = viewModel::onMemberDraftChanged,
                    onNewsDraftChanged = viewModel::onNewsDraftChanged,
                    onNotificationDraftChanged = viewModel::onNotificationDraftChanged,
                    onProductDraftChanged = viewModel::onProductDraftChanged,
                    onSharedProfileDraftChanged = viewModel::onSharedProfileDraftChanged,
                    onShiftSwapDraftChanged = viewModel::onShiftSwapDraftChanged,
                    onToggleAdmin = viewModel::toggleAdmin,
                    onToggleActive = viewModel::toggleActive,
                    onCreateMember = viewModel::createAuthorizedMember,
                    onStartCreatingNews = viewModel::startCreatingNews,
                    onStartCreatingNotification = viewModel::startCreatingNotification,
                    onStartCreatingProduct = viewModel::startCreatingProduct,
                    onStartEditingNews = viewModel::startEditingNews,
                    onStartEditingProduct = viewModel::startEditingProduct,
                    onSaveNews = viewModel::saveNews,
                    onSaveProduct = viewModel::saveProduct,
                    onSetProducerCatalogVisibility = viewModel::setOwnProducerCatalogVisibility,
                    onSendNotification = viewModel::sendNotification,
                    onDeleteNews = viewModel::deleteNews,
                    onArchiveProduct = viewModel::archiveProduct,
                    onRefreshNews = viewModel::refreshNews,
                    onRefreshNotifications = viewModel::refreshNotifications,
                    onRefreshProducts = viewModel::refreshProducts,
                    onRefreshSharedProfiles = viewModel::refreshSharedProfiles,
                    onRefreshShifts = viewModel::refreshShifts,
                    onRefreshDeliveryCalendar = viewModel::refreshDeliveryCalendar,
                    onClearNewsEditor = viewModel::clearNewsEditor,
                    onClearNotificationEditor = viewModel::clearNotificationEditor,
                    onClearProductEditor = viewModel::clearProductEditor,
                    onStartCreatingShiftSwap = viewModel::startCreatingShiftSwap,
                    onClearShiftSwapDraft = viewModel::clearShiftSwapDraft,
                    onSaveShiftSwapRequest = viewModel::saveShiftSwapRequest,
                    onAcceptShiftSwapRequest = viewModel::acceptShiftSwapRequest,
                    onRejectShiftSwapRequest = viewModel::rejectShiftSwapRequest,
                    onCancelShiftSwapRequest = viewModel::cancelShiftSwapRequest,
                    onConfirmShiftSwapRequest = viewModel::confirmShiftSwapRequest,
                    onDismissShiftSwapActivity = viewModel::dismissShiftSwapActivity,
                    onSaveSharedProfile = viewModel::saveSharedProfile,
                    onDeleteSharedProfile = viewModel::deleteSharedProfile,
                    onSaveDeliveryCalendarOverride = viewModel::saveDeliveryCalendarOverride,
                    onDeleteDeliveryCalendarOverride = viewModel::deleteDeliveryCalendarOverride,
                    onSubmitShiftPlanningRequest = viewModel::submitShiftPlanningRequest,
                    onRetryMyOrderFreshness = viewModel::refreshMyOrderFreshness,
                    onOpenProducts = viewModel::refreshProducts,
                    onOpenShifts = viewModel::refreshShifts,
                    onImpersonateMember = viewModel::impersonateMember,
                    onClearImpersonation = viewModel::clearImpersonation,
                    isDevelopImpersonationEnabled = viewModel.isDevelopImpersonationEnabled,
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
