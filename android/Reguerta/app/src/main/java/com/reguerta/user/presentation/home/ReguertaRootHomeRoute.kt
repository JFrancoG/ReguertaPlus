package com.reguerta.user.presentation.home

import com.reguerta.user.presentation.bylaws.BylawsRoute
import com.reguerta.user.presentation.news.NewsEditorRoute
import com.reguerta.user.presentation.news.NewsFeedRoute
import com.reguerta.user.presentation.news.NotificationEditorRoute
import com.reguerta.user.presentation.news.NotificationsFeedRoute
import com.reguerta.user.presentation.orders.MyOrderRoute
import com.reguerta.user.presentation.orders.MyOrdersHistoryRoute
import com.reguerta.user.presentation.orders.ReceivedOrdersHistoryRoute
import com.reguerta.user.presentation.orders.ReceivedOrdersRoute
import com.reguerta.user.presentation.products.ProductsRoute
import com.reguerta.user.presentation.settings.SettingsRoute
import com.reguerta.user.presentation.sharedprofile.SharedProfileRoute
import com.reguerta.user.presentation.shifts.ShiftSwapRequestRoute
import com.reguerta.user.presentation.shifts.ShiftsRoute
import com.reguerta.user.presentation.users.UsersRoute
import com.reguerta.user.presentation.root.BylawsAnswerResult
import com.reguerta.user.presentation.root.MemberDraft
import com.reguerta.user.presentation.root.MyOrderFreshnessUiState
import com.reguerta.user.presentation.root.NewsDraft
import com.reguerta.user.presentation.root.NewsSaveResult
import com.reguerta.user.presentation.root.NotificationDraft
import com.reguerta.user.presentation.root.NotificationFeedItem
import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SharedProfileDraft
import com.reguerta.user.presentation.root.ShiftSwapDraft

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.zIndex
import androidx.compose.ui.platform.LocalContext
import androidx.activity.compose.BackHandler
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.canAccessReceivedOrders
import com.reguerta.user.domain.access.canPublishNews
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import kotlinx.coroutines.delay

private const val HomeDrawerAnimationMillis = 400
private const val HomeDrawerWidthFraction = 304f / 390f
private const val HomeDrawerScrimAlpha = 0.15f
private const val HomeLogoutConfirmationDelayMillis = 80L

