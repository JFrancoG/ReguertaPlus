package com.reguerta.user.presentation.auth

import com.reguerta.user.data.freshness.requiringPrincipal
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.AuthPasswordResetResult
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.AuthSessionProvider
import com.reguerta.user.domain.access.AuthSessionRefreshResult
import com.reguerta.user.domain.access.AuthSignInFailureReason
import com.reguerta.user.domain.access.AuthSignInResult
import com.reguerta.user.domain.access.AuthorizedMemberResolution
import com.reguerta.user.domain.access.AuthorizedMemberResolver
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.canManageMembers
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionEnvironmentRouter
import com.reguerta.user.domain.access.SessionRefreshPolicy
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.freshness.CriticalCollection
import com.reguerta.user.domain.freshness.CriticalDataRefreshPayload
import com.reguerta.user.domain.freshness.CriticalDataRefreshScope
import com.reguerta.user.domain.freshness.CriticalDataRefresher
import com.reguerta.user.domain.freshness.CriticalDataFreshnessConfig
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.CriticalDataFreshnessMetadata
import com.reguerta.user.domain.freshness.CriticalDataFreshnessMetadataWrite
import com.reguerta.user.domain.freshness.CriticalDataFreshnessRemoteRepository
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import com.reguerta.user.presentation.root.MyOrderFreshnessUiState
import com.reguerta.user.presentation.root.NewsDraft
import com.reguerta.user.presentation.root.NotificationDraft
import com.reguerta.user.presentation.root.MY_ORDER_FRESHNESS_TIMEOUT_MILLIS
import com.reguerta.user.presentation.root.CriticalDataRefreshConsumerReceipt
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.criticalDataRefreshConsumerReceipt
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionAuthActionsConcurrencyTest {
    @Test
    fun `result and deadline claims have exactly one winner under concurrent execution`() {
        repeat(50) {
            val claim = SessionOperationDeadlineClaim()
            val ready = CountDownLatch(2)
            val start = CountDownLatch(1)
            val resultWon = AtomicBoolean(false)
            val deadlineWon = AtomicBoolean(false)
            val resultThread = thread(isDaemon = true) {
                ready.countDown()
                start.await()
                resultWon.set(claim.claimResult())
            }
            val deadlineThread = thread(isDaemon = true) {
                ready.countDown()
                start.await()
                deadlineWon.set(claim.claimDraining())
            }

            ready.await()
            start.countDown()
            resultThread.join()
            deadlineThread.join()

            assertEquals(1, listOf(resultWon.get(), deadlineWon.get()).count { it })
            assertEquals(
                if (resultWon.get()) {
                    SessionOperationDeadlineOutcome.RESULT
                } else {
                    SessionOperationDeadlineOutcome.DRAINING
                },
                claim.outcome,
            )
        }
    }

    @Test
    fun `current sign in exception recovers the login instead of escaping`() = runTest {
        val providerError = CompletableDeferred<Throwable>()
        val authProvider = ControlledAuthSessionProvider(lateSignInError = providerError)
        val fixture = fixture(scope = this, authProvider = authProvider)

        assertTrue(fixture.actions.signIn("secret123"))
        runCurrent()

        providerError.complete(IOException("current provider failure"))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertFalse(fixture.state.value.isAuthenticating)
        assertEquals(
            com.reguerta.user.R.string.auth_error_unknown,
            fixture.state.value.emailErrorRes,
        )
        assertEquals("member@reguerta.app", fixture.state.value.emailInput)
        assertEquals(2, authProvider.signOutRequests)
    }

    @Test
    fun `member loading failure after authentication reports account data instead of credentials`() = runTest {
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(AuthSignInResult.Success(principal("member-data-failure"))),
            ),
        )
        val memberRepository = TestMemberRepository(
            visibleMembersError = RepositoryException(
                kind = RepositoryErrorKind.INVALID_DATA,
                resource = "members.document",
            ),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            memberRepository = memberRepository,
        )

        assertTrue(fixture.actions.signIn("secret123"))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertFalse(fixture.state.value.isAuthenticating)
        assertEquals(
            com.reguerta.user.R.string.auth_error_session_data,
            fixture.state.value.emailErrorRes,
        )
        assertEquals(2, authProvider.signOutRequests)
    }

    @Test
    fun `interactive submit is rejected while another session operation owns the lane`() = runTest {
        val predecessorResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(predecessorResult),
        )
        val fixture = fixture(scope = this, authProvider = authProvider)

        assertTrue(fixture.actions.signIn("secret123"))
        runCurrent()

        fixture.state.value = fixture.state.value.copy(emailInput = "waiting@reguerta.app")
        assertFalse(fixture.actions.signIn("waiting-secret"))
        runCurrent()
        assertEquals(1, authProvider.signInRequests.size)

        predecessorResult.complete(AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK))
        advanceUntilIdle()
        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
    }

    @Test
    fun `sign in deadline drains non cancellable work before accepting a later login`() = runTest {
        val timedOutResult = CompletableDeferred<AuthSignInResult>()
        val cleanupStarted = CompletableDeferred<Unit>()
        val cleanupRelease = CompletableDeferred<Unit>()
        val localFreshnessRepository = TestCriticalDataFreshnessLocalRepository(
            clearStarted = cleanupStarted,
            clearRelease = cleanupRelease,
        )
        val laterResult = CompletableDeferred<AuthSignInResult>(
            AuthSignInResult.Success(principal("after-timeout")),
        )
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(timedOutResult, laterResult),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            localFreshnessRepository = localFreshnessRepository,
        )

        assertTrue(fixture.actions.signIn("secret123"))
        runCurrent()

        advanceTimeBy(TEST_SESSION_OPERATION_TIMEOUT_MILLIS - 1)
        runCurrent()
        assertTrue(fixture.state.value.isAuthenticating)
        assertEquals(0, authProvider.signOutRequests)

        advanceTimeBy(1)
        runCurrent()
        cleanupStarted.await()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertFalse(fixture.state.value.isAuthenticating)
        assertFalse(fixture.state.value.showSessionExpiredDialog)
        assertEquals(
            com.reguerta.user.R.string.auth_error_unknown,
            fixture.state.value.emailErrorRes,
        )
        assertEquals(1, authProvider.signOutRequests)
        assertEquals(1, fixture.deviceRegistrar.clearRequests)
        assertEquals(1, fixture.localFreshnessRepository.clearRequests)
        assertEquals(0, fixture.localFreshnessRepository.completedClearRequests)

        fixture.state.value = fixture.state.value.copy(
            emailInput = "later@reguerta.app",
            emailErrorRes = null,
        )
        assertFalse(fixture.actions.signIn("later-secret"))
        assertEquals(
            com.reguerta.user.R.string.auth_error_unknown,
            fixture.state.value.emailErrorRes,
        )
        assertEquals(1, authProvider.signInRequests.size)

        timedOutResult.complete(AuthSignInResult.Success(principal("too-late")))
        runCurrent()

        assertFalse(fixture.actions.signIn("still-draining-secret"))
        cleanupRelease.complete(Unit)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(2, authProvider.signOutRequests)
        assertEquals(2, fixture.deviceRegistrar.clearRequests)
        assertEquals(2, fixture.localFreshnessRepository.clearRequests)
        assertEquals(2, fixture.localFreshnessRepository.completedClearRequests)

        assertTrue(fixture.actions.signIn("later-secret"))
        advanceUntilIdle()

        val mode = fixture.state.value.mode as SessionMode.Authorized
        assertEquals("uid-after-timeout", mode.principal.uid)
        assertEquals(listOf("member", "later"), authProvider.signInRequests.map { it.email.substringBefore('@') })
    }

    @Test
    fun `refresh deadline fails closed without expired dialog or success timestamp`() = runTest {
        val principal = principal("refresh-timeout")
        val refreshResult = CompletableDeferred<AuthSessionRefreshResult>()
        val authProvider = ControlledAuthSessionProvider(refreshResult = refreshResult)
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)).copy(emailInput = principal.email),
            authProvider = authProvider,
        )

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        runCurrent()

        advanceTimeBy(TEST_SESSION_OPERATION_TIMEOUT_MILLIS)
        runCurrent()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertFalse(fixture.state.value.showSessionExpiredDialog)
        assertEquals(principal.email, fixture.state.value.emailInput)
        assertEquals(
            com.reguerta.user.R.string.auth_error_unknown,
            fixture.state.value.emailErrorRes,
        )
        assertFalse(fixture.isRefreshInFlight)
        assertEquals(null, fixture.lastRefreshAtMillis)

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        runCurrent()
        assertEquals(1, authProvider.refreshRequests)

        refreshResult.complete(AuthSessionRefreshResult.Active(principal))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(null, fixture.lastRefreshAtMillis)
        assertEquals(2, authProvider.signOutRequests)
    }

    @Test
    fun `sign up deadline recovers registration and preserves its email`() = runTest {
        val signUpResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signUpResults = listOf(signUpResult))
        val fixture = fixture(
            scope = this,
            state = registrationState(),
            authProvider = authProvider,
        )

        assertTrue(fixture.actions.signUp("secret123", "secret123"))
        runCurrent()
        advanceTimeBy(TEST_SESSION_OPERATION_TIMEOUT_MILLIS)
        runCurrent()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals("member@reguerta.app", fixture.state.value.registerEmailInput)
        assertEquals(
            com.reguerta.user.R.string.auth_error_register_generic,
            fixture.state.value.registerEmailErrorRes,
        )
        assertFalse(fixture.state.value.isRegistering)
        assertEquals(1, authProvider.signOutRequests)

        signUpResult.complete(AuthSignInResult.Success(principal("late-sign-up-timeout")))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(2, authProvider.signOutRequests)
    }

    @Test
    fun `failed definitive sign out keeps the completed operation quarantined`() = runTest {
        val timedOutResult = CompletableDeferred<AuthSignInResult>()
        val rejectedResult = CompletableDeferred<AuthSignInResult>(
            AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK),
        )
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(timedOutResult, rejectedResult),
            signOutErrors = listOf(
                null,
                IOException("definitive sign out failed"),
                IOException("definitive sign out retry failed"),
            ),
        )
        val fixture = fixture(scope = this, authProvider = authProvider)

        assertTrue(fixture.actions.signIn("secret123"))
        runCurrent()
        advanceTimeBy(TEST_SESSION_OPERATION_TIMEOUT_MILLIS)
        runCurrent()

        timedOutResult.complete(AuthSignInResult.Success(principal("late-after-failed-cleanup")))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(3, authProvider.signOutRequests)
        fixture.state.value = fixture.state.value.copy(emailInput = "blocked@reguerta.app")
        assertFalse(fixture.actions.signIn("blocked-secret"))
        assertEquals(1, authProvider.signInRequests.size)
    }

    @Test
    fun `failed definitive private cleanup keeps the completed operation quarantined`() = runTest {
        val timedOutResult = CompletableDeferred<AuthSignInResult>()
        val rejectedResult = CompletableDeferred<AuthSignInResult>(
            AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK),
        )
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(timedOutResult, rejectedResult),
        )
        val deviceRegistrar = TestAuthorizedDeviceRegistrar(
            clearErrors = listOf(
                null,
                IOException("definitive device cleanup failed"),
                IOException("definitive device cleanup retry failed"),
            ),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            deviceRegistrar = deviceRegistrar,
        )

        assertTrue(fixture.actions.signIn("secret123"))
        runCurrent()
        advanceTimeBy(TEST_SESSION_OPERATION_TIMEOUT_MILLIS)
        runCurrent()

        timedOutResult.complete(AuthSignInResult.Success(principal("late-after-private-cleanup")))
        advanceUntilIdle()

        assertEquals(3, authProvider.signOutRequests)
        assertEquals(3, deviceRegistrar.clearRequests)
        assertEquals(3, fixture.localFreshnessRepository.completedClearRequests)
        fixture.state.value = fixture.state.value.copy(emailInput = "blocked@reguerta.app")
        assertFalse(fixture.actions.signIn("blocked-secret"))
        assertEquals(1, authProvider.signInRequests.size)
    }

    @Test
    fun `sign out failure still clears local state and retains quarantine`() = runTest {
        val principal = principal("manual-sign-out-failure")
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK)),
            ),
            signOutErrors = listOf(
                IOException("preliminary sign out failed"),
                IOException("definitive sign out failed"),
            ),
        )
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = authProvider,
        )

        fixture.actions.signOut()
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(2, authProvider.signOutRequests)
        assertTrue(fixture.deviceRegistrar.clearRequests >= 1)
        assertTrue(fixture.localFreshnessRepository.completedClearRequests >= 1)
        fixture.state.value = fixture.state.value.copy(emailInput = "blocked@reguerta.app")
        assertFalse(fixture.actions.signIn("blocked-secret"))
        assertTrue(authProvider.signInRequests.isEmpty())
    }

    @Test
    fun `refresh during failing sign out cleanup is ignored and quarantine remains`() = runTest {
        val cleanupStarted = CompletableDeferred<Unit>()
        val cleanupRelease = CompletableDeferred<Unit>()
        val principal = principal("cleanup-refresh")
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK)),
            ),
            refreshResults = listOf(
                CompletableDeferred(AuthSessionRefreshResult.Active(principal)),
            ),
            signOutErrors = listOf(
                IOException("preliminary sign out failed"),
                IOException("definitive sign out failed"),
            ),
        )
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = authProvider,
            localFreshnessRepository = TestCriticalDataFreshnessLocalRepository(
                clearStarted = cleanupStarted,
                clearRelease = cleanupRelease,
            ),
        )

        fixture.actions.signOut()
        cleanupStarted.await()
        fixture.actions.refreshSession(SessionRefreshTrigger.FOREGROUND)
        runCurrent()

        assertEquals(0, authProvider.refreshRequests)

        cleanupRelease.complete(Unit)
        advanceUntilIdle()

        assertEquals(0, authProvider.refreshRequests)
        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        fixture.state.value = fixture.state.value.copy(emailInput = "blocked@reguerta.app")
        assertFalse(fixture.actions.signIn("blocked-secret"))
        assertTrue(authProvider.signInRequests.isEmpty())
    }

    @Test
    fun `valid sign in forwards the route password snapshot`() = runTest {
        val signInResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(signInResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        assertTrue(fixture.actions.signIn("single-pass12"))
        runCurrent()

        assertEquals(1, authProvider.signInRequests.size)
        assertTrue(authProvider.signInRequests.single().password == "single-pass12")

        signInResult.complete(AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK))
        advanceUntilIdle()
    }

    @Test
    fun `invalid sign in never reaches the provider`() = runTest {
        val authProvider = ControlledAuthSessionProvider()
        val fixture = fixture(scope = this, authProvider = authProvider)

        assertFalse(fixture.actions.signIn("short"))

        assertTrue(authProvider.signInRequests.isEmpty())
        assertEquals(com.reguerta.user.R.string.feedback_password_invalid_length, fixture.state.value.passwordErrorRes)
    }

    @Test
    fun `valid sign up forwards one password snapshot`() = runTest {
        val signUpResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signUpResults = listOf(signUpResult))
        val fixture = fixture(
            scope = this,
            state = registrationState(),
            authProvider = authProvider,
        )

        assertTrue(fixture.actions.signUp("single-pass12", "single-pass12"))
        runCurrent()

        assertEquals(1, authProvider.signUpRequests.size)
        assertTrue(authProvider.signUpRequests.single().password == "single-pass12")

        signUpResult.complete(AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK))
        advanceUntilIdle()
    }

    @Test
    fun `mismatched sign up never reaches the provider`() = runTest {
        val authProvider = ControlledAuthSessionProvider()
        val fixture = fixture(
            scope = this,
            state = registrationState(),
            authProvider = authProvider,
        )

        assertFalse(fixture.actions.signUp("single-pass12", "other-pass34"))

        assertTrue(authProvider.signUpRequests.isEmpty())
        assertEquals(
            com.reguerta.user.R.string.feedback_password_mismatch,
            fixture.state.value.registerRepeatPasswordErrorRes,
        )
    }

    @Test
    fun `late active refresh cannot restore authorization after sign out`() = runTest {
        val principal = principal("refresh")
        val member = member(principal)
        val refreshResult = CompletableDeferred<AuthSessionRefreshResult>()
        val authProvider = ControlledAuthSessionProvider(refreshResult = refreshResult)
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member),
            authProvider = authProvider,
        )

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        runCurrent()
        assertEquals(1, authProvider.refreshRequests)

        fixture.actions.signOut()
        refreshResult.complete(AuthSessionRefreshResult.Active(principal))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(null, fixture.state.value.sessionEnvironment)
        assertEquals(0, fixture.deviceRegistrations)
        assertEquals(0, fixture.shiftRefreshes)
    }

    @Test
    fun `late sign in cannot restore authorization after sign out`() = runTest {
        val signInResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(signInResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        fixture.actions.signIn("secret123")
        runCurrent()
        assertEquals(1, authProvider.signInRequests.size)

        fixture.actions.signOut()
        signInResult.complete(AuthSignInResult.Success(principal("late")))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(3, authProvider.signOutRequests)
        assertEquals(0, fixture.deviceRegistrations)
    }

    @Test
    fun `sign out during authorized member loading prevents late session publication`() = runTest {
        val visibleMembersStarted = CompletableDeferred<Unit>()
        val visibleMembersRelease = CompletableDeferred<Unit>()
        val memberRepository = TestMemberRepository(
            visibleMembersStarted = visibleMembersStarted,
            visibleMembersRelease = visibleMembersRelease,
        )
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(
                    AuthSignInResult.Success(principal("loading")),
                ),
            ),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            memberRepository = memberRepository,
        )

        fixture.actions.signIn("secret123")
        visibleMembersStarted.await()
        fixture.actions.signOut()
        visibleMembersRelease.complete(Unit)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(3, authProvider.signOutRequests)
        assertEquals(0, fixture.deviceRegistrations)
        assertEquals(0, fixture.shiftRefreshes)
    }

    @Test
    fun `new auth operation is accepted only after the current owner releases the lane`() = runTest {
        val firstResult = CompletableDeferred<AuthSignInResult>()
        val secondResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(firstResult, secondResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        assertTrue(fixture.actions.signIn("secret123"))
        runCurrent()
        fixture.state.value = fixture.state.value.copy(
            emailInput = "new@reguerta.app",
        )
        assertFalse(fixture.actions.signIn("new-secret"))
        runCurrent()

        assertEquals(1, authProvider.signInRequests.size)
        firstResult.complete(AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK))
        advanceUntilIdle()

        assertTrue(fixture.actions.signIn("new-secret"))
        runCurrent()
        secondResult.complete(AuthSignInResult.Success(principal("new")))
        advanceUntilIdle()

        val mode = fixture.state.value.mode as SessionMode.Authorized
        assertEquals(listOf("member", "new"), authProvider.signInRequests.map { it.email.substringBefore('@') })
        assertEquals("uid-new", mode.principal.uid)
        assertEquals(1, fixture.deviceRegistrations)
    }

    @Test
    fun `refresh requested while sign out owns cleanup is ignored`() = runTest {
        val firstRefresh = CompletableDeferred<AuthSessionRefreshResult>()
        val secondRefresh = CompletableDeferred<AuthSessionRefreshResult>(
            AuthSessionRefreshResult.NoSession,
        )
        val authProvider = ControlledAuthSessionProvider(refreshResults = listOf(firstRefresh, secondRefresh))
        val principal = principal("refresh-owner")
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = authProvider,
        )

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        runCurrent()
        fixture.actions.signOut()
        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        runCurrent()

        firstRefresh.complete(AuthSessionRefreshResult.Active(principal))
        advanceUntilIdle()

        assertEquals(1, authProvider.refreshRequests)
        assertFalse(fixture.isRefreshInFlight)
        assertEquals(null, fixture.lastRefreshAtMillis)
        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
    }

    @Test
    fun `late sign up cannot restore authorization or form state after sign out`() = runTest {
        val signUpResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signUpResults = listOf(signUpResult))
        val fixture = fixture(
            scope = this,
            state = registrationState(),
            authProvider = authProvider,
        )

        fixture.actions.signUp("secret123", "secret123")
        runCurrent()
        assertEquals(1, authProvider.signUpRequests.size)

        fixture.actions.signOut()
        signUpResult.complete(AuthSignInResult.Success(principal("late-sign-up")))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(3, authProvider.signOutRequests)
        assertEquals(null, fixture.state.value.registerEmailErrorRes)
        assertEquals("", fixture.state.value.registerEmailInput)
        assertEquals(0, fixture.deviceRegistrations)
    }

    @Test
    fun `late sign in failure cannot publish errors after sign out`() = runTest {
        val signInResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(signInResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        fixture.actions.signIn("secret123")
        runCurrent()
        fixture.actions.signOut()
        signInResult.complete(AuthSignInResult.Failure(AuthSignInFailureReason.INVALID_CREDENTIALS))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(null, fixture.state.value.emailErrorRes)
        assertEquals(null, fixture.state.value.passwordErrorRes)
        assertFalse(fixture.state.value.isAuthenticating)
    }

    @Test
    fun `late sign up failure cannot publish errors after sign out`() = runTest {
        val signUpResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signUpResults = listOf(signUpResult))
        val fixture = fixture(
            scope = this,
            state = registrationState(),
            authProvider = authProvider,
        )

        fixture.actions.signUp("secret123", "secret123")
        runCurrent()
        fixture.actions.signOut()
        signUpResult.complete(AuthSignInResult.Failure(AuthSignInFailureReason.EMAIL_ALREADY_IN_USE))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(null, fixture.state.value.registerEmailErrorRes)
        assertEquals(null, fixture.state.value.registerPasswordErrorRes)
        assertFalse(fixture.state.value.isRegistering)
    }

    @Test
    fun `automatic refresh cannot supersede interactive sign in`() = runTest {
        val signInResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(signInResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        fixture.actions.signIn("secret123")
        runCurrent()
        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        runCurrent()

        assertEquals(1, authProvider.signInRequests.size)
        assertEquals(0, authProvider.refreshRequests)
        assertTrue(fixture.state.value.isAuthenticating)
        assertFalse(fixture.isRefreshInFlight)

        signInResult.complete(AuthSignInResult.Success(principal("interactive")))
        advanceUntilIdle()

        val mode = fixture.state.value.mode as SessionMode.Authorized
        assertEquals("uid-interactive", mode.principal.uid)
        assertEquals(1, fixture.deviceRegistrations)
    }

    @Test
    fun `refresh cannot replace the authenticated principal with another uid`() = runTest {
        val currentPrincipal = principal("current")
        val otherPrincipal = principal("other")
        val authProvider = ControlledAuthSessionProvider(
            refreshResult = CompletableDeferred(AuthSessionRefreshResult.Active(otherPrincipal)),
        )
        val fixture = fixture(
            scope = this,
            state = authorizedState(currentPrincipal, member(currentPrincipal)),
            authProvider = authProvider,
        )

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertTrue(fixture.state.value.showSessionExpiredDialog)
        assertEquals(1, authProvider.signOutRequests)
        assertEquals(null, fixture.lastRefreshAtMillis)
        assertEquals(0, fixture.deviceRegistrations)
    }

    @Test
    fun `repeated interactive submits are rejected until the current owner finishes`() = runTest {
        val firstResult = CompletableDeferred<AuthSignInResult>()
        val finalResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(firstResult, finalResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        assertTrue(fixture.actions.signIn("secret123"))
        runCurrent()
        fixture.state.value = fixture.state.value.copy(
            emailInput = "middle@reguerta.app",
        )
        assertFalse(fixture.actions.signIn("middle-secret"))
        runCurrent()
        fixture.state.value = fixture.state.value.copy(
            emailInput = "final@reguerta.app",
        )
        assertFalse(fixture.actions.signIn("final-secret"))
        runCurrent()

        assertEquals(listOf("member"), authProvider.signInRequests.map { it.email.substringBefore('@') })

        firstResult.complete(AuthSignInResult.Failure(AuthSignInFailureReason.NETWORK))
        advanceUntilIdle()

        assertTrue(fixture.actions.signIn("final-secret"))
        runCurrent()
        assertEquals(listOf("member", "final"), authProvider.signInRequests.map { it.email.substringBefore('@') })

        finalResult.complete(AuthSignInResult.Success(principal("final")))
        advanceUntilIdle()

        val mode = fixture.state.value.mode as SessionMode.Authorized
        assertEquals("uid-final", mode.principal.uid)
        assertEquals(1, fixture.deviceRegistrations)
    }

    @Test
    fun `stale freshness result cannot reach a later session of the same principal`() = runTest {
        val freshnessStarted = CompletableDeferred<Unit>()
        val freshnessRelease = CompletableDeferred<Unit>()
        val principal = principal("same")
        val member = member(principal)
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRemoteRepository = ControlledCriticalDataFreshnessRemoteRepository(
                started = freshnessStarted,
                release = freshnessRelease,
            ),
        )

        fixture.actions.refreshMyOrderFreshness()
        freshnessStarted.await()
        fixture.actions.signOut()
        fixture.state.value = authorizedState(principal, member).copy(
            sessionEpoch = fixture.state.value.sessionEpoch + 1,
            myOrderFreshnessState = MyOrderFreshnessUiState.Ready,
        )

        freshnessRelease.complete(Unit)
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
    }

    @Test
    fun `same email unauthorized session still refreshes critical data after authorization`() {
        val principal = principal("same-email")
        val currentMode = SessionMode.Unauthorized(
            email = principal.email,
            reason = com.reguerta.user.domain.access.UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS,
        )

        assertTrue(shouldRefreshCriticalDataFor(currentMode = currentMode, principal = principal))
    }

    @Test
    fun `environment switch forces critical freshness check for the same principal`() = runTest {
        val principal = principal("environment")
        val member = member(principal)
        val lifecycleEvents = mutableListOf<String>()
        val environmentRouter = RecordingSessionEnvironmentRouter(lifecycleEvents)
        val deviceRegistrar = TestAuthorizedDeviceRegistrar(lifecycleEvents = lifecycleEvents)
        val authProvider = ControlledAuthSessionProvider(
            refreshResult = CompletableDeferred(AuthSessionRefreshResult.Active(principal)),
        )
        val freshnessRemoteRepository = RecordingCriticalDataFreshnessRemoteRepository()
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member).copy(
                myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
            ),
            authProvider = authProvider,
            authorizedMemberResolver = ProductionAuthorizedMemberResolver,
            environmentRouter = environmentRouter,
            deviceRegistrar = deviceRegistrar,
            freshnessRemoteRepository = freshnessRemoteRepository,
        )

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        advanceUntilIdle()

        assertEquals("production", fixture.state.value.sessionEnvironment)
        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
        assertEquals(1, fixture.localFreshnessRepository.saveRequests)
        assertEquals(listOf("production"), freshnessRemoteRepository.requestedEnvironments)
        assertTrue(
            lifecycleEvents.indexOf("invalidate") <
                lifecycleEvents.indexOf("apply:production"),
        )
    }

    @Test
    fun `environment routing clears community state before authorization hydration completes`() = runTest {
        val hydrationStarted = CompletableDeferred<Unit>()
        val hydrationRelease = CompletableDeferred<Unit>()
        val principal = principal("environment-boundary")
        val member = member(principal)
        val article = NewsArticle(
            id = "news-1",
            title = "News",
            body = "Body",
            active = true,
            publishedBy = "Publisher",
            publishedAtMillis = 1L,
            urlImage = null,
        )
        val notification = NotificationEvent(
            id = "notification-1",
            title = "Notification",
            body = "Body",
            type = "admin_broadcast",
            target = "all",
            userIds = emptyList(),
            segmentType = null,
            targetRole = null,
            createdBy = member.id,
            sentAtMillis = 1L,
            weekKey = null,
        )
        val initialState = authorizedState(principal, member).copy(
            latestNews = listOf(article),
            newsFeed = listOf(article),
            newsDraft = NewsDraft(title = "Draft", body = "Body"),
            editingNewsId = article.id,
            isLoadingNews = true,
            isSavingNews = true,
            isUploadingNewsImage = true,
            notificationsFeed = listOf(notification),
            readNotificationIds = setOf(notification.id),
            pendingNotificationAcknowledgements = listOf(notification),
            pendingReadNotificationIds = setOf(notification.id),
            notificationDraft = NotificationDraft(title = "Draft", body = "Body"),
            isLoadingNotifications = true,
            isSendingNotification = true,
        )
        val environmentRouter = RecordingSessionEnvironmentRouter().also { router ->
            router.currentEnvironment = "develop"
        }
        val fixture = fixture(
            scope = this,
            state = initialState,
            authProvider = ControlledAuthSessionProvider(
                refreshResult = CompletableDeferred(AuthSessionRefreshResult.Active(principal)),
            ),
            memberRepository = TestMemberRepository(
                visibleMembersStarted = hydrationStarted,
                visibleMembersRelease = hydrationRelease,
            ),
            authorizedMemberResolver = ProductionAuthorizedMemberResolver,
            environmentRouter = environmentRouter,
        )

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        hydrationStarted.await()
        try {
            val stateWhileHydrationIsPending = fixture.state.value
            assertEquals("production", environmentRouter.currentEnvironment)
            assertEquals(listOf("production"), environmentRouter.appliedEnvironments)
            assertEquals("develop", stateWhileHydrationIsPending.sessionEnvironment)
            assertEquals(initialState.sessionEpoch + 1, stateWhileHydrationIsPending.sessionEpoch)
            assertTrue(stateWhileHydrationIsPending.mode is SessionMode.Authorized)
            assertTrue(stateWhileHydrationIsPending.latestNews.isEmpty())
            assertTrue(stateWhileHydrationIsPending.newsFeed.isEmpty())
            assertEquals(NewsDraft(), stateWhileHydrationIsPending.newsDraft)
            assertEquals(null, stateWhileHydrationIsPending.editingNewsId)
            assertFalse(stateWhileHydrationIsPending.isLoadingNews)
            assertFalse(stateWhileHydrationIsPending.isSavingNews)
            assertFalse(stateWhileHydrationIsPending.isUploadingNewsImage)
            assertTrue(stateWhileHydrationIsPending.notificationsFeed.isEmpty())
            assertTrue(stateWhileHydrationIsPending.readNotificationIds.isEmpty())
            assertTrue(stateWhileHydrationIsPending.pendingNotificationAcknowledgements.isEmpty())
            assertTrue(stateWhileHydrationIsPending.pendingReadNotificationIds.isEmpty())
            assertEquals(NotificationDraft(), stateWhileHydrationIsPending.notificationDraft)
            assertFalse(stateWhileHydrationIsPending.isLoadingNotifications)
            assertFalse(stateWhileHydrationIsPending.isSendingNotification)
            assertEquals(0, fixture.newsRefreshes)
            assertEquals(0, fixture.notificationRefreshes)
        } finally {
            hydrationRelease.complete(Unit)
        }
        advanceUntilIdle()

        assertEquals("production", fixture.state.value.sessionEnvironment)
        assertTrue(fixture.state.value.mode is SessionMode.Authorized)
    }

    @Test
    fun `freshness failure is unavailable and retry can recover`() = runTest {
        val principal = principal("retry")
        val repository = RecoveringCriticalDataFreshnessRemoteRepository()
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRemoteRepository = repository,
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()
        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()
        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
        assertEquals(1, fixture.localFreshnessRepository.saveRequests)
        assertEquals(listOf("develop", "develop"), repository.requestedEnvironments)
    }

    @Test
    fun `authenticated member relink is unavailable without consumer or acknowledgement`() = runTest {
        val principal = principal("relinked")
        var consumerRefreshes = 0
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = CriticalDataRefresher { refreshScope, _ ->
                member(principal).copy(authUid = "uid-new-owner")
                    .requiringPrincipal(refreshScope.principalUid)
                error("Relinked identity must fail before payload creation")
            },
            refreshMyOrderConsumer = { _, _ ->
                consumerRefreshes += 1
                true
            },
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, consumerRefreshes)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
    }

    @Test
    fun `partial critical refresh never acknowledges and retry completes consumer before save`() = runTest {
        val principal = principal("partial-refresh")
        val refresher = PartiallyFailingThenRecoveringCriticalDataRefresher()
        val localRepository = TestCriticalDataFreshnessLocalRepository()
        var consumerRefreshes = 0
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = refresher,
            localFreshnessRepository = localRepository,
            refreshMyOrderConsumer = { _, fence ->
                assertEquals(0, localRepository.saveRequests)
                consumerRefreshes += 1
                fence()
            },
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, localRepository.saveRequests)
        assertEquals(0, consumerRefreshes)

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
        assertEquals(1, localRepository.saveRequests)
        assertEquals(1, consumerRefreshes)
        assertEquals(
            listOf(CriticalCollection.entries.toSet(), CriticalCollection.entries.toSet()),
            refresher.requestedCollections,
        )
    }

    @Test
    fun `seasonal commitment ancillary failure blocks ready with unchanged timestamps`() = runTest {
        val principal = principal("member")
        val previousMetadata = validFreshnessMetadata(
            environment = "develop",
            validatedAtMillis = 1_000L,
        )
        val localRepository = TestCriticalDataFreshnessLocalRepository().apply {
            storedMetadata = previousMetadata
        }
        val requestedCollections = mutableListOf<Set<CriticalCollection>>()
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            localFreshnessRepository = localRepository,
            freshnessNowProvider = { 1_000L },
            freshnessRefresher = CriticalDataRefresher { _, collections ->
                requestedCollections += collections
                throw RepositoryException(
                    kind = RepositoryErrorKind.UNAVAILABLE,
                    resource = "seasonalCommitments.server",
                )
            },
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(listOf(emptySet<CriticalCollection>()), requestedCollections)
        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, localRepository.saveRequests)
        assertEquals(previousMetadata, localRepository.storedMetadata)
    }

    @Test
    fun `critical refresher timeout is explicit and cannot apply consumer or metadata`() = runTest {
        val principal = principal("refresh-timeout")
        var consumerRefreshes = 0
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = DelayedCriticalDataRefresher,
            refreshMyOrderConsumer = { _, fence ->
                consumerRefreshes += 1
                fence()
            },
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.TimedOut, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
        assertEquals(0, consumerRefreshes)
    }

    @Test
    fun `failed freshness retries automatically after the configured delay and recovers`() = runTest {
        val principal = principal("automatic-retry")
        val refresher = PartiallyFailingThenRecoveringCriticalDataRefresher()
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = refresher,
            freshnessRetryDelaysMillis = listOf(10_000L, 20_000L, 30_000L),
        )

        fixture.actions.refreshMyOrderFreshness()
        runCurrent()

        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)
        assertEquals(1, refresher.requestedCollections.size)

        advanceTimeBy(9_999L)
        runCurrent()
        assertEquals(1, refresher.requestedCollections.size)

        advanceTimeBy(1L)
        advanceUntilIdle()

        assertEquals(2, refresher.requestedCollections.size)
        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
    }

    @Test
    fun `sign out cancels a scheduled automatic freshness retry`() = runTest {
        val principal = principal("automatic-retry-signout")
        val refresher = PartiallyFailingThenRecoveringCriticalDataRefresher()
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = refresher,
            freshnessRetryDelaysMillis = listOf(10_000L, 20_000L, 30_000L),
        )

        fixture.actions.refreshMyOrderFreshness()
        runCurrent()
        assertEquals(1, refresher.requestedCollections.size)

        fixture.actions.signOut()
        runCurrent()
        advanceTimeBy(10_000L)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(1, refresher.requestedCollections.size)
    }

    @Test
    fun `consumer refresh failure blocks acknowledgement after firestore refresh`() = runTest {
        val principal = principal("consumer-failure")
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            refreshMyOrderConsumer = { _, _ ->
                throw RepositoryException(
                    kind = RepositoryErrorKind.UNAVAILABLE,
                    resource = "myOrder.consumer",
                )
            },
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
    }

    @Test
    fun `same scope stale writer after consumer invalidates receipt until retry`() = runTest {
        val principal = principal("stale-receipt")
        val originalMember = member(principal)
        val refreshedMember = originalMember.copy(displayName = "Refreshed member")
        val staleMember = originalMember.copy(displayName = "Stale member")
        var injectStaleWriter = true
        lateinit var fixture: AuthFixture
        fixture = fixture(
            scope = this,
            state = authorizedState(principal, originalMember),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = CriticalDataRefresher { refreshScope, _ ->
                criticalRefreshPayload(
                    scope = refreshScope,
                    selectedMember = refreshedMember,
                    authenticatedMember = refreshedMember,
                )
            },
            refreshMyOrderConsumerWithReceipt = { payload, fence ->
                if (!fence()) {
                    null
                } else {
                    val selectedMember = requireNotNull(payload.selectedMember)
                    val currentMode = fixture.state.value.mode as SessionMode.Authorized
                    fixture.state.value = fixture.state.value.copy(
                        mode = currentMode.copy(
                            authenticatedMember = payload.authenticatedMember,
                            member = selectedMember,
                            members = listOf(payload.authenticatedMember),
                        ),
                    )
                    val receipt = requireNotNull(
                        fixture.state.value.criticalDataRefreshConsumerReceipt(),
                    )
                    if (injectStaleWriter) {
                        injectStaleWriter = false
                        val refreshedMode = fixture.state.value.mode as SessionMode.Authorized
                        fixture.state.value = fixture.state.value.copy(
                            mode = refreshedMode.copy(
                                authenticatedMember = staleMember,
                                member = staleMember,
                                members = listOf(staleMember),
                            ),
                        )
                    }
                    receipt
                }
            },
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)
        assertEquals(staleMember, (fixture.state.value.mode as SessionMode.Authorized).member)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
        assertEquals(refreshedMember, (fixture.state.value.mode as SessionMode.Authorized).member)
        assertEquals(1, fixture.localFreshnessRepository.saveRequests)
    }

    @Test
    fun `late refresh cannot cross an authenticated access scope change`() = runTest {
        val refreshStarted = CompletableDeferred<Unit>()
        val refreshRelease = CompletableDeferred<Unit>()
        val principal = principal("access-scope")
        val originalMember = member(principal)
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, originalMember),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = ControlledCriticalDataRefresher(
                started = refreshStarted,
                release = refreshRelease,
            ),
        )

        fixture.actions.refreshMyOrderFreshness()
        refreshStarted.await()
        val adminMember = originalMember.copy(roles = setOf(MemberRole.ADMIN))
        fixture.state.value = fixture.state.value.copy(
            mode = (fixture.state.value.mode as SessionMode.Authorized).copy(
                authenticatedMember = adminMember,
                member = adminMember,
                members = listOf(adminMember),
            ),
            myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
        )
        refreshRelease.complete(Unit)
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Idle, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
    }

    @Test
    fun `late refresh cannot cross an authenticated member relink`() = runTest {
        val refreshStarted = CompletableDeferred<Unit>()
        val refreshRelease = CompletableDeferred<Unit>()
        val principal = principal("auth-relink")
        val originalMember = member(principal)
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, originalMember),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = ControlledCriticalDataRefresher(
                started = refreshStarted,
                release = refreshRelease,
            ),
        )

        fixture.actions.refreshMyOrderFreshness()
        refreshStarted.await()
        val relinkedMember = originalMember.copy(authUid = "uid-relinked")
        fixture.state.value = fixture.state.value.copy(
            mode = (fixture.state.value.mode as SessionMode.Authorized).copy(
                authenticatedMember = relinkedMember,
                member = relinkedMember,
                members = listOf(relinkedMember),
            ),
            myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
        )
        refreshRelease.complete(Unit)
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.Idle, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
    }

    @Test
    fun `users refresh capability change becomes retryable with the new scope`() = runTest {
        val principal = principal("capability-refresh")
        val requestedAccessScopes = mutableListOf<Boolean>()
        var consumerRefreshes = 0
        lateinit var fixture: AuthFixture
        fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = CriticalDataRefresher { scope, _ ->
                requestedAccessScopes += scope.canManageMembers
                criticalRefreshPayload(
                    scope = scope,
                    selectedMember = member(principal).copy(
                        roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN),
                    ),
                )
            },
            refreshMyOrderConsumer = { payload, _ ->
                consumerRefreshes += 1
                if (consumerRefreshes == 1) {
                    val currentMode = fixture.state.value.mode as SessionMode.Authorized
                    val promoted = requireNotNull(payload.selectedMember)
                    fixture.state.value = fixture.state.value.copy(
                        mode = currentMode.copy(
                            authenticatedMember = promoted,
                            member = promoted,
                            members = listOf(promoted),
                        ),
                    )
                }
                true
            },
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(listOf(false), requestedAccessScopes)
        assertEquals(1, consumerRefreshes)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(listOf(false, true), requestedAccessScopes)
        assertEquals(2, consumerRefreshes)
        assertEquals(1, fixture.localFreshnessRepository.saveRequests)
        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
    }

    @Test
    fun `revoked admin impersonation retries without attempting the old full users query`() = runTest {
        val principal = principal("revoked-admin")
        val authenticatedAdmin = member(principal).copy(
            id = "admin",
            roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN),
        )
        val selectedMember = member(principal("selected")).copy(id = "selected")
        val demotedAuthenticatedMember = authenticatedAdmin.copy(
            roles = setOf(MemberRole.MEMBER),
        )
        val requestedScopes = mutableListOf<Triple<String, String, Boolean>>()
        var fullUsersQueryAttempts = 0
        lateinit var fixture: AuthFixture
        fixture = fixture(
            scope = this,
            state = SessionUiState(
                sessionEnvironment = "develop",
                mode = SessionMode.Authorized(
                    principal = principal,
                    authenticatedMember = authenticatedAdmin,
                    member = selectedMember,
                    members = listOf(authenticatedAdmin, selectedMember),
                ),
            ),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRefresher = CriticalDataRefresher { refreshScope, _ ->
                requestedScopes += Triple(
                    refreshScope.authenticatedMemberId,
                    refreshScope.memberId,
                    refreshScope.canManageMembers,
                )
                if (demotedAuthenticatedMember.canManageMembers != refreshScope.canManageMembers) {
                    CriticalDataRefreshPayload(
                        authenticatedMemberId = demotedAuthenticatedMember.id,
                        authenticatedMember = demotedAuthenticatedMember,
                        selectedMember = null,
                        seasonalCommitments = null,
                        requiresAccessScopeRetry = true,
                    )
                } else {
                    if (refreshScope.canManageMembers) fullUsersQueryAttempts += 1
                    criticalRefreshPayload(
                        scope = refreshScope,
                        selectedMember = demotedAuthenticatedMember,
                        authenticatedMember = demotedAuthenticatedMember,
                    )
                }
            },
            refreshMyOrderConsumer = { payload, fence ->
                if (!fence()) {
                    false
                } else {
                    if (payload.requiresAccessScopeRetry) {
                        val currentMode = fixture.state.value.mode as SessionMode.Authorized
                        fixture.state.value = fixture.state.value.copy(
                            mode = currentMode.copy(
                                authenticatedMember = payload.authenticatedMember,
                                member = payload.authenticatedMember,
                                members = listOf(payload.authenticatedMember),
                            ),
                        )
                    }
                    true
                }
            },
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        val firstMode = fixture.state.value.mode as SessionMode.Authorized
        assertEquals(MyOrderFreshnessUiState.Unavailable, fixture.state.value.myOrderFreshnessState)
        assertEquals(demotedAuthenticatedMember, firstMode.authenticatedMember)
        assertEquals("admin", firstMode.member.id)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
        assertEquals(0, fullUsersQueryAttempts)

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(
            listOf(
                Triple("admin", "selected", true),
                Triple("admin", "admin", false),
            ),
            requestedScopes,
        )
        assertEquals(6, CriticalCollection.entries.size)
        assertEquals(0, fullUsersQueryAttempts)
        assertEquals(1, fixture.localFreshnessRepository.saveRequests)
        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
    }

    @Test
    fun `freshness timeout is explicit and does not persist metadata`() = runTest {
        assertEquals(10_000L, MY_ORDER_FRESHNESS_TIMEOUT_MILLIS)
        val principal = principal("timeout")
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRemoteRepository = DelayedCriticalDataFreshnessRemoteRepository,
        )

        fixture.actions.refreshMyOrderFreshness()
        advanceUntilIdle()

        assertEquals(MyOrderFreshnessUiState.TimedOut, fixture.state.value.myOrderFreshnessState)
        assertEquals(0, fixture.localFreshnessRepository.saveRequests)
    }

    @Test
    fun `session invalidation during a non cancellable metadata write rolls the stale write back`() = runTest {
        val saveStarted = CompletableDeferred<Unit>()
        val saveRelease = CompletableDeferred<Unit>()
        val principal = principal("write-fence")
        val localRepository = SuspendedCriticalDataFreshnessLocalRepository(
            saveStarted = saveStarted,
            saveRelease = saveRelease,
            writeBeforeSuspension = false,
        )
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            localFreshnessRepository = localRepository,
        )

        fixture.actions.refreshMyOrderFreshness()
        saveStarted.await()
        fixture.state.value = fixture.state.value.copy(
            sessionEpoch = fixture.state.value.sessionEpoch + 1,
            myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
        )
        saveRelease.complete(Unit)
        advanceUntilIdle()

        assertEquals(null, localRepository.storedMetadata)
        assertEquals(1, localRepository.rollbackRequests)
        assertEquals(MyOrderFreshnessUiState.Idle, fixture.state.value.myOrderFreshnessState)
    }

    @Test
    fun `stale rollback never removes metadata written by a newer operation`() = runTest {
        val saveStarted = CompletableDeferred<Unit>()
        val saveRelease = CompletableDeferred<Unit>()
        val principal = principal("write-replacement")
        val localRepository = SuspendedCriticalDataFreshnessLocalRepository(
            saveStarted = saveStarted,
            saveRelease = saveRelease,
            writeBeforeSuspension = true,
        )
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            localFreshnessRepository = localRepository,
        )

        fixture.actions.refreshMyOrderFreshness()
        saveStarted.await()
        fixture.state.value = fixture.state.value.copy(
            sessionEpoch = fixture.state.value.sessionEpoch + 1,
        )
        val newerMetadata = validFreshnessMetadata(
            environment = "develop",
            validatedAtMillis = 9_000L,
        )
        localRepository.replaceWithNewerMetadata(newerMetadata)
        saveRelease.complete(Unit)
        advanceUntilIdle()

        assertEquals(newerMetadata, localRepository.storedMetadata)
        assertEquals(1, localRepository.rollbackRequests)
    }

    @Test
    fun `retry generation can commit while an older non cancellable write unwinds`() = runTest {
        val firstSaveStarted = CompletableDeferred<Unit>()
        val firstSaveRelease = CompletableDeferred<Unit>()
        val secondSaveCompleted = CompletableDeferred<Unit>()
        val principal = principal("write-generation")
        val localRepository = SupersededWriteCriticalDataFreshnessLocalRepository(
            firstSaveStarted = firstSaveStarted,
            firstSaveRelease = firstSaveRelease,
            secondSaveCompleted = secondSaveCompleted,
        )
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(),
            freshnessRemoteRepository = ChangingCriticalDataFreshnessRemoteRepository(),
            localFreshnessRepository = localRepository,
        )

        fixture.actions.refreshMyOrderFreshness()
        firstSaveStarted.await()
        fixture.actions.refreshMyOrderFreshness()
        secondSaveCompleted.await()
        firstSaveRelease.complete(Unit)
        advanceUntilIdle()

        assertEquals(
            CriticalCollection.entries.associateWith { 3_000L },
            localRepository.storedMetadata?.acknowledgedTimestampsMillis,
        )
        assertEquals(1, localRepository.rollbackRequests)
        assertEquals(MyOrderFreshnessUiState.Ready, fixture.state.value.myOrderFreshnessState)
    }

    @Test
    fun `late authorization resolution cannot apply routing after sign out`() = runTest {
        val resolverStarted = CompletableDeferred<Unit>()
        val resolverRelease = CompletableDeferred<Unit>()
        val memberRepository = TestMemberRepository()
        val environmentRouter = RecordingSessionEnvironmentRouter()
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(AuthSignInResult.Success(principal("routing"))),
            ),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            memberRepository = memberRepository,
            authorizedMemberResolver = ControlledAuthorizedMemberResolver(
                started = resolverStarted,
                release = resolverRelease,
            ),
            environmentRouter = environmentRouter,
        )

        fixture.actions.signIn("secret123")
        resolverStarted.await()
        fixture.actions.signOut()
        val invalidationRequestsAfterSignOut = fixture.deviceRegistrar.invalidationRequests
        resolverRelease.complete(Unit)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(
            invalidationRequestsAfterSignOut,
            fixture.deviceRegistrar.invalidationRequests,
        )
        assertTrue(environmentRouter.appliedEnvironments.isEmpty())
        assertEquals(null, environmentRouter.currentEnvironment)
        assertEquals(0, memberRepository.findByAuthUidRequests)
        assertEquals(3, authProvider.signOutRequests)
    }

    @Test
    fun `current authorization applies resolved environment before member lookup`() = runTest {
        val environmentRouter = RecordingSessionEnvironmentRouter()
        val memberRepository = TestMemberRepository(
            currentEnvironment = { environmentRouter.currentEnvironment },
        )
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(AuthSignInResult.Success(principal("routed"))),
            ),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            memberRepository = memberRepository,
            environmentRouter = environmentRouter,
        )

        fixture.actions.signIn("secret123")
        advanceUntilIdle()

        assertEquals(listOf("develop"), environmentRouter.appliedEnvironments)
        assertEquals(listOf("develop"), memberRepository.environmentsAtFindByAuthUid)
        assertTrue(fixture.state.value.mode is SessionMode.Authorized)
    }

    @Test
    fun `sign out during device registration prevents stale completion`() = runTest {
        val registrationStarted = CompletableDeferred<Unit>()
        val registrationRelease = CompletableDeferred<Unit>()
        val deviceRegistrar = TestAuthorizedDeviceRegistrar(
            started = registrationStarted,
            release = registrationRelease,
        )
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(AuthSignInResult.Success(principal("device"))),
            ),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            deviceRegistrar = deviceRegistrar,
        )

        fixture.actions.signIn("secret123")
        registrationStarted.await()
        val invalidationRequestsBeforeLogout = deviceRegistrar.invalidationRequests
        val invalidationFenceCountBeforeLogout =
            deviceRegistrar.sessionFenceValuesAtInvalidation.size
        fixture.actions.signOut()
        val invalidationRequestsAtLogout =
            deviceRegistrar.invalidationRequests - invalidationRequestsBeforeLogout
        val sessionFenceValuesAtLogout = deviceRegistrar.sessionFenceValuesAtInvalidation
            .drop(invalidationFenceCountBeforeLogout)
        val clearRequestsAtLogout = deviceRegistrar.clearRequests
        registrationRelease.complete(Unit)
        advanceUntilIdle()

        assertEquals(2, invalidationRequestsAtLogout)
        assertEquals(listOf(true, false), sessionFenceValuesAtLogout)
        assertEquals(0, clearRequestsAtLogout)
        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(listOf("develop"), deviceRegistrar.requestedEnvironments)
        assertEquals(0, deviceRegistrar.completedRegistrations)
        assertTrue(deviceRegistrar.clearRequests >= 1)
        assertEquals(3, authProvider.signOutRequests)
    }

    @Test
    fun `email verification rejection stays quarantined when firebase sign out fails`() = runTest {
        val principal = principal("verification-required")
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(AuthSignInResult.Success(principal)),
            ),
            signOutErrors = listOf(IOException("firebase sign out failed")),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            authorizedMemberResolver = EmailVerificationRequiredMemberResolver,
        )

        assertTrue(fixture.actions.signIn("secret123"))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertFalse(fixture.state.value.showSessionExpiredDialog)
        assertEquals(principal.email, fixture.state.value.emailInput)
        assertEquals(
            com.reguerta.user.R.string.auth_error_email_not_verified,
            fixture.state.value.emailErrorRes,
        )
        assertEquals(1, authProvider.signOutRequests)
        assertEquals(1, fixture.deviceRegistrar.clearRequests)
        assertEquals(1, fixture.localFreshnessRepository.clearRequests)

        assertFalse(fixture.actions.signIn("secret123"))
        assertEquals(1, authProvider.signInRequests.size)
        assertEquals(
            com.reguerta.user.R.string.auth_error_unknown,
            fixture.state.value.emailErrorRes,
        )
    }

    @Test
    fun `expired refresh terminates locally before freshness cleanup completes`() = runTest {
        val clearStarted = CompletableDeferred<Unit>()
        val clearRelease = CompletableDeferred<Unit>()
        val localFreshnessRepository = TestCriticalDataFreshnessLocalRepository(
            clearStarted = clearStarted,
            clearRelease = clearRelease,
        )
        val principal = principal("expired")
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)),
            authProvider = ControlledAuthSessionProvider(
                refreshResult = CompletableDeferred(AuthSessionRefreshResult.Expired),
            ),
            localFreshnessRepository = localFreshnessRepository,
        )

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        clearStarted.await()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertTrue(fixture.state.value.showSessionExpiredDialog)
        assertEquals(null, fixture.environmentRouter.currentEnvironment)
        assertEquals(1, localFreshnessRepository.clearRequests)
        assertTrue(fixture.deviceRegistrar.clearRequests >= 1)

        clearRelease.complete(Unit)
        advanceUntilIdle()
    }

    @Test
    fun `expired refresh stays quarantined when private cleanup fails`() = runTest {
        val principal = principal("expired-cleanup-failure")
        val authProvider = ControlledAuthSessionProvider(
            refreshResult = CompletableDeferred(AuthSessionRefreshResult.Expired),
        )
        val fixture = fixture(
            scope = this,
            state = authorizedState(principal, member(principal)).copy(emailInput = principal.email),
            authProvider = authProvider,
            deviceRegistrar = TestAuthorizedDeviceRegistrar(
                clearErrors = listOf(IOException("device cleanup failed")),
            ),
        )

        fixture.actions.refreshSession(SessionRefreshTrigger.STARTUP)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertTrue(fixture.state.value.showSessionExpiredDialog)
        assertEquals(1, authProvider.signOutRequests)
        assertEquals(1, fixture.deviceRegistrar.clearRequests)
        assertEquals(1, fixture.localFreshnessRepository.clearRequests)

        assertFalse(fixture.actions.signIn("secret123"))
        assertEquals(0, authProvider.signInRequests.size)
    }

    @Test
    fun `late non cancellation exception cleans stale authentication`() = runTest {
        val lateError = CompletableDeferred<Throwable>()
        val authProvider = ControlledAuthSessionProvider(lateSignInError = lateError)
        val fixture = fixture(scope = this, authProvider = authProvider)

        fixture.actions.signIn("secret123")
        runCurrent()
        fixture.actions.signOut()
        lateError.complete(IOException("late provider failure"))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(3, authProvider.signOutRequests)
        assertEquals(null, fixture.environmentRouter.currentEnvironment)
        assertEquals(null, fixture.state.value.emailErrorRes)
        assertTrue(fixture.deviceRegistrar.clearRequests >= 1)
    }

    @Test
    fun `authorized session remains valid when non critical community refresh scheduling fails`() = runTest {
        val principal = principal("community-failure")
        val authProvider = ControlledAuthSessionProvider(
            signInResults = listOf(
                CompletableDeferred(AuthSignInResult.Success(principal)),
            ),
        )
        val fixture = fixture(
            scope = this,
            authProvider = authProvider,
            refreshNews = { throw IOException("news refresh failed") },
            refreshNotifications = { throw IOException("notifications refresh failed") },
        )

        assertTrue(fixture.actions.signIn("secret123"))
        advanceUntilIdle()

        val mode = fixture.state.value.mode as SessionMode.Authorized
        assertEquals(principal.uid, mode.principal.uid)
        assertFalse(fixture.state.value.isAuthenticating)
        assertEquals(1, fixture.newsRefreshes)
        assertEquals(1, fixture.notificationRefreshes)
        assertEquals(1, fixture.deviceRegistrations)
        assertEquals(0, authProvider.signOutRequests)
    }

    @Test
    fun `capability boundary clears community snapshot editors and spinners synchronously`() {
        val principal = principal("capability-boundary")
        val member = member(principal)
        val article = NewsArticle(
            id = "news-1",
            title = "News",
            body = "Body",
            active = true,
            publishedBy = "Publisher",
            publishedAtMillis = 1L,
            urlImage = null,
        )
        val notification = NotificationEvent(
            id = "notification-1",
            title = "Notification",
            body = "Body",
            type = "admin_broadcast",
            target = "all",
            userIds = emptyList(),
            segmentType = null,
            targetRole = null,
            createdBy = "admin-1",
            sentAtMillis = 1L,
            weekKey = null,
        )
        val dirtyState = authorizedState(principal, member).copy(
            latestNews = listOf(article),
            newsFeed = listOf(article),
            newsDraft = NewsDraft(title = "Draft"),
            newsEditorRevision = 4L,
            editingNewsId = article.id,
            isLoadingNews = true,
            isSavingNews = true,
            isDeletingNews = true,
            isUploadingNewsImage = true,
            notificationsFeed = listOf(notification),
            readNotificationIds = setOf(notification.id),
            pendingNotificationAcknowledgements = listOf(notification),
            pendingReadNotificationIds = setOf(notification.id),
            notificationReadRevision = 4L,
            notificationDraft = NotificationDraft(title = "Draft"),
            notificationEditorRevision = 4L,
            isLoadingNotifications = true,
            isSendingNotification = true,
            isPushNotificationPermissionActive = false,
            showPushNotificationPermissionDialog = true,
        )

        val cleared = dirtyState.clearCommunitySessionStateIfInvalidated(
            AuthorizedSessionAccessTransition(
                sameProductIdentity = true,
                accessCapabilitiesChanged = true,
                rolesChanged = false,
                adminAccessChanged = true,
                environmentChanged = false,
            ),
        )

        assertTrue(cleared.latestNews.isEmpty())
        assertTrue(cleared.newsFeed.isEmpty())
        assertEquals(NewsDraft(), cleared.newsDraft)
        assertEquals(null, cleared.editingNewsId)
        assertEquals(5L, cleared.newsEditorRevision)
        assertFalse(cleared.isLoadingNews)
        assertFalse(cleared.isSavingNews)
        assertFalse(cleared.isDeletingNews)
        assertFalse(cleared.isUploadingNewsImage)
        assertTrue(cleared.notificationsFeed.isEmpty())
        assertTrue(cleared.readNotificationIds.isEmpty())
        assertTrue(cleared.pendingNotificationAcknowledgements.isEmpty())
        assertTrue(cleared.pendingReadNotificationIds.isEmpty())
        assertEquals(5L, cleared.notificationReadRevision)
        assertEquals(NotificationDraft(), cleared.notificationDraft)
        assertEquals(5L, cleared.notificationEditorRevision)
        assertFalse(cleared.isLoadingNotifications)
        assertFalse(cleared.isSendingNotification)
        assertTrue(cleared.isPushNotificationPermissionActive)
        assertFalse(cleared.showPushNotificationPermissionDialog)
    }
}

