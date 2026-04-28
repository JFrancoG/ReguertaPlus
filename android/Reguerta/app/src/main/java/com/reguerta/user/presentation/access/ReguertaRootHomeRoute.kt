package com.reguerta.user.presentation.access

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Card
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.activity.compose.BackHandler
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.canPublishNews
import com.reguerta.user.domain.access.canSendAdminNotifications
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import kotlinx.coroutines.launch
@Composable
internal fun HomeRoute(
    modifier: Modifier = Modifier,
    mode: SessionMode,
    myOrderFreshnessState: MyOrderFreshnessUiState,
    draft: MemberDraft,
    latestNews: List<NewsArticle>,
    newsFeed: List<NewsArticle>,
    newsDraft: NewsDraft,
    notificationsFeed: List<NotificationEvent>,
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
    onSaveMemberDraft: (String?, onSuccess: () -> Unit) -> Unit,
    onStartCreatingNews: () -> Unit,
    onStartCreatingNotification: () -> Unit,
    onStartCreatingProduct: () -> Unit,
    onStartEditingNews: (String) -> Unit,
    onStartEditingProduct: (String) -> Unit,
    onUploadProductImageFromUri: (Uri) -> Unit,
    onClearProductImage: () -> Unit,
    onUploadNewsImageFromUri: (Uri) -> Unit,
    onClearNewsImage: () -> Unit,
    onUploadSharedProfileImageFromUri: (Uri) -> Unit,
    onClearSharedProfileImage: () -> Unit,
    onSaveNews: (onSuccess: () -> Unit) -> Unit,
    onSaveProduct: (onSuccess: () -> Unit) -> Unit,
    onSetProducerCatalogVisibility: (Boolean, onSuccess: () -> Unit) -> Unit,
    onSendNotification: (onSuccess: () -> Unit) -> Unit,
    onDeleteNews: (String, () -> Unit) -> Unit,
    onArchiveProduct: (String, onSuccess: () -> Unit) -> Unit,
    onRefreshNews: () -> Unit,
    onRefreshNotifications: () -> Unit,
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
                        } else if (destination == HomeDestination.BYLAWS) {
                            Unit
                        } else if (destination == HomeDestination.SHIFT_SWAP_REQUEST) {
                            onRefreshShifts()
                        } else if (destination == HomeDestination.PUBLISH_NEWS) {
                            onStartCreatingNews()
                        } else if (destination == HomeDestination.ADMIN_BROADCAST) {
                            onStartCreatingNotification()
                        } else if (destination == HomeDestination.SETTINGS) {
                            onRefreshDeliveryCalendar()
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
        val usesRouteScroll =
            currentDestination != HomeDestination.MY_ORDER &&
                currentDestination != HomeDestination.RECEIVED_ORDERS &&
                currentDestination != HomeDestination.USERS
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxSize()
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
                    } else if (currentDestination == HomeDestination.PRODUCTS) {
                        onClearProductEditor()
                    } else if (currentDestination == HomeDestination.SHIFT_SWAP_REQUEST) {
                        onClearShiftSwapDraft()
                    }
                    currentDestination = when (currentDestination) {
                        HomeDestination.PUBLISH_NEWS -> HomeDestination.NEWS
                        HomeDestination.ADMIN_BROADCAST -> HomeDestination.NOTIFICATIONS
                        HomeDestination.SHIFT_SWAP_REQUEST -> HomeDestination.SHIFTS
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
                    NextShiftsCard(
                        nextDeliveryShift = nextDeliveryShift,
                        nextMarketShift = nextMarketShift,
                        deliveryCalendarOverrides = deliveryCalendarOverrides,
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
                                onOpenMyOrder = {
                                    currentDestination = HomeDestination.MY_ORDER
                                    onRefreshMyOrderProducts()
                                },
                                onOpenProducts = {
                                    currentDestination = HomeDestination.PRODUCTS
                                    onRefreshProducts()
                                },
                                onOpenShifts = {
                                    currentDestination = HomeDestination.SHIFTS
                                    onRefreshShifts()
                                },
                                onOpenBylaws = {
                                    currentDestination = HomeDestination.BYLAWS
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
                    isAdmin = member?.canPublishNews == true,
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
                    isUploadingImage = isUploadingNewsImage,
                    isEditing = editingNewsId != null,
                    onPickImage = onUploadNewsImageFromUri,
                    onClearImage = onClearNewsImage,
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
                    isAdmin = member?.canSendAdminNotifications == true,
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
                    onSaveProduct = { onSaveProduct { } },
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
                    onRefresh = onRefreshMyOrderProducts,
                    onCheckoutSuccessAcknowledge = {
                        currentDestination = HomeDestination.DASHBOARD
                    },
                    )

                    HomeDestination.RECEIVED_ORDERS -> ReceivedOrdersRoute(
                    modifier = Modifier.fillMaxSize(),
                    currentMember = member,
                    shifts = shiftsFeed,
                    defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    nowOverrideMillis = nowOverrideMillis,
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
                    shiftSwapRequests = shiftSwapRequests,
                    dismissedShiftSwapRequestIds = dismissedShiftSwapRequestIds,
                    nextDeliveryShift = nextDeliveryShift,
                    nextMarketShift = nextMarketShift,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    currentMember = member,
                    members = (mode as? SessionMode.Authorized)?.members.orEmpty(),
                    isLoading = isLoadingShifts,
                    isUpdatingShiftSwapRequest = isUpdatingShiftSwapRequest,
                    onRefresh = onRefreshShifts,
                    onRequestShiftSwap = { shiftId ->
                        onStartCreatingShiftSwap(shiftId)
                        currentDestination = HomeDestination.SHIFT_SWAP_REQUEST
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
                        currentDestination = HomeDestination.SHIFTS
                    },
                    onSave = {
                        onSaveShiftSwapRequest {
                            currentDestination = HomeDestination.SHIFTS
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
