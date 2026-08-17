package com.reguerta.user.presentation.auth

import android.util.Log
import com.reguerta.user.presentation.root.CriticalDataRefreshConsumerReceipt
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
import com.reguerta.user.presentation.root.matchesCriticalDataRefreshConsumerReceipt

import com.reguerta.user.R
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
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
import com.reguerta.user.domain.access.canManageMembers
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.freshness.CriticalDataRefreshPayload
import com.reguerta.user.domain.freshness.CriticalDataRefreshScope
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.CriticalDataFreshnessMetadataWrite
import com.reguerta.user.domain.freshness.CriticalDataFreshnessResolution
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.profiles.SharedProfileRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import java.util.UUID

internal const val SESSION_AUTH_OPERATION_TIMEOUT_MILLIS = 30_000L

internal class SessionAuthActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val memberRepository: MemberRepository,
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
    private val refreshNews: () -> Unit,
    private val refreshNotifications: () -> Unit,
    private val refreshShifts: () -> Unit,
    private val refreshDeliveryCalendar: () -> Unit,
    private val refreshMyOrderConsumer: suspend (
        CriticalDataRefreshPayload,
        () -> Boolean,
    ) -> CriticalDataRefreshConsumerReceipt?,
    private val sessionOperationTimeoutMillis: Long = SESSION_AUTH_OPERATION_TIMEOUT_MILLIS,
) {
    init {
        require(sessionOperationTimeoutMillis > 0L) {
            "Session operation timeout must be positive"
        }
    }

    private val sessionOperationLock = Any()
    private var sessionOperationGeneration = 0L
    private var sessionOperationOwner: Any? = null
    private var sessionOperationJob: Job? = null
    private var sessionOperationKind: SessionAuthOperationKind? = null
    private val freshnessOperationLock = Any()
    private var freshnessOperationGeneration = 0L
    private var freshnessOperationJob: Job? = null

    fun signIn(password: String): Boolean {
        val currentState = uiState.value
        val email = currentState.emailInput.trim()

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
            return false
        }

        return launchSessionOperation(kind = SessionAuthOperationKind.SIGN_IN) { operation ->
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
                is AuthSignInResult.Success -> {
                    operation.authenticationSucceeded.set(true)
                    when (
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

    fun signUp(password: String, repeatedPassword: String): Boolean {
        val currentState = uiState.value
        val email = currentState.registerEmailInput.trim()

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
            return false
        }

        return launchSessionOperation(kind = SessionAuthOperationKind.SIGN_UP) { operation ->
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
        invalidateAuthorizedDeviceSessionSafely()
        cancelMyOrderFreshness()
        val cleanupJob = ownSessionTerminationCleanup {
            val authenticationAndRoutingClosed = closeAuthenticationAndRoutingSafely()
            val privateContextClosed = clearPrivateSessionContext()
            authenticationAndRoutingClosed && privateContextClosed
        }
        invalidateAuthorizedDeviceSessionSafely()
        closeAuthenticationAndRoutingSafely()
        clearSessionRefreshTracking()
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
            var completedSuccessfully = false
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
                completedSuccessfully = true
            } finally {
                finishRefreshIfCurrent(
                    operation = operation,
                    completedSuccessfully = completedSuccessfully,
                )
            }
        }
        if (!didLaunch) {
            isSessionRefreshInFlight.set(false)
        }
    }

    fun refreshMyOrderFreshness(): Long? {
        val state = uiState.value
        val currentMode = state.mode as? SessionMode.Authorized ?: return null
        val sessionEnvironment = state.sessionEnvironment ?: run {
            cancelMyOrderFreshness()
            uiState.update { current ->
                if (current.mode is SessionMode.Authorized) {
                    current.copy(
                        myOrderFreshnessState = MyOrderFreshnessUiState.Unavailable,
                        myOrderFreshnessGeneration = null,
                        myOrderFreshnessConsumerReceipt = null,
                    )
                } else {
                    current
                }
            }
            return null
        }
        lateinit var operation: FreshnessOperation
        lateinit var job: Job
        synchronized(freshnessOperationLock) {
            freshnessOperationJob?.cancel()
            freshnessOperationGeneration += 1
            operation = FreshnessOperation(
                generation = freshnessOperationGeneration,
                principalUid = currentMode.principal.uid,
                authenticatedMemberId = currentMode.authenticatedMember.id,
                authenticatedMemberAuthUid = currentMode.authenticatedMember.authUid,
                memberId = currentMode.member.id,
                canManageMembers = currentMode.authenticatedMember.canManageMembers,
                sessionEnvironment = sessionEnvironment,
                sessionEpoch = state.sessionEpoch,
            )
            job = scope.launch(start = CoroutineStart.LAZY) {
                runMyOrderFreshness(operation)
            }
            freshnessOperationJob = job
        }
        updateMyOrderFreshnessIfCurrent(operation, MyOrderFreshnessUiState.Checking)
        job.invokeOnCompletion { releaseFreshnessOperation(operation, job) }
        job.start()
        return operation.generation
    }

    private suspend fun runMyOrderFreshness(operation: FreshnessOperation) {
        if (!isCurrentFreshnessOperation(operation)) return
        var pendingWrite: CriticalDataFreshnessMetadataWrite? = null
        var completedReceipt: CriticalDataRefreshConsumerReceipt? = null
        try {
            val completedForCurrentSession = withTimeout(MY_ORDER_FRESHNESS_TIMEOUT_MILLIS) {
                val resolution = resolveCriticalDataFreshness(
                    scope = CriticalDataRefreshScope(
                        environment = operation.sessionEnvironment,
                        principalUid = operation.principalUid,
                        authenticatedMemberId = operation.authenticatedMemberId,
                        memberId = operation.memberId,
                        canManageMembers = operation.canManageMembers,
                    ),
                )
                if (!isCurrentFreshnessOperation(operation)) {
                    return@withTimeout false
                }
                when (resolution) {
                    is CriticalDataFreshnessResolution.Fresh -> {
                        val consumerReceipt = refreshMyOrderConsumer(
                            resolution.refreshedPayload,
                        ) {
                            isCurrentFreshnessOperation(operation)
                        }
                        if (resolution.refreshedPayload.requiresAccessScopeRetry) {
                            markFreshnessUnavailableAfterIdentityRefresh(operation)
                            return@withTimeout false
                        }
                        if (consumerReceipt == null) {
                            if (markFreshnessUnavailableForUpdatedAccessScope(operation)) {
                                return@withTimeout false
                            }
                            if (!isCurrentFreshnessOperation(operation)) {
                                return@withTimeout false
                            }
                            throw RepositoryException(
                                kind = RepositoryErrorKind.UNAVAILABLE,
                                resource = "criticalDataRefresh.consumer.superseded",
                            )
                        }
                        if (!isCurrentFreshnessOperation(operation)) {
                            markFreshnessUnavailableForUpdatedAccessScope(operation)
                            return@withTimeout false
                        }
                        if (!uiState.value.matchesCriticalDataRefreshConsumerReceipt(consumerReceipt)) {
                            throw RepositoryException(
                                kind = RepositoryErrorKind.UNAVAILABLE,
                                resource = "criticalDataRefresh.consumer.staleReceipt",
                            )
                        }
                        completedReceipt = consumerReceipt
                        resolution.metadataToPersist?.let { metadata ->
                            val write = CriticalDataFreshnessMetadataWrite(
                                id = UUID.randomUUID().toString(),
                                metadata = metadata,
                            )
                            pendingWrite = write
                            val didSave = criticalDataFreshnessLocalRepository.saveMetadataIfCurrent(
                                write = write,
                                isCurrent = {
                                    isCurrentFreshnessConsumerReceipt(operation, consumerReceipt)
                                },
                            )
                            if (!didSave) {
                                pendingWrite = null
                                if (isCurrentFreshnessOperation(operation)) {
                                    throw RepositoryException(
                                        kind = RepositoryErrorKind.UNAVAILABLE,
                                        resource = "criticalDataRefresh.consumer.staleReceipt",
                                    )
                                }
                                return@withTimeout false
                            }
                        }
                    }
                }
                isCurrentFreshnessConsumerReceipt(operation, completedReceipt)
            }
            if (completedForCurrentSession) {
                if (
                    updateMyOrderFreshnessIfCurrent(
                        operation = operation,
                        nextState = MyOrderFreshnessUiState.Ready,
                        requiredReceipt = completedReceipt,
                    )
                ) {
                    pendingWrite = null
                } else {
                    updateMyOrderFreshnessIfCurrent(
                        operation = operation,
                        nextState = MyOrderFreshnessUiState.Unavailable,
                    )
                }
            }
        } catch (_: TimeoutCancellationException) {
            updateMyOrderFreshnessIfCurrent(operation, MyOrderFreshnessUiState.TimedOut)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            updateMyOrderFreshnessIfCurrent(operation, MyOrderFreshnessUiState.Unavailable)
        } finally {
            pendingWrite?.let { write ->
                try {
                    withContext(NonCancellable) {
                        criticalDataFreshnessLocalRepository.rollbackMetadata(write)
                    }
                } catch (_: Exception) {
                    // A failed conditional rollback must not replace the original operation outcome.
                }
            }
        }
    }

    private fun updateMyOrderFreshnessIfCurrent(
        operation: FreshnessOperation,
        nextState: MyOrderFreshnessUiState,
        requiredReceipt: CriticalDataRefreshConsumerReceipt? = null,
    ): Boolean {
        uiState.update { state ->
            if (
                isCurrentFreshnessOperation(operation, state) &&
                (
                    requiredReceipt == null ||
                        state.matchesCriticalDataRefreshConsumerReceipt(requiredReceipt)
                )
            ) {
                state.copy(
                    myOrderFreshnessState = nextState,
                    myOrderFreshnessGeneration = operation.generation,
                    myOrderFreshnessConsumerReceipt = if (
                        nextState == MyOrderFreshnessUiState.Ready
                    ) {
                        requiredReceipt
                    } else {
                        null
                    },
                )
            } else {
                state
            }
        }
        return isCurrentFreshnessOperation(operation) &&
            (
                requiredReceipt == null ||
                    uiState.value.matchesCriticalDataRefreshConsumerReceipt(requiredReceipt)
            ) &&
            uiState.value.myOrderFreshnessState == nextState
    }

    private fun isCurrentFreshnessConsumerReceipt(
        operation: FreshnessOperation,
        receipt: CriticalDataRefreshConsumerReceipt,
        state: SessionUiState = uiState.value,
    ): Boolean = isCurrentFreshnessOperation(operation, state) &&
        state.matchesCriticalDataRefreshConsumerReceipt(receipt)

    private fun isCurrentFreshnessOperation(
        operation: FreshnessOperation,
        state: SessionUiState = uiState.value,
    ): Boolean {
        val currentMode = state.mode as? SessionMode.Authorized ?: return false
        val isCurrentGeneration = synchronized(freshnessOperationLock) {
            freshnessOperationGeneration == operation.generation
        }
        return isCurrentGeneration &&
            state.sessionEpoch == operation.sessionEpoch &&
            currentMode.principal.uid == operation.principalUid &&
            currentMode.authenticatedMember.id == operation.authenticatedMemberId &&
            currentMode.authenticatedMember.authUid == operation.authenticatedMemberAuthUid &&
            currentMode.member.id == operation.memberId &&
            currentMode.authenticatedMember.canManageMembers == operation.canManageMembers &&
            state.sessionEnvironment == operation.sessionEnvironment
    }

    private fun markFreshnessUnavailableForUpdatedAccessScope(
        operation: FreshnessOperation,
    ): Boolean {
        var didUpdate = false
        uiState.update { state ->
            if (hasUpdatedAccessScopeForCurrentFreshnessOperation(operation, state)) {
                didUpdate = true
                state.copy(
                    myOrderFreshnessState = MyOrderFreshnessUiState.Unavailable,
                    myOrderFreshnessGeneration = operation.generation,
                    myOrderFreshnessConsumerReceipt = null,
                )
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun markFreshnessUnavailableAfterIdentityRefresh(
        operation: FreshnessOperation,
    ): Boolean {
        var didUpdate = false
        uiState.update { state ->
            if (hasCurrentFreshnessIdentity(operation, state)) {
                didUpdate = true
                state.copy(
                    myOrderFreshnessState = MyOrderFreshnessUiState.Unavailable,
                    myOrderFreshnessGeneration = operation.generation,
                    myOrderFreshnessConsumerReceipt = null,
                )
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun hasUpdatedAccessScopeForCurrentFreshnessOperation(
        operation: FreshnessOperation,
        state: SessionUiState = uiState.value,
    ): Boolean {
        val currentMode = state.mode as? SessionMode.Authorized ?: return false
        return hasCurrentFreshnessIdentity(operation, state) &&
            (
                currentMode.member.id != operation.memberId ||
                    currentMode.authenticatedMember.canManageMembers != operation.canManageMembers
            )
    }

    private fun hasCurrentFreshnessIdentity(
        operation: FreshnessOperation,
        state: SessionUiState = uiState.value,
    ): Boolean {
        val currentMode = state.mode as? SessionMode.Authorized ?: return false
        val isCurrentGeneration = synchronized(freshnessOperationLock) {
            freshnessOperationGeneration == operation.generation
        }
        return isCurrentGeneration &&
            state.sessionEpoch == operation.sessionEpoch &&
            currentMode.principal.uid == operation.principalUid &&
            currentMode.authenticatedMember.id == operation.authenticatedMemberId &&
            currentMode.authenticatedMember.authUid == operation.authenticatedMemberAuthUid &&
            state.sessionEnvironment == operation.sessionEnvironment
    }

    private fun cancelMyOrderFreshness() {
        synchronized(freshnessOperationLock) {
            freshnessOperationGeneration += 1
            freshnessOperationJob?.cancel()
            freshnessOperationJob = null
        }
    }

    private fun releaseFreshnessOperation(operation: FreshnessOperation, job: Job) {
        synchronized(freshnessOperationLock) {
            if (
                freshnessOperationGeneration == operation.generation &&
                freshnessOperationJob === job
            ) {
                freshnessOperationJob = null
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
            if (sessionOperationKind == SessionAuthOperationKind.DRAINING) {
                publishDrainingSessionOperationError(kind)
                return false
            }
            if (
                sessionOperationJob != null &&
                (kind in INTERACTIVE_SESSION_OPERATION_KINDS || kind == SessionAuthOperationKind.REFRESH)
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
                    startSessionOperationDeadline(operation, job)
                    block(operation)
                    claimSessionOperationResult(operation)
                } catch (_: CancellationException) {
                    // Cancellation from a successor or the deadline is stale by definition.
                    // Definitive cleanup runs below without publishing from the cancelled owner.
                } catch (_: Exception) {
                    if (isCurrentSessionOperation(operation)) {
                        recoverCurrentSessionOperation(operation, job)
                    }
                } finally {
                    if (!operation.deadlineTriggered.get()) {
                        operation.deadlineJob.getAndSet(null)?.cancel()
                    }
                    if (operation.deadlineClaim.outcome == SessionOperationDeadlineOutcome.DRAINING) {
                        withContext(NonCancellable) {
                            operation.drainCleanupCompleted.await()
                        }
                    }
                    if (!operation.providerWasInvoked.get()) {
                        operation.definitiveCleanupConfirmed.set(true)
                    }
                    if (
                        operation.providerWasInvoked.get() &&
                        !isCurrentSessionOperation(operation) &&
                        !operation.terminalSessionApplied.get()
                    ) {
                        withContext(NonCancellable) {
                            closeStaleFirebaseAuthentication(operation)
                        }
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

    private fun startSessionOperationDeadline(
        operation: SessionAuthOperation,
        operationJob: Job,
    ) {
        val deadlineJob = scope.launch {
            delay(sessionOperationTimeoutMillis)
            handleSessionOperationDeadline(operation, operationJob)
        }
        operation.deadlineJob.set(deadlineJob)
    }

    private fun claimSessionOperationResult(operation: SessionAuthOperation) {
        synchronized(sessionOperationLock) {
            operation.deadlineClaim.claimResult()
        }
    }

    private suspend fun handleSessionOperationDeadline(
        operation: SessionAuthOperation,
        operationJob: Job,
    ) {
        val drainingOperation = synchronized(sessionOperationLock) {
            val activeKind = sessionOperationKind
            val activeJob = sessionOperationJob
            if (
                operationJob.isCompleted ||
                activeKind == null ||
                activeKind !in ACTIVE_SESSION_OPERATION_KINDS ||
                activeJob !== operationJob ||
                sessionOperationGeneration != operation.generation ||
                sessionOperationOwner !== operation.owner ||
                !operation.deadlineClaim.claimDraining()
            ) {
                null
            } else {
                operation.deadlineTriggered.set(true)
                sessionOperationGeneration += 1
                sessionOperationOwner = null
                sessionOperationKind = SessionAuthOperationKind.DRAINING
                isSessionRefreshInFlight.set(false)
                SessionOperationDrain(
                    kind = checkNotNull(activeKind),
                    laneJob = activeJob,
                )
            }
        } ?: return

        recoverSessionUi(drainingOperation.kind)
        drainingOperation.laneJob.cancel(
            CancellationException("Session operation exceeded its UI deadline"),
        )
        performPreliminarySessionCleanup(operation)
    }

    private suspend fun recoverCurrentSessionOperation(
        operation: SessionAuthOperation,
        operationJob: Job,
    ) {
        val didBeginDraining = synchronized(sessionOperationLock) {
            if (
                sessionOperationGeneration != operation.generation ||
                sessionOperationOwner !== operation.owner ||
                sessionOperationJob !== operationJob ||
                !operation.deadlineClaim.claimDraining()
            ) {
                false
            } else {
                sessionOperationGeneration += 1
                sessionOperationOwner = null
                sessionOperationKind = SessionAuthOperationKind.DRAINING
                isSessionRefreshInFlight.set(false)
                true
            }
        }
        if (!didBeginDraining) return

        recoverSessionUi(
            kind = operation.kind,
            authenticationSucceeded = operation.authenticationSucceeded.get(),
        )
        performPreliminarySessionCleanup(operation)
    }

    private fun recoverSessionUi(
        kind: SessionAuthOperationKind,
        authenticationSucceeded: Boolean = false,
    ) {
        invalidateAuthorizedDeviceSessionSafely()
        cancelMyOrderFreshness()
        clearSessionRefreshTracking()
        uiState.update { state ->
            val knownEmail = (state.mode as? SessionMode.Authorized)
                ?.principal
                ?.email
                ?.takeIf(String::isNotBlank)
                ?: state.emailInput
            val registrationEmail = state.registerEmailInput
            state.toSignedOutSessionState(showSessionExpiredDialog = false).copy(
                emailInput = knownEmail,
                emailErrorRes = when {
                    kind == SessionAuthOperationKind.SIGN_UP -> null
                    kind == SessionAuthOperationKind.SIGN_IN && authenticationSucceeded -> {
                        R.string.auth_error_session_data
                    }
                    else -> R.string.auth_error_unknown
                },
                registerEmailInput = if (kind == SessionAuthOperationKind.SIGN_UP) {
                    registrationEmail
                } else {
                    ""
                },
                registerEmailErrorRes = if (kind == SessionAuthOperationKind.SIGN_UP) {
                    R.string.auth_error_register_generic
                } else {
                    null
                },
            )
        }
    }

    private fun publishDrainingSessionOperationError(kind: SessionAuthOperationKind) {
        uiState.update { state ->
            when (kind) {
                SessionAuthOperationKind.SIGN_IN -> state.copy(
                    emailErrorRes = R.string.auth_error_unknown,
                )

                SessionAuthOperationKind.SIGN_UP -> state.copy(
                    registerEmailErrorRes = R.string.auth_error_register_generic,
                )

                SessionAuthOperationKind.REFRESH,
                SessionAuthOperationKind.DRAINING,
                SessionAuthOperationKind.CLEANUP,
                    -> state
            }
        }
    }

    private suspend fun performPreliminarySessionCleanup(operation: SessionAuthOperation) {
        try {
            withContext(NonCancellable) {
                closeAuthenticationAndRoutingSafely()
                clearPrivateSessionContext()
            }
        } finally {
            operation.drainCleanupCompleted.complete(Unit)
        }
    }

    private fun ownSessionTerminationCleanup(block: suspend () -> Boolean): Job {
        lateinit var cleanupJob: Job
        val cleanupConfirmed = AtomicBoolean(false)
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
                    cleanupConfirmed.set(block())
                }
            }
            sessionOperationJob = cleanupJob
            sessionOperationKind = SessionAuthOperationKind.CLEANUP
        }
        cleanupJob.invokeOnCompletion {
            synchronized(sessionOperationLock) {
                if (sessionOperationJob === cleanupJob) {
                    if (cleanupConfirmed.get()) {
                        sessionOperationJob = null
                        sessionOperationKind = null
                    } else {
                        sessionOperationKind = SessionAuthOperationKind.DRAINING
                    }
                }
            }
        }
        return cleanupJob
    }

    private fun releaseSessionOperation(operation: SessionAuthOperation, job: Job) {
        synchronized(sessionOperationLock) {
            val mustRemainQuarantined =
                sessionOperationKind == SessionAuthOperationKind.DRAINING &&
                    !operation.definitiveCleanupConfirmed.get()
            if (sessionOperationJob === job && !mustRemainQuarantined) {
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
            invalidateAuthorizedDeviceSessionSafely()
            sessionEnvironmentRouter.applyResolvedEnvironment(environment)
            if (
                sessionOperationGeneration != operation.generation ||
                sessionOperationOwner !== operation.owner
            ) {
                throw CancellationException("Session operation was superseded during routing")
            }
            uiState.update { state ->
                if (state.sessionEnvironment != environment) {
                    state.clearCommunitySessionState().copy(
                        sessionEpoch = state.sessionEpoch + 1,
                    )
                } else {
                    state
                }
            }
        }
    }

    private fun completeTerminalSessionOperationIfCurrent(
        operation: SessionAuthOperation,
        cleanupConfirmed: Boolean,
    ): Boolean =
        synchronized(sessionOperationLock) {
            if (
                sessionOperationGeneration != operation.generation ||
                sessionOperationOwner !== operation.owner
            ) {
                false
            } else {
                operation.terminalSessionApplied.set(true)
                operation.definitiveCleanupConfirmed.set(cleanupConfirmed)
                sessionOperationGeneration += 1
                sessionOperationOwner = null
                isSessionRefreshInFlight.set(false)
                if (!cleanupConfirmed) {
                    operation.deadlineClaim.claimDraining()
                    operation.drainCleanupCompleted.complete(Unit)
                    sessionOperationKind = SessionAuthOperationKind.DRAINING
                }
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

    private fun finishRefreshIfCurrent(
        operation: SessionAuthOperation,
        completedSuccessfully: Boolean,
    ) {
        synchronized(sessionOperationLock) {
            if (
                sessionOperationGeneration == operation.generation &&
                sessionOperationOwner === operation.owner
            ) {
                if (completedSuccessfully) {
                    setLastSessionRefreshAtMillis(nowMillisProvider())
                }
                isSessionRefreshInFlight.set(false)
            }
        }
    }

    private fun abandonStaleAuthorizedSession(): AuthorizedSessionApplication {
        return AuthorizedSessionApplication.STALE
    }

    private suspend fun closeStaleFirebaseAuthentication(operation: SessionAuthOperation) {
        if (operation.staleAuthenticationClosed.get()) return
        withContext(NonCancellable) {
            if (operation.staleAuthenticationClosed.get()) return@withContext
            val authenticationAndRoutingClosed = closeAuthenticationAndRoutingSafely()
            val privateContextClosed = clearPrivateSessionContext()
            val cleanupConfirmed = authenticationAndRoutingClosed && privateContextClosed
            operation.definitiveCleanupConfirmed.set(cleanupConfirmed)
            if (cleanupConfirmed) {
                operation.staleAuthenticationClosed.set(true)
            }
        }
    }

    private fun closeAuthenticationAndRoutingSafely(): Boolean {
        val authenticationClosed = try {
            authSessionProvider.signOut()
            true
        } catch (_: Exception) {
            false
        }
        val routingReset = try {
            sessionEnvironmentRouter.resetToBaseEnvironment()
            true
        } catch (_: Exception) {
            false
        }
        return authenticationClosed && routingReset
    }

    private suspend fun clearPrivateSessionContext(): Boolean {
        val deviceContextClosed = try {
            authorizedDeviceRegistrar.clearAuthorizedSession()
            true
        } catch (_: Exception) {
            false
        }
        val localFreshnessClosed = try {
            criticalDataFreshnessLocalRepository.clear()
            true
        } catch (_: Exception) {
            false
        }
        return deviceContextClosed && localFreshnessClosed
    }

    private fun invalidateAuthorizedDeviceSessionSafely(): Boolean =
        try {
            authorizedDeviceRegistrar.invalidateAuthorizedSession()
            true
        } catch (_: Exception) {
            false
        }

    private fun resetSessionRoutingSafely(): Boolean =
        try {
            sessionEnvironmentRouter.resetToBaseEnvironment()
            true
        } catch (_: Exception) {
            false
        }

    private suspend fun terminateCurrentSession(
        operation: SessionAuthOperation,
        closeAuthentication: Boolean,
        transformUiState: (SessionUiState) -> SessionUiState,
    ): AuthorizedSessionApplication {
        if (!isCurrentSessionOperation(operation)) {
            return abandonStaleAuthorizedSession()
        }

        invalidateAuthorizedDeviceSessionSafely()
        cancelMyOrderFreshness()
        clearSessionRefreshTracking()
        if (!updateUiStateIfCurrent(operation, transformUiState)) {
            return abandonStaleAuthorizedSession()
        }

        val cleanupConfirmed = withContext(NonCancellable) {
            val authenticationAndRoutingClosed = if (closeAuthentication) {
                closeAuthenticationAndRoutingSafely()
            } else {
                resetSessionRoutingSafely()
            }
            val privateContextClosed = clearPrivateSessionContext()
            authenticationAndRoutingClosed && privateContextClosed
        }

        if (!completeTerminalSessionOperationIfCurrent(operation, cleanupConfirmed)) {
            if (cleanupConfirmed && closeAuthentication) {
                operation.definitiveCleanupConfirmed.set(true)
                operation.staleAuthenticationClosed.set(true)
            }
            return abandonStaleAuthorizedSession()
        }
        return AuthorizedSessionApplication.TERMINATED
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
                val products = productRepository.getProductsForVendor(result.member.id)
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                val sharedProfiles = sharedProfileRepository.getAllSharedProfiles()
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                val ownSharedProfile = sharedProfiles.firstOrNull { it.userId == result.member.id }
                var refreshCriticalDataForAppliedSession = shouldRefreshCriticalData
                if (!updateUiStateIfCurrent(operation) {
                    val currentMode = it.mode as? SessionMode.Authorized
                    val accessTransition = resolveAuthorizedSessionAccessTransition(
                        currentMode = currentMode,
                        currentEnvironment = it.sessionEnvironment,
                        principal = principal,
                        member = result.member,
                        resolvedEnvironment = result.environment,
                    )
                    refreshCriticalDataForAppliedSession =
                        refreshCriticalDataForAppliedSession || accessTransition.invalidatesSessionContext
                    val productState = it.resetProductEditorUnlessAuthorizedRefreshCanPreserve(
                        principalUid = principal.uid,
                        member = result.member,
                    )
                    productState
                        .reconcileAuthorizedShiftState(accessTransition)
                        .clearCommunitySessionStateIfInvalidated(accessTransition)
                        .copy(
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
                            myOrderFreshnessState = if (refreshCriticalDataForAppliedSession) {
                                MyOrderFreshnessUiState.Checking
                            } else {
                                it.myOrderFreshnessState
                            },
                            myOrderFreshnessGeneration = if (refreshCriticalDataForAppliedSession) {
                                null
                            } else {
                                it.myOrderFreshnessGeneration
                            },
                            myOrderFreshnessConsumerReceipt = if (refreshCriticalDataForAppliedSession) {
                                null
                            } else {
                                it.myOrderFreshnessConsumerReceipt
                            },
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
                            isUploadingNewsImage = false,
                            isUploadingSharedProfileImage = false,
                            isLoadingSharedProfiles = false,
                        )
                }) return abandonStaleAuthorizedSession()
                if (refreshCriticalDataForAppliedSession) {
                    cancelMyOrderFreshness()
                }
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                launchCommunityRefreshes()
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                refreshShifts()
                if (!isCurrentSessionOperation(operation)) return abandonStaleAuthorizedSession()
                refreshDeliveryCalendar()
                if (!registerAuthorizedDevice(result.member, result.environment, operation)) {
                    return abandonStaleAuthorizedSession()
                }
                if (refreshCriticalDataForAppliedSession) {
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
                if (result.reason == UnauthorizedReason.EMAIL_NOT_VERIFIED) {
                    return terminateCurrentSession(
                        operation = operation,
                        closeAuthentication = true,
                    ) { state ->
                        state.toSignedOutSessionState(showSessionExpiredDialog = false).copy(
                            emailInput = principal.email,
                            emailErrorRes = R.string.auth_error_email_not_verified,
                        )
                    }
                }
                val showUnauthorizedDialog = shouldShowUnauthorizedDialog(
                    currentMode = uiState.value.mode,
                    email = principal.email,
                    reason = result.reason,
                )
                terminateCurrentSession(
                    operation = operation,
                    closeAuthentication = false,
                ) { state ->
                    state.toUnauthorizedSessionState(
                        email = principal.email,
                        reason = result.reason,
                        showUnauthorizedDialog = showUnauthorizedDialog,
                    )
                }
            }
        }
    }

    private fun launchCommunityRefreshes() {
        try {
            refreshNews()
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (_: Exception) {
            // Community feeds are recoverable and must not revoke an authorized session.
        }
        try {
            refreshNotifications()
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (_: Exception) {
            // The fenced feed action owns user feedback and retry.
        }
    }

    private suspend fun handleExpiredSession(operation: SessionAuthOperation) {
        val result = terminateCurrentSession(
            operation = operation,
            closeAuthentication = true,
        ) { state ->
            state.toSignedOutSessionState(showSessionExpiredDialog = true)
        }
        if (result == AuthorizedSessionApplication.STALE) {
            closeStaleFirebaseAuthentication(operation)
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
            Log.e("SessionAuthActions", "Authorized device registration failed")
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
    val authenticationSucceeded: AtomicBoolean = AtomicBoolean(false),
    val staleAuthenticationClosed: AtomicBoolean = AtomicBoolean(false),
    val terminalSessionApplied: AtomicBoolean = AtomicBoolean(false),
    val deadlineClaim: SessionOperationDeadlineClaim = SessionOperationDeadlineClaim(),
    val deadlineTriggered: AtomicBoolean = AtomicBoolean(false),
    val deadlineJob: AtomicReference<Job?> = AtomicReference(null),
    val drainCleanupCompleted: CompletableDeferred<Unit> = CompletableDeferred(),
    val definitiveCleanupConfirmed: AtomicBoolean = AtomicBoolean(false),
)

internal class SessionOperationDeadlineClaim {
    private val state = AtomicReference(SessionOperationDeadlineOutcome.ACTIVE)

    val outcome: SessionOperationDeadlineOutcome
        get() = state.get()

    fun claimResult(): Boolean = state.compareAndSet(
        SessionOperationDeadlineOutcome.ACTIVE,
        SessionOperationDeadlineOutcome.RESULT,
    )

    fun claimDraining(): Boolean = state.compareAndSet(
        SessionOperationDeadlineOutcome.ACTIVE,
        SessionOperationDeadlineOutcome.DRAINING,
    )
}

internal enum class SessionOperationDeadlineOutcome {
    ACTIVE,
    RESULT,
    DRAINING,
}

private data class SessionOperationDrain(
    val kind: SessionAuthOperationKind,
    val laneJob: Job,
)

private data class FreshnessOperation(
    val generation: Long,
    val principalUid: String,
    val authenticatedMemberId: String,
    val authenticatedMemberAuthUid: String?,
    val memberId: String,
    val canManageMembers: Boolean,
    val sessionEnvironment: String,
    val sessionEpoch: Long,
)

private enum class SessionAuthOperationKind {
    SIGN_IN,
    SIGN_UP,
    REFRESH,
    DRAINING,
    CLEANUP,
}

private val INTERACTIVE_SESSION_OPERATION_KINDS = setOf(
    SessionAuthOperationKind.SIGN_IN,
    SessionAuthOperationKind.SIGN_UP,
)

private val ACTIVE_SESSION_OPERATION_KINDS = setOf(
    SessionAuthOperationKind.SIGN_IN,
    SessionAuthOperationKind.SIGN_UP,
    SessionAuthOperationKind.REFRESH,
)

private enum class AuthorizedSessionApplication {
    APPLIED,
    TERMINATED,
    STALE,
}

internal data class AuthorizedSessionAccessTransition(
    val sameProductIdentity: Boolean,
    val accessCapabilitiesChanged: Boolean,
    val rolesChanged: Boolean,
    val adminAccessChanged: Boolean,
    val environmentChanged: Boolean,
) {
    val invalidatesSessionContext: Boolean
        get() = !sameProductIdentity || accessCapabilitiesChanged || rolesChanged || environmentChanged

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
    val rolesChanged = currentMode?.member?.roles?.let { previousRoles ->
        previousRoles != member.roles
    } ?: false
    val adminAccessChanged = currentMode?.member?.isAdmin?.let { wasAdmin ->
        wasAdmin != member.isAdmin
    } ?: false
    val environmentChanged = currentEnvironment != resolvedEnvironment
    return AuthorizedSessionAccessTransition(
        sameProductIdentity = sameProductIdentity,
        accessCapabilitiesChanged = accessCapabilitiesChanged,
        rolesChanged = rolesChanged,
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
