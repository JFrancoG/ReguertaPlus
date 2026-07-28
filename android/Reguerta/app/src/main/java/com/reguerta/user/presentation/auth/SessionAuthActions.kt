package com.reguerta.user.presentation.auth

import com.reguerta.user.presentation.root.EmailPatternRegex
import com.reguerta.user.presentation.root.MyOrderFreshnessUiState
import com.reguerta.user.presentation.root.MY_ORDER_FRESHNESS_TIMEOUT_MILLIS
import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.SharedProfileDraft
import com.reguerta.user.presentation.root.canManageSessionProductCatalog
import com.reguerta.user.presentation.root.hasVisibleContent
import com.reguerta.user.presentation.root.isAuthenticatedSession
import com.reguerta.user.presentation.root.isValidPassword
import com.reguerta.user.presentation.root.ShiftSwapDraft
import com.reguerta.user.presentation.root.toDraft

import com.reguerta.user.R
import com.reguerta.user.domain.access.AccessResolutionResult
import com.reguerta.user.domain.access.AuthPasswordResetResult
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.AuthSessionProvider
import com.reguerta.user.domain.access.AuthSessionRefreshResult
import com.reguerta.user.domain.access.AuthSignInResult
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberPermissionMatrix
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionRefreshPolicy
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.access.SessionEnvironmentRouter
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.CriticalDataFreshnessResolution
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.profiles.SharedProfileRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.atomic.AtomicBoolean

