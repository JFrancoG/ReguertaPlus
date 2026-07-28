package com.reguerta.user.presentation.auth

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
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.SessionEnvironmentRouter
import com.reguerta.user.domain.access.SessionRefreshPolicy
import com.reguerta.user.domain.access.SessionRefreshTrigger
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.freshness.CriticalDataFreshnessConfig
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.CriticalDataFreshnessMetadata
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
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceUntilIdle
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

        fixture.actions.signIn()
        runCurrent()
        assertEquals(1, authProvider.signInRequests.size)

        fixture.actions.signOut()
        signInResult.complete(AuthSignInResult.Success(principal("late")))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(2, authProvider.signOutRequests)
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

        fixture.actions.signIn()
        visibleMembersStarted.await()
        fixture.actions.signOut()
        visibleMembersRelease.complete(Unit)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(2, authProvider.signOutRequests)
        assertEquals(0, fixture.deviceRegistrations)
        assertEquals(0, fixture.shiftRefreshes)
    }

    @Test
    fun `new auth operation waits for stale predecessor cleanup and is sole publisher`() = runTest {
        val firstResult = CompletableDeferred<AuthSignInResult>()
        val secondResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(firstResult, secondResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        fixture.actions.signIn()
        runCurrent()
        fixture.state.value = fixture.state.value.copy(
            emailInput = "new@reguerta.app",
            passwordInput = "new-secret",
        )
        fixture.actions.signIn()
        runCurrent()

        val requestsBeforePredecessorCompletion = authProvider.signInRequests.size

        firstResult.complete(AuthSignInResult.Success(principal("old")))
        runCurrent()

        val staleCleanupSignOuts = authProvider.signOutRequests
        val requestOrder = authProvider.signInRequests.map { it.email.substringBefore('@') }
        secondResult.complete(AuthSignInResult.Success(principal("new")))
        advanceUntilIdle()

        val mode = fixture.state.value.mode as SessionMode.Authorized
        assertEquals(1, requestsBeforePredecessorCompletion)
        assertEquals(1, staleCleanupSignOuts)
        assertEquals(listOf("member", "new"), requestOrder)
        assertEquals("uid-new", mode.principal.uid)
        assertEquals(1, fixture.deviceRegistrations)
    }

    @Test
    fun `stale refresh finalizer cannot clear ownership or timestamp of newer refresh`() = runTest {
        val firstRefresh = CompletableDeferred<AuthSessionRefreshResult>()
        val secondRefresh = CompletableDeferred<AuthSessionRefreshResult>()
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
        val requestsBeforePredecessorCompletion = authProvider.refreshRequests

        firstRefresh.complete(AuthSessionRefreshResult.Active(principal))
        runCurrent()

        val requestsAfterPredecessorCompletion = authProvider.refreshRequests
        val newerRefreshStillOwnsFlag = fixture.isRefreshInFlight
        val timestampBeforeNewerRefreshCompletion = fixture.lastRefreshAtMillis

        secondRefresh.complete(AuthSessionRefreshResult.NoSession)
        advanceUntilIdle()

        assertEquals(1, requestsBeforePredecessorCompletion)
        assertEquals(2, requestsAfterPredecessorCompletion)
        assertTrue(newerRefreshStillOwnsFlag)
        assertEquals(null, timestampBeforeNewerRefreshCompletion)
        assertFalse(fixture.isRefreshInFlight)
        assertEquals(1_000L, fixture.lastRefreshAtMillis)
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

        fixture.actions.signUp()
        runCurrent()
        assertEquals(1, authProvider.signUpRequests.size)

        fixture.actions.signOut()
        signUpResult.complete(AuthSignInResult.Success(principal("late-sign-up")))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(2, authProvider.signOutRequests)
        assertEquals(null, fixture.state.value.registerEmailErrorRes)
        assertEquals("", fixture.state.value.registerEmailInput)
        assertEquals(0, fixture.deviceRegistrations)
    }

    @Test
    fun `late sign in failure cannot publish errors after sign out`() = runTest {
        val signInResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(signInResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        fixture.actions.signIn()
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

        fixture.actions.signUp()
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

        fixture.actions.signIn()
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
    fun `three operation chain preserves predecessor cleanup before final sign in`() = runTest {
        val firstResult = CompletableDeferred<AuthSignInResult>()
        val finalResult = CompletableDeferred<AuthSignInResult>()
        val authProvider = ControlledAuthSessionProvider(signInResults = listOf(firstResult, finalResult))
        val fixture = fixture(scope = this, authProvider = authProvider)

        fixture.actions.signIn()
        runCurrent()
        fixture.state.value = fixture.state.value.copy(
            emailInput = "middle@reguerta.app",
            passwordInput = "middle-secret",
        )
        fixture.actions.signIn()
        runCurrent()
        fixture.state.value = fixture.state.value.copy(
            emailInput = "final@reguerta.app",
            passwordInput = "final-secret",
        )
        fixture.actions.signIn()
        runCurrent()

        assertEquals(listOf("member"), authProvider.signInRequests.map { it.email.substringBefore('@') })

        firstResult.complete(AuthSignInResult.Success(principal("first")))
        runCurrent()

        assertEquals(
            listOf("member", "final"),
            authProvider.signInRequests.map { it.email.substringBefore('@') },
        )
        assertEquals(1, authProvider.signOutRequests)

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

        fixture.actions.signIn()
        resolverStarted.await()
        fixture.actions.signOut()
        resolverRelease.complete(Unit)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertTrue(environmentRouter.appliedEnvironments.isEmpty())
        assertEquals(null, environmentRouter.currentEnvironment)
        assertEquals(0, memberRepository.findByAuthUidRequests)
        assertEquals(2, authProvider.signOutRequests)
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

        fixture.actions.signIn()
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

        fixture.actions.signIn()
        registrationStarted.await()
        fixture.actions.signOut()
        registrationRelease.complete(Unit)
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(listOf("develop"), deviceRegistrar.requestedEnvironments)
        assertEquals(0, deviceRegistrar.completedRegistrations)
        assertTrue(deviceRegistrar.clearRequests >= 1)
        assertEquals(2, authProvider.signOutRequests)
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
    fun `late non cancellation exception cleans stale authentication`() = runTest {
        val lateError = CompletableDeferred<Throwable>()
        val authProvider = ControlledAuthSessionProvider(lateSignInError = lateError)
        val fixture = fixture(scope = this, authProvider = authProvider)

        fixture.actions.signIn()
        runCurrent()
        fixture.actions.signOut()
        lateError.complete(IOException("late provider failure"))
        advanceUntilIdle()

        assertTrue(fixture.state.value.mode is SessionMode.SignedOut)
        assertEquals(2, authProvider.signOutRequests)
        assertEquals(null, fixture.environmentRouter.currentEnvironment)
        assertEquals(null, fixture.state.value.emailErrorRes)
        assertTrue(fixture.deviceRegistrar.clearRequests >= 1)
    }
}

private data class AuthFixture(
    val actions: SessionAuthActions,
    val state: MutableStateFlow<SessionUiState>,
    val environmentRouter: RecordingSessionEnvironmentRouter,
    val deviceRegistrar: TestAuthorizedDeviceRegistrar,
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
}

private fun fixture(
    scope: CoroutineScope,
    state: SessionUiState = signedOutState(),
    authProvider: ControlledAuthSessionProvider,
    memberRepository: TestMemberRepository = TestMemberRepository(),
    freshnessRemoteRepository: CriticalDataFreshnessRemoteRepository = EmptyCriticalDataFreshnessRemoteRepository,
    authorizedMemberResolver: AuthorizedMemberResolver = AlwaysAuthorizedMemberResolver,
    environmentRouter: RecordingSessionEnvironmentRouter = RecordingSessionEnvironmentRouter(),
    deviceRegistrar: TestAuthorizedDeviceRegistrar = TestAuthorizedDeviceRegistrar(),
    localFreshnessRepository: TestCriticalDataFreshnessLocalRepository =
        TestCriticalDataFreshnessLocalRepository(),
): AuthFixture {
    val stateFlow = MutableStateFlow(state)
    var lastRefreshAtMillis: Long? = null
    var shiftRefreshes = 0
    val isSessionRefreshInFlight = AtomicBoolean(false)
    val actions = SessionAuthActions(
        uiState = stateFlow,
        scope = scope,
        memberRepository = memberRepository,
        newsRepository = EmptyNewsRepository,
        notificationRepository = EmptyNotificationRepository,
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
        ),
        criticalDataFreshnessLocalRepository = localFreshnessRepository,
        sessionEnvironmentRouter = environmentRouter,
        sessionRefreshPolicy = SessionRefreshPolicy(),
        isSessionRefreshInFlight = isSessionRefreshInFlight,
        getLastSessionRefreshAtMillis = { lastRefreshAtMillis },
        setLastSessionRefreshAtMillis = { lastRefreshAtMillis = it },
        nowMillisProvider = { 1_000L },
        refreshShifts = { shiftRefreshes += 1 },
        refreshDeliveryCalendar = {},
    )
    return AuthFixture(
        actions = actions,
        state = stateFlow,
        environmentRouter = environmentRouter,
        deviceRegistrar = deviceRegistrar,
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
) : AuthSessionProvider {
    data class SignInRequest(val email: String)

    val signInRequests = mutableListOf<SignInRequest>()
    val signUpRequests = mutableListOf<SignInRequest>()
    var refreshRequests = 0
    var signOutRequests = 0

    override suspend fun signIn(email: String, password: String): AuthSignInResult {
        val requestIndex = signInRequests.size
        signInRequests += SignInRequest(email)
        lateSignInError?.let { error ->
            throw withContext(NonCancellable) { error.await() }
        }
        val result = signInResults[requestIndex]
        return withContext(NonCancellable) { result.await() }
    }

    override suspend fun signUp(email: String, password: String): AuthSignInResult {
        val result = signUpResults[signUpRequests.size]
        signUpRequests += SignInRequest(email)
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
        signOutRequests += 1
    }
}

private class TestAuthorizedDeviceRegistrar(
    private val started: CompletableDeferred<Unit>? = null,
    private val release: CompletableDeferred<Unit>? = null,
) : AuthorizedDeviceRegistrar {
    var registerRequests = 0
    var completedRegistrations = 0
    var clearRequests = 0
    val requestedEnvironments = mutableListOf<String>()

    override suspend fun register(
        member: Member,
        environment: String,
        isSessionCurrent: () -> Boolean,
    ) {
        registerRequests += 1
        requestedEnvironments += environment
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

    override fun clearAuthorizedSession() {
        clearRequests += 1
    }
}

private class TestMemberRepository(
    private val visibleMembersStarted: CompletableDeferred<Unit>? = null,
    private val visibleMembersRelease: CompletableDeferred<Unit>? = null,
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
    override suspend fun getConfig(): CriticalDataFreshnessConfig? = null
}

private class ControlledCriticalDataFreshnessRemoteRepository(
    private val started: CompletableDeferred<Unit>,
    private val release: CompletableDeferred<Unit>,
) : CriticalDataFreshnessRemoteRepository {
    override suspend fun getConfig(): CriticalDataFreshnessConfig? {
        started.complete(Unit)
        withContext(NonCancellable) {
            release.await()
        }
        return null
    }
}

private class TestCriticalDataFreshnessLocalRepository(
    private val clearStarted: CompletableDeferred<Unit>? = null,
    private val clearRelease: CompletableDeferred<Unit>? = null,
) : CriticalDataFreshnessLocalRepository {
    var clearRequests = 0

    override suspend fun getMetadata(): CriticalDataFreshnessMetadata? = null
    override suspend fun saveMetadata(metadata: CriticalDataFreshnessMetadata) = Unit
    override suspend fun clear() {
        clearRequests += 1
        clearStarted?.complete(Unit)
        clearRelease?.let { gate ->
            withContext(NonCancellable) {
                gate.await()
            }
        }
    }
}

private class RecordingSessionEnvironmentRouter : SessionEnvironmentRouter {
    var currentEnvironment: String? = null
    val appliedEnvironments = mutableListOf<String>()
    var resetRequests = 0

    override fun applyResolvedEnvironment(environment: String) {
        currentEnvironment = environment
        appliedEnvironments += environment
    }

    override fun resetToBaseEnvironment() {
        currentEnvironment = null
        resetRequests += 1
    }
}

private fun signedOutState() = SessionUiState(
    emailInput = "member@reguerta.app",
    passwordInput = "secret123",
)

private fun registrationState() = SessionUiState(
    registerEmailInput = "member@reguerta.app",
    registerPasswordInput = "secret123",
    registerRepeatPasswordInput = "secret123",
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