private const val TEST_SESSION_OPERATION_TIMEOUT_MILLIS = 30_000L

private data class AuthFixture(
    val actions: SessionAuthActions,
    val state: MutableStateFlow<SessionUiState>,
    val environmentRouter: RecordingSessionEnvironmentRouter,
    val deviceRegistrar: TestAuthorizedDeviceRegistrar,
    val localFreshnessRepository: TestCriticalDataFreshnessLocalRepository,
    val newsRefreshesProvider: () -> Int,
    val notificationRefreshesProvider: () -> Int,
    val shiftRefreshesProvider: () -> Int,
    val isRefreshInFlightProvider: () -> Boolean,
    val lastRefreshAtMillisProvider: () -> Long?,
) {
    val deviceRegistrations: Int
        get() = deviceRegistrar.completedRegistrations

    val shiftRefreshes: Int
        get() = shiftRefreshesProvider()

    val isRefreshInFlight: Boolean
        get() = isRefreshInFlightProvider()

    val lastRefreshAtMillis: Long?
        get() = lastRefreshAtMillisProvider()

    val newsRefreshes: Int
        get() = newsRefreshesProvider()

    val notificationRefreshes: Int
        get() = notificationRefreshesProvider()
}

private fun fixture(
    scope: CoroutineScope,
    state: SessionUiState = signedOutState(),
    authProvider: ControlledAuthSessionProvider,
    memberRepository: TestMemberRepository = TestMemberRepository(),
    freshnessRemoteRepository: CriticalDataFreshnessRemoteRepository = EmptyCriticalDataFreshnessRemoteRepository,
    freshnessRefresher: CriticalDataRefresher = CriticalDataRefresher { scope, _ ->
        criticalRefreshPayload(scope)
    },
    authorizedMemberResolver: AuthorizedMemberResolver = AlwaysAuthorizedMemberResolver,
    environmentRouter: RecordingSessionEnvironmentRouter = RecordingSessionEnvironmentRouter(),
    deviceRegistrar: TestAuthorizedDeviceRegistrar = TestAuthorizedDeviceRegistrar(),
    localFreshnessRepository: TestCriticalDataFreshnessLocalRepository =
        TestCriticalDataFreshnessLocalRepository(),
    freshnessNowProvider: () -> Long = { System.currentTimeMillis() },
    sessionOperationTimeoutMillis: Long = TEST_SESSION_OPERATION_TIMEOUT_MILLIS,
    refreshMyOrderConsumer: suspend (CriticalDataRefreshPayload, () -> Boolean) -> Boolean = { _, fence -> fence() },
    refreshMyOrderConsumerWithReceipt: (suspend (
        CriticalDataRefreshPayload,
        () -> Boolean,
    ) -> CriticalDataRefreshConsumerReceipt?)? = null,
    refreshNews: () -> Unit = {},
    refreshNotifications: () -> Unit = {},
    freshnessRetryDelaysMillis: List<Long> = emptyList(),
): AuthFixture {
    val stateFlow = MutableStateFlow(state)
    var lastRefreshAtMillis: Long? = null
    var shiftRefreshes = 0
    var newsRefreshes = 0
    var notificationRefreshes = 0
    val isSessionRefreshInFlight = AtomicBoolean(false)
    val actions = SessionAuthActions(
        uiState = stateFlow,
        scope = scope,
        memberRepository = memberRepository,
        productRepository = EmptyProductRepository,
        sharedProfileRepository = EmptySharedProfileRepository,
        authSessionProvider = authProvider,
        resolveAuthorizedSession = ResolveAuthorizedSessionUseCase(
            memberRepository = memberRepository,
            authorizedMemberResolver = authorizedMemberResolver,
        ),
        authorizedDeviceRegistrar = deviceRegistrar,
        resolveCriticalDataFreshness = ResolveCriticalDataFreshnessUseCase(
            remoteRepository = freshnessRemoteRepository,
            localRepository = localFreshnessRepository,
            refresher = freshnessRefresher,
            nowProvider = freshnessNowProvider,
        ),
        criticalDataFreshnessLocalRepository = localFreshnessRepository,
        sessionEnvironmentRouter = environmentRouter,
        sessionRefreshPolicy = SessionRefreshPolicy(),
        isSessionRefreshInFlight = isSessionRefreshInFlight,
        getLastSessionRefreshAtMillis = { lastRefreshAtMillis },
        setLastSessionRefreshAtMillis = { lastRefreshAtMillis = it },
        nowMillisProvider = { 1_000L },
        refreshNews = {
            newsRefreshes += 1
            refreshNews()
        },
        refreshNotifications = {
            notificationRefreshes += 1
            refreshNotifications()
        },
        refreshShifts = { shiftRefreshes += 1 },
        refreshDeliveryCalendar = {},
        refreshMyOrderConsumer = refreshMyOrderConsumerWithReceipt ?: { payload, fence ->
            if (refreshMyOrderConsumer(payload, fence)) {
                stateFlow.value.criticalDataRefreshConsumerReceipt()
            } else {
                null
            }
        },
        sessionOperationTimeoutMillis = sessionOperationTimeoutMillis,
        freshnessRetryDelaysMillis = freshnessRetryDelaysMillis,
    )
    return AuthFixture(
        actions = actions,
        state = stateFlow,
        environmentRouter = environmentRouter,
        deviceRegistrar = deviceRegistrar,
        localFreshnessRepository = localFreshnessRepository,
        newsRefreshesProvider = { newsRefreshes },
        notificationRefreshesProvider = { notificationRefreshes },
        shiftRefreshesProvider = { shiftRefreshes },
        isRefreshInFlightProvider = isSessionRefreshInFlight::get,
        lastRefreshAtMillisProvider = { lastRefreshAtMillis },
    )
}

