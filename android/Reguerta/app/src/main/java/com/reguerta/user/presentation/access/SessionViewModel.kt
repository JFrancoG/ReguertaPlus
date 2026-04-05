package com.reguerta.user.presentation.access

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.reguerta.user.R
import com.reguerta.user.domain.access.AccessResolutionResult
import com.reguerta.user.domain.access.AuthPasswordResetResult
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.AuthSessionRefreshResult
import com.reguerta.user.domain.access.AuthSessionProvider
import com.reguerta.user.domain.access.AuthSignInResult
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberManagementException
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionRefreshPolicy
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.CriticalDataFreshnessResolution
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
import com.reguerta.user.domain.shifts.ShiftSwapResponse
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftType
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.atomic.AtomicBoolean
import java.util.Locale

data class MemberDraft(
    val displayName: String = "",
    val email: String = "",
    val isMember: Boolean = true,
    val isProducer: Boolean = false,
    val isAdmin: Boolean = false,
    val isActive: Boolean = true,
)

data class NewsDraft(
    val title: String = "",
    val body: String = "",
    val urlImage: String = "",
    val active: Boolean = true,
)

data class NotificationDraft(
    val title: String = "",
    val body: String = "",
    val audience: NotificationAudience = NotificationAudience.ALL,
)

data class SharedProfileDraft(
    val familyNames: String = "",
    val photoUrl: String = "",
    val about: String = "",
)

data class ShiftSwapDraft(
    val shiftId: String = "",
    val reason: String = "",
)

sealed interface SessionMode {
    data object SignedOut : SessionMode

    data class Authorized(
        val principal: AuthPrincipal,
        val authenticatedMember: Member,
        val member: Member,
        val members: List<Member>,
    ) : SessionMode

    data class Unauthorized(
        val email: String,
        val reason: UnauthorizedReason,
    ) : SessionMode
}

data class SessionUiState(
    val emailInput: String = "",
    val passwordInput: String = "",
    @param:StringRes val emailErrorRes: Int? = null,
    @param:StringRes val passwordErrorRes: Int? = null,
    val isAuthenticating: Boolean = false,
    val registerEmailInput: String = "",
    val registerPasswordInput: String = "",
    val registerRepeatPasswordInput: String = "",
    @param:StringRes val registerEmailErrorRes: Int? = null,
    @param:StringRes val registerPasswordErrorRes: Int? = null,
    @param:StringRes val registerRepeatPasswordErrorRes: Int? = null,
    val isRegistering: Boolean = false,
    val recoverEmailInput: String = "",
    @param:StringRes val recoverEmailErrorRes: Int? = null,
    val isRecoveringPassword: Boolean = false,
    val showRecoverSuccessDialog: Boolean = false,
    val showSessionExpiredDialog: Boolean = false,
    val showUnauthorizedDialog: Boolean = false,
    val mode: SessionMode = SessionMode.SignedOut,
    val memberDraft: MemberDraft = MemberDraft(),
    val myOrderFreshnessState: MyOrderFreshnessUiState = MyOrderFreshnessUiState.Idle,
    val latestNews: List<NewsArticle> = emptyList(),
    val newsFeed: List<NewsArticle> = emptyList(),
    val newsDraft: NewsDraft = NewsDraft(),
    val notificationsFeed: List<NotificationEvent> = emptyList(),
    val notificationDraft: NotificationDraft = NotificationDraft(),
    val sharedProfiles: List<SharedProfile> = emptyList(),
    val sharedProfileDraft: SharedProfileDraft = SharedProfileDraft(),
    val shiftsFeed: List<ShiftAssignment> = emptyList(),
    val shiftSwapRequests: List<ShiftSwapRequest> = emptyList(),
    val shiftSwapDraft: ShiftSwapDraft = ShiftSwapDraft(),
    val nextDeliveryShift: ShiftAssignment? = null,
    val nextMarketShift: ShiftAssignment? = null,
    val editingNewsId: String? = null,
    val isLoadingNews: Boolean = false,
    val isSavingNews: Boolean = false,
    val isLoadingNotifications: Boolean = false,
    val isSendingNotification: Boolean = false,
    val isLoadingSharedProfiles: Boolean = false,
    val isSavingSharedProfile: Boolean = false,
    val isDeletingSharedProfile: Boolean = false,
    val isLoadingShifts: Boolean = false,
    val isSavingShiftSwapRequest: Boolean = false,
    val isUpdatingShiftSwapRequest: Boolean = false,
)

sealed interface SessionUiEvent {
    data class ShowMessage(@param:StringRes val messageRes: Int) : SessionUiEvent
}

sealed interface MyOrderFreshnessUiState {
    data object Idle : MyOrderFreshnessUiState

    data object Checking : MyOrderFreshnessUiState

    data object Ready : MyOrderFreshnessUiState

    data object TimedOut : MyOrderFreshnessUiState

    data object Unavailable : MyOrderFreshnessUiState
}

