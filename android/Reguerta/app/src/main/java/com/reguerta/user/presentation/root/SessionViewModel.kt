package com.reguerta.user.presentation.root

import android.net.Uri
import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.reguerta.user.data.bylaws.InMemoryBylawsKnowledgeSource
import com.reguerta.user.data.media.ImagePipelineManager
import com.reguerta.user.domain.access.AuthSessionProvider
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.NoOpSessionEnvironmentRouter
import com.reguerta.user.domain.access.SessionEnvironmentRouter
import com.reguerta.user.domain.access.SessionRefreshPolicy
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.bylaws.BylawsEvidenceRetriever
import com.reguerta.user.domain.bylaws.BylawsKnowledgeSource
import com.reguerta.user.domain.bylaws.BylawsOnDeviceAssistant
import com.reguerta.user.domain.bylaws.PdfOnlyBylawsOnDeviceAssistant
import com.reguerta.user.domain.commitments.SeasonalCommitmentRepository
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.notifications.PushNotificationPermissionProvider
import com.reguerta.user.domain.profiles.SharedProfileRepository
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import com.reguerta.user.presentation.auth.SessionAuthActions
import com.reguerta.user.presentation.auth.clearCommunitySessionState
import com.reguerta.user.presentation.bylaws.SessionBylawsActions
import com.reguerta.user.presentation.products.SessionProductActions
import com.reguerta.user.presentation.shifts.SessionShiftActions
import com.reguerta.user.presentation.users.SessionMemberActions
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