private class ControlledAuthSessionProvider(
    private val signInResults: List<CompletableDeferred<AuthSignInResult>> = emptyList(),
    private val lateSignInError: CompletableDeferred<Throwable>? = null,
    private val signUpResults: List<CompletableDeferred<AuthSignInResult>> = emptyList(),
    refreshResult: CompletableDeferred<AuthSessionRefreshResult>? = null,
    private val refreshResults: List<CompletableDeferred<AuthSessionRefreshResult>> = refreshResult?.let(::listOf)
        ?: listOf(CompletableDeferred(AuthSessionRefreshResult.NoSession)),
    private val signOutErrors: List<Throwable?> = emptyList(),
) : AuthSessionProvider {
    class SignInRequest(
        val email: String,
        val password: String,
    ) {
        override fun toString(): String = "SignInRequest(email=$email, password=<redacted>)"
    }

    val signInRequests = mutableListOf<SignInRequest>()
    val signUpRequests = mutableListOf<SignInRequest>()
    var refreshRequests = 0
    var signOutRequests = 0

    override suspend fun signIn(email: String, password: String): AuthSignInResult {
        val requestIndex = signInRequests.size
        signInRequests += SignInRequest(email, password)
        lateSignInError?.let { error ->
            throw withContext(NonCancellable) { error.await() }
        }
        val result = signInResults[requestIndex]
        return withContext(NonCancellable) { result.await() }
    }

    override suspend fun signUp(email: String, password: String): AuthSignInResult {
        val result = signUpResults[signUpRequests.size]
        signUpRequests += SignInRequest(email, password)
        return withContext(NonCancellable) { result.await() }
    }

    override suspend fun sendPasswordReset(email: String): AuthPasswordResetResult =
        error("Unexpected sendPasswordReset")

    override suspend fun refreshCurrentSession(): AuthSessionRefreshResult {
        val result = refreshResults[refreshRequests]
        refreshRequests += 1
        return withContext(NonCancellable) { result.await() }
    }

    override fun signOut() {
        val error = signOutErrors.getOrNull(signOutRequests)
        signOutRequests += 1
        error?.let { throw it }
    }
}