class SessionViewModel(
    private val repository: MemberRepository,
    private val newsRepository: NewsRepository,
    private val notificationRepository: NotificationRepository,
    private val sharedProfileRepository: SharedProfileRepository,
    private val shiftRepository: ShiftRepository,
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

    val isDevelopImpersonationEnabled: Boolean
        get() = developImpersonationEnabled

    fun impersonateMember(memberId: String) {
        if (!developImpersonationEnabled) return
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        val target = mode.members.firstOrNull { it.id == memberId && it.isActive } ?: return
        _uiState.update {
            it.copy(
                mode = mode.copy(member = target),
                shiftSwapDraft = ShiftSwapDraft(),
            )
        }
        refreshNews()
        refreshNotifications()
        refreshSharedProfiles()
        refreshShifts()
    }

    fun clearImpersonation() {
        if (!developImpersonationEnabled) return
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (mode.member.id == mode.authenticatedMember.id) return
        _uiState.update {
            it.copy(
                mode = mode.copy(member = mode.authenticatedMember),
                shiftSwapDraft = ShiftSwapDraft(),
            )
        }
        refreshNews()
        refreshNotifications()
        refreshSharedProfiles()
        refreshShifts()
    }

    fun onEmailChanged(value: String) {
        _uiState.update {
            it.copy(
                emailInput = value,
                emailErrorRes = null,
                passwordErrorRes = null,
            )
        }
    }

    fun onPasswordChanged(value: String) {
        _uiState.update {
            it.copy(
                passwordInput = value,
                emailErrorRes = null,
                passwordErrorRes = null,
            )
        }
    }

    fun onRegisterEmailChanged(value: String) {
        _uiState.update {
            it.copy(
                registerEmailInput = value,
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
            )
        }
    }

    fun onRegisterPasswordChanged(value: String) {
        _uiState.update {
            it.copy(
                registerPasswordInput = value,
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
            )
        }
    }

    fun onRegisterRepeatPasswordChanged(value: String) {
        _uiState.update {
            it.copy(
                registerRepeatPasswordInput = value,
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
            )
        }
    }

    fun onRecoverEmailChanged(value: String) {
        _uiState.update { it.copy(recoverEmailInput = value, recoverEmailErrorRes = null) }
    }

    fun clearLoginForm() {
        _uiState.update {
            it.copy(
                emailInput = "",
                passwordInput = "",
                emailErrorRes = null,
                passwordErrorRes = null,
                isAuthenticating = false,
            )
        }
    }

    fun clearRegisterForm() {
        _uiState.update {
            it.copy(
                registerEmailInput = "",
                registerPasswordInput = "",
                registerRepeatPasswordInput = "",
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
                isRegistering = false,
            )
        }
    }

    fun clearRecoverForm() {
        _uiState.update {
            it.copy(
                recoverEmailInput = "",
                recoverEmailErrorRes = null,
                isRecoveringPassword = false,
                showRecoverSuccessDialog = false,
            )
        }
    }

    fun dismissRecoverSuccessDialog() {
        _uiState.update { it.copy(showRecoverSuccessDialog = false) }
    }

    fun dismissSessionExpiredDialog() {
        _uiState.update { it.copy(showSessionExpiredDialog = false) }
    }

    fun dismissUnauthorizedDialog() {
        _uiState.update { it.copy(showUnauthorizedDialog = false) }
    }

    fun onNewsDraftChanged(newDraft: NewsDraft) {
        _uiState.update { it.copy(newsDraft = newDraft) }
    }

    fun onNotificationDraftChanged(newDraft: NotificationDraft) {
        _uiState.update { it.copy(notificationDraft = newDraft) }
    }

    fun startCreatingNews() {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_publish_news)
            return
        }

        _uiState.update {
            it.copy(
                newsDraft = NewsDraft(active = true),
                editingNewsId = null,
            )
        }
    }

    fun startEditingNews(newsId: String) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_edit_news)
            return
        }
        val article = _uiState.value.newsFeed.firstOrNull { it.id == newsId } ?: return
        _uiState.update {
            it.copy(
                newsDraft = NewsDraft(
                    title = article.title,
                    body = article.body,
                    urlImage = article.urlImage.orEmpty(),
                    active = article.active,
                ),
                editingNewsId = article.id,
            )
        }
    }

    fun clearNewsEditor() {
        _uiState.update {
            it.copy(
                newsDraft = NewsDraft(),
                editingNewsId = null,
                isSavingNews = false,
            )
        }
    }

    fun startCreatingNotification() {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_send_notification)
            return
        }

        _uiState.update {
            it.copy(
                notificationDraft = NotificationDraft(),
                isSendingNotification = false,
            )
        }
    }

    fun clearNotificationEditor() {
        _uiState.update {
            it.copy(
                notificationDraft = NotificationDraft(),
                isSendingNotification = false,
            )
        }
    }

    fun onSharedProfileDraftChanged(draft: SharedProfileDraft) {
        _uiState.update { it.copy(sharedProfileDraft = draft) }
    }

    fun onShiftSwapDraftChanged(draft: ShiftSwapDraft) {
        _uiState.update { it.copy(shiftSwapDraft = draft) }
    }

    fun startCreatingShiftSwap(shiftId: String) {
        _uiState.update {
            it.copy(
                shiftSwapDraft = ShiftSwapDraft(
                    shiftId = shiftId,
                ),
            )
        }
    }

    fun clearShiftSwapDraft() {
        _uiState.update {
            it.copy(
                shiftSwapDraft = ShiftSwapDraft(),
                isSavingShiftSwapRequest = false,
            )
        }
    }

    fun refreshSharedProfiles() {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingSharedProfiles = true) }
            val profiles = sharedProfileRepository.getAllSharedProfiles()
            val ownProfile = profiles.firstOrNull { it.userId == mode.member.id }
            _uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        sharedProfiles = profiles.filter { profile -> profile.hasVisibleContent },
                        sharedProfileDraft = ownProfile?.toDraft() ?: SharedProfileDraft(),
                        isLoadingSharedProfiles = false,
                    )
                }
            }
        }
    }

    fun refreshShifts() {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingShifts = true) }
            val shifts = shiftRepository.getAllShifts()
            val requests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            _uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        shiftsFeed = shifts,
                        shiftSwapRequests = requests.visibleTo(mode.member.id),
                        nextDeliveryShift = shifts.nextAssignedShift(
                            memberId = mode.member.id,
                            type = ShiftType.DELIVERY,
                            nowMillis = nowMillisProvider(),
                        ),
                        nextMarketShift = shifts.nextAssignedShift(
                            memberId = mode.member.id,
                            type = ShiftType.MARKET,
                            nowMillis = nowMillisProvider(),
                        ),
                        isLoadingShifts = false,
                    )
                }
            }
        }
    }

    fun saveSharedProfile(onSuccess: () -> Unit = {}) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        val draft = _uiState.value.sharedProfileDraft.normalized()
        if (!draft.hasVisibleContent) {
            emitMessage(R.string.feedback_shared_profile_content_required)
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSavingSharedProfile = true) }
            val saved = sharedProfileRepository.upsertSharedProfile(
                SharedProfile(
                    userId = mode.member.id,
                    familyNames = draft.familyNames,
                    photoUrl = draft.photoUrl.ifBlank { null },
                    about = draft.about,
                    updatedAtMillis = nowMillisProvider(),
                ),
            )
            val profiles = sharedProfileRepository.getAllSharedProfiles()
            _uiState.update {
                it.copy(
                    sharedProfiles = profiles.filter { profile -> profile.hasVisibleContent },
                    sharedProfileDraft = saved.toDraft(),
                    isSavingSharedProfile = false,
                )
            }
            emitMessage(R.string.feedback_shared_profile_saved)
            onSuccess()
        }
    }

    fun deleteSharedProfile(onSuccess: () -> Unit = {}) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isDeletingSharedProfile = true) }
            val deleted = sharedProfileRepository.deleteSharedProfile(mode.member.id)
            val profiles = sharedProfileRepository.getAllSharedProfiles()
            _uiState.update {
                it.copy(
                    sharedProfiles = profiles.filter { profile -> profile.hasVisibleContent },
                    sharedProfileDraft = SharedProfileDraft(),
                    isDeletingSharedProfile = false,
                )
            }
            emitMessage(
                if (deleted) {
                    R.string.feedback_shared_profile_deleted
                } else {
                    R.string.feedback_shared_profile_delete_failed
                },
            )
            onSuccess()
        }
    }

    fun refreshNews() {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingNews = true) }
            val allNews = newsRepository.getAllNews()
            val visibleNews = if (mode.member.isAdmin) {
                allNews
            } else {
                allNews.filter { article -> article.active }
            }
            val latestActiveNews = allNews.filter { it.active }.take(3)
            _uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        latestNews = latestActiveNews,
                        newsFeed = visibleNews,
                        isLoadingNews = false,
                    )
                }
            }
        }
    }

    fun refreshNotifications() {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingNotifications = true) }
            val allNotifications = notificationRepository.getAllNotifications()
            val visibleNotifications = allNotifications.filter { event -> event.isVisibleTo(mode.member) }
            _uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        notificationsFeed = visibleNotifications,
                        isLoadingNotifications = false,
                    )
                }
            }
        }
    }

    fun saveNews(onSuccess: () -> Unit = {}) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_publish_news)
            return
        }

        val draft = _uiState.value.newsDraft
        if (draft.title.trim().isBlank() || draft.body.trim().isBlank()) {
            emitMessage(R.string.feedback_news_title_body_required)
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSavingNews = true) }
            val nowMillis = nowMillisProvider()
            val existing = _uiState.value.newsFeed.firstOrNull { it.id == _uiState.value.editingNewsId }
            val saved = newsRepository.upsertNews(
                NewsArticle(
                    id = _uiState.value.editingNewsId.orEmpty(),
                    title = draft.title.trim(),
                    body = draft.body.trim(),
                    active = draft.active,
                    publishedBy = existing?.publishedBy ?: mode.member.displayName,
                    publishedAtMillis = existing?.publishedAtMillis ?: nowMillis,
                    urlImage = draft.urlImage.trim().ifBlank { null },
                ),
            )
            val allNews = newsRepository.getAllNews()
            val visibleNews = allNews
            val latestActiveNews = allNews.filter { it.active }.take(3)
            _uiState.update {
                it.copy(
                    latestNews = latestActiveNews,
                    newsFeed = visibleNews,
                    newsDraft = NewsDraft(
                        title = saved.title,
                        body = saved.body,
                        urlImage = saved.urlImage.orEmpty(),
                        active = saved.active,
                    ),
                    editingNewsId = saved.id,
                    isSavingNews = false,
                )
            }
            emitMessage(
                if (existing == null) {
                    R.string.feedback_news_created
                } else {
                    R.string.feedback_news_updated
                },
            )
            onSuccess()
        }
    }

    fun deleteNews(
        newsId: String,
        onSuccess: () -> Unit = {},
    ) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_delete_news)
            return
        }

        viewModelScope.launch {
            val deleted = newsRepository.deleteNews(newsId)
            if (!deleted) {
                emitMessage(R.string.feedback_news_delete_failed)
                return@launch
            }
            val allNews = newsRepository.getAllNews()
            _uiState.update {
                it.copy(
                    latestNews = allNews.filter { article -> article.active }.take(3),
                    newsFeed = allNews,
                    newsDraft = if (it.editingNewsId == newsId) NewsDraft() else it.newsDraft,
                    editingNewsId = if (it.editingNewsId == newsId) null else it.editingNewsId,
                )
            }
            emitMessage(R.string.feedback_news_deleted)
            onSuccess()
        }
    }

    fun sendNotification(onSuccess: () -> Unit = {}) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_send_notification)
            return
        }

        val draft = _uiState.value.notificationDraft
        if (draft.title.trim().isBlank() || draft.body.trim().isBlank()) {
            emitMessage(R.string.feedback_notification_title_body_required)
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSendingNotification = true) }
            notificationRepository.sendNotification(
                NotificationEvent(
                    id = "",
                    title = draft.title.trim(),
                    body = draft.body.trim(),
                    type = "admin_broadcast",
                    target = draft.audience.toTarget(),
                    userIds = emptyList(),
                    segmentType = draft.audience.toSegmentType(),
                    targetRole = draft.audience.toTargetRole(),
                    createdBy = mode.member.id,
                    sentAtMillis = nowMillisProvider(),
                    weekKey = null,
                ),
            )
            val allNotifications = notificationRepository.getAllNotifications()
            _uiState.update {
                it.copy(
                    notificationsFeed = allNotifications.filter { event -> event.isVisibleTo(mode.member) },
                    notificationDraft = NotificationDraft(),
                    isSendingNotification = false,
                )
            }
            emitMessage(R.string.feedback_notification_sent)
            onSuccess()
        }
    }

    fun saveShiftSwapRequest(onSuccess: () -> Unit = {}) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        val draft = _uiState.value.shiftSwapDraft
        if (draft.shiftId.isBlank()) {
            return
        }
        val shift = _uiState.value.shiftsFeed.firstOrNull { it.id == draft.shiftId } ?: return
        val candidates = shift.swapCandidates(
            allShifts = _uiState.value.shiftsFeed,
            requesterUserId = mode.member.id,
            nowMillis = nowMillisProvider(),
        )
        if (candidates.isEmpty()) {
            emitMessage(R.string.feedback_shift_swap_no_candidates)
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSavingShiftSwapRequest = true) }
            val persisted = shiftSwapRequestRepository.upsertShiftSwapRequest(
                ShiftSwapRequest(
                    id = "",
                    requestedShiftId = shift.id,
                    requesterUserId = mode.member.id,
                    reason = draft.reason.trim(),
                    status = ShiftSwapRequestStatus.OPEN,
                    candidates = candidates,
                    responses = emptyList(),
                    selectedCandidateUserId = null,
                    selectedCandidateShiftId = null,
                    requestedAtMillis = nowMillisProvider(),
                    confirmedAtMillis = null,
                    appliedAtMillis = null,
                ),
            )
            sendShiftSwapNotification(
                title = "Solicitud de cambio de turno",
                body = "${mode.member.displayName} solicita cambio para el turno del ${shift.dateMillis.toShiftNotificationDateTime()}",
                type = "shift_swap_requested",
                targetUserIds = persisted.candidates.map { it.userId }.distinct(),
                createdBy = mode.member.id,
            )
            val allRequests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            _uiState.update {
                it.copy(
                    shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                    shiftSwapDraft = ShiftSwapDraft(),
                    isSavingShiftSwapRequest = false,
                )
            }
            onSuccess()
        }
    }

    fun acceptShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(
            requestId = requestId,
            candidateShiftId = candidateShiftId,
            responseStatus = com.reguerta.user.domain.shifts.ShiftSwapResponseStatus.AVAILABLE,
        )
    }

    fun rejectShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(
            requestId = requestId,
            candidateShiftId = candidateShiftId,
            responseStatus = com.reguerta.user.domain.shifts.ShiftSwapResponseStatus.UNAVAILABLE,
        )
    }

    fun cancelShiftSwapRequest(requestId: String) {
        updateShiftSwapRequest(requestId) { request, _, _ ->
            request.copy(
                status = ShiftSwapRequestStatus.CANCELLED,
            )
        }
    }

    fun confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        val request = _uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return
        val requestedShift = _uiState.value.shiftsFeed.firstOrNull { it.id == request.requestedShiftId } ?: return
        val candidate = request.candidates.firstOrNull { it.shiftId == candidateShiftId } ?: return
        val candidateShift = _uiState.value.shiftsFeed.firstOrNull { it.id == candidate.shiftId } ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isUpdatingShiftSwapRequest = true) }
            val now = nowMillisProvider()
            val updatedRequest = request.copy(
                status = ShiftSwapRequestStatus.APPLIED,
                selectedCandidateUserId = candidate.userId,
                selectedCandidateShiftId = candidate.shiftId,
                confirmedAtMillis = now,
                appliedAtMillis = now,
            )
            val (updatedRequestedShift, updatedCandidateShift) = requestedShift.swapMemberWith(
                other = candidateShift,
                requesterUserId = request.requesterUserId,
                responderUserId = candidate.userId,
                nowMillis = now,
            )
            shiftSwapRequestRepository.upsertShiftSwapRequest(updatedRequest)
            val existingShifts = shiftRepository.getAllShifts()
            val shiftsToPersist = existingShifts.applyConfirmedSwap(
                updatedRequestedShift = updatedRequestedShift,
                updatedCandidateShift = updatedCandidateShift,
                nowMillis = now,
            )
            shiftsToPersist.forEach { shiftRepository.upsertShift(it) }
            sendShiftSwapNotification(
                title = "Cambio de turno aplicado",
                body = "Se ha confirmado el cambio entre ${mode.member.displayName} y ${mode.members.displayNameFor(candidate.userId)} para ${requestedShift.dateMillis.toShiftNotificationDateTime()} y ${candidateShift.dateMillis.toShiftNotificationDateTime()}.",
                type = "shift_swap_applied",
                targetUserIds = mode.members.filter { it.isActive }.map { it.id }.distinct(),
                createdBy = mode.member.id,
            )
            val allRequests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            val allShifts = shiftRepository.getAllShifts()
            _uiState.update {
                it.copy(
                    shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                    shiftsFeed = allShifts,
                    nextDeliveryShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.DELIVERY, nowMillisProvider()),
                    nextMarketShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.MARKET, nowMillisProvider()),
                    isUpdatingShiftSwapRequest = false,
                )
            }
        }
    }

    private fun updateShiftSwapRequest(
        requestId: String,
        transform: (ShiftSwapRequest, SessionMode.Authorized, Long) -> ShiftSwapRequest,
    ) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        val request = _uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isUpdatingShiftSwapRequest = true) }
            val now = nowMillisProvider()
            val updatedRequest = transform(request, mode, now)
            shiftSwapRequestRepository.upsertShiftSwapRequest(updatedRequest)
            val allRequests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            val allShifts = shiftRepository.getAllShifts()
            _uiState.update {
                it.copy(
                    shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                    shiftsFeed = allShifts,
                    nextDeliveryShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.DELIVERY, nowMillisProvider()),
                    nextMarketShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.MARKET, nowMillisProvider()),
                    isUpdatingShiftSwapRequest = false,
                )
            }
        }
    }

    private fun respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        responseStatus: com.reguerta.user.domain.shifts.ShiftSwapResponseStatus,
    ) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        val request = _uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return
        val candidate = request.candidates.firstOrNull { it.userId == mode.member.id && it.shiftId == candidateShiftId } ?: return
        val requestedShift = _uiState.value.shiftsFeed.firstOrNull { it.id == request.requestedShiftId } ?: return
        val candidateShift = _uiState.value.shiftsFeed.firstOrNull { it.id == candidate.shiftId }

        viewModelScope.launch {
            _uiState.update { it.copy(isUpdatingShiftSwapRequest = true) }
            val now = nowMillisProvider()
            val updatedResponses = request.responses
                .filterNot { it.userId == candidate.userId && it.shiftId == candidate.shiftId }
                .plus(
                    ShiftSwapResponse(
                        userId = candidate.userId,
                        shiftId = candidate.shiftId,
                        status = responseStatus,
                        respondedAtMillis = now,
                    ),
                )
                .sortedByDescending { it.respondedAtMillis }
            val updatedRequest = request.copy(responses = updatedResponses)
            shiftSwapRequestRepository.upsertShiftSwapRequest(updatedRequest)
            sendShiftSwapNotification(
                title = if (responseStatus == com.reguerta.user.domain.shifts.ShiftSwapResponseStatus.AVAILABLE) {
                    "Socio disponible para cambio"
                } else {
                    "Socio no disponible para cambio"
                },
                body = buildString {
                    append(mode.member.displayName)
                    append(
                        if (responseStatus == com.reguerta.user.domain.shifts.ShiftSwapResponseStatus.AVAILABLE) {
                            " puede cubrir "
                        } else {
                            " no puede cubrir "
                        },
                    )
                    append(requestedShift.dateMillis.toShiftNotificationDateTime())
                    candidateShift?.let {
                        append(" desde su turno del ")
                        append(it.dateMillis.toShiftNotificationDateTime())
                    }
                },
                type = if (responseStatus == com.reguerta.user.domain.shifts.ShiftSwapResponseStatus.AVAILABLE) {
                    "shift_swap_available"
                } else {
                    "shift_swap_unavailable"
                },
                targetUserIds = listOf(request.requesterUserId),
                createdBy = mode.member.id,
            )
            val allRequests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            _uiState.update {
                it.copy(
                    shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                    isUpdatingShiftSwapRequest = false,
                )
            }
        }
    }

    private suspend fun sendShiftSwapNotification(
        title: String,
        body: String,
        type: String,
        targetUserIds: List<String>,
        createdBy: String,
    ) {
        notificationRepository.sendNotification(
            NotificationEvent(
                id = "",
                title = title,
                body = body,
                type = type,
                target = "users",
                userIds = targetUserIds,
                segmentType = null,
                targetRole = null,
                createdBy = createdBy,
                sentAtMillis = nowMillisProvider(),
                weekKey = null,
            ),
        )
    }

    fun signIn() {
        val currentState = _uiState.value
        val email = currentState.emailInput.trim()
        val password = currentState.passwordInput

        val emailErrorRes = when {
            email.isBlank() -> R.string.feedback_email_required
            !email.matches(EmailPatternRegex) -> R.string.feedback_email_invalid
            else -> null
        }
        val passwordErrorRes = when {
            password.isBlank() -> R.string.feedback_password_required
            !password.isValidPassword() -> R.string.feedback_password_invalid_length
            else -> null
        }

        if (emailErrorRes != null || passwordErrorRes != null) {
            _uiState.update {
                it.copy(
                    emailErrorRes = emailErrorRes,
                    passwordErrorRes = passwordErrorRes,
                )
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isAuthenticating = true, emailErrorRes = null, passwordErrorRes = null) }

            when (val authResult = authSessionProvider.signIn(email = email, password = password)) {
                is AuthSignInResult.Success -> {
                    when (val result = resolveAuthorizedSession(authResult.principal)) {
                        is AccessResolutionResult.Authorized -> {
                            val members = repository.getAllMembers()
                            val allNotifications = notificationRepository.getAllNotifications()
                            _uiState.update {
                                it.copy(
                                    isAuthenticating = false,
                                    mode = SessionMode.Authorized(
                                        principal = authResult.principal,
                                        authenticatedMember = result.member,
                                        member = result.member,
                                        members = members,
                                    ),
                                    myOrderFreshnessState = MyOrderFreshnessUiState.Checking,
                                    notificationsFeed = allNotifications.filter { event -> event.isVisibleTo(result.member) },
                                )
                            }
                            registerAuthorizedDevice(result.member)
                            refreshMyOrderFreshness()
                        }

                        is AccessResolutionResult.Unauthorized -> {
                            val showUnauthorizedDialog = shouldShowUnauthorizedDialog(
                                email = authResult.principal.email,
                                reason = result.reason,
                            )
                            _uiState.update {
                                it.copy(
                                    isAuthenticating = false,
                                    mode = SessionMode.Unauthorized(
                                        email = authResult.principal.email,
                                        reason = result.reason,
                                    ),
                                    showUnauthorizedDialog = showUnauthorizedDialog,
                                    myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
                                    notificationsFeed = emptyList(),
                                    notificationDraft = NotificationDraft(),
                                    isLoadingNotifications = false,
                                    isSendingNotification = false,
                                )
                            }
                        }
                    }
                }

                is AuthSignInResult.Failure -> {
                    val mappedError = mapAuthFailure(
                        reason = authResult.reason,
                        flow = AuthErrorFlow.SIGN_IN,
                    )
                    val fallbackEmailErrorRes = when {
                        mappedError.emailErrorRes != null -> null
                        mappedError.passwordErrorRes != null -> null
                        mappedError.globalMessageRes != null -> mappedError.globalMessageRes
                        else -> R.string.auth_error_unknown
                    }
                    _uiState.update {
                        it.copy(
                            isAuthenticating = false,
                            emailErrorRes = mappedError.emailErrorRes ?: fallbackEmailErrorRes,
                            passwordErrorRes = mappedError.passwordErrorRes,
                        )
                    }
                }
            }
        }
    }

    fun signUp() {
        val currentState = _uiState.value
        val email = currentState.registerEmailInput.trim()
        val password = currentState.registerPasswordInput
        val repeatedPassword = currentState.registerRepeatPasswordInput

        val emailErrorRes = when {
            email.isBlank() -> R.string.feedback_email_required
            !email.matches(EmailPatternRegex) -> R.string.feedback_email_invalid
            else -> null
        }
        val passwordErrorRes = when {
            password.isBlank() -> R.string.feedback_password_required
            !password.isValidPassword() -> R.string.feedback_password_invalid_length
            else -> null
        }
        val repeatedPasswordErrorRes = when {
            repeatedPassword.isBlank() -> R.string.feedback_password_repeat_required
            !repeatedPassword.isValidPassword() -> R.string.feedback_password_invalid_length
            repeatedPassword != password -> R.string.feedback_password_mismatch
            else -> null
        }

        if (emailErrorRes != null || passwordErrorRes != null || repeatedPasswordErrorRes != null) {
            _uiState.update {
                it.copy(
                    registerEmailErrorRes = emailErrorRes,
                    registerPasswordErrorRes = passwordErrorRes,
                    registerRepeatPasswordErrorRes = repeatedPasswordErrorRes,
                )
            }
            return
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isRegistering = true,
                    registerEmailErrorRes = null,
                    registerPasswordErrorRes = null,
                    registerRepeatPasswordErrorRes = null,
                )
            }

            when (val authResult = authSessionProvider.signUp(email = email, password = password)) {
                is AuthSignInResult.Success -> {
                    when (val result = resolveAuthorizedSession(authResult.principal)) {
                        is AccessResolutionResult.Authorized -> {
                            val members = repository.getAllMembers()
                            val allNotifications = notificationRepository.getAllNotifications()
                            _uiState.update {
                                it.copy(
                                    isRegistering = false,
                                    registerEmailInput = "",
                                    registerPasswordInput = "",
                                    registerRepeatPasswordInput = "",
                                    mode = SessionMode.Authorized(
                                        principal = authResult.principal,
                                        authenticatedMember = result.member,
                                        member = result.member,
                                        members = members,
                                    ),
                                    myOrderFreshnessState = MyOrderFreshnessUiState.Checking,
                                    notificationsFeed = allNotifications.filter { event -> event.isVisibleTo(result.member) },
                                )
                            }
                            registerAuthorizedDevice(result.member)
                            refreshMyOrderFreshness()
                        }

                        is AccessResolutionResult.Unauthorized -> {
                            val showUnauthorizedDialog = shouldShowUnauthorizedDialog(
                                email = authResult.principal.email,
                                reason = result.reason,
                            )
                            _uiState.update {
                                it.copy(
                                    isRegistering = false,
                                    registerEmailInput = "",
                                    registerPasswordInput = "",
                                    registerRepeatPasswordInput = "",
                                    mode = SessionMode.Unauthorized(
                                        email = authResult.principal.email,
                                        reason = result.reason,
                                    ),
                                    showUnauthorizedDialog = showUnauthorizedDialog,
                                    myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
                                    notificationsFeed = emptyList(),
                                    notificationDraft = NotificationDraft(),
                                    isLoadingNotifications = false,
                                    isSendingNotification = false,
                                )
                            }
                        }
                    }
                }

                is AuthSignInResult.Failure -> {
                    val mappedError = mapAuthFailure(
                        reason = authResult.reason,
                        flow = AuthErrorFlow.SIGN_UP,
                    )
                    val fallbackEmailErrorRes = when {
                        mappedError.emailErrorRes != null -> null
                        mappedError.passwordErrorRes != null -> null
                        mappedError.globalMessageRes != null -> mappedError.globalMessageRes
                        else -> R.string.auth_error_register_generic
                    }
                    _uiState.update {
                        it.copy(
                            isRegistering = false,
                            registerEmailErrorRes = mappedError.emailErrorRes ?: fallbackEmailErrorRes,
                            registerPasswordErrorRes = mappedError.passwordErrorRes,
                        )
                    }
                }
            }
        }
    }

    fun sendPasswordReset() {
        val currentState = _uiState.value
        val email = currentState.recoverEmailInput.trim()
        val emailErrorRes = when {
            email.isBlank() -> R.string.feedback_email_required
            !email.matches(EmailPatternRegex) -> R.string.feedback_email_invalid
            else -> null
        }

        if (emailErrorRes != null) {
            _uiState.update { it.copy(recoverEmailErrorRes = emailErrorRes) }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isRecoveringPassword = true, recoverEmailErrorRes = null) }

            when (val result = authSessionProvider.sendPasswordReset(email = email)) {
                AuthPasswordResetResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isRecoveringPassword = false,
                            recoverEmailInput = "",
                            recoverEmailErrorRes = null,
                            showRecoverSuccessDialog = true,
                        )
                    }
                }

                is AuthPasswordResetResult.Failure -> {
                    val mappedError = mapAuthFailure(
                        reason = result.reason,
                        flow = AuthErrorFlow.PASSWORD_RESET,
                    )
                    val fallbackEmailErrorRes = mappedError.globalMessageRes ?: R.string.auth_error_recover_generic
                    _uiState.update {
                        it.copy(
                            isRecoveringPassword = false,
                            recoverEmailErrorRes = mappedError.emailErrorRes ?: fallbackEmailErrorRes,
                        )
                    }
                }
            }
        }
    }

    fun signOut() {
        authSessionProvider.signOut()
        clearSessionRefreshTracking()
        viewModelScope.launch {
            criticalDataFreshnessLocalRepository.clear()
        }
        _uiState.update {
            it.copy(
                mode = SessionMode.SignedOut,
                passwordInput = "",
                emailErrorRes = null,
                passwordErrorRes = null,
                isAuthenticating = false,
                registerEmailInput = "",
                registerPasswordInput = "",
                registerRepeatPasswordInput = "",
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
                isRegistering = false,
                recoverEmailInput = "",
                recoverEmailErrorRes = null,
                isRecoveringPassword = false,
                showRecoverSuccessDialog = false,
                showSessionExpiredDialog = false,
                showUnauthorizedDialog = false,
                memberDraft = MemberDraft(),
                myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
                latestNews = emptyList(),
                newsFeed = emptyList(),
                newsDraft = NewsDraft(),
                notificationsFeed = emptyList(),
                notificationDraft = NotificationDraft(),
                sharedProfiles = emptyList(),
                sharedProfileDraft = SharedProfileDraft(),
                shiftsFeed = emptyList(),
                nextDeliveryShift = null,
                nextMarketShift = null,
                editingNewsId = null,
                isLoadingNews = false,
                isSavingNews = false,
                isLoadingNotifications = false,
                isSendingNotification = false,
                isLoadingSharedProfiles = false,
                isSavingSharedProfile = false,
                isDeletingSharedProfile = false,
                isLoadingShifts = false,
            )
        }
    }

    fun refreshSession(trigger: SessionRefreshTrigger) {
        val nowMillis = nowMillisProvider()
        if (!sessionRefreshPolicy.shouldRefresh(
                trigger = trigger,
                lastRefreshAtMillis = lastSessionRefreshAtMillis,
                nowMillis = nowMillis,
                isRefreshInFlight = isSessionRefreshInFlight.get(),
            )
        ) {
            return
        }
        if (!isSessionRefreshInFlight.compareAndSet(false, true)) {
            return
        }

        viewModelScope.launch {
            val hadAuthenticatedSession = _uiState.value.mode.isAuthenticatedSession()
            try {
                when (val result = authSessionProvider.refreshCurrentSession()) {
                    AuthSessionRefreshResult.NoSession -> {
                        if (hadAuthenticatedSession) {
                            handleExpiredSession()
                        }
                    }

                    is AuthSessionRefreshResult.Active -> {
                        val shouldRefreshCriticalData = !hadAuthenticatedSession || shouldRefreshCriticalDataFor(result.principal)
                        applyAuthorizedSession(
                            principal = result.principal,
                            shouldRefreshCriticalData = shouldRefreshCriticalData,
                        )
                    }

                    AuthSessionRefreshResult.Expired -> {
                        handleExpiredSession()
                    }
                }
            } finally {
                lastSessionRefreshAtMillis = nowMillisProvider()
                isSessionRefreshInFlight.set(false)
            }
        }
    }

    fun refreshMyOrderFreshness() {
        val currentMode = _uiState.value.mode as? SessionMode.Authorized ?: return
        _uiState.update { it.copy(myOrderFreshnessState = MyOrderFreshnessUiState.Checking) }

        viewModelScope.launch {
            val resolution = withTimeoutOrNull(MY_ORDER_FRESHNESS_TIMEOUT_MILLIS) {
                resolveCriticalDataFreshness()
            }

            val nextState = when (resolution) {
                null -> MyOrderFreshnessUiState.TimedOut
                CriticalDataFreshnessResolution.Fresh -> MyOrderFreshnessUiState.Ready
                CriticalDataFreshnessResolution.InvalidConfig -> MyOrderFreshnessUiState.Unavailable
            }

            _uiState.update { state ->
                if (state.mode != currentMode) {
                    state
                } else {
                    state.copy(myOrderFreshnessState = nextState)
                }
            }
        }
    }

    fun onMemberDraftChanged(newDraft: MemberDraft) {
        _uiState.update { it.copy(memberDraft = newDraft) }
    }

    fun createAuthorizedMember() {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_create)
            return
        }

        val draft = _uiState.value.memberDraft
        if (draft.displayName.isBlank() || draft.email.isBlank()) {
            emitMessage(R.string.feedback_display_name_email_required)
            return
        }

        val normalizedEmail = draft.email.trim().lowercase()
        val allMembers = mode.members
        val memberId = buildMemberId(normalizedEmail)
        if (allMembers.any { it.id == memberId || it.normalizedEmail == normalizedEmail }) {
            emitMessage(R.string.feedback_member_exists)
            return
        }

        val roles = buildRoles(draft)
        if (roles.isEmpty()) {
            emitMessage(R.string.feedback_select_role)
            return
        }

        val member = Member(
            id = memberId,
            displayName = draft.displayName.trim(),
            normalizedEmail = normalizedEmail,
            authUid = null,
            roles = roles,
            isActive = draft.isActive,
            producerCatalogEnabled = true,
        )

        updateMember(mode, member) {
            it.copy(memberDraft = MemberDraft())
        }
    }

    fun toggleAdmin(memberId: String) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_edit_roles)
            return
        }

        val target = mode.members.firstOrNull { it.id == memberId } ?: return
        val updatedRoles = target.roles.toMutableSet().also { roles ->
            if (roles.contains(MemberRole.ADMIN)) {
                roles.remove(MemberRole.ADMIN)
            } else {
                roles.add(MemberRole.ADMIN)
            }
            if (roles.isEmpty()) {
                roles.add(MemberRole.MEMBER)
            }
        }

        val updated = target.copy(roles = updatedRoles)
        updateMember(mode, updated)
    }

    fun toggleActive(memberId: String) {
        val mode = _uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_toggle_active)
            return
        }

        val target = mode.members.firstOrNull { it.id == memberId } ?: return
        val updated = target.copy(isActive = !target.isActive)
        updateMember(mode, updated)
    }

    private fun updateMember(
        mode: SessionMode.Authorized,
        target: Member,
        onSuccessState: (SessionUiState) -> SessionUiState = { it },
    ) {
        viewModelScope.launch {
            val updatedMember = try {
                upsertMemberByAdmin(actorAuthUid = mode.principal.uid, target = target)
            } catch (_: MemberManagementException.AccessDenied) {
                emitMessage(R.string.feedback_only_admin_manage_members)
                return@launch
            } catch (_: MemberManagementException.LastAdminRemoval) {
                emitMessage(R.string.feedback_cannot_remove_last_admin)
                return@launch
            } catch (_: Exception) {
                emitMessage(R.string.feedback_unable_save_changes)
                return@launch
            }

            val allMembers = repository.getAllMembers()
            val refreshedCurrentMember = if (mode.member.id == updatedMember.id) {
                updatedMember
            } else {
                mode.member
            }
            val refreshedAuthenticatedMember = if (mode.authenticatedMember.id == updatedMember.id) {
                updatedMember
            } else {
                mode.authenticatedMember
            }

            _uiState.update {
                onSuccessState(
                    it.copy(
                        mode = SessionMode.Authorized(
                            principal = mode.principal,
                            authenticatedMember = refreshedAuthenticatedMember,
                            member = refreshedCurrentMember,
                            members = allMembers,
                        ),
                    ),
                )
            }
        }
    }

    private fun emitMessage(@StringRes messageRes: Int) {
        viewModelScope.launch {
            _uiEvents.emit(SessionUiEvent.ShowMessage(messageRes))
        }
    }

    private suspend fun applyAuthorizedSession(
        principal: AuthPrincipal,
        shouldRefreshCriticalData: Boolean,
    ) {
        when (val result = resolveAuthorizedSession(principal)) {
            is AccessResolutionResult.Authorized -> {
                val members = repository.getAllMembers()
                val allNotifications = notificationRepository.getAllNotifications()
                val sharedProfiles = sharedProfileRepository.getAllSharedProfiles()
                val allShifts = shiftRepository.getAllShifts()
                val ownSharedProfile = sharedProfiles.firstOrNull { it.userId == result.member.id }
                _uiState.update {
                    it.copy(
                        mode = SessionMode.Authorized(
                            principal = principal,
                            authenticatedMember = result.member,
                            member = result.member,
                            members = members,
                        ),
                        showSessionExpiredDialog = false,
                        showUnauthorizedDialog = false,
                        myOrderFreshnessState = if (shouldRefreshCriticalData) {
                            MyOrderFreshnessUiState.Checking
                        } else {
                            it.myOrderFreshnessState
                        },
                        isLoadingNews = true,
                        isLoadingNotifications = true,
                        isLoadingSharedProfiles = true,
                        isLoadingShifts = true,
                    )
                }
                val allNews = newsRepository.getAllNews()
                _uiState.update {
                    val currentMode = it.mode as? SessionMode.Authorized
                    if (currentMode?.principal?.uid != principal.uid) {
                        it
                    } else {
                        it.copy(
                            latestNews = allNews.filter { article -> article.active }.take(3),
                            newsFeed = if (result.member.isAdmin) {
                                allNews
                            } else {
                                allNews.filter { article -> article.active }
                            },
                            notificationsFeed = allNotifications.filter { event -> event.isVisibleTo(result.member) },
                            sharedProfiles = sharedProfiles.filter { profile -> profile.hasVisibleContent },
                            sharedProfileDraft = ownSharedProfile?.toDraft() ?: SharedProfileDraft(),
                            shiftsFeed = allShifts,
                            nextDeliveryShift = allShifts.nextAssignedShift(
                                memberId = result.member.id,
                                type = ShiftType.DELIVERY,
                                nowMillis = nowMillisProvider(),
                            ),
                            nextMarketShift = allShifts.nextAssignedShift(
                                memberId = result.member.id,
                                type = ShiftType.MARKET,
                                nowMillis = nowMillisProvider(),
                            ),
                            isLoadingNews = false,
                            isLoadingNotifications = false,
                            isLoadingSharedProfiles = false,
                            isLoadingShifts = false,
                        )
                    }
                }
                registerAuthorizedDevice(result.member)
                if (shouldRefreshCriticalData) {
                    refreshMyOrderFreshness()
                }
            }

            is AccessResolutionResult.Unauthorized -> {
                val showUnauthorizedDialog = shouldShowUnauthorizedDialog(
                    email = principal.email,
                    reason = result.reason,
                )
                _uiState.update {
                    it.copy(
                        mode = SessionMode.Unauthorized(
                            email = principal.email,
                            reason = result.reason,
                        ),
                        showSessionExpiredDialog = false,
                        showUnauthorizedDialog = showUnauthorizedDialog,
                        myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
                        latestNews = emptyList(),
                        newsFeed = emptyList(),
                        newsDraft = NewsDraft(),
                        notificationsFeed = emptyList(),
                        notificationDraft = NotificationDraft(),
                        sharedProfiles = emptyList(),
                        sharedProfileDraft = SharedProfileDraft(),
                        shiftsFeed = emptyList(),
                        nextDeliveryShift = null,
                        nextMarketShift = null,
                        editingNewsId = null,
                        isLoadingNews = false,
                        isSavingNews = false,
                        isLoadingNotifications = false,
                        isSendingNotification = false,
                        isLoadingSharedProfiles = false,
                        isSavingSharedProfile = false,
                        isDeletingSharedProfile = false,
                        isLoadingShifts = false,
                    )
                }
            }
        }
    }

    private fun shouldRefreshCriticalDataFor(principal: AuthPrincipal): Boolean {
        val currentMode = _uiState.value.mode
        return when (currentMode) {
            SessionMode.SignedOut -> true
            is SessionMode.Unauthorized -> currentMode.email != principal.email
            is SessionMode.Authorized -> currentMode.principal.uid != principal.uid
        }
    }

    private fun shouldShowUnauthorizedDialog(
        email: String,
        reason: UnauthorizedReason,
    ): Boolean {
        if (reason != UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS) {
            return false
        }
        val currentMode = _uiState.value.mode
        return currentMode !is SessionMode.Unauthorized || currentMode.email != email
    }

    private suspend fun handleExpiredSession() {
        clearSessionRefreshTracking()
        criticalDataFreshnessLocalRepository.clear()
        _uiState.update {
            it.copy(
                mode = SessionMode.SignedOut,
                passwordInput = "",
                emailErrorRes = null,
                passwordErrorRes = null,
                isAuthenticating = false,
                registerEmailInput = "",
                registerPasswordInput = "",
                registerRepeatPasswordInput = "",
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
                isRegistering = false,
                recoverEmailInput = "",
                recoverEmailErrorRes = null,
                isRecoveringPassword = false,
                showRecoverSuccessDialog = false,
                showSessionExpiredDialog = true,
                showUnauthorizedDialog = false,
                memberDraft = MemberDraft(),
                myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
                latestNews = emptyList(),
                newsFeed = emptyList(),
                newsDraft = NewsDraft(),
                notificationsFeed = emptyList(),
                notificationDraft = NotificationDraft(),
                sharedProfiles = emptyList(),
                sharedProfileDraft = SharedProfileDraft(),
                shiftsFeed = emptyList(),
                nextDeliveryShift = null,
                nextMarketShift = null,
                editingNewsId = null,
                isLoadingNews = false,
                isSavingNews = false,
                isLoadingNotifications = false,
                isSendingNotification = false,
                isLoadingSharedProfiles = false,
                isSavingSharedProfile = false,
                isDeletingSharedProfile = false,
                isLoadingShifts = false,
            )
        }
    }

    private fun clearSessionRefreshTracking() {
        lastSessionRefreshAtMillis = null
        isSessionRefreshInFlight.set(false)
    }

    private fun registerAuthorizedDevice(member: Member) {
        viewModelScope.launch {
            runCatching {
                authorizedDeviceRegistrar.register(member)
            }
        }
    }

    private fun buildRoles(draft: MemberDraft): Set<MemberRole> {
        val roles = mutableSetOf<MemberRole>()
        if (draft.isMember) roles.add(MemberRole.MEMBER)
        if (draft.isProducer) roles.add(MemberRole.PRODUCER)
        if (draft.isAdmin) roles.add(MemberRole.ADMIN)
        return roles
    }

    private fun buildMemberId(normalizedEmail: String): String {
        val suffix = normalizedEmail.replace("[^a-z0-9]+".toRegex(), "_").trim('_').ifBlank { "member" }
        return "member_${suffix.take(40)}"
    }
}

