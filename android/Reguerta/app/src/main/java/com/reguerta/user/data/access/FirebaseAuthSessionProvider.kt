package com.reguerta.user.data.access

import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.AuthPasswordResetResult
import com.reguerta.user.domain.access.AuthSessionRefreshResult
import com.reguerta.user.domain.access.AuthSessionProvider
import com.reguerta.user.domain.access.AuthSignInFailureReason
import com.reguerta.user.domain.access.AuthSignInResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirebaseAuthSessionProvider(
    private val auth: FirebaseAuth,
) : AuthSessionProvider {
    override suspend fun signIn(email: String, password: String): AuthSignInResult = withContext(Dispatchers.IO) {
        val trimmedEmail = email.trim()
        return@withContext try {
            val result = Tasks.await(auth.signInWithEmailAndPassword(trimmedEmail, password))
            val user = result.user
                ?: return@withContext AuthSignInResult.Failure(AuthSignInFailureReason.UNKNOWN)

            AuthSignInResult.Success(
                principal = AuthPrincipal(
                    uid = user.uid,
                    email = (user.email ?: trimmedEmail).trim().lowercase(),
                ),
            )
        } catch (exception: Exception) {
            AuthSignInResult.Failure(exception.toFailureReason())
        }
    }

    override suspend fun signUp(email: String, password: String): AuthSignInResult = withContext(Dispatchers.IO) {
        val trimmedEmail = email.trim()
        return@withContext try {
            val result = Tasks.await(auth.createUserWithEmailAndPassword(trimmedEmail, password))
            val user = result.user
                ?: return@withContext AuthSignInResult.Failure(AuthSignInFailureReason.UNKNOWN)

            AuthSignInResult.Success(
                principal = AuthPrincipal(
                    uid = user.uid,
                    email = (user.email ?: trimmedEmail).trim().lowercase(),
                ),
            )
        } catch (exception: Exception) {
            AuthSignInResult.Failure(exception.toFailureReason())
        }
    }

    override suspend fun sendPasswordReset(email: String): AuthPasswordResetResult = withContext(Dispatchers.IO) {
        val trimmedEmail = email.trim()
        return@withContext try {
            Tasks.await(auth.sendPasswordResetEmail(trimmedEmail))
            AuthPasswordResetResult.Success
        } catch (exception: Exception) {
            AuthPasswordResetResult.Failure(exception.toFailureReason())
        }
    }

    override suspend fun refreshCurrentSession(): AuthSessionRefreshResult = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: return@withContext AuthSessionRefreshResult.NoSession
        val fallbackPrincipal = AuthPrincipal(
            uid = user.uid,
            email = (user.email ?: "").trim().lowercase(),
        )

        return@withContext try {
            Tasks.await(user.reload())
            val refreshedUser = auth.currentUser ?: return@withContext AuthSessionRefreshResult.Expired
            Tasks.await(refreshedUser.getIdToken(false))

            AuthSessionRefreshResult.Active(
                principal = AuthPrincipal(
                    uid = refreshedUser.uid,
                    email = (refreshedUser.email ?: fallbackPrincipal.email).trim().lowercase(),
                ),
            )
        } catch (exception: Exception) {
            when (exception.toFailureReason()) {
                AuthSignInFailureReason.USER_DISABLED,
                AuthSignInFailureReason.USER_NOT_FOUND,
                AuthSignInFailureReason.INVALID_CREDENTIALS,
                    -> {
                        auth.signOut()
                        AuthSessionRefreshResult.Expired
                    }

                AuthSignInFailureReason.NETWORK,
                AuthSignInFailureReason.TOO_MANY_REQUESTS,
                AuthSignInFailureReason.UNKNOWN,
                AuthSignInFailureReason.INVALID_EMAIL,
                AuthSignInFailureReason.EMAIL_ALREADY_IN_USE,
                AuthSignInFailureReason.WEAK_PASSWORD,
                    -> AuthSessionRefreshResult.Active(fallbackPrincipal)
            }
        }
    }

    override fun signOut() {
        auth.signOut()
    }
}

private fun Exception.toFailureReason(): AuthSignInFailureReason =
    when (this) {
        is FirebaseAuthInvalidCredentialsException -> mapFirebaseAuthErrorCode(errorCode)
        is FirebaseAuthInvalidUserException -> mapFirebaseAuthErrorCode(errorCode)
        is FirebaseNetworkException -> AuthSignInFailureReason.NETWORK
        is FirebaseTooManyRequestsException -> AuthSignInFailureReason.TOO_MANY_REQUESTS
        is FirebaseAuthException -> mapFirebaseAuthErrorCode(errorCode)
        else -> AuthSignInFailureReason.UNKNOWN
    }

internal fun mapFirebaseAuthErrorCode(errorCode: String?): AuthSignInFailureReason =
    when (errorCode) {
        "ERROR_INVALID_EMAIL" -> AuthSignInFailureReason.INVALID_EMAIL
        "ERROR_WRONG_PASSWORD",
        "ERROR_INVALID_CREDENTIAL",
        "ERROR_INVALID_LOGIN_CREDENTIALS",
        -> AuthSignInFailureReason.INVALID_CREDENTIALS
        "ERROR_EMAIL_ALREADY_IN_USE",
        "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL",
        -> AuthSignInFailureReason.EMAIL_ALREADY_IN_USE
        "ERROR_WEAK_PASSWORD" -> AuthSignInFailureReason.WEAK_PASSWORD
        "ERROR_USER_NOT_FOUND" -> AuthSignInFailureReason.USER_NOT_FOUND
        "ERROR_USER_DISABLED" -> AuthSignInFailureReason.USER_DISABLED
        "ERROR_TOO_MANY_REQUESTS" -> AuthSignInFailureReason.TOO_MANY_REQUESTS
        "ERROR_NETWORK_REQUEST_FAILED" -> AuthSignInFailureReason.NETWORK
        else -> AuthSignInFailureReason.UNKNOWN
    }