private class TestAuthorizedDeviceRegistrar(
    private val started: CompletableDeferred<Unit>? = null,
    private val release: CompletableDeferred<Unit>? = null,
    private val clearErrors: List<Throwable?> = emptyList(),
    private val lifecycleEvents: MutableList<String>? = null,
) : AuthorizedDeviceRegistrar {
    var registerRequests = 0
    var completedRegistrations = 0
    var clearRequests = 0
    var invalidationRequests = 0
    val sessionFenceValuesAtInvalidation = mutableListOf<Boolean?>()
    val requestedEnvironments = mutableListOf<String>()
    private var currentSessionFence: (() -> Boolean)? = null

    override suspend fun register(
        member: Member,
        environment: String,
        isSessionCurrent: () -> Boolean,
    ) {
        registerRequests += 1
        currentSessionFence = isSessionCurrent
        requestedEnvironments += environment
        lifecycleEvents?.add("register:$environment")
        started?.complete(Unit)
        release?.let { gate ->
            withContext(NonCancellable) {
                gate.await()
            }
        }
        if (isSessionCurrent()) {
            completedRegistrations += 1
        }
    }

    override suspend fun clearAuthorizedSession() {
        val error = clearErrors.getOrNull(clearRequests)
        clearRequests += 1
        error?.let { throw it }
    }

    override fun invalidateAuthorizedSession() {
        invalidationRequests += 1
        sessionFenceValuesAtInvalidation += currentSessionFence?.invoke()
        lifecycleEvents?.add("invalidate")
    }
}