@Composable
internal fun HomeRoute(
    modifier: Modifier = Modifier,
    mode: SessionMode,
    myOrderFreshnessState: MyOrderFreshnessUiState,
    draft: MemberDraft,
    latestNews: List<NewsArticle>,
    newsFeed: List<NewsArticle>,
    newsDraft: NewsDraft,
    notificationFeedItems: List<NotificationFeedItem>,
    hasUnreadNotifications: Boolean,
    notificationDraft: NotificationDraft,
    productsFeed: List<Product>,
    myOrderProductsFeed: List<Product>,
    myOrderSeasonalCommitmentsFeed: List<SeasonalCommitment>,
    productDraft: ProductDraft,
    sharedProfiles: List<SharedProfile>,
    sharedProfileDraft: SharedProfileDraft,
    shiftsFeed: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    shiftSwapRequests: List<ShiftSwapRequest>,
    dismissedShiftSwapRequestIds: Set<String>,
    shiftSwapDraft: ShiftSwapDraft,
    bylawsQueryInput: String,
    bylawsAnswerResult: BylawsAnswerResult?,
    nextDeliveryShift: ShiftAssignment?,
    nextMarketShift: ShiftAssignment?,
    editingProductId: String?,
    editingNewsId: String?,
    isLoadingNews: Boolean,
    isSavingNews: Boolean,
    isUploadingNewsImage: Boolean,
    isLoadingNotifications: Boolean,
    isSendingNotification: Boolean,
    showPushNotificationPermissionDialog: Boolean,
    isLoadingProducts: Boolean,
    isLoadingMyOrderProducts: Boolean,
    isSavingProduct: Boolean,
    isUploadingProductImage: Boolean,
    isUpdatingProducerCatalogVisibility: Boolean,
    isLoadingSharedProfiles: Boolean,
    isSavingSharedProfile: Boolean,
    isUploadingSharedProfileImage: Boolean,
    isDeletingSharedProfile: Boolean,
    isLoadingShifts: Boolean,
    isLoadingDeliveryCalendar: Boolean,
    isSavingDeliveryCalendar: Boolean,
    isSubmittingShiftPlanningRequest: Boolean,
    isSavingShiftSwapRequest: Boolean,
    isUpdatingShiftSwapRequest: Boolean,
    isAskingBylaws: Boolean,
    nowOverrideMillis: Long?,
    onDraftChanged: (MemberDraft) -> Unit,
    onNewsDraftChanged: (NewsDraft) -> Unit,
    onNotificationDraftChanged: (NotificationDraft) -> Unit,
    onProductDraftChanged: (ProductDraft) -> Unit,
    onSharedProfileDraftChanged: (SharedProfileDraft) -> Unit,
    onShiftSwapDraftChanged: (ShiftSwapDraft) -> Unit,
    onBylawsQueryChanged: (String) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
    onSaveMemberDraft: (String?, onSuccess: (String) -> Unit) -> Unit,
    onStartCreatingNews: () -> Unit,
    onStartCreatingNotification: () -> Unit,
    onPrepareNotificationsRoute: () -> Unit,
    onMarkVisibleNotificationsReadOnExit: () -> Unit,
    onDismissPushNotificationPermissionDialog: () -> Unit,
    onOpenPushNotificationSettings: () -> Unit,
    onStartCreatingProduct: () -> Unit,
    onStartEditingNews: (String) -> Unit,
    onStartEditingProduct: (String) -> Unit,
    onUploadProductImageFromUri: (Uri) -> Unit,
    onClearProductImage: () -> Unit,
    onUploadNewsImageFromUri: (Uri) -> Unit,
    onClearNewsImage: () -> Unit,
    onUploadSharedProfileImageFromUri: (Uri) -> Unit,
    onClearSharedProfileImage: () -> Unit,
    onSaveNews: (onSuccess: (NewsSaveResult) -> Unit) -> Unit,
    onSaveProduct: (onSuccess: (String) -> Unit) -> Unit,
    onSetProducerCatalogVisibility: (Boolean, onSuccess: () -> Unit) -> Unit,
    onSendNotification: (onSuccess: () -> Unit) -> Unit,
    onDeleteNews: (String, () -> Unit) -> Unit,
    onArchiveProduct: (String, onSuccess: () -> Unit) -> Unit,
    onRefreshNews: () -> Unit,
    onRefreshProducts: () -> Unit,
    onRefreshMyOrderProducts: () -> Unit,
    onRefreshSharedProfiles: () -> Unit,
    onRefreshMembers: () -> Unit,
    onRefreshShifts: () -> Unit,
    onRefreshDeliveryCalendar: () -> Unit,
    onClearNewsEditor: () -> Unit,
    onClearNotificationEditor: () -> Unit,
    onClearProductEditor: () -> Unit,
    onStartCreatingShiftSwap: (String) -> Unit,
    onClearShiftSwapDraft: () -> Unit,
    onSaveShiftSwapRequest: (onSuccess: () -> Unit) -> Unit,
    onAcceptShiftSwapRequest: (String, String) -> Unit,
    onRejectShiftSwapRequest: (String, String) -> Unit,
    onCancelShiftSwapRequest: (String) -> Unit,
    onConfirmShiftSwapRequest: (String, String) -> Unit,
    onAskBylawsQuestion: () -> Unit,
    onClearBylawsResult: () -> Unit,
    onDismissShiftSwapActivity: (String) -> Unit,
    onSaveSharedProfile: (onSuccess: () -> Unit) -> Unit,
    onDeleteSharedProfile: (onSuccess: () -> Unit) -> Unit,
    onSaveDeliveryCalendarOverride: (String, DeliveryWeekday, String, onSuccess: () -> Unit) -> Unit,
    onDeleteDeliveryCalendarOverride: (String, onSuccess: () -> Unit) -> Unit,
    onSubmitShiftPlanningRequest: (ShiftPlanningRequestType, onSuccess: () -> Unit) -> Unit,
    onRetryMyOrderFreshness: () -> Unit,
    onOpenProducts: () -> Unit,
    onOpenShifts: () -> Unit,
    onImpersonateMember: (String) -> Unit,
    onClearImpersonation: () -> Unit,
    onSetNowOverrideMillis: (Long?) -> Unit,
    onShiftNowByDays: (Int) -> Unit,
    isDevelopImpersonationEnabled: Boolean,
    onSignOut: () -> Unit,
    installedVersion: String,
) {
    val context = LocalContext.current
    var isDrawerOpen by rememberSaveable { mutableStateOf(false) }
    var currentDestination by rememberSaveable { mutableStateOf(HomeDestination.DASHBOARD) }
    var newsPendingDeletionId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingSavedNewsId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingSavedNewsWasNew by rememberSaveable { mutableStateOf(false) }
    var isNotificationSentDialogVisible by rememberSaveable { mutableStateOf(false) }
    var highlightedNewsId by rememberSaveable { mutableStateOf<String?>(null) }
    var myOrderCartUnits by rememberSaveable { mutableIntStateOf(0) }
    var myOrderCartOpenRequests by rememberSaveable { mutableIntStateOf(0) }
    var myOrderRouteEntryRequests by rememberSaveable { mutableIntStateOf(0) }
    var isMyOrderReadOnlyMode by rememberSaveable { mutableStateOf(false) }
    var isMyOrderCartVisible by rememberSaveable { mutableStateOf(false) }
    var sharedProfileTitleOverride by rememberSaveable { mutableStateOf<String?>(null) }
    var receivedOrdersHistoryTitleOverride by rememberSaveable { mutableStateOf<String?>(null) }
    val member = when (mode) {
        is SessionMode.Authorized -> mode.member
        SessionMode.SignedOut,
        is SessionMode.Unauthorized,
            -> null
    }
    val currentSharedProfile = sharedProfiles.firstOrNull { profile -> profile.userId == member?.id }
    val effectiveNowMillis = nowOverrideMillis ?: System.currentTimeMillis()

    LaunchedEffect(highlightedNewsId) {
        val currentHighlightedNewsId = highlightedNewsId ?: return@LaunchedEffect
        delay(1_600)
        if (highlightedNewsId == currentHighlightedNewsId) {
            highlightedNewsId = null
        }
    }

    fun closeDrawer() {
        isDrawerOpen = false
    }

    fun navigateHome(destination: HomeDestination) {
        val previousDestination = currentDestination
        if (previousDestination == HomeDestination.NOTIFICATIONS && destination != HomeDestination.NOTIFICATIONS) {
            onMarkVisibleNotificationsReadOnExit()
        }
        if (destination != HomeDestination.MY_ORDER) {
            isMyOrderCartVisible = false
        } else {
            myOrderRouteEntryRequests += 1
            isMyOrderCartVisible = false
        }
        if (destination != HomeDestination.PROFILE) {
            sharedProfileTitleOverride = null
        }
        if (destination != HomeDestination.RECEIVED_ORDERS_HISTORY) {
            receivedOrdersHistoryTitleOverride = null
        }

        currentDestination = destination

        if (destination == HomeDestination.NEWS) {
            onRefreshNews()
        } else if (destination == HomeDestination.NOTIFICATIONS) {
            onPrepareNotificationsRoute()
        } else if (destination == HomeDestination.MY_ORDER) {
            onRefreshMyOrderProducts()
        } else if (destination == HomeDestination.PRODUCTS) {
            onRefreshProducts()
        } else if (destination == HomeDestination.PROFILE) {
            onRefreshSharedProfiles()
        } else if (destination == HomeDestination.USERS) {
            onRefreshMembers()
        } else if (destination == HomeDestination.SHIFTS) {
            onRefreshShifts()
        } else if (destination == HomeDestination.SHIFT_SWAP_REQUEST) {
            onRefreshShifts()
        } else if (destination == HomeDestination.ADMIN_BROADCAST) {
            onStartCreatingNotification()
        } else if (destination == HomeDestination.SETTINGS) {
            onRefreshDeliveryCalendar()
        }
    }

    fun closeNewsSaveDialog() {
        val savedNewsId = pendingSavedNewsId ?: return
        pendingSavedNewsId = null
        pendingSavedNewsWasNew = false
        onClearNewsEditor()
        highlightedNewsId = savedNewsId
        navigateHome(HomeDestination.NEWS)
    }

    fun handleDrawerNavigation(destination: HomeDestination) {
        if (destination == HomeDestination.PUBLISH_NEWS) {
            onStartCreatingNews()
        }
        navigateHome(destination)
        closeDrawer()
    }

    BackHandler(enabled = isDrawerOpen) {
        closeDrawer()
    }

    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val drawerWidth = maxWidth * HomeDrawerWidthFraction
        val drawerAnimationSpec = tween<Dp>(
            durationMillis = HomeDrawerAnimationMillis,
            easing = FastOutSlowInEasing,
        )
        val homeOffset by animateDpAsState(
            targetValue = if (isDrawerOpen) drawerWidth else 0.dp,
            animationSpec = drawerAnimationSpec,
            label = "homeDrawerOffset",
        )
        val homeElevation by animateDpAsState(
            targetValue = if (isDrawerOpen) 12.dp else 0.dp,
            animationSpec = drawerAnimationSpec,
            label = "homeDrawerElevation",
        )
        val isHomeShifted = isDrawerOpen || homeOffset > 0.dp

        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.surface,
        ) {
            Row(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .width(drawerWidth)
                        .clipToBounds(),
                ) {
                    HomeDrawerContentWithLogoutConfirmation(
                        member = member,
                        sharedProfile = currentSharedProfile,
                        currentDestination = currentDestination,
                        installedVersion = installedVersion,
                        isDevelopBuild = isDevelopImpersonationEnabled,
                        onNavigate = ::handleDrawerNavigation,
                        onCloseDrawer = ::closeDrawer,
                        onSignOut = onSignOut,
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .offset { IntOffset(homeOffset.roundToPx(), 0) }
                .shadow(homeElevation, clip = false)
                .zIndex(1f),
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background,
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                val usesRouteScroll =
                    currentDestination != HomeDestination.MY_ORDER &&
                        currentDestination != HomeDestination.MY_ORDERS &&
                        currentDestination != HomeDestination.RECEIVED_ORDERS &&
                        currentDestination != HomeDestination.RECEIVED_ORDERS_HISTORY &&
                        currentDestination != HomeDestination.PRODUCTS &&
                        currentDestination != HomeDestination.USERS &&
                        currentDestination != HomeDestination.NEWS &&
                        currentDestination != HomeDestination.PUBLISH_NEWS &&
                        currentDestination != HomeDestination.ADMIN_BROADCAST &&
                        currentDestination != HomeDestination.PROFILE &&
                        currentDestination != HomeDestination.SHIFTS
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .fillMaxSize()
                        .windowInsetsPadding(
                            WindowInsets.safeDrawing.only(
                                WindowInsetsSides.Horizontal + WindowInsetsSides.Top,
                            ),
                        )
                        .imePadding()
                        .padding(start = 16.dp, top = 0.dp, end = 16.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    val showsMyOrderCartAction = currentDestination == HomeDestination.MY_ORDER && !isMyOrderReadOnlyMode
                    val homeShellTitle = when {
                        currentDestination == HomeDestination.DASHBOARD -> formatHomeTopBarDate(effectiveNowMillis)
                        currentDestination == HomeDestination.MY_ORDER && isMyOrderCartVisible && !isMyOrderReadOnlyMode -> {
                            stringResource(R.string.my_order_cart_title)
                        }
                        currentDestination == HomeDestination.MY_ORDER && isMyOrderReadOnlyMode -> ""
                        currentDestination == HomeDestination.MY_ORDERS -> ""
                        currentDestination == HomeDestination.PUBLISH_NEWS && editingNewsId != null -> {
                            stringResource(R.string.news_editor_title_edit)
                        }
                        currentDestination == HomeDestination.NOTIFICATIONS -> ""
                        currentDestination == HomeDestination.SHIFTS -> ""
                        currentDestination == HomeDestination.PROFILE && !sharedProfileTitleOverride.isNullOrBlank() -> {
                            sharedProfileTitleOverride.orEmpty()
                        }
                        currentDestination == HomeDestination.RECEIVED_ORDERS_HISTORY -> {
                            receivedOrdersHistoryTitleOverride ?: stringResource(R.string.home_shell_action_received_orders)
                        }
                        else -> stringResource(currentDestination.titleRes())
                    }
                    HomeShellTopBar(
                        title = homeShellTitle,
                        canNavigateBack = currentDestination != HomeDestination.DASHBOARD,
                        placesTitleBelowNavigation = currentDestination.placesTitleBelowNavigation(),
                        showsNotificationsAction = currentDestination == HomeDestination.DASHBOARD,
                        hasNotificationIndicator = hasUnreadNotifications,
                        showsCartAction = showsMyOrderCartAction,
                        cartUnits = myOrderCartUnits,
                        onBack = {
                            if (currentDestination == HomeDestination.PUBLISH_NEWS) {
                                onClearNewsEditor()
                            } else if (currentDestination == HomeDestination.ADMIN_BROADCAST) {
                                onClearNotificationEditor()
                            } else if (currentDestination == HomeDestination.PRODUCTS) {
                                onClearProductEditor()
                            } else if (currentDestination == HomeDestination.SHIFT_SWAP_REQUEST) {
                                onClearShiftSwapDraft()
                            } else if (currentDestination == HomeDestination.MY_ORDER) {
                                isMyOrderCartVisible = false
                            }
                            navigateHome(when (currentDestination) {
                                HomeDestination.PUBLISH_NEWS -> HomeDestination.NEWS
                                HomeDestination.ADMIN_BROADCAST -> HomeDestination.NOTIFICATIONS
                                HomeDestination.SHIFT_SWAP_REQUEST -> HomeDestination.SHIFTS
                                else -> HomeDestination.DASHBOARD
                            })
                        },
                        onOpenMenu = {
                            isDrawerOpen = true
                        },
                        onOpenNotifications = {
                            navigateHome(HomeDestination.NOTIFICATIONS)
                        },
                        onOpenCart = {
                            myOrderCartOpenRequests += 1
                        },
                    )
                    Column(
                        modifier = if (usesRouteScroll) {
                            Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .verticalScroll(rememberScrollState())
                        } else {
                            Modifier
                                .fillMaxWidth()
                                .weight(1f)
                        },
                        verticalArrangement = if (usesRouteScroll) {
                            Arrangement.spacedBy(16.dp)
                        } else {
                            Arrangement.Top
                        },
                    ) {
                when (currentDestination) {
                    HomeDestination.DASHBOARD -> {
                    when (mode) {
                        is SessionMode.Unauthorized -> Unit
                        is SessionMode.Authorized -> {
                            val members = mode.members
                            val baselineSummary = resolveHomeWeeklySummaryDisplay(
                                nowMillis = effectiveNowMillis,
                                defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
                                deliveryCalendarOverrides = deliveryCalendarOverrides,
                                shifts = shiftsFeed,
                                members = members,
                                currentMemberId = mode.member.id,
                                orderState = HomeOrderStateDisplay.NOT_STARTED,
                            )
                            val weeklySummary = baselineSummary.copy(
                                orderState = resolveHomeDisplayedOrderState(
                                    isConsultaPhase = baselineSummary.isConsultaPhase,
                                    orderState = resolveHomeOrderState(
                                        context = context,
                                        memberId = mode.member.id,
                                        weekKey = baselineSummary.orderWeekKey,
                                    ),
                                ),
                            )
                            AuthorizedHome(
                                mode = mode,
                                myOrderFreshnessState = myOrderFreshnessState,
                                weeklySummaryDisplay = weeklySummary,
                                onRetryMyOrderFreshness = onRetryMyOrderFreshness,
                                onOpenMyOrder = {
                                    navigateHome(HomeDestination.MY_ORDER)
                                },
                                onOpenReceivedOrders = {
                                    navigateHome(HomeDestination.RECEIVED_ORDERS)
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
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 4.dp),
                        color = MaterialTheme.colorScheme.outlineVariant,
                    )
                    LatestNewsCard(
                        news = latestNews,
                        onViewAll = {
                            navigateHome(HomeDestination.NEWS)
                        },
                        modifier = Modifier.padding(bottom = 16.dp),
                    )
                    Spacer(
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(bottom = 16.dp),
                    )
                    }

                    HomeDestination.NEWS -> NewsFeedRoute(
                    articles = newsFeed,
                    isLoading = isLoadingNews,
                    isAdmin = member?.canPublishNews == true,
                    highlightedNewsId = highlightedNewsId,
                    onCreateNews = {
                        onStartCreatingNews()
                        navigateHome(HomeDestination.PUBLISH_NEWS)
                    },
                    onEditNews = { newsId ->
                        onStartEditingNews(newsId)
                        navigateHome(HomeDestination.PUBLISH_NEWS)
                    },
                    onRequestDeleteNews = { newsId ->
                        newsPendingDeletionId = newsId
                    },
                    )

                    HomeDestination.PUBLISH_NEWS -> NewsEditorRoute(
                    draft = newsDraft,
                    isSaving = isSavingNews,
                    isUploadingImage = isUploadingNewsImage,
                    isEditing = editingNewsId != null,
                    onPickImage = onUploadNewsImageFromUri,
                    onClearImage = onClearNewsImage,
                    onDraftChanged = onNewsDraftChanged,
                    onSave = {
                        onSaveNews { result ->
                            pendingSavedNewsId = result.newsId
                            pendingSavedNewsWasNew = result.isNew
                        }
                    },
                    )

                    HomeDestination.NOTIFICATIONS -> NotificationsFeedRoute(
                    notificationItems = notificationFeedItems,
                    isLoading = isLoadingNotifications,
                    )

                    HomeDestination.ADMIN_BROADCAST -> NotificationEditorRoute(
                    draft = notificationDraft,
                    isSending = isSendingNotification,
                    onDraftChanged = onNotificationDraftChanged,
                    onSend = {
                        onSendNotification {
                            isNotificationSentDialogVisible = true
                        }
                    },
                    )

                    HomeDestination.PRODUCTS -> ProductsRoute(
                    currentMember = member,
                    products = productsFeed,
                    draft = productDraft,
                    editingProductId = editingProductId,
                    isLoading = isLoadingProducts,
                    isSaving = isSavingProduct,
                    isUploadingImage = isUploadingProductImage,
                    isUpdatingProducerCatalogVisibility = isUpdatingProducerCatalogVisibility,
                    onRefresh = onRefreshProducts,
                    onDraftChanged = onProductDraftChanged,
                    onCreateProduct = onStartCreatingProduct,
                    onEditProduct = onStartEditingProduct,
                    onPickImage = onUploadProductImageFromUri,
                    onClearImage = onClearProductImage,
                    onCancelEditor = onClearProductEditor,
                    onSaveProduct = onSaveProduct,
                    onArchiveProduct = onArchiveProduct,
                    onSetProducerCatalogVisibility = onSetProducerCatalogVisibility,
                    )

                    HomeDestination.MY_ORDER -> MyOrderRoute(
                    modifier = Modifier.fillMaxSize(),
                    currentMember = member,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    products = myOrderProductsFeed,
                    seasonalCommitments = myOrderSeasonalCommitmentsFeed,
                    shifts = shiftsFeed,
                    defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    nowOverrideMillis = nowOverrideMillis,
                    isLoading = isLoadingMyOrderProducts,
                    cartOpenRequests = myOrderCartOpenRequests,
                    routeEntryRequests = myOrderRouteEntryRequests,
                    onRefresh = onRefreshMyOrderProducts,
                    onCartUnitsChange = { units -> myOrderCartUnits = units },
                    onReadOnlyModeChange = { isReadOnly -> isMyOrderReadOnlyMode = isReadOnly },
                    onCartVisibilityChange = { isVisible -> isMyOrderCartVisible = isVisible },
                    onCheckoutSuccessAcknowledge = {
                        navigateHome(HomeDestination.DASHBOARD)
                        isMyOrderCartVisible = false
                    },
                    )

                    HomeDestination.MY_ORDERS -> MyOrdersHistoryRoute(
                    modifier = Modifier.fillMaxSize(),
                    currentMember = member,
                    nowOverrideMillis = nowOverrideMillis,
                    )

                    HomeDestination.RECEIVED_ORDERS -> ReceivedOrdersRoute(
                    modifier = Modifier.fillMaxSize(),
                    currentMember = member,
                    shifts = shiftsFeed,
                    defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    nowOverrideMillis = nowOverrideMillis,
                    )

                    HomeDestination.RECEIVED_ORDERS_HISTORY -> ReceivedOrdersHistoryRoute(
                    modifier = Modifier.fillMaxSize(),
                    currentMember = member,
                    nowOverrideMillis = nowOverrideMillis,
                    onTitleChanged = { titleOverride ->
                        receivedOrdersHistoryTitleOverride = titleOverride
                    },
                    )

                    HomeDestination.PROFILE -> SharedProfileRoute(
                    currentMember = member,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    profiles = sharedProfiles,
                    draft = sharedProfileDraft,
                    isLoading = isLoadingSharedProfiles,
                    isSaving = isSavingSharedProfile,
                    isUploadingImage = isUploadingSharedProfileImage,
                    isDeleting = isDeletingSharedProfile,
                    onDraftChanged = onSharedProfileDraftChanged,
                    onPickImage = onUploadSharedProfileImageFromUri,
                    onClearImage = onClearSharedProfileImage,
                    onSave = { onSuccess ->
                        onSaveSharedProfile {
                            onSuccess()
                            navigateHome(HomeDestination.PROFILE)
                        }
                    },
                    onDelete = {
                        onDeleteSharedProfile {
                            navigateHome(HomeDestination.PROFILE)
                        }
                    },
                    onTitleChanged = { titleOverride ->
                        sharedProfileTitleOverride = titleOverride
                    },
                    )

                    HomeDestination.SHIFTS -> ShiftsRoute(
                    shifts = shiftsFeed,
                    shiftSwapRequests = shiftSwapRequests,
                    dismissedShiftSwapRequestIds = dismissedShiftSwapRequestIds,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    currentMember = member,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    isLoading = isLoadingShifts,
                    isUpdatingShiftSwapRequest = isUpdatingShiftSwapRequest,
                    nowMillis = effectiveNowMillis,
                    onRequestShiftSwap = { shiftId ->
                        onStartCreatingShiftSwap(shiftId)
                        navigateHome(HomeDestination.SHIFT_SWAP_REQUEST)
                    },
                    onAcceptShiftSwapRequest = onAcceptShiftSwapRequest,
                    onRejectShiftSwapRequest = onRejectShiftSwapRequest,
                    onCancelShiftSwapRequest = onCancelShiftSwapRequest,
                    onConfirmShiftSwapRequest = onConfirmShiftSwapRequest,
                    onDismissShiftSwapActivity = onDismissShiftSwapActivity,
                    )

                    HomeDestination.SHIFT_SWAP_REQUEST -> ShiftSwapRequestRoute(
                    draft = shiftSwapDraft,
                    shifts = shiftsFeed,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    isSaving = isSavingShiftSwapRequest,
                    onDraftChanged = onShiftSwapDraftChanged,
                    onCancel = {
                        onClearShiftSwapDraft()
                        navigateHome(HomeDestination.SHIFTS)
                    },
                    onSave = {
                        onSaveShiftSwapRequest {
                            navigateHome(HomeDestination.SHIFTS)
                        }
                    },
                    )

                    HomeDestination.SETTINGS -> SettingsRoute(
                    currentMember = member,
                    authenticatedMember = (mode as? SessionMode.Authorized)?.authenticatedMember,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    shifts = shiftsFeed,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
                    isLoadingDeliveryCalendar = isLoadingDeliveryCalendar,
                    isSavingDeliveryCalendar = isSavingDeliveryCalendar,
                    isSubmittingShiftPlanningRequest = isSubmittingShiftPlanningRequest,
                    isDevelopImpersonationEnabled = isDevelopImpersonationEnabled,
                    nowOverrideMillis = nowOverrideMillis,
                    onImpersonateMember = onImpersonateMember,
                    onClearImpersonation = onClearImpersonation,
                    onSetNowOverrideMillis = onSetNowOverrideMillis,
                    onShiftNowByDays = onShiftNowByDays,
                    onRefreshDeliveryCalendar = onRefreshDeliveryCalendar,
                    onSaveDeliveryCalendarOverride = onSaveDeliveryCalendarOverride,
                    onDeleteDeliveryCalendarOverride = onDeleteDeliveryCalendarOverride,
                    onSubmitShiftPlanningRequest = onSubmitShiftPlanningRequest,
                    )

                    HomeDestination.USERS -> UsersRoute(
                    currentMember = member,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    draft = draft,
                    onDraftChanged = onDraftChanged,
                    onSaveMemberDraft = onSaveMemberDraft,
                    onRefreshMembers = onRefreshMembers,
                    onToggleActive = onToggleActive,
                    )

                    HomeDestination.BYLAWS -> BylawsRoute(
                        queryInput = bylawsQueryInput,
                        answerResult = bylawsAnswerResult,
                        isLoading = isAskingBylaws,
                        onQueryChanged = onBylawsQueryChanged,
                        onAsk = onAskBylawsQuestion,
                        onClear = onClearBylawsResult,
                    )

                    }
                }
                }

                if (isHomeShifted) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = HomeDrawerScrimAlpha))
                            .clickable(onClick = ::closeDrawer),
                    )
                }

            }
        }

    }
    pendingSavedNewsId?.let {
        ReguertaDialog(
            type = ReguertaDialogType.INFO,
            title = stringResource(
                if (pendingSavedNewsWasNew) {
                    R.string.news_save_created_dialog_title
                } else {
                    R.string.news_save_updated_dialog_title
                },
            ),
            message = stringResource(
                if (pendingSavedNewsWasNew) {
                    R.string.news_save_created_dialog_message
                } else {
                    R.string.news_save_updated_dialog_message
                },
            ),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.common_action_close),
                onClick = ::closeNewsSaveDialog,
            ),
            onDismissRequest = ::closeNewsSaveDialog,
        )
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

    if (isNotificationSentDialogVisible) {
        ReguertaDialog(
            type = ReguertaDialogType.INFO,
            title = stringResource(R.string.notifications_send_success_dialog_title),
            message = stringResource(R.string.notifications_send_success_dialog_message),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.common_action_close),
                onClick = {
                    isNotificationSentDialogVisible = false
                    onClearNotificationEditor()
                    navigateHome(HomeDestination.NOTIFICATIONS)
                },
            ),
            onDismissRequest = {
                isNotificationSentDialogVisible = false
                onClearNotificationEditor()
                navigateHome(HomeDestination.NOTIFICATIONS)
            },
        )
    }

    if (showPushNotificationPermissionDialog && currentDestination == HomeDestination.NOTIFICATIONS) {
        ReguertaDialog(
            type = ReguertaDialogType.INFO,
            title = stringResource(R.string.notifications_push_permission_dialog_title),
            message = stringResource(R.string.notifications_push_permission_dialog_message),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.notifications_push_permission_dialog_settings),
                onClick = onOpenPushNotificationSettings,
            ),
            secondaryAction = ReguertaDialogAction(
                label = stringResource(R.string.common_action_close),
                onClick = onDismissPushNotificationPermissionDialog,
            ),
            onDismissRequest = onDismissPushNotificationPermissionDialog,
        )
    }
}
}