internal class SessionAuthActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val memberRepository: MemberRepository,
    private val newsRepository: NewsRepository,
    private val notificationRepository: NotificationRepository,
    private val productRepository: ProductRepository,
    private val sharedProfileRepository: SharedProfileRepository,
    private val authSessionProvider: AuthSessionProvider,
    private val resolveAuthorizedSession: ResolveAuthorizedSessionUseCase,
    private val authorizedDeviceRegistrar: AuthorizedDeviceRegistrar,
    private val resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase,
    private val criticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository,
    private val sessionEnvironmentRouter: SessionEnvironmentRouter,
    private val sessionRefreshPolicy: SessionRefreshPolicy,
    private val isSessionRefreshInFlight: AtomicBoolean,
    private val getLastSessionRefreshAtMillis: () -> Long?,
    private val setLastSessionRefreshAtMillis: (Long?) -> Unit,
    private val nowMillisProvider: () -> Long,
    private val refreshShifts: () -> Unit,
    private val refreshDeliveryCalendar: () -> Unit,
) {
    fun signIn() {
        val currentState = uiState.value
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
            uiState.update {
                it.copy(
                    emailErrorRes = emailErrorRes,
                    passwordErrorRes = passwordErrorRes,
                )
            }
            return
        }

        scope.launch {
            uiState.update { it.copy(isAuthenticating = true, emailErrorRes = null, passwordErrorRes = null) }

            when (val authResult = authSessionProvider.signIn(email = email, password = password)) {
                is AuthSignInResult.Success -> {
                    applyAuthorizedSession(
                        principal = authResult.principal,
                        shouldRefreshCriticalData = true,
                    )
                    uiState.update { it.copy(isAuthenticating = false) }
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
                    uiState.update {
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
        val currentState = uiState.value
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
            uiState.update {
                it.copy(
                    registerEmailErrorRes = emailErrorRes,
                    registerPasswordErrorRes = passwordErrorRes,
                    registerRepeatPasswordErrorRes = repeatedPasswordErrorRes,
                )
            }
            return
        }

        scope.launch {
            uiState.update {
                it.copy(
                    isRegistering = true,
                    registerEmailErrorRes = null,
                    registerPasswordErrorRes = null,
                    registerRepeatPasswordErrorRes = null,
                )
            }

            when (val authResult = authSessionProvider.signUp(email = email, password = password)) {
                is AuthSignInResult.Success -> {
                    applyAuthorizedSession(
                        principal = authResult.principal,
                        shouldRefreshCriticalData = true,
                    )
                    uiState.update {
                        it.copy(
                            isRegistering = false,
                            registerEmailInput = "",
                            registerPasswordInput = "",
                            registerRepeatPasswordInput = "",
                        )
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
                    uiState.update {
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
        val currentState = uiState.value
        val email = currentState.recoverEmailInput.trim()
        val emailErrorRes = when {
            email.isBlank() -> R.string.feedback_email_required
            !email.matches(EmailPatternRegex) -> R.string.feedback_email_invalid
            else -> null
        }

        if (emailErrorRes != null) {
            uiState.update { it.copy(recoverEmailErrorRes = emailErrorRes) }
            return
        }

        scope.launch {
            uiState.update { it.copy(isRecoveringPassword = true, recoverEmailErrorRes = null) }

            when (val result = authSessionProvider.sendPasswordReset(email = email)) {
                AuthPasswordResetResult.Success -> {
                    uiState.update {
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
                    uiState.update {
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
        sessionEnvironmentRouter.resetToBaseEnvironment()
        scope.launch {
            criticalDataFreshnessLocalRepository.clear()
        }
        uiState.update { state -> state.toSignedOutSessionState(showSessionExpiredDialog = false) }
    }

    fun refreshSession(trigger: SessionRefreshTrigger) {
        val nowMillis = nowMillisProvider()
        if (!sessionRefreshPolicy.shouldRefresh(
                trigger = trigger,
                lastRefreshAtMillis = getLastSessionRefreshAtMillis(),
                nowMillis = nowMillis,
                isRefreshInFlight = isSessionRefreshInFlight.get(),
            )
        ) {
            return
        }
        if (!isSessionRefreshInFlight.compareAndSet(false, true)) {
            return
        }

        scope.launch {
            val hadAuthenticatedSession = uiState.value.mode.isAuthenticatedSession()
            try {
                when (val result = authSessionProvider.refreshCurrentSession()) {
                    AuthSessionRefreshResult.NoSession -> {
                        if (hadAuthenticatedSession) {
                            handleExpiredSession()
                        }
                    }

                    is AuthSessionRefreshResult.Active -> {
                        val shouldRefreshCriticalData = !hadAuthenticatedSession || shouldRefreshCriticalDataFor(
                            currentMode = uiState.value.mode,
                            principal = result.principal,
                        )
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
                setLastSessionRefreshAtMillis(nowMillisProvider())
                isSessionRefreshInFlight.set(false)
            }
        }
    }

    fun refreshMyOrderFreshness() {
        val currentMode = uiState.value.mode as? SessionMode.Authorized ?: return
        uiState.update { it.copy(myOrderFreshnessState = MyOrderFreshnessUiState.Checking) }

        scope.launch {
            val resolution = withTimeoutOrNull(MY_ORDER_FRESHNESS_TIMEOUT_MILLIS) {
                resolveCriticalDataFreshness()
            }

            val nextState = when (resolution) {
                null -> MyOrderFreshnessUiState.TimedOut
                CriticalDataFreshnessResolution.Fresh -> MyOrderFreshnessUiState.Ready
                CriticalDataFreshnessResolution.InvalidConfig -> MyOrderFreshnessUiState.Unavailable
            }

            uiState.update { state ->
                if (state.mode != currentMode) {
                    state
                } else {
                    state.copy(myOrderFreshnessState = nextState)
                }
            }
        }
    }

    private suspend fun applyAuthorizedSession(
        principal: AuthPrincipal,
        shouldRefreshCriticalData: Boolean,
    ) {
        when (val result = resolveAuthorizedSession(principal)) {
            is AccessResolutionResult.Authorized -> {
                val members = memberRepository.getMembersVisibleTo(result.member)
                val allNotifications = notificationRepository.getNotificationsFor(result.member)
                val readNotificationIds = notificationRepository.getReadNotificationIds(result.member.id)
                val products = productRepository.getProductsForVendor(result.member.id)
                val sharedProfiles = sharedProfileRepository.getAllSharedProfiles()
                val ownSharedProfile = sharedProfiles.firstOrNull { it.userId == result.member.id }
                uiState.update {
                    val currentMode = it.mode as? SessionMode.Authorized
                    val accessTransition = resolveAuthorizedSessionAccessTransition(
                        currentMode = currentMode,
                        currentEnvironment = it.sessionEnvironment,
                        principal = principal,
                        member = result.member,
                        resolvedEnvironment = result.environment,
                    )
                    val productState = it.resetProductEditorUnlessAuthorizedRefreshCanPreserve(
                        principalUid = principal.uid,
                        member = result.member,
                    )
                    productState.reconcileAuthorizedShiftState(accessTransition).copy(
                        isAuthenticating = false,
                        isRegistering = false,
                        sessionEnvironment = result.environment,
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
                        isLoadingProducts = result.member.canManageSessionProductCatalog,
                        isLoadingMyOrderProducts = false,
                        isUploadingNewsImage = false,
                        isUploadingSharedProfileImage = false,
                        isLoadingSharedProfiles = true,
                    )
                }
                val allNews = newsRepository.getNewsFor(result.member)
                uiState.update {
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
                            notificationsFeed = allNotifications,
                            readNotificationIds = readNotificationIds,
                            productsFeed = products,
                            myOrderProductsFeed = emptyList(),
                            myOrderSeasonalCommitmentsFeed = emptyList(),
                            sharedProfiles = sharedProfiles.filter { profile -> profile.hasVisibleContent },
                            sharedProfileDraft = ownSharedProfile?.toDraft() ?: SharedProfileDraft(),
                            sharedProfileEditorRevision = it.sharedProfileEditorRevision + 1,
                            sharedProfilesRevision = it.sharedProfilesRevision + 1,
                            isLoadingNews = false,
                            isLoadingNotifications = false,
                            isLoadingProducts = false,
                            isLoadingMyOrderProducts = false,
                            isLoadingSharedProfiles = false,
                            isUploadingNewsImage = false,
                            isUploadingSharedProfileImage = false,
                        )
                    }
                }
                refreshShifts()
                refreshDeliveryCalendar()
                registerAuthorizedDevice(result.member)
                if (shouldRefreshCriticalData) {
                    refreshMyOrderFreshness()
                }
            }

            is AccessResolutionResult.Unauthorized -> {
                if (result.reason == UnauthorizedReason.EMAIL_NOT_VERIFIED) {
                    authSessionProvider.signOut()
                    sessionEnvironmentRouter.resetToBaseEnvironment()
                    uiState.update { state ->
                        state.toSignedOutSessionState(showSessionExpiredDialog = false).copy(
                            emailInput = principal.email,
                            emailErrorRes = R.string.auth_error_email_not_verified,
                        )
                    }
                    return
                }
                val showUnauthorizedDialog = shouldShowUnauthorizedDialog(
                    currentMode = uiState.value.mode,
                    email = principal.email,
                    reason = result.reason,
                )
                uiState.update { state ->
                    state.toUnauthorizedSessionState(
                        email = principal.email,
                        reason = result.reason,
                        showUnauthorizedDialog = showUnauthorizedDialog,
                    )
                }
            }
        }
    }

    private suspend fun handleExpiredSession() {
        clearSessionRefreshTracking()
        sessionEnvironmentRouter.resetToBaseEnvironment()
        criticalDataFreshnessLocalRepository.clear()
        uiState.update { state -> state.toSignedOutSessionState(showSessionExpiredDialog = true) }
    }

    private fun clearSessionRefreshTracking() {
        setLastSessionRefreshAtMillis(null)
        isSessionRefreshInFlight.set(false)
    }

    private fun registerAuthorizedDevice(member: Member) {
        scope.launch {
            runCatching {
                authorizedDeviceRegistrar.register(member)
            }
        }
    }
}

internal data class AuthorizedSessionAccessTransition(
    val sameProductIdentity: Boolean,
    val accessCapabilitiesChanged: Boolean,
    val adminAccessChanged: Boolean,
    val environmentChanged: Boolean,
) {
    val invalidatesSessionContext: Boolean
        get() = !sameProductIdentity || accessCapabilitiesChanged || environmentChanged

    val preservesShiftData: Boolean
        get() = sameProductIdentity && !environmentChanged

    val preservesDeliveryCalendar: Boolean
        get() = preservesShiftData && !adminAccessChanged
}

internal fun resolveAuthorizedSessionAccessTransition(
    currentMode: SessionMode.Authorized?,
    currentEnvironment: String?,
    principal: AuthPrincipal,
    member: Member,
    resolvedEnvironment: String,
): AuthorizedSessionAccessTransition {
    val sameProductIdentity = currentMode?.principal?.uid == principal.uid &&
        currentMode.member.id == member.id
    val accessCapabilitiesChanged = currentMode?.let { mode ->
        MemberPermissionMatrix.capabilitiesFor(mode.member) != MemberPermissionMatrix.capabilitiesFor(member)
    } ?: false
    val adminAccessChanged = currentMode?.member?.isAdmin?.let { wasAdmin ->
        wasAdmin != member.isAdmin
    } ?: false
    val environmentChanged = currentEnvironment != resolvedEnvironment
    return AuthorizedSessionAccessTransition(
        sameProductIdentity = sameProductIdentity,
        accessCapabilitiesChanged = accessCapabilitiesChanged,
        adminAccessChanged = adminAccessChanged,
        environmentChanged = environmentChanged,
    )
}

internal fun SessionUiState.reconcileAuthorizedShiftState(
    transition: AuthorizedSessionAccessTransition,
): SessionUiState = copy(
    sessionEpoch = if (transition.invalidatesSessionContext) sessionEpoch + 1 else sessionEpoch,
    shiftsFeed = if (transition.preservesShiftData) shiftsFeed else emptyList(),
    deliveryCalendarOverrides = if (transition.preservesDeliveryCalendar) {
        deliveryCalendarOverrides
    } else {
        emptyList()
    },
    defaultDeliveryDayOfWeek = if (transition.preservesDeliveryCalendar) {
        defaultDeliveryDayOfWeek
    } else {
        null
    },
    shiftSwapRequests = if (transition.preservesShiftData) shiftSwapRequests else emptyList(),
    dismissedShiftSwapRequestIds = if (transition.preservesShiftData) {
        dismissedShiftSwapRequestIds
    } else {
        emptySet()
    },
    acknowledgedShiftSwapRequestIds = if (
        transition.preservesShiftData && !transition.invalidatesSessionContext
    ) {
        acknowledgedShiftSwapRequestIds
    } else {
        emptySet()
    },
    acknowledgedShiftSwapCreates = if (
        transition.preservesShiftData && !transition.invalidatesSessionContext
    ) {
        acknowledgedShiftSwapCreates
    } else {
        emptyMap()
    },
    shiftSwapDraft = if (transition.preservesShiftData) shiftSwapDraft else ShiftSwapDraft(),
    nextDeliveryShift = if (transition.preservesShiftData) nextDeliveryShift else null,
    nextMarketShift = if (transition.preservesShiftData) nextMarketShift else null,
    isLoadingShifts = false,
    isLoadingDeliveryCalendar = false,
    isSavingDeliveryCalendar = false,
    isSubmittingShiftPlanningRequest = false,
    isSavingShiftSwapRequest = false,
    isUpdatingShiftSwapRequest = false,
)