private class TestMemberRepository(
    private val visibleMembersStarted: CompletableDeferred<Unit>? = null,
    private val visibleMembersRelease: CompletableDeferred<Unit>? = null,
    private val visibleMembersError: Exception? = null,
    private val currentEnvironment: () -> String? = { null },
) : MemberRepository {
    var findByAuthUidRequests = 0
    val environmentsAtFindByAuthUid = mutableListOf<String?>()

    override suspend fun findByAuthUid(authUid: String): Member {
        findByAuthUidRequests += 1
        environmentsAtFindByAuthUid += currentEnvironment()
        return member(principalFromUid(authUid))
    }

    override suspend fun getMembersVisibleTo(member: Member): List<Member> {
        visibleMembersStarted?.complete(Unit)
        visibleMembersRelease?.let { release ->
            withContext(NonCancellable) { release.await() }
        }
        visibleMembersError?.let { throw it }
        return listOf(member)
    }

    override suspend fun updateOwnProducerCatalogEnabled(member: Member, isEnabled: Boolean): Member = member
}

private object AlwaysAuthorizedMemberResolver : AuthorizedMemberResolver {
    override suspend fun resolve(): AuthorizedMemberResolution = AuthorizedMemberResolution.Authorized(
        memberId = "member",
        roles = setOf(MemberRole.MEMBER),
        isActive = true,
        environment = "develop",
        firstLoginLinked = false,
    )
}