@Composable
fun HomeDrawerContentWithLogoutConfirmation(
    member: Member?,
    sharedProfile: SharedProfile?,
    currentDestination: HomeDestination,
    installedVersion: String,
    isDevelopBuild: Boolean,
    onNavigate: (HomeDestination) -> Unit,
    onCloseDrawer: () -> Unit,
    onSignOut: () -> Unit,
) {
    var showLogoutConfirmationDialog by rememberSaveable { mutableStateOf(false) }
    var logoutConfirmationRequestCount by rememberSaveable { mutableIntStateOf(0) }

    LaunchedEffect(logoutConfirmationRequestCount) {
        if (logoutConfirmationRequestCount == 0) {
            return@LaunchedEffect
        }
        delay(HomeLogoutConfirmationDelayMillis)
        showLogoutConfirmationDialog = true
    }

    fun dismissLogoutConfirmation() {
        showLogoutConfirmationDialog = false
    }

    HomeDrawerContent(
        member = member,
        sharedProfile = sharedProfile,
        currentDestination = currentDestination,
        installedVersion = installedVersion,
        isDevelopBuild = isDevelopBuild,
        onNavigate = onNavigate,
        onCloseDrawer = onCloseDrawer,
        onSignOut = {
            onCloseDrawer()
            showLogoutConfirmationDialog = false
            logoutConfirmationRequestCount += 1
        },
    )

    if (showLogoutConfirmationDialog) {
        HomeLogoutConfirmationDialog(
            onConfirmSignOut = {
                showLogoutConfirmationDialog = false
                onSignOut()
            },
            onDismiss = ::dismissLogoutConfirmation,
        )
    }
}

@Composable
private fun HomeLogoutConfirmationDialog(
    onConfirmSignOut: () -> Unit,
    onDismiss: () -> Unit,
) {
    ReguertaDialog(
        type = ReguertaDialogType.INFO,
        title = stringResource(R.string.access_action_sign_out),
        message = stringResource(R.string.access_action_sign_out_confirm_message),
        primaryAction = ReguertaDialogAction(
            label = stringResource(R.string.common_action_confirm),
            onClick = onConfirmSignOut,
        ),
        secondaryAction = ReguertaDialogAction(
            label = stringResource(R.string.common_action_back),
            onClick = onDismiss,
        ),
        onDismissRequest = onDismiss,
    )
}
