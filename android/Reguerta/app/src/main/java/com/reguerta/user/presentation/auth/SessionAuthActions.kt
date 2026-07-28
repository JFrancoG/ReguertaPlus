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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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
    private val sessionOperationLock = Any()
    private var sessionOperationGeneration = 0L
    private var sessionOperationOwner: Any? = null
    private var sessionOperationJob: Job? = null
    private var sessionOperationKind: SessionAuthOperationKind? = null

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

        launchSessionOperation(kind = SessionAuthOperationKind.SIGN_IN) { operation ->
            updateUiStateIfCurrent(operation) {
                it.copy(
                    isAuthenticating = true,
                    isRegistering = false,
                    emailErrorRes = null,
                    passwordErrorRes = null,
                )
            }

            operation.providerWasInvoked.set(true)
            val authResult = authSessionProvider.signIn(email = email, password = password)
            if (!isCurrentSessionOperation(operation)) {
                closeStaleFirebaseAuthentication(operation)
                return@launchSessionOperation
            }

            when (authResult) {
                is AuthSignInResult.Success -> when (
                    applyAuthorizedSession(
                        principal = authResult.principal,
                        shouldRefreshCriticalData = true,
                        operation = operation,
                    )
                ) {
                    AuthorizedSessionApplication.STALE -> closeStaleFirebaseAuthentication(operation)
                    AuthorizedSessionApplication.APPLIED,
                    AuthorizedSessionApplication.TERMINATED,
                        -> Unit
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
                    updateUiStateIfCurrent(operation) {
                        it.copy(
                            isAuthenticating = false,
                            emailErrorRes = mappedError.emailErrorRes ?: fallbackEmailErrorRes,
                            passwordErrorRes = mappedError.passwordErrorRes,
                        )
                    }
                }
            }
            updateUiStateIfCurrent(operation) { it.copy(isAuthenticating = false) }
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

        launchSessionOperation(kind = SessionAuthOperationKind.SIGN_UP) { operation ->
            updateUiStateIfCurrent(operation) {
                it.copy(
                    isAuthenticating = false,
                    isRegistering = true,
                    registerEmailErrorRes = null,
                    registerPasswordErrorRes = null,
                    registerRepeatPasswordErrorRes = null,
                )
            }

            operation.providerWasInvoked.set(true)
            val authResult = authSessionProvider.signUp(email = email, password = password)
            if (!isCurrentSessionOperation(operation)) {
                closeStaleFirebaseAuthentication(operation)
                return@launchSessionOperation
            }

            when (authResult) {
                is AuthSignInResult.Success -> when (
                    applyAuthorizedSession(
                        principal = authResult.principal,
                        shouldRefreshCriticalData = true,
                        operation = operation,
                    )
                ) {
                    AuthorizedSessionApplication.APPLIED -> updateUiStateIfCurrent(operation) {
                        it.copy(
                            isRegistering = false,
                            registerEmailInput = "",
                            registerPasswordInput = "",
                            registerRepeatPasswordInput = "",
                        )
                    }

                    AuthorizedSessionApplication.STALE -> closeStaleFirebaseAuthentication(operation)
                    AuthorizedSessionApplication.TERMINATED -> Unit
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
                    updateUiStateIfCurrent(operation) {
                        it.copy(
                            isRegistering = false,
                            registerEmailErrorRes = mappedError.emailErrorRes ?: fallbackEmailErrorRes,
                            registerPasswordErrorRes = mappedError.passwordErrorRes,
                        )
                    }
                }
            }
            updateUiStateIfCurrent(operation) { it.copy(isRegistering = false) }
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
        val cleanupJob = ownSessionTerminationCleanup {
            criticalDataFreshnessLocalRepository.clear()
        }
        authorizedDeviceRegistrar.clearAuthorizedSession()
        authSessionProvider.signOut()
        clearSessionRefreshTracking()
        sessionEnvironmentRouter.resetToBaseEnvironment()
        uiState.update { state -> state.toSignedOutSessionState(showSessionExpiredDialog = false) }
        cleanupJob.start()
    }

    fun refreshSession(trigger: SessionRefreshTrigger) {
        val nowMillis = nowMillisProvider()
        val currentAuthorizedSession = uiState.value.mode as? SessionMode.Authorized
        val hadAuthenticatedSession = currentAuthorizedSession != null
        val expectedPrincipalUid = currentAuthorizedSession?.principal?.uid
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

        val didLaunch = launchSessionOperation(
            kind = SessionAuthOperationKind.REFRESH,
            expectedPrincipalUid = expectedPrincipalUid,
        ) { operation ->
            try {
                operation.providerWasInvoked.set(true)
                val result = authSessionProvider.refreshCurrentSession()
                if (!isCurrentSessionOperation(operation)) {
                    closeStaleFirebaseAuthentication(operation)
                    return@launchSessionOperation
                }
                when (result) {
                    AuthSessionRefreshResult.NoSession -> {
                        if (hadAuthenticatedSession) {
                            handleExpiredSession(operation)
                        }
                    }

                    is AuthSessionRefreshResult.Active -> {
                        if (
                            operation.expectedPrincipalUid != null &&
                            result.principal.uid != operation.expectedPrincipalUid
                        ) {
                            closeStaleFirebaseAuthentication(operation)
                            handleExpiredSession(operation)
                            return@launchSessionOperation
                        }
                        val shouldRefreshCriticalData = !hadAuthenticatedSession || shouldRefreshCriticalDataFor(
                            currentMode = uiState.value.mode,
                            principal = result.principal,
                        )
                        when (
                            applyAuthorizedSession(
                                principal = result.principal,
                                shouldRefreshCriticalData = shouldRefreshCriticalData,
                                operation = operation,
                            )
                        ) {
                            AuthorizedSessionApplication.STALE -> closeStaleFirebaseAuthentication(operation)
                            AuthorizedSessionApplication.APPLIED,
                            AuthorizedSessionApplication.TERMINATED,
                                -> Unit
                        }
                    }

                    AuthSessionRefreshResult.Expired -> {
                        handleExpiredSession(operation)
                    }
                }
            } finally {
                finishRefreshIfCurrent(operation)
            }
        }
        if (!didLaunch) {
            isSessionRefreshInFlight.set(false)
        }
    }

    fun refreshMyOrderFreshness() {
        val currentMode = uiState.value.mode as? SessionMode.Authorized ?: return
        val currentSessionEpoch = uiState.value.sessionEpoch
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
                if (state.mode != currentMode || state.sessionEpoch != currentSessionEpoch) {
                    state
                } else {
                    state.copy(myOrderFreshnessState = nextState)
                }
            }
        }
    }

    private fun launchSessionOperation(
        kind: SessionAuthOperationKind,
        expectedPrincipalUid: String? = null,
        block: suspend (SessionAuthOperation) -> Unit,
    ): Boolean {
        lateinit var operation: SessionAuthOperation
        lateinit var job: Job
        synchronized(sessionOperationLock) {
            val refreshWouldSupersedeInteractive =
                sessionOperationKind in INTERACTIVE_SESSION_OPERATION_KINDS
            val refreshWasCapturedBeforeCleanup =
                sessionOperationKind == SessionAuthOperationKind.CLEANUP && expectedPrincipalUid != null
            if (
                kind == SessionAuthOperationKind.REFRESH &&
                (refreshWouldSupersedeInteractive || refreshWasCapturedBeforeCleanup)
            ) {
                return false
            }
            val owner = Any()
            val predecessor = sessionOperationJob
            if (sessionOperationKind != SessionAuthOperationKind.CLEANUP) {
                predecessor?.cancel()
            }
            sessionOperationGeneration += 1
            operation = SessionAuthOperation(
                generation = sessionOperationGeneration,
                owner = owner,
                predecessor = predecessor,
                kind = kind,
                expectedPrincipalUid = expectedPrincipalUid,
            )
            job = scope.launch(start = CoroutineStart.LAZY) {
                try {
                    withContext(NonCancellable) {
                        predecessor?.join()
                    }
                    if (!isCurrentSessionOperation(operation)) return@launch
                    block(operation)
                } catch (error: Exception) {
                    if (
                        operation.providerWasInvoked.get() &&
                        !isCurrentSessionOperation(operation) &&
                        !operation.terminalSessionApplied.get()
                    ) {
                        closeStaleFirebaseAuthentication(operation)
                        return@launch
                    }
                    throw error
                } finally {
                    if (
                        operation.providerWasInvoked.get() &&
                        !isCurrentSessionOperation(operation) &&
                        !operation.terminalSessionApplied.get()
                    ) {
                        closeStaleFirebaseAuthentication(operation)
                    }
                }
            }
            sessionOperationOwner = owner
            sessionOperationJob = job
            sessionOperationKind = kind
            isSessionRefreshInFlight.set(kind == SessionAuthOperationKind.REFRESH)
        }
        job.invokeOnCompletion {
            releaseSessionOperation(operation, job)
        }
        job.start()
        return true
    }

    private fun ownSessionTerminationCleanup(block: suspend () -> Unit): Job {
        lateinit var cleanupJob: Job
        synchronized(sessionOperationLock) {
            val predecessor = sessionOperationJob
            if (sessionOperationKind != SessionAuthOperationKind.CLEANUP) {
                predecessor?.cancel()
            }
            sessionOperationGeneration += 1
            sessionOperationOwner = null
            isSessionRefreshInFlight.set(false)
            cleanupJob = scope.launch(start = CoroutineStart.LAZY) {
                withContext(NonCancellable) {
                    predecessor?.join()
                }
                block()
            }
            sessionOperationJob = cleanupJob
            sessionOperationKind = SessionAuthOperationKind.CLEANUP
        }
        cleanupJob.invokeOnCompletion {
            synchronized(sessionOperationLock) {
                if (sessionOperationJob === cleanupJob) {
                    sessionOperationJob = null
                    sessionOperationKind = null
                }
            }
        }
        return cleanupJob
    }

    private fun releaseSessionOperation(operation: SessionAuthOperation, job: Job) {
        synchronized(sessionOperationLock) {
            if (sessionOperationJob === job) {
                sessionOperationJob = null
                sessionOperationKind = null
            }
            if (
                sessionOperationGeneration == operation.generation &&
                sessionOperationOwner === operation.owner
            ) {
                sessionOperationOwner = null
            }
        }
    }

    private fun isCurrentSessionOperation(operation: SessionAuthOperation): Boolean =
        synchronized(sessionOperationLock) {
            sessionOperationGeneration == operation.generation &&
                sessionOperationOwner === operation.owner
        }

    private fun applyResolvedEnvironmentIfCurrent(
        operation: SessionAuthOperation,
        environment: String,
    ) {
        synchronized(sessionOperationLock) {
            if (
                sessionOperationGeneration != operation.generation ||
                sessionOperationOwner !== operation.owner
            ) {
                throw CancellationException("Session operation was superseded before routing")
            }
            sessionEnvironmentRouter.applyResolvedEnvironment(environment)
        }
    }

    private fun invalidateSessionOperationIfCurrent(operation: SessionAuthOperation): Boolean =
        synchronized(sessionOperationLock) {
            if (
                sessionOperationGeneration != operation.generation ||
                sessionOperationOwner !== operation.owner
            ) {
                false
            } else {
                operation.terminalSessionApplied.set(true)
                sessionOperationGeneration += 1
                sessionOperationOwner = null
                isSessionRefreshInFlight.set(false)
                true
            }
        }

    private fun updateUiStateIfCurrent(
        operation: SessionAuthOperation,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        uiState.update { state ->
            if (isCurrentSessionOperation(operation)) transform(state) else state
        }
        return isCurrentSessionOperation(operation)
    }

    private fun finishRefreshIfCurrent(operation: SessionAuthOperation) {
        synchronized(sessionOperationLock) {
            if (
                sessionOperationGeneration == operation.generation &&
                sessionOperationOwner === operation.owner
            ) {
                setLastSessionRefreshAtMillis(nowMillisProvider())
                isSessionRefreshInFlight.set(false)
            }
        }
    }

    private fun abandonStaleAuthorizedSession(): AuthorizedSessionApplication {
        return AuthorizedSessionApplication.STALE
    }

    private fun closeStaleFirebaseAuthentication(operation: SessionAuthOperation) {
        if (operation.staleAuthenticationClosed.compareAndSet(false, true)) {
            authorizedDeviceRegistrar.clearAuthorizedSession()
            authSessionProvider.signOut()
            sessionEnvironmentRouter.resetToBaseEnvironment()
        }
    }

    private suspend fun applyAuthorizedSession(
        principal: AuthPrincipal,
        shouldRefreshCriticalData: Boolean,
        operation: SessionAuthOperation,
    ): AuthorizedSessionApplication {
        val result = resolveAuthorizedSession(principal) { environment ->
            applyResolvedEnvironmentIfCurrent(operation, environment)
        }
        if (!isCurrentSessionOperation(operation)) {
            return abandonStaleAuthorizedSession()
        }
        return when (result) {
            is AccessResolutionResult.Authorized -> {
                val members = memberRepository.getMembersVisibleTo(result.member)
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                val allNotifications = notificationRepository.getNotificationsFor(result.member)
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                val readNotificationIds = notificationRepository.getReadNotificationIds(result.member.id)
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                val products = productRepository.getProductsForVendor(result.member.id)
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                val sharedProfiles = sharedProfileRepository.getAllSharedProfiles()
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                val ownSharedProfile = sharedProfiles.firstOrNull { it.userId == result.member.id }
                if (!updateUiStateIfCurrent(operation) {
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
                }) return abandonStaleAuthorizedSession()
                val allNews = newsRepository.getNewsFor(result.member)
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                if (!updateUiStateIfCurrent(operation) {
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
                }) return abandonStaleAuthorizedSession()
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                refreshShifts()
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                refreshDeliveryCalendar()
                if (!registerAuthorizedDevice(result.member, result.environment, operation)) {
                    return abandonStaleAuthorizedSession()
                }
                if (shouldRefreshCriticalData) {
                    if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                    refreshMyOrderFreshness()
                }
                if (isCurrentSessionOperation(operation)) {
                    AuthorizedSessionApplication.APPLIED
                } else {
                    abandonStaleAuthorizedSession()
                }
            }

            is AccessResolutionResult.Unauthorized -> {
                if (!invalidateSessionOperationIfCurrent(operation)) {
                    return abandonStaleAuthorizedSession()
                }
                authorizedDeviceRegistrar.clearAuthorizedSession()
                clearSessionRefreshTracking()
                sessionEnvironmentRouter.resetToBaseEnvironment()
                if (result.reason == UnauthorizedReason.EMAIL_NOT_VERIFIED) {
                    authSessionProvider.signOut()
                    uiState.update { state ->
                        state.toSignedOutSessionState(showSessionExpiredDialog = false).copy(
                            emailInput = principal.email,
                            emailErrorRes = R.string.auth_error_email_not_verified,
                        )
                    }
                    return AuthorizedSessionApplication.TERMINATED
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
                AuthorizedSessionApplication.TERMINATED
            }
        }
    }

    private suspend fun handleExpiredSession(operation: SessionAuthOperation) {
        if (!isCurrentSessionOperation(operation)) {
            closeStaleFirebaseAuthentication(operation)
            return
        }
        if (!invalidateSessionOperationIfCurrent(operation)) {
            closeStaleFirebaseAuthentication(operation)
            return
        }
        authorizedDeviceRegistrar.clearAuthorizedSession()
        clearSessionRefreshTracking()
        sessionEnvironmentRouter.resetToBaseEnvironment()
        uiState.update { state -> state.toSignedOutSessionState(showSessionExpiredDialog = true) }
        try {
            withContext(NonCancellable) {
                criticalDataFreshnessLocalRepository.clear()
            }
        } catch (_: Exception) {
            // Local cleanup must never delay or undo an already applied session termination.
        }
    }

    private fun clearSessionRefreshTracking() {
        setLastSessionRefreshAtMillis(null)
        isSessionRefreshInFlight.set(false)
    }

    private suspend fun registerAuthorizedDevice(
        member: Member,
        environment: String,
        operation: SessionAuthOperation,
    ): Boolean {
        if (!isCurrentSessionOperation(operation)) return false
        try {
            authorizedDeviceRegistrar.register(
                member = member,
                environment = environment,
                isSessionCurrent = { isCurrentSessionOperation(operation) },
            )
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // Device registration is best-effort and must not fail authorization.
        }
        return isCurrentSessionOperation(operation)
    }
}

private data class SessionAuthOperation(
    val generation: Long,
    val owner: Any,
    val predecessor: Job?,
    val kind: SessionAuthOperationKind,
    val expectedPrincipalUid: String?,
    val providerWasInvoked: AtomicBoolean = AtomicBoolean(false),
    val staleAuthenticationClosed: AtomicBoolean = AtomicBoolean(false),
    val terminalSessionApplied: AtomicBoolean = AtomicBoolean(false),
)

private enum class SessionAuthOperationKind {
    SIGN_IN,
    SIGN_UP,
    REFRESH,
    CLEANUP,
}

private val INTERACTIVE_SESSION_OPERATION_KINDS = setOf(
    SessionAuthOperationKind.SIGN_IN,
    SessionAuthOperationKind.SIGN_UP,
)

private enum class AuthorizedSessionApplication {
    APPLIED,
    TERMINATED,
    STALE,
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
