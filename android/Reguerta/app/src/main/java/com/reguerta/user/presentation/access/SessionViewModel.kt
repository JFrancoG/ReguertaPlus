package com.reguerta.user.presentation.access

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.reguerta.user.domain.access.AuthSessionProvider
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionRefreshPolicy
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.profiles.SharedProfileRepository
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
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
    private val sharedProfileRepository: SharedProfileRepository,
    private val shiftRepository: ShiftRepository,
    private val deliveryCalendarRepository: DeliveryCalendarRepository,
    private val shiftPlanningRequestRepository: ShiftPlanningRequestRepository = object : ShiftPlanningRequestRepository {
        override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest = request
    },
    private val shiftSwapRequestRepository: ShiftSwapRequestRepository = object : ShiftSwapRequestRepository {
        override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = emptyList()
        override suspend fun upsertShiftSwapRequest(request: ShiftSwapRequest): ShiftSwapRequest = request
    },
    private val authSessionProvider: AuthSessionProvider,
    private val resolveAuthorizedSession: ResolveAuthorizedSessionUseCase,
    private val upsertMemberByAdmin: UpsertMemberByAdminUseCase,
    private val authorizedDeviceRegistrar: AuthorizedDeviceRegistrar = AuthorizedDeviceRegistrar { },
    private val resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase,
    private val criticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository,
    private val sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
    private val nowMillisProvider: () -> Long = { System.currentTimeMillis() },
    private val developImpersonationEnabled: Boolean = false,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SessionUiState())
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
            nowMillisProvider = nowMillisProvider,
            emitMessage = ::emitMessage,
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
            notificationRepository = notificationRepository,
            nowMillisProvider = nowMillisProvider,
            emitMessage = ::emitMessage,
        )
    }

    private val authActions by lazy {
        SessionAuthActions(
            uiState = _uiState,
            scope = viewModelScope,
            memberRepository = repository,
            newsRepository = newsRepository,
            notificationRepository = notificationRepository,
            productRepository = productRepository,
            sharedProfileRepository = sharedProfileRepository,
            shiftRepository = shiftRepository,
            authSessionProvider = authSessionProvider,
            resolveAuthorizedSession = resolveAuthorizedSession,
            authorizedDeviceRegistrar = authorizedDeviceRegistrar,
            resolveCriticalDataFreshness = resolveCriticalDataFreshness,
            criticalDataFreshnessLocalRepository = criticalDataFreshnessLocalRepository,
            sessionRefreshPolicy = sessionRefreshPolicy,
            isSessionRefreshInFlight = isSessionRefreshInFlight,
            getLastSessionRefreshAtMillis = { lastSessionRefreshAtMillis },
            setLastSessionRefreshAtMillis = { lastSessionRefreshAtMillis = it },
            nowMillisProvider = nowMillisProvider,
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

    val isDevelopImpersonationEnabled: Boolean
        get() = developImpersonationEnabled

    fun impersonateMember(memberId: String) {
        if (!developImpersonationEnabled) return
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        val target = mode.members.firstOrNull { it.id == memberId && it.isActive } ?: return
        _uiState.update {
            it.copy(
                mode = mode.copy(member = target),
                dismissedShiftSwapRequestIds = emptySet(),
                shiftSwapDraft = ShiftSwapDraft(),
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
            it.copy(
                mode = mode.copy(member = mode.authenticatedMember),
                dismissedShiftSwapRequestIds = emptySet(),
                shiftSwapDraft = ShiftSwapDraft(),
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

    fun dismissShiftSwapActivity(requestId: String) {
        _uiState.update {
            it.copy(dismissedShiftSwapRequestIds = it.dismissedShiftSwapRequestIds + requestId)
        }
    }

    fun onEmailChanged(value: String) = formActions.onEmailChanged(value)

    fun onPasswordChanged(value: String) = formActions.onPasswordChanged(value)

    fun onRegisterEmailChanged(value: String) = formActions.onRegisterEmailChanged(value)

    fun onRegisterPasswordChanged(value: String) = formActions.onRegisterPasswordChanged(value)

    fun onRegisterRepeatPasswordChanged(value: String) = formActions.onRegisterRepeatPasswordChanged(value)

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

    fun startCreatingNotification() = formActions.startCreatingNotification()

    fun clearNotificationEditor() = formActions.clearNotificationEditor()

    fun refreshProducts() = productActions.refreshProducts()

    fun refreshMyOrderProducts() = productActions.refreshMyOrderProducts()

    fun startCreatingProduct() = formActions.startCreatingProduct()

    fun startEditingProduct(productId: String) = formActions.startEditingProduct(productId)

    fun clearProductEditor() = formActions.clearProductEditor()

    fun saveProduct(onSuccess: () -> Unit = {}) = productActions.saveProduct(onSuccess)

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

    fun deleteDeliveryCalendarOverride(
        weekKey: String,
        onSuccess: () -> Unit = {},
    ) = shiftActions.deleteDeliveryCalendarOverride(weekKey, onSuccess)

    fun submitShiftPlanningRequest(
        type: ShiftPlanningRequestType,
        onSuccess: () -> Unit = {},
    ) = shiftActions.submitShiftPlanningRequest(type, onSuccess)

    fun saveSharedProfile(onSuccess: () -> Unit = {}) = communityActions.saveSharedProfile(onSuccess)

    fun deleteSharedProfile(onSuccess: () -> Unit = {}) = communityActions.deleteSharedProfile(onSuccess)

    fun refreshNews() = communityActions.refreshNews()

    fun refreshNotifications() = communityActions.refreshNotifications()

    fun saveNews(onSuccess: () -> Unit = {}) = communityActions.saveNews(onSuccess)

    fun deleteNews(
        newsId: String,
        onSuccess: () -> Unit = {},
    ) = communityActions.deleteNews(newsId, onSuccess)

    fun sendNotification(onSuccess: () -> Unit = {}) = communityActions.sendNotification(onSuccess)

    fun saveShiftSwapRequest(onSuccess: () -> Unit = {}) = shiftActions.saveShiftSwapRequest(onSuccess)

    fun acceptShiftSwapRequest(requestId: String, candidateShiftId: String) =
        shiftActions.acceptShiftSwapRequest(requestId, candidateShiftId)

    fun rejectShiftSwapRequest(requestId: String, candidateShiftId: String) =
        shiftActions.rejectShiftSwapRequest(requestId, candidateShiftId)

    fun cancelShiftSwapRequest(requestId: String) = shiftActions.cancelShiftSwapRequest(requestId)

    fun confirmShiftSwapRequest(requestId: String, candidateShiftId: String) =
        shiftActions.confirmShiftSwapRequest(requestId, candidateShiftId)

    fun signIn() = authActions.signIn()

    fun signUp() = authActions.signUp()

    fun sendPasswordReset() = authActions.sendPasswordReset()

    fun signOut() = authActions.signOut()

    fun refreshSession(trigger: SessionRefreshTrigger) = authActions.refreshSession(trigger)

    fun refreshMyOrderFreshness() = authActions.refreshMyOrderFreshness()

    fun onMemberDraftChanged(newDraft: MemberDraft) = formActions.onMemberDraftChanged(newDraft)

    fun createAuthorizedMember() = memberActions.createAuthorizedMember()

    fun toggleAdmin(memberId: String) = memberActions.toggleAdmin(memberId)

    fun toggleActive(memberId: String) = memberActions.toggleActive(memberId)

    private fun emitMessage(@StringRes messageRes: Int) {
        viewModelScope.launch {
            _uiEvents.emit(SessionUiEvent.ShowMessage(messageRes))
        }
    }
}