private fun SharedProfile.toDraft(): SharedProfileDraft =
    SharedProfileDraft(
        familyNames = familyNames,
        photoUrl = photoUrl.orEmpty(),
        about = about,
    )

private fun SharedProfileDraft.normalized(): SharedProfileDraft =
    copy(
        familyNames = familyNames.trim(),
        photoUrl = photoUrl.trim(),
        about = about.trim(),
    )

private val SharedProfileDraft.hasVisibleContent: Boolean
    get() = familyNames.isNotBlank() || photoUrl.isNotBlank() || about.isNotBlank()

private fun List<ShiftAssignment>.nextAssignedShift(
    memberId: String,
    type: ShiftType,
    nowMillis: Long,
): ShiftAssignment? =
    asSequence()
        .filter { shift -> shift.type == type && shift.dateMillis >= nowMillis && shift.isAssignedTo(memberId) }
        .minByOrNull { shift -> shift.dateMillis }

private fun List<ShiftSwapRequest>.visibleTo(memberId: String): List<ShiftSwapRequest> =
    filter { request ->
        request.requesterUserId == memberId || request.candidates.any { candidate -> candidate.userId == memberId }
    }
        .sortedByDescending { it.requestedAtMillis }

private fun ShiftAssignment.swapCandidates(
    allShifts: List<ShiftAssignment>,
    requesterUserId: String,
    nowMillis: Long,
): List<com.reguerta.user.domain.shifts.ShiftSwapCandidate> {
    val thresholdDate = java.time.Instant.ofEpochMilli(nowMillis)
        .atZone(java.time.ZoneId.systemDefault())
        .toLocalDate()
        .plusWeeks(if (type == ShiftType.DELIVERY) 2 else 0)
        .atStartOfDay(java.time.ZoneId.systemDefault())
        .toInstant()
        .toEpochMilli()

    val candidates = allShifts.asSequence()
        .filter { shift ->
            shift.id != id &&
                shift.type == type &&
                shift.dateMillis >= thresholdDate
        }
        .flatMap { shift ->
            when (type) {
                ShiftType.DELIVERY -> shift.assignedUserIds.asSequence()
                ShiftType.MARKET -> shift.assignedUserIds.asSequence()
            }
                .filter { userId -> userId != requesterUserId }
                .map { userId -> com.reguerta.user.domain.shifts.ShiftSwapCandidate(userId = userId, shiftId = shift.id) }
        }
        .distinctBy { candidate -> "${candidate.userId}:${candidate.shiftId}" }
        .toList()

    return candidates
}

