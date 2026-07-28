package com.reguerta.user.data.access

import com.reguerta.user.domain.access.AuthSignInFailureReason
import com.reguerta.user.domain.access.AuthSignInResult
import com.reguerta.user.domain.access.AuthSessionRefreshResult
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FirebaseAuthSessionProviderTest {
    @Test
    fun `initial sign in failure does not sign out an unrelated auth state`() = runBlocking {
        val gateway = RecordingFirebaseAuthGateway(
            signInError = IOException("credentials request failed"),
        )

        val result = FirebaseAuthSessionProvider(gateway).signIn(
            email = "member@reguerta.app",
            password = "secret123",
        )

        assertTrue(result is AuthSignInResult.Failure)
        assertEquals(0, gateway.signOutCalls)
        assertEquals(0, gateway.reloadCalls)
    }

    @Test
    fun `reload failure after sign in mutation closes auth before returning failure`() = runBlocking {
        val gateway = RecordingFirebaseAuthGateway(
            signInUser = verifiedUser("mutated-sign-in"),
            reloadError = IOException("reload failed"),
        )

        val result = FirebaseAuthSessionProvider(gateway).signIn(
            email = "member@reguerta.app",
            password = "secret123",
        )

        assertTrue(result is AuthSignInResult.Failure)
        assertEquals(1, gateway.signOutCalls)
        assertEquals(1, gateway.reloadCalls)
    }

    @Test
    fun `post mutation failure propagates when firebase sign out cannot be confirmed`() = runBlocking {
        val gateway = RecordingFirebaseAuthGateway(
            signInUser = verifiedUser("unconfirmed-cleanup"),
            reloadError = IOException("reload failed"),
            signOutError = IOException("sign out failed"),
        )
        var thrown: Throwable? = null

        try {
            FirebaseAuthSessionProvider(gateway).signIn(
                email = "member@reguerta.app",
                password = "secret123",
            )
        } catch (error: Throwable) {
            thrown = error
        }

        assertTrue(thrown is FirebaseAuthCleanupNotConfirmedException)
        assertEquals(1, gateway.signOutCalls)
    }

    @Test
    fun `missing user after completed sign in closes auth before returning failure`() = runBlocking {
        val gateway = RecordingFirebaseAuthGateway()

        val result = FirebaseAuthSessionProvider(gateway).signIn(
            email = "member@reguerta.app",
            password = "secret123",
        )

        assertTrue(result is AuthSignInResult.Failure)
        assertEquals(1, gateway.signOutCalls)
        assertEquals(1, gateway.reloadCalls)
    }

    @Test
    fun `initial sign up failure does not sign out an unrelated auth state`() = runBlocking {
        val gateway = RecordingFirebaseAuthGateway(
            signUpError = IOException("create request failed"),
        )

        val result = FirebaseAuthSessionProvider(gateway).signUp(
            email = "new@reguerta.app",
            password = "secret123",
        )

        assertTrue(result is AuthSignInResult.Failure)
        assertEquals(0, gateway.signOutCalls)
        assertEquals(0, gateway.verificationEmailCalls)
    }

    @Test
    fun `verification failure after sign up mutation closes auth before returning failure`() = runBlocking {
        val gateway = RecordingFirebaseAuthGateway(
            signUpUser = verifiedUser("mutated-sign-up"),
            verificationError = IOException("verification failed"),
        )

        val result = FirebaseAuthSessionProvider(gateway).signUp(
            email = "new@reguerta.app",
            password = "secret123",
        )

        assertTrue(result is AuthSignInResult.Failure)
        assertEquals(1, gateway.signOutCalls)
        assertEquals(1, gateway.verificationEmailCalls)
    }

    @Test
    fun `missing user after completed sign up closes auth before returning failure`() = runBlocking {
        val gateway = RecordingFirebaseAuthGateway()

        val result = FirebaseAuthSessionProvider(gateway).signUp(
            email = "new@reguerta.app",
            password = "secret123",
        )

        assertTrue(result is AuthSignInResult.Failure)
        assertEquals(1, gateway.signOutCalls)
        assertEquals(0, gateway.verificationEmailCalls)
    }

    @Test
    fun `refresh failure before a successful reload keeps the known active session`() = runBlocking {
        val currentUser = verifiedUser("offline-refresh")
        val gateway = RecordingFirebaseAuthGateway(
            currentUser = currentUser,
            reloadError = IOException("offline"),
        )

        val result = FirebaseAuthSessionProvider(gateway).refreshCurrentSession()

        val active = result as AuthSessionRefreshResult.Active
        assertEquals(currentUser.uid, active.principal.uid)
        assertEquals(0, gateway.signOutCalls)
    }

    @Test
    fun `token failure after successful reload closes auth and propagates for fail closed recovery`() = runBlocking {
        val currentUser = verifiedUser("token-failure")
        val gateway = RecordingFirebaseAuthGateway(
            currentUser = currentUser,
            reloadedUser = currentUser,
            tokenRefreshError = IOException("token refresh failed"),
        )
        var thrown: Throwable? = null

        try {
            FirebaseAuthSessionProvider(gateway).refreshCurrentSession()
        } catch (error: Throwable) {
            thrown = error
        }

        assertTrue(thrown is IOException)
        assertEquals(1, gateway.signOutCalls)
        assertEquals(listOf(true), gateway.tokenRefreshRequests)
    }

    @Test
    fun `cancellation after firebase sign in closes auth before reload`() = runBlocking {
        val signInStarted = CompletableDeferred<Unit>()
        val signInRelease = CompletableDeferred<Unit>()
        val gateway = CancellationCheckpointFirebaseAuthGateway(
            signInStarted = signInStarted,
            signInRelease = signInRelease,
        )
        val provider = FirebaseAuthSessionProvider(gateway)
        val job = launch {
            provider.signIn(
                email = "member@reguerta.app",
                password = "secret123",
            )
        }

        signInStarted.await()
        job.cancel()
        signInRelease.complete(Unit)
        job.join()

        assertEquals(1, gateway.signOutCalls)
        assertEquals(0, gateway.reloadCalls)
    }

    @Test
    fun `cancellation after firebase sign up closes auth before verification`() = runBlocking {
        val signUpStarted = CompletableDeferred<Unit>()
        val signUpRelease = CompletableDeferred<Unit>()
        val gateway = CancellationCheckpointSignUpGateway(
            signUpStarted = signUpStarted,
            signUpRelease = signUpRelease,
        )
        val provider = FirebaseAuthSessionProvider(gateway)
        val job = launch {
            provider.signUp(
                email = "new@reguerta.app",
                password = "secret123",
            )
        }

        signUpStarted.await()
        job.cancel()
        signUpRelease.complete(Unit)
        job.join()

        assertEquals(1, gateway.signOutCalls)
        assertEquals(0, gateway.verificationEmailCalls)
    }

    @Test
    fun `cancellation while sign in reload returns closes auth before token refresh`() = runBlocking {
        val reloadStarted = CompletableDeferred<Unit>()
        val reloadRelease = CompletableDeferred<Unit>()
        val user = verifiedUser("cancelled-sign-in-reload")
        val gateway = RecordingFirebaseAuthGateway(
            signInUser = user,
            reloadedUser = user,
            reloadStarted = reloadStarted,
            reloadRelease = reloadRelease,
        )
        val job = launch {
            FirebaseAuthSessionProvider(gateway).signIn(
                email = user.email.orEmpty(),
                password = "secret123",
            )
        }

        reloadStarted.await()
        job.cancel()
        reloadRelease.complete(Unit)
        job.join()

        assertEquals(1, gateway.signOutCalls)
        assertTrue(gateway.tokenRefreshRequests.isEmpty())
    }

    @Test
    fun `cancellation while sign in token refresh returns closes auth`() = runBlocking {
        val tokenStarted = CompletableDeferred<Unit>()
        val tokenRelease = CompletableDeferred<Unit>()
        val user = verifiedUser("cancelled-sign-in-token")
        val gateway = RecordingFirebaseAuthGateway(
            signInUser = user,
            reloadedUser = user,
            tokenStarted = tokenStarted,
            tokenRelease = tokenRelease,
        )
        val job = launch {
            FirebaseAuthSessionProvider(gateway).signIn(
                email = user.email.orEmpty(),
                password = "secret123",
            )
        }

        tokenStarted.await()
        job.cancel()
        tokenRelease.complete(Unit)
        job.join()

        assertEquals(1, gateway.signOutCalls)
        assertEquals(listOf(true), gateway.tokenRefreshRequests)
    }

    @Test
    fun `cancellation while sign up verification returns closes auth`() = runBlocking {
        val verificationStarted = CompletableDeferred<Unit>()
        val verificationRelease = CompletableDeferred<Unit>()
        val user = verifiedUser("cancelled-sign-up-verification")
        val gateway = RecordingFirebaseAuthGateway(
            signUpUser = user,
            verificationStarted = verificationStarted,
            verificationRelease = verificationRelease,
        )
        val job = launch {
            FirebaseAuthSessionProvider(gateway).signUp(
                email = user.email.orEmpty(),
                password = "secret123",
            )
        }

        verificationStarted.await()
        job.cancel()
        verificationRelease.complete(Unit)
        job.join()

        assertEquals(1, gateway.signOutCalls)
        assertEquals(1, gateway.verificationEmailCalls)
    }

    @Test
    fun `cancellation while refresh reload returns closes auth before token refresh`() = runBlocking {
        val reloadStarted = CompletableDeferred<Unit>()
        val reloadRelease = CompletableDeferred<Unit>()
        val user = verifiedUser("cancelled-refresh-reload")
        val gateway = RecordingFirebaseAuthGateway(
            currentUser = user,
            reloadedUser = user,
            reloadStarted = reloadStarted,
            reloadRelease = reloadRelease,
        )
        val job = launch {
            FirebaseAuthSessionProvider(gateway).refreshCurrentSession()
        }

        reloadStarted.await()
        job.cancel()
        reloadRelease.complete(Unit)
        job.join()

        assertEquals(1, gateway.signOutCalls)
        assertTrue(gateway.tokenRefreshRequests.isEmpty())
    }

    @Test
    fun `cancellation while refresh token returns closes auth`() = runBlocking {
        val tokenStarted = CompletableDeferred<Unit>()
        val tokenRelease = CompletableDeferred<Unit>()
        val user = verifiedUser("cancelled-refresh-token")
        val gateway = RecordingFirebaseAuthGateway(
            currentUser = user,
            reloadedUser = user,
            tokenStarted = tokenStarted,
            tokenRelease = tokenRelease,
        )
        val job = launch {
            FirebaseAuthSessionProvider(gateway).refreshCurrentSession()
        }

        tokenStarted.await()
        job.cancel()
        tokenRelease.complete(Unit)
        job.join()

        assertEquals(1, gateway.signOutCalls)
        assertEquals(listOf(true), gateway.tokenRefreshRequests)
    }

    @Test
    fun `maps credential related firebase error codes`() {
        assertEquals(
            AuthSignInFailureReason.INVALID_CREDENTIALS,
            mapFirebaseAuthErrorCode("ERROR_WRONG_PASSWORD"),
        )
        assertEquals(
            AuthSignInFailureReason.INVALID_CREDENTIALS,
            mapFirebaseAuthErrorCode("ERROR_INVALID_CREDENTIAL"),
        )
        assertEquals(
            AuthSignInFailureReason.INVALID_CREDENTIALS,
            mapFirebaseAuthErrorCode("ERROR_INVALID_LOGIN_CREDENTIALS"),
        )
    }

    @Test
    fun `maps account related firebase error codes`() {
        assertEquals(AuthSignInFailureReason.INVALID_EMAIL, mapFirebaseAuthErrorCode("ERROR_INVALID_EMAIL"))
        assertEquals(AuthSignInFailureReason.EMAIL_ALREADY_IN_USE, mapFirebaseAuthErrorCode("ERROR_EMAIL_ALREADY_IN_USE"))
        assertEquals(AuthSignInFailureReason.WEAK_PASSWORD, mapFirebaseAuthErrorCode("ERROR_WEAK_PASSWORD"))
        assertEquals(AuthSignInFailureReason.USER_NOT_FOUND, mapFirebaseAuthErrorCode("ERROR_USER_NOT_FOUND"))
        assertEquals(AuthSignInFailureReason.USER_DISABLED, mapFirebaseAuthErrorCode("ERROR_USER_DISABLED"))
    }

    @Test
    fun `maps operational firebase error codes and defaults unknown`() {
        assertEquals(AuthSignInFailureReason.TOO_MANY_REQUESTS, mapFirebaseAuthErrorCode("ERROR_TOO_MANY_REQUESTS"))
        assertEquals(AuthSignInFailureReason.NETWORK, mapFirebaseAuthErrorCode("ERROR_NETWORK_REQUEST_FAILED"))
        assertEquals(AuthSignInFailureReason.UNKNOWN, mapFirebaseAuthErrorCode("SOMETHING_ELSE"))
        assertEquals(AuthSignInFailureReason.UNKNOWN, mapFirebaseAuthErrorCode(null))
    }

    @Test
    fun `sign up sends verification email and never exposes principal`() = runBlocking {
        val gateway = RecordingFirebaseAuthGateway(
            signUpUser = FirebaseAuthUserSnapshot(
                uid = "new_uid",
                email = "new@reguerta.app",
                emailVerified = false,
            ),
        )

        val result = FirebaseAuthSessionProvider(gateway).signUp(
            email = "new@reguerta.app",
            password = "secret123",
        )

        assertEquals(
            AuthSignInFailureReason.EMAIL_NOT_VERIFIED,
            (result as AuthSignInResult.Failure).reason,
        )
        assertEquals(1, gateway.verificationEmailCalls)
        assertEquals(1, gateway.signOutCalls)
        assertEquals(0, gateway.reloadCalls)
    }

    @Test
    fun `sign in resends verification and closes an unverified session`() = runBlocking {
        val unverified = FirebaseAuthUserSnapshot(
            uid = "pending_uid",
            email = "pending@reguerta.app",
            emailVerified = false,
        )
        val gateway = RecordingFirebaseAuthGateway(
            signInUser = unverified,
            reloadedUser = unverified,
        )

        val result = FirebaseAuthSessionProvider(gateway).signIn(
            email = "pending@reguerta.app",
            password = "secret123",
        )

        assertEquals(
            AuthSignInFailureReason.EMAIL_NOT_VERIFIED,
            (result as AuthSignInResult.Failure).reason,
        )
        assertEquals(1, gateway.reloadCalls)
        assertTrue(gateway.tokenRefreshRequests.isEmpty())
        assertEquals(1, gateway.verificationEmailCalls)
        assertEquals(1, gateway.signOutCalls)
    }

    @Test
    fun `sign in returns principal only after refreshed user is verified`() = runBlocking {
        val verified = FirebaseAuthUserSnapshot(
            uid = "verified_uid",
            email = "verified@reguerta.app",
            emailVerified = true,
        )
        val gateway = RecordingFirebaseAuthGateway(
            signInUser = verified,
            reloadedUser = verified,
        )

        val result = FirebaseAuthSessionProvider(gateway).signIn(
            email = "verified@reguerta.app",
            password = "secret123",
        )

        assertTrue(result is AuthSignInResult.Success)
        assertEquals("verified_uid", (result as AuthSignInResult.Success).principal.uid)
        assertEquals(1, gateway.reloadCalls)
        assertEquals(listOf(true), gateway.tokenRefreshRequests)
        assertEquals(0, gateway.signOutCalls)
    }
}

