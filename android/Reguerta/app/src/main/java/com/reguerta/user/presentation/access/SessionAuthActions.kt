package com.reguerta.user.presentation.access

import com.reguerta.user.R
import com.reguerta.user.domain.access.AccessResolutionResult
import com.reguerta.user.domain.access.AuthPasswordResetResult
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.AuthSessionProvider
import com.reguerta.user.domain.access.AuthSessionRefreshResult
import com.reguerta.user.domain.access.AuthSignInResult
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionRefreshPolicy
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.CriticalDataFreshnessResolution
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.profiles.SharedProfileRepository
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftType
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
    private val shiftRepository: ShiftRepository,
    private val authSessionProvider: AuthSessionProvider,
    private val resolveAuthorizedSession: ResolveAuthorizedSessionUseCase,
    private val authorizedDeviceRegistrar: AuthorizedDeviceRegistrar,
    private val resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase,
    private val criticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository,
    private val reviewerEnvironmentRouter: ReviewerEnvironmentRouter,
    private val sessionRefreshPolicy: SessionRefreshPolicy,
    private val isSessionRefreshInFlight: AtomicBoolean,
    private val getLastSessionRefreshAtMillis: () -> Long?,
    private val setLastSessionRefreshAtMillis: (Long?) -> Unit,
    private val nowMillisProvider: () -> Long,
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
                    when (val result = resolveAuthorizedSession(authResult.principal)) {
                        is AccessResolutionResult.Authorized -> {
                            val members = memberRepository.getAllMembers()
                            val allNotifications = notificationRepository.getAllNotifications()
                            uiState.update {
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
                                currentMode = uiState.value.mode,
                                email = authResult.principal.email,
                                reason = result.reason,
                            )
                            uiState.update { state ->
                                state.toUnauthorizedAfterAuthAttemptState(
                                    email = authResult.principal.email,
                                    reason = result.reason,
                                    showUnauthorizedDialog = showUnauthorizedDialog,
                                    clearRegisterInputs = false,
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
                    when (val result = resolveAuthorizedSession(authResult.principal)) {
                        is AccessResolutionResult.Authorized -> {
                            val members = memberRepository.getAllMembers()
                            val allNotifications = notificationRepository.getAllNotifications()
                            uiState.update {
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
                                currentMode = uiState.value.mode,
                                email = authResult.principal.email,
                                reason = result.reason,
                            )
                            uiState.update { state ->
                                state.toUnauthorizedAfterAuthAttemptState(
                                    email = authResult.principal.email,
                                    reason = result.reason,
                                    showUnauthorizedDialog = showUnauthorizedDialog,
                                    clearRegisterInputs = true,
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
        reviewerEnvironmentRouter.resetToBaseEnvironment()
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
        reviewerEnvironmentRouter.applyRoutingFor(principal)
        when (val result = resolveAuthorizedSession(principal)) {
            is AccessResolutionResult.Authorized -> {
                val members = memberRepository.getAllMembers()
                val allNotifications = notificationRepository.getAllNotifications()
                val products = productRepository.getProductsForVendor(result.member.id)
                val sharedProfiles = sharedProfileRepository.getAllSharedProfiles()
                val allShifts = shiftRepository.getAllShifts()
                val ownSharedProfile = sharedProfiles.firstOrNull { it.userId == result.member.id }
                uiState.update {
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
                        isLoadingProducts = result.member.canManageSessionProductCatalog,
                        isLoadingMyOrderProducts = false,
                        isUpdatingProducerCatalogVisibility = false,
                        isLoadingSharedProfiles = true,
                        isLoadingShifts = true,
                    )
                }
                val allNews = newsRepository.getAllNews()
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
                            notificationsFeed = allNotifications.filter { event -> event.isVisibleTo(result.member) },
                            productsFeed = products,
                            myOrderProductsFeed = emptyList(),
                            myOrderSeasonalCommitmentsFeed = emptyList(),
                            productDraft = ProductDraft(),
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
                            isLoadingProducts = false,
                            isLoadingMyOrderProducts = false,
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
        reviewerEnvironmentRouter.resetToBaseEnvironment()
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