private fun ShiftAssignment.swapMemberWith(
    other: ShiftAssignment,
    requesterUserId: String,
    responderUserId: String,
    nowMillis: Long,
): Pair<ShiftAssignment, ShiftAssignment> {
    fun ShiftAssignment.replacing(oldUserId: String, newUserId: String): ShiftAssignment {
        val updatedAssigned = assignedUserIds.map { assignedUserId ->
            if (assignedUserId == oldUserId) newUserId else assignedUserId
        }
        val updatedHelper = when (helperUserId) {
            oldUserId -> newUserId
            else -> helperUserId
        }
        return copy(
            assignedUserIds = updatedAssigned,
            helperUserId = updatedHelper,
            status = com.reguerta.user.domain.shifts.ShiftStatus.CONFIRMED,
            source = "app",
            updatedAtMillis = nowMillis,
        )
    }

    return replacing(requesterUserId, responderUserId) to other.replacing(responderUserId, requesterUserId)
}

private fun List<ShiftAssignment>.applyConfirmedSwap(
    updatedRequestedShift: ShiftAssignment,
    updatedCandidateShift: ShiftAssignment,
    nowMillis: Long,
): List<ShiftAssignment> {
    val replaced = map { shift ->
        when (shift.id) {
            updatedRequestedShift.id -> updatedRequestedShift
            updatedCandidateShift.id -> updatedCandidateShift
            else -> shift
        }
    }

    val deliveries = replaced
        .filter { it.type == ShiftType.DELIVERY }
        .sortedBy { it.dateMillis }
    val helperByDeliveryId = deliveries.mapIndexed { index, shift ->
        shift.id to deliveries.getOrNull(index + 1)?.assignedUserIds?.firstOrNull()
    }.toMap()

    return replaced.map { shift ->
        if (shift.type != ShiftType.DELIVERY) {
            shift
        } else {
            val recomputedHelper = helperByDeliveryId[shift.id]
            if (shift.helperUserId == recomputedHelper) {
                shift
            } else {
                shift.copy(
                    helperUserId = recomputedHelper,
                    status = com.reguerta.user.domain.shifts.ShiftStatus.CONFIRMED,
                    source = "app",
                    updatedAtMillis = nowMillis,
                )
            }
        }
    }
}