private class CancellationCheckpointFirebaseAuthGateway(
    private val signInStarted: CompletableDeferred<Unit>,
    private val signInRelease: CompletableDeferred<Unit>,
) : FirebaseAuthGateway {
    var reloadCalls = 0
    var signOutCalls = 0

    override suspend fun signIn(email: String, password: String): FirebaseAuthUserSnapshot =
        withContext(NonCancellable) {
            signInStarted.complete(Unit)
            signInRelease.await()
            FirebaseAuthUserSnapshot(
                uid = "cancelled_uid",
                email = email,
                emailVerified = true,
            )
        }

    override suspend fun signUp(email: String, password: String): FirebaseAuthUserSnapshot? =
        error("Unexpected signUp")

    override suspend fun sendCurrentUserVerificationEmail() = error("Unexpected verification")

    override suspend fun sendPasswordReset(email: String) = error("Unexpected password reset")

    override fun currentUserSnapshot(): FirebaseAuthUserSnapshot? = null

    override suspend fun reloadCurrentUser(): FirebaseAuthUserSnapshot? {
        reloadCalls += 1
        return null
    }

    override suspend fun refreshCurrentUserToken(forceRefresh: Boolean) = error("Unexpected token refresh")

    override fun signOut() {
        signOutCalls += 1
    }
}