private object ProductionAuthorizedMemberResolver : AuthorizedMemberResolver {
    override suspend fun resolve(): AuthorizedMemberResolution = AuthorizedMemberResolution.Authorized(
        memberId = "member",
        roles = setOf(MemberRole.MEMBER),
        isActive = true,
        environment = "production",
        firstLoginLinked = false,
    )
}

private object EmailVerificationRequiredMemberResolver : AuthorizedMemberResolver {
    override suspend fun resolve(): AuthorizedMemberResolution = AuthorizedMemberResolution.Unauthorized(
        isActive = null,
        emailVerificationRequired = true,
    )
}

private class ControlledAuthorizedMemberResolver(
    private val started: CompletableDeferred<Unit>,
    private val release: CompletableDeferred<Unit>,
    private val environment: String = "develop",
) : AuthorizedMemberResolver {
    override suspend fun resolve(): AuthorizedMemberResolution {
        started.complete(Unit)
        withContext(NonCancellable) {
            release.await()
        }
        return AuthorizedMemberResolution.Authorized(
            memberId = "member",
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            environment = environment,
            firstLoginLinked = false,
        )
    }
}

private object EmptyNewsRepository : NewsRepository {
    override suspend fun getNewsFor(member: Member): List<NewsArticle> = emptyList()
    override suspend fun upsertNews(article: NewsArticle): NewsArticle = article
    override suspend fun deleteNews(newsId: String): Boolean = false
}