private fun List<Member>.displayNameFor(memberId: String): String =
    firstOrNull { it.id == memberId }?.displayName ?: memberId

private fun ShiftSwapRequest.availableResponses(): List<com.reguerta.user.domain.shifts.ShiftSwapResponse> =
    responses.filter { it.status == com.reguerta.user.domain.shifts.ShiftSwapResponseStatus.AVAILABLE }

private fun ShiftSwapRequest.hasPendingCandidateFor(memberId: String): Boolean =
    candidates.any { candidate ->
        candidate.userId == memberId && responses.none { response ->
            response.userId == candidate.userId && response.shiftId == candidate.shiftId
        }
    }

private fun Long.toShiftNotificationDateTime(): String {
    val formatter = java.text.SimpleDateFormat("d MMM yyyy", Locale.forLanguageTag("es-ES"))
    return formatter.format(java.util.Date(this))
}

private val EmailPatternRegex = "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$".toRegex(setOf(RegexOption.IGNORE_CASE))
private const val MY_ORDER_FRESHNESS_TIMEOUT_MILLIS = 2_500L
private const val PasswordMinLength = 6
private const val PasswordMaxLength = 16

private fun String.isValidPassword(): Boolean = length in PasswordMinLength..PasswordMaxLength

private fun SessionMode.isAuthenticatedSession(): Boolean =
    this is SessionMode.Authorized || this is SessionMode.Unauthorized

private fun NotificationAudience.toTarget(): String =
    when (this) {
        NotificationAudience.ALL -> "all"
        NotificationAudience.MEMBERS,
        NotificationAudience.PRODUCERS,
        NotificationAudience.ADMINS,
            -> "segment"
    }

private fun NotificationAudience.toSegmentType(): String? =
    when (this) {
        NotificationAudience.ALL -> null
        NotificationAudience.MEMBERS,
        NotificationAudience.PRODUCERS,
        NotificationAudience.ADMINS,
            -> "role"
    }

private fun NotificationAudience.toTargetRole(): MemberRole? =
    when (this) {
        NotificationAudience.ALL -> null
        NotificationAudience.MEMBERS -> MemberRole.MEMBER
        NotificationAudience.PRODUCERS -> MemberRole.PRODUCER
        NotificationAudience.ADMINS -> MemberRole.ADMIN
    }