private class CancellationCheckpointSignUpGateway(
    private val signUpStarted: CompletableDeferred<Unit>,
    private val signUpRelease: CompletableDeferred<Unit>,
) : FirebaseAuthGateway {
    var verificationEmailCalls = 0
    var signOutCalls = 0

    override suspend fun signIn(email: String, password: String): FirebaseAuthUserSnapshot? =
        error("Unexpected signIn")

    override suspend fun signUp(email: String, password: String): FirebaseAuthUserSnapshot =
        withContext(NonCancellable) {
            signUpStarted.complete(Unit)
            signUpRelease.await()
            FirebaseAuthUserSnapshot(
                uid = "cancelled_new_uid",
                email = email,
                emailVerified = false,
            )
        }

    override suspend fun sendCurrentUserVerificationEmail() {
        verificationEmailCalls += 1
    }

    override suspend fun sendPasswordReset(email: String) = error("Unexpected password reset")

    override fun currentUserSnapshot(): FirebaseAuthUserSnapshot? = null

    override suspend fun reloadCurrentUser(): FirebaseAuthUserSnapshot? = error("Unexpected reload")

    override suspend fun refreshCurrentUserToken(forceRefresh: Boolean) = error("Unexpected token refresh")

    override fun signOut() {
        signOutCalls += 1
    }
}

