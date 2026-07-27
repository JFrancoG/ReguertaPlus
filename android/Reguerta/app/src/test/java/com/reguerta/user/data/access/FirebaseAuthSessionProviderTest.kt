package com.reguerta.user.data.access

import com.reguerta.user.domain.access.AuthSignInFailureReason
import com.reguerta.user.domain.access.AuthSignInResult
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FirebaseAuthSessionProviderTest {
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

private class RecordingFirebaseAuthGateway(
    private val signInUser: FirebaseAuthUserSnapshot? = null,
    private val signUpUser: FirebaseAuthUserSnapshot? = null,
    private val reloadedUser: FirebaseAuthUserSnapshot? = null,
    private val currentUser: FirebaseAuthUserSnapshot? = null,
) : FirebaseAuthGateway {
    var verificationEmailCalls: Int = 0
    var reloadCalls: Int = 0
    var signOutCalls: Int = 0
    val tokenRefreshRequests = mutableListOf<Boolean>()

    override suspend fun signIn(email: String, password: String): FirebaseAuthUserSnapshot? = signInUser

    override suspend fun signUp(email: String, password: String): FirebaseAuthUserSnapshot? = signUpUser

    override suspend fun sendCurrentUserVerificationEmail() {
        verificationEmailCalls += 1
    }

    override suspend fun sendPasswordReset(email: String) = Unit

    override fun currentUserSnapshot(): FirebaseAuthUserSnapshot? = currentUser

    override suspend fun reloadCurrentUser(): FirebaseAuthUserSnapshot? {
        reloadCalls += 1
        return reloadedUser
    }

    override suspend fun refreshCurrentUserToken(forceRefresh: Boolean) {
        tokenRefreshRequests += forceRefresh
    }

    override fun signOut() {
        signOutCalls += 1
    }
}