private object EmptyNotificationRepository : NotificationRepository {
    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> = emptyList()
    override suspend fun getReadNotificationIds(memberId: String): Set<String> = emptySet()
    override suspend fun markNotificationsRead(memberId: String, notificationIds: Set<String>, readAtMillis: Long) = Unit
    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = event
}

private object EmptyProductRepository : ProductRepository {
    override suspend fun getAllProducts(): List<Product> = emptyList()
    override suspend fun getProductsForVendor(vendorId: String): List<Product> = emptyList()
    override suspend fun upsertProduct(product: Product): Product = product
}

private object EmptySharedProfileRepository : SharedProfileRepository {
    override suspend fun getAllSharedProfiles(): List<SharedProfile> = emptyList()
    override suspend fun getSharedProfile(userId: String): SharedProfile? = null
    override suspend fun upsertSharedProfile(profile: SharedProfile): SharedProfile = profile
    override suspend fun deleteSharedProfile(userId: String): Boolean = false
}

private object EmptyCriticalDataFreshnessRemoteRepository : CriticalDataFreshnessRemoteRepository {
    override suspend fun getConfig(environment: String): CriticalDataFreshnessConfig = validFreshnessConfig()
}

private class RecordingCriticalDataFreshnessRemoteRepository : CriticalDataFreshnessRemoteRepository {
    val requestedEnvironments = mutableListOf<String>()