private class RecordingFirebaseAuthGateway(
    private val signInUser: FirebaseAuthUserSnapshot? = null,
    private val signUpUser: FirebaseAuthUserSnapshot? = null,
    private val reloadedUser: FirebaseAuthUserSnapshot? = null,
    private val currentUser: FirebaseAuthUserSnapshot? = null,
    private val signInError: Exception? = null,
    private val signUpError: Exception? = null,
    private val verificationError: Exception? = null,
    private val reloadError: Exception? = null,
    private val tokenRefreshError: Exception? = null,
    private val signOutError: Exception? = null,
    private val reloadStarted: CompletableDeferred<Unit>? = null,
    private val reloadRelease: CompletableDeferred<Unit>? = null,
    private val tokenStarted: CompletableDeferred<Unit>? = null,
    private val tokenRelease: CompletableDeferred<Unit>? = null,
    private val verificationStarted: CompletableDeferred<Unit>? = null,
    private val verificationRelease: CompletableDeferred<Unit>? = null,
) : FirebaseAuthGateway {
    var verificationEmailCalls: Int = 0
    var reloadCalls: Int = 0
    var signOutCalls: Int = 0
    val tokenRefreshRequests = mutableListOf<Boolean>()

    override suspend fun signIn(email: String, password: String): FirebaseAuthUserSnapshot? {
        signInError?.let { throw it }
        return signInUser
    }

    override suspend fun signUp(email: String, password: String): FirebaseAuthUserSnapshot? {
        signUpError?.let { throw it }
        return signUpUser
    }

    override suspend fun sendCurrentUserVerificationEmail() {
        verificationEmailCalls += 1
        verificationStarted?.complete(Unit)
        verificationRelease?.let { release ->
            withContext(NonCancellable) {
                release.await()
            }
        }
        verificationError?.let { throw it }
    }

    override suspend fun sendPasswordReset(email: String) = Unit

    override fun currentUserSnapshot(): FirebaseAuthUserSnapshot? = currentUser

    override suspend fun reloadCurrentUser(): FirebaseAuthUserSnapshot? {
        reloadCalls += 1
        reloadStarted?.complete(Unit)
        reloadRelease?.let { release ->
            withContext(NonCancellable) {
                release.await()
            }
        }
        reloadError?.let { throw it }
        return reloadedUser
    }

    override suspend fun refreshCurrentUserToken(forceRefresh: Boolean) {
        tokenRefreshRequests += forceRefresh
        tokenStarted?.complete(Unit)
        tokenRelease?.let { release ->
            withContext(NonCancellable) {
                release.await()
            }
        }
        tokenRefreshError?.let { throw it }
    }

    override fun signOut() {
        signOutCalls += 1
        signOutError?.let { throw it }
    }
}

private fun verifiedUser(id: String) = FirebaseAuthUserSnapshot(
    uid = "uid-$id",
    email = "$id@reguerta.app",
    emailVerified = true,
)