class SessionViewModel(
    private val repository: MemberRepository,
    private val newsRepository: NewsRepository,
    private val notificationRepository: NotificationRepository,
    private val productRepository: ProductRepository,
    private val seasonalCommitmentRepository: SeasonalCommitmentRepository,
    private val imagePipelineManager: ImagePipelineManager,
    private val sharedProfileRepository: SharedProfileRepository,
    private val shiftRepository: ShiftRepository,
    private val deliveryCalendarRepository: DeliveryCalendarRepository,
    private val shiftPlanningRequestRepository: ShiftPlanningRequestRepository = object : ShiftPlanningRequestRepository {
        override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest = request
    },
    private val shiftSwapRequestRepository: ShiftSwapRequestRepository = object : ShiftSwapRequestRepository {
        override suspend fun getAllShiftSwapRequests() = emptyList<com.reguerta.user.domain.shifts.ShiftSwapRequest>()
        override suspend fun createShiftSwapRequest(requestedShiftId: String, reason: String): String = ""
        override suspend fun respondToShiftSwapRequest(
            requestId: String,
            candidateShiftId: String,
            response: ShiftSwapResponseStatus,
        ) = Unit
        override suspend fun cancelShiftSwapRequest(requestId: String) = Unit
        override suspend fun applyShiftSwapRequest(requestId: String, candidateShiftId: String) = Unit
    },
    private val authSessionProvider: AuthSessionProvider,
    private val resolveAuthorizedSession: ResolveAuthorizedSessionUseCase,
    private val upsertMemberByAdmin: UpsertMemberByAdminUseCase,
    private val authorizedDeviceRegistrar: AuthorizedDeviceRegistrar = AuthorizedDeviceRegistrar { _, _, _ -> },
    private val pushNotificationPermissionProvider: PushNotificationPermissionProvider = PushNotificationPermissionProvider { true },
    private val resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase,
    private val criticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository,
    private val sessionEnvironmentRouter: SessionEnvironmentRouter = NoOpSessionEnvironmentRouter,
    private val bylawsKnowledgeSource: BylawsKnowledgeSource = InMemoryBylawsKnowledgeSource(),
    private val bylawsEvidenceRetriever: BylawsEvidenceRetriever = BylawsEvidenceRetriever(),
    private val bylawsOnDeviceAssistant: BylawsOnDeviceAssistant = PdfOnlyBylawsOnDeviceAssistant,
    private val sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
    private val nowMillisProvider: () -> Long = { System.currentTimeMillis() },
    private val runtimeEnvironmentProvider: () -> String? = { null },
    private val developImpersonationEnabled: Boolean = false,
    initialNowOverrideMillis: Long? = null,
) : ViewModel() {
    private val _uiState = MutableStateFlow(
        SessionUiState(nowOverrideMillis = initialNowOverrideMillis),
    )
    val uiState: StateFlow<SessionUiState> = _uiState.asStateFlow()

    private val _uiEvents = MutableSharedFlow<SessionUiEvent>(replay = 0)
    val uiEvents: SharedFlow<SessionUiEvent> = _uiEvents.asSharedFlow()

    private val isSessionRefreshInFlight = AtomicBoolean(false)
    private var lastSessionRefreshAtMillis: Long? = null

    private val formActions by lazy {
        SessionFormActions(
            uiState = _uiState,
            emitMessage = ::emitMessage,
        )
    }

    private val productActions by lazy {
        SessionProductActions(
            uiState = _uiState,
            scope = viewModelScope,
            memberRepository = repository,
            productRepository = productRepository,
            seasonalCommitmentRepository = seasonalCommitmentRepository,
            imagePipelineManager = imagePipelineManager,
            nowMillisProvider = nowMillisProvider,
            emitMessage = ::emitMessage,
        )
    }

    private val communityActions by lazy {
        SessionCommunityActions(
            uiState = _uiState,
            scope = viewModelScope,
            newsRepository = newsRepository,
            notificationRepository = notificationRepository,
            sharedProfileRepository = sharedProfileRepository,
            imagePipelineManager = imagePipelineManager,
            nowMillisProvider = nowMillisProvider,
            emitMessage = ::emitMessage,
            emitEvent = ::emitEvent,
            pushNotificationPermissionProvider = pushNotificationPermissionProvider,
            runtimeEnvironmentProvider = runtimeEnvironmentProvider,
        )
    }

    private val shiftActions by lazy {
        SessionShiftActions(
            uiState = _uiState,
            scope = viewModelScope,
            shiftRepository = shiftRepository,
            deliveryCalendarRepository = deliveryCalendarRepository,
            shiftPlanningRequestRepository = shiftPlanningRequestRepository,
            shiftSwapRequestRepository = shiftSwapRequestRepository,
            nowMillisProvider = nowMillisProvider,
            emitMessage = ::emitMessage,
        )
    }

    private val authActions by lazy {
        SessionAuthActions(
            uiState = _uiState,
            scope = viewModelScope,
            memberRepository = repository,
            productRepository = productRepository,
            sharedProfileRepository = sharedProfileRepository,
            authSessionProvider = authSessionProvider,
            resolveAuthorizedSession = resolveAuthorizedSession,
            authorizedDeviceRegistrar = authorizedDeviceRegistrar,
            resolveCriticalDataFreshness = resolveCriticalDataFreshness,
            criticalDataFreshnessLocalRepository = criticalDataFreshnessLocalRepository,
            sessionEnvironmentRouter = sessionEnvironmentRouter,
            sessionRefreshPolicy = sessionRefreshPolicy,
            isSessionRefreshInFlight = isSessionRefreshInFlight,
            getLastSessionRefreshAtMillis = { lastSessionRefreshAtMillis },
            setLastSessionRefreshAtMillis = { lastSessionRefreshAtMillis = it },
            nowMillisProvider = nowMillisProvider,
            refreshNews = { communityActions.refreshNews() },
            refreshNotifications = { communityActions.refreshNotifications() },
            refreshShifts = { shiftActions.refreshShifts() },
            refreshDeliveryCalendar = { shiftActions.refreshDeliveryCalendar() },
            refreshMyOrderConsumer = { payload, additionalFence ->
                productActions.refreshMyOrderProductsForFreshness(
                    prefetchedPayload = payload,
                    additionalFence = additionalFence,
                )
            },
        )
    }

    private val memberActions by lazy {
        SessionMemberActions(
            uiState = _uiState,
            scope = viewModelScope,
            memberRepository = repository,
            upsertMemberByAdmin = upsertMemberByAdmin,
            emitMessage = ::emitMessage,
        )
    }

    private val bylawsActions by lazy {
        SessionBylawsActions(
            uiState = _uiState,
            scope = viewModelScope,
            knowledgeSource = bylawsKnowledgeSource,
            evidenceRetriever = bylawsEvidenceRetriever,
            onDeviceAssistant = bylawsOnDeviceAssistant,
            emitMessage = ::emitMessage,
        )
    }

    val isDevelopImpersonationEnabled: Boolean
        get() = developImpersonationEnabled

    fun impersonateMember(memberId: String) {
        if (!developImpersonationEnabled) return
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        val target = mode.members.firstOrNull { it.id == memberId && it.isActive } ?: return
        _uiState.update {
            it.clearCommunitySessionState().copy(
                sessionEpoch = it.sessionEpoch + 1,
                mode = mode.copy(member = target),
                shiftsFeed = emptyList(),
                deliveryCalendarOverrides = emptyList(),
                defaultDeliveryDayOfWeek = null,
                shiftSwapRequests = emptyList(),
                dismissedShiftSwapRequestIds = emptySet(),
                acknowledgedShiftSwapRequestIds = emptySet(),
                acknowledgedShiftSwapCreates = emptyMap(),
                shiftSwapDraft = ShiftSwapDraft(),
                nextDeliveryShift = null,
                nextMarketShift = null,
                isLoadingShifts = false,
                isLoadingDeliveryCalendar = false,
                isSavingDeliveryCalendar = false,
                isSubmittingShiftPlanningRequest = false,
                isSavingShiftSwapRequest = false,
                isUpdatingShiftSwapRequest = false,
            )
        }
        refreshNews()
        refreshNotifications()
        refreshProducts()
        refreshMyOrderProducts()
        refreshSharedProfiles()
        refreshShifts()
        refreshDeliveryCalendar()
    }

    fun clearImpersonation() {
        if (!developImpersonationEnabled) return
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (mode.member.id == mode.authenticatedMember.id) return
        _uiState.update {
            it.clearCommunitySessionState().copy(
                sessionEpoch = it.sessionEpoch + 1,
                mode = mode.copy(member = mode.authenticatedMember),
                shiftsFeed = emptyList(),
                deliveryCalendarOverrides = emptyList(),
                defaultDeliveryDayOfWeek = null,
                shiftSwapRequests = emptyList(),
                dismissedShiftSwapRequestIds = emptySet(),
                acknowledgedShiftSwapRequestIds = emptySet(),
                acknowledgedShiftSwapCreates = emptyMap(),
                shiftSwapDraft = ShiftSwapDraft(),
                nextDeliveryShift = null,
                nextMarketShift = null,
                isLoadingShifts = false,
                isLoadingDeliveryCalendar = false,
                isSavingDeliveryCalendar = false,
                isSubmittingShiftPlanningRequest = false,
                isSavingShiftSwapRequest = false,
                isUpdatingShiftSwapRequest = false,
            )
        }
        refreshNews()
        refreshNotifications()
        refreshProducts()
        refreshMyOrderProducts()
        refreshSharedProfiles()
        refreshShifts()
        refreshDeliveryCalendar()
    }

    fun setNowOverrideMillis(nowMillis: Long?) {
        DevelopmentTimeMachine.setOverrideNowMillis(nowMillis)
        _uiState.update { it.copy(nowOverrideMillis = nowMillis) }
        refreshProducts()
        refreshMyOrderProducts()
        refreshShifts()
        refreshDeliveryCalendar()
    }

    fun shiftNowByDays(days: Int) {
        val baseMillis = _uiState.value.nowOverrideMillis ?: System.currentTimeMillis()
        val shiftedMillis = baseMillis + (days * 24L * 60L * 60L * 1_000L)
        setNowOverrideMillis(shiftedMillis)
    }

    fun dismissShiftSwapActivity(requestId: String) {
        _uiState.update {
            it.copy(dismissedShiftSwapRequestIds = it.dismissedShiftSwapRequestIds + requestId)
        }
    }

    fun onEmailChanged(value: String) = formActions.onEmailChanged(value)

    fun onPasswordEdited() = formActions.onPasswordEdited()

    fun onRegisterEmailChanged(value: String) = formActions.onRegisterEmailChanged(value)

    fun onRegisterPasswordEdited() = formActions.onRegisterPasswordEdited()

    fun onRegisterRepeatPasswordEdited() = formActions.onRegisterRepeatPasswordEdited()

    fun onRecoverEmailChanged(value: String) = formActions.onRecoverEmailChanged(value)

    fun clearLoginForm() = formActions.clearLoginForm()

    fun clearRegisterForm() = formActions.clearRegisterForm()

    fun clearRecoverForm() = formActions.clearRecoverForm()

    fun dismissRecoverSuccessDialog() = formActions.dismissRecoverSuccessDialog()

    fun dismissSessionExpiredDialog() = formActions.dismissSessionExpiredDialog()

    fun dismissUnauthorizedDialog() = formActions.dismissUnauthorizedDialog()

    fun onNewsDraftChanged(newDraft: NewsDraft) = formActions.onNewsDraftChanged(newDraft)

    fun onNotificationDraftChanged(newDraft: NotificationDraft) = formActions.onNotificationDraftChanged(newDraft)

    fun onProductDraftChanged(newDraft: ProductDraft) = formActions.onProductDraftChanged(newDraft)

    fun startCreatingNews() = formActions.startCreatingNews()

    fun startEditingNews(newsId: String) = formActions.startEditingNews(newsId)

    fun clearNewsEditor() = formActions.clearNewsEditor()

    fun clearNewsEditorIfCurrent(identity: EditorConfirmationIdentity): Boolean =
        formActions.clearNewsEditorIfCurrent(identity)

    fun startCreatingNotification() = formActions.startCreatingNotification()

    fun clearNotificationEditor() = formActions.clearNotificationEditor()

    fun clearNotificationEditorIfCurrent(identity: EditorConfirmationIdentity): Boolean =
        formActions.clearNotificationEditorIfCurrent(identity)

    fun requestNewsDeletion(newsId: String) = formActions.requestNewsDeletion(newsId)

    fun clearNewsDeletionRequest(requestRevision: Long) =
        formActions.clearNewsDeletionRequest(requestRevision)

    fun refreshProducts() = productActions.refreshProducts()

    fun refreshMyOrderProducts() = productActions.refreshMyOrderProducts()

    fun startCreatingProduct() = formActions.startCreatingProduct()

    fun startEditingProduct(productId: String) = formActions.startEditingProduct(productId)

    fun clearProductEditor() = formActions.clearProductEditor()

    fun uploadProductImageFromUri(sourceUri: Uri) = productActions.uploadProductImageFromUri(sourceUri)

    fun clearProductImage() = productActions.clearProductImage()

    fun saveProduct(onSuccess: (String) -> Unit = {}) = productActions.saveProduct(onSuccess)

    fun archiveProduct(
        productId: String,
        onSuccess: () -> Unit = {},
    ) = productActions.archiveProduct(productId, onSuccess)

    fun setOwnProducerCatalogVisibility(
        isEnabled: Boolean,
        onSuccess: () -> Unit = {},
    ) = productActions.setOwnProducerCatalogVisibility(isEnabled, onSuccess)

    fun onSharedProfileDraftChanged(draft: SharedProfileDraft) = formActions.onSharedProfileDraftChanged(draft)

    fun onShiftSwapDraftChanged(draft: ShiftSwapDraft) = formActions.onShiftSwapDraftChanged(draft)

    fun onBylawsQueryChanged(value: String) = bylawsActions.onBylawsQueryChanged(value)

    fun prepareBylawsRoute() = bylawsActions.prepareBylawsRoute()

    fun prepareBylawsModel() = bylawsActions.prepareBylawsModel()

    fun cancelBylawsConsultation() = bylawsActions.cancelBylawsConsultation()

    fun clearBylawsResult() = bylawsActions.clearBylawsResult()

    fun startCreatingShiftSwap(shiftId: String) = formActions.startCreatingShiftSwap(shiftId)

    fun clearShiftSwapDraft() = formActions.clearShiftSwapDraft()

    fun refreshSharedProfiles() = communityActions.refreshSharedProfiles()

    fun refreshShifts() = shiftActions.refreshShifts()

    fun refreshDeliveryCalendar() = shiftActions.refreshDeliveryCalendar()

    fun saveDeliveryCalendarOverride(
        weekKey: String,
        weekday: DeliveryWeekday,
        updatedByUserId: String,
        onSuccess: () -> Unit = {},
    ) = shiftActions.saveDeliveryCalendarOverride(weekKey, weekday, updatedByUserId, onSuccess)

    fun submitShiftPlanningRequest(
        type: ShiftPlanningRequestType,
        onSuccess: () -> Unit = {},
    ) = shiftActions.submitShiftPlanningRequest(type, onSuccess)

    fun saveSharedProfile(onSuccess: () -> Unit = {}) = communityActions.saveSharedProfile(onSuccess)

    fun deleteSharedProfile(onSuccess: () -> Unit = {}) = communityActions.deleteSharedProfile(onSuccess)

    fun uploadNewsImageFromUri(sourceUri: Uri) = communityActions.uploadNewsImageFromUri(sourceUri)

    fun clearNewsImage() = communityActions.clearNewsImage()

    fun uploadSharedProfileImageFromUri(sourceUri: Uri) =
        communityActions.uploadSharedProfileImageFromUri(sourceUri)

    fun clearSharedProfileImage() = communityActions.clearSharedProfileImage()

    fun refreshNews() = communityActions.refreshNews()

    fun refreshNotifications() = communityActions.refreshNotifications()

    fun prepareNotificationsRoute() = communityActions.prepareNotificationsRoute()

    fun markVisibleNotificationsReadOnExit() = communityActions.markVisibleNotificationsReadOnExit()

    fun dismissPushNotificationPermissionDialog() = communityActions.dismissPushNotificationPermissionDialog()

    fun openPushNotificationSettings() = communityActions.openPushNotificationSettings()

    fun saveNews(onSuccess: (NewsSaveResult) -> Unit = {}) = communityActions.saveNews(onSuccess)

    fun deleteNews(
        newsId: String,
        requestRevision: Long,
        onSuccess: () -> Unit = {},
    ) = communityActions.deleteNews(newsId, requestRevision, onSuccess)

    fun sendNotification(onSuccess: (NotificationSendResult) -> Unit = {}) =
        communityActions.sendNotification(onSuccess)

    fun saveShiftSwapRequest(onSuccess: () -> Unit = {}) = shiftActions.saveShiftSwapRequest(onSuccess)

    fun acceptShiftSwapRequest(requestId: String, candidateShiftId: String) =
        shiftActions.acceptShiftSwapRequest(requestId, candidateShiftId)

    fun rejectShiftSwapRequest(requestId: String, candidateShiftId: String) =
        shiftActions.rejectShiftSwapRequest(requestId, candidateShiftId)

    fun cancelShiftSwapRequest(requestId: String) = shiftActions.cancelShiftSwapRequest(requestId)

    fun confirmShiftSwapRequest(requestId: String, candidateShiftId: String) =
        shiftActions.confirmShiftSwapRequest(requestId, candidateShiftId)

    fun askBylawsQuestion() = bylawsActions.askBylawsQuestion()

    fun signIn(password: String): Boolean = authActions.signIn(password)

    fun signUp(password: String, repeatedPassword: String): Boolean =
        authActions.signUp(password, repeatedPassword)

    fun sendPasswordReset() = authActions.sendPasswordReset()

    fun signOut() = authActions.signOut()

    fun refreshSession(trigger: SessionRefreshTrigger) = authActions.refreshSession(trigger)

    fun refreshMyOrderFreshness(): Long? = authActions.refreshMyOrderFreshness()

    fun isMyOrderFreshnessReceiptCurrent(generation: Long?): Boolean {
        val state = _uiState.value
        val receipt = state.myOrderFreshnessConsumerReceipt ?: return false
        return generation != null &&
            state.myOrderFreshnessGeneration == generation &&
            state.myOrderFreshnessState == MyOrderFreshnessUiState.Ready &&
            state.matchesCriticalDataRefreshConsumerReceipt(receipt)
    }

    fun onMemberDraftChanged(newDraft: MemberDraft) = formActions.onMemberDraftChanged(newDraft)

    fun createAuthorizedMember() = memberActions.createAuthorizedMember()

    fun saveMemberDraft(
        editingMemberId: String?,
        onSuccess: (String) -> Unit = {},
    ) = memberActions.saveMemberDraft(editingMemberId, onSuccess)

    fun refreshMembers() = memberActions.refreshMembers()

    fun toggleAdmin(memberId: String) = memberActions.toggleAdmin(memberId)

    fun toggleActive(memberId: String) = memberActions.toggleActive(memberId)

    private fun emitMessage(@StringRes messageRes: Int) {
        emitEvent(SessionUiEvent.ShowMessage(messageRes))
    }

    private fun emitEvent(event: SessionUiEvent) {
        viewModelScope.launch {
            _uiEvents.emit(event)
        }
    }
}