    override suspend fun getConfig(environment: String): CriticalDataFreshnessConfig {
        requestedEnvironments += environment
        return validFreshnessConfig()
    }
}

private class ChangingCriticalDataFreshnessRemoteRepository : CriticalDataFreshnessRemoteRepository {
    private var requestCount = 0

    override suspend fun getConfig(environment: String): CriticalDataFreshnessConfig {
        requestCount += 1
        return CriticalDataFreshnessConfig(
            cacheExpirationMinutes = 15,
            remoteTimestampsMillis = CriticalCollection.entries.associateWith {
                if (requestCount == 1) 2_000L else 3_000L
            },
        )
    }
}

private class PartiallyFailingThenRecoveringCriticalDataRefresher : CriticalDataRefresher {
    val requestedCollections = mutableListOf<Set<CriticalCollection>>()

    override suspend fun refresh(
        scope: CriticalDataRefreshScope,
        collections: Set<CriticalCollection>,
    ): CriticalDataRefreshPayload {
        requestedCollections += collections
        if (requestedCollections.size == 1) {
            throw RepositoryException(
                kind = RepositoryErrorKind.UNAVAILABLE,
                resource = "criticalDataRefresh.products",
            )
        }
        return criticalRefreshPayload(scope)
    }
}

private object DelayedCriticalDataRefresher : CriticalDataRefresher {
    override suspend fun refresh(
        scope: CriticalDataRefreshScope,
        collections: Set<CriticalCollection>,
    ): CriticalDataRefreshPayload {
        delay(MY_ORDER_FRESHNESS_TIMEOUT_MILLIS + 1)
        return criticalRefreshPayload(scope)
    }
}

private class ControlledCriticalDataRefresher(
    private val started: CompletableDeferred<Unit>,
    private val release: CompletableDeferred<Unit>,
) : CriticalDataRefresher {
    override suspend fun refresh(
        scope: CriticalDataRefreshScope,
        collections: Set<CriticalCollection>,
    ): CriticalDataRefreshPayload {
        started.complete(Unit)
        withContext(NonCancellable) {
            release.await()
        }
        return criticalRefreshPayload(scope)
    }
}

private class RecoveringCriticalDataFreshnessRemoteRepository : CriticalDataFreshnessRemoteRepository {
    val requestedEnvironments = mutableListOf<String>()

    override suspend fun getConfig(environment: String): CriticalDataFreshnessConfig {
        requestedEnvironments += environment
        if (requestedEnvironments.size == 1) {
            throw RepositoryException(
                kind = RepositoryErrorKind.UNAVAILABLE,
                resource = "criticalDataFreshness.config",
            )
        }
        return validFreshnessConfig()
    }
}

private object DelayedCriticalDataFreshnessRemoteRepository : CriticalDataFreshnessRemoteRepository {
    override suspend fun getConfig(environment: String): CriticalDataFreshnessConfig {
        delay(MY_ORDER_FRESHNESS_TIMEOUT_MILLIS + 1)
        return validFreshnessConfig()
    }
}

private class ControlledCriticalDataFreshnessRemoteRepository(
    private val started: CompletableDeferred<Unit>,
    private val release: CompletableDeferred<Unit>,
) : CriticalDataFreshnessRemoteRepository {
    override suspend fun getConfig(environment: String): CriticalDataFreshnessConfig {
        started.complete(Unit)
        withContext(NonCancellable) {
            release.await()
        }
        return validFreshnessConfig()
    }
}

private open class TestCriticalDataFreshnessLocalRepository(
    private val clearStarted: CompletableDeferred<Unit>? = null,
    private val clearRelease: CompletableDeferred<Unit>? = null,
) : CriticalDataFreshnessLocalRepository {
    var clearRequests = 0
    var completedClearRequests = 0
    var saveRequests = 0
    var storedMetadata: CriticalDataFreshnessMetadata? = null
    private var currentWriteId: String? = null

    override suspend fun getMetadata(): CriticalDataFreshnessMetadata? = storedMetadata
    override suspend fun saveMetadataIfCurrent(
        write: CriticalDataFreshnessMetadataWrite,
        isCurrent: () -> Boolean,
    ): Boolean {
        if (!isCurrent()) return false
        saveRequests += 1
        currentWriteId = write.id
        storedMetadata = write.metadata
        return true
    }
    override suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite) {
        if (currentWriteId == write.id) {
            currentWriteId = null
            storedMetadata = null
        }
    }
    override suspend fun clear() {
        clearRequests += 1
        currentWriteId = null
        storedMetadata = null
        clearStarted?.complete(Unit)
        clearRelease?.let { gate ->
            withContext(NonCancellable) {
                gate.await()
            }
        }
        completedClearRequests += 1
    }
}

private class SuspendedCriticalDataFreshnessLocalRepository(
    private val saveStarted: CompletableDeferred<Unit>,
    private val saveRelease: CompletableDeferred<Unit>,
    private val writeBeforeSuspension: Boolean,
) : TestCriticalDataFreshnessLocalRepository() {
    var rollbackRequests = 0
        private set
    private var suspendedWriteId: String? = null

    override suspend fun saveMetadataIfCurrent(
        write: CriticalDataFreshnessMetadataWrite,
        isCurrent: () -> Boolean,
    ): Boolean {
        if (!isCurrent()) return false
        if (writeBeforeSuspension) {
            suspendedWriteId = write.id
            storedMetadata = write.metadata
        }
        saveStarted.complete(Unit)
        withContext(NonCancellable) {
            saveRelease.await()
        }
        if (!writeBeforeSuspension) {
            suspendedWriteId = write.id
            storedMetadata = write.metadata
        }
        return true
    }

    override suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite) {
        rollbackRequests += 1
        if (suspendedWriteId == write.id) {
            suspendedWriteId = null
            storedMetadata = null
        }
    }

    override suspend fun clear() {
        suspendedWriteId = null
        storedMetadata = null
    }

    fun replaceWithNewerMetadata(metadata: CriticalDataFreshnessMetadata) {
        suspendedWriteId = "newer-write"
        storedMetadata = metadata
    }
}

private class SupersededWriteCriticalDataFreshnessLocalRepository(
    private val firstSaveStarted: CompletableDeferred<Unit>,
    private val firstSaveRelease: CompletableDeferred<Unit>,
    private val secondSaveCompleted: CompletableDeferred<Unit>,
) : TestCriticalDataFreshnessLocalRepository() {
    var rollbackRequests = 0
        private set
    private var saveCount = 0
    private var currentWriteId: String? = null

    override suspend fun saveMetadataIfCurrent(
        write: CriticalDataFreshnessMetadataWrite,
        isCurrent: () -> Boolean,
    ): Boolean {
        if (!isCurrent()) return false
        saveCount += 1
        currentWriteId = write.id
        storedMetadata = write.metadata
        if (saveCount == 1) {
            firstSaveStarted.complete(Unit)
            withContext(NonCancellable) {
                firstSaveRelease.await()
            }
        } else {
            secondSaveCompleted.complete(Unit)
        }
        return true
    }

    override suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite) {
        rollbackRequests += 1
        if (currentWriteId == write.id) {
            currentWriteId = null
            storedMetadata = null
        }
    }
}

private fun validFreshnessConfig() = CriticalDataFreshnessConfig(
    cacheExpirationMinutes = 15,
    remoteTimestampsMillis = com.reguerta.user.domain.freshness.CriticalCollection.entries
        .associateWith { 2_000L },
)

private fun validFreshnessMetadata(
    environment: String,
    validatedAtMillis: Long,
) = CriticalDataFreshnessMetadata(
    environment = environment,
    principalUid = "uid-member",
    authenticatedMemberId = "member",
    memberId = "member",
    canManageMembers = false,
    validatedAtMillis = validatedAtMillis,
    acknowledgedTimestampsMillis = com.reguerta.user.domain.freshness.CriticalCollection.entries
        .associateWith { 2_000L },
)

private class RecordingSessionEnvironmentRouter(
    private val lifecycleEvents: MutableList<String>? = null,
) : SessionEnvironmentRouter {
    var currentEnvironment: String? = null
    val appliedEnvironments = mutableListOf<String>()
    var resetRequests = 0

    override fun applyResolvedEnvironment(environment: String) {
        currentEnvironment = environment
        appliedEnvironments += environment
        lifecycleEvents?.add("apply:$environment")
    }

    override fun resetToBaseEnvironment() {
        currentEnvironment = null
        resetRequests += 1
    }
}

private fun signedOutState() = SessionUiState(
    emailInput = "member@reguerta.app",
)

private fun registrationState() = SessionUiState(
    registerEmailInput = "member@reguerta.app",
)

private fun authorizedState(principal: AuthPrincipal, member: Member) = SessionUiState(
    sessionEnvironment = "develop",
    mode = SessionMode.Authorized(
        principal = principal,
        authenticatedMember = member,
        member = member,
        members = listOf(member),
    ),
)

private fun principal(suffix: String) = AuthPrincipal(
    uid = "uid-$suffix",
    email = "$suffix@reguerta.app",
)

private fun principalFromUid(uid: String) = AuthPrincipal(
    uid = uid,
    email = "${uid.removePrefix("uid-")}@reguerta.app",
)

private fun member(principal: AuthPrincipal) = Member(
    id = "member",
    displayName = "Member",
    normalizedEmail = principal.email,
    authUid = principal.uid,
    roles = setOf(MemberRole.MEMBER),
    isActive = true,
    producerCatalogEnabled = false,
)

private fun criticalRefreshPayload(
    scope: CriticalDataRefreshScope,
    selectedMember: Member = member(principalFromUid(scope.principalUid)).copy(id = scope.memberId),
    authenticatedMember: Member = if (selectedMember.id == scope.authenticatedMemberId) {
        selectedMember
    } else {
        member(principalFromUid(scope.principalUid)).copy(id = scope.authenticatedMemberId)
    },
) = CriticalDataRefreshPayload(
    authenticatedMemberId = authenticatedMember.id,
    authenticatedMember = authenticatedMember,
    selectedMember = selectedMember,
    seasonalCommitments = emptyList(),
)
