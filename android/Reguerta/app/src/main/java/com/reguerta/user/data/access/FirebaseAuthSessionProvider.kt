package com.reguerta.user.data.access

import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.reguerta.user.domain.access.AuthPrincipal
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
        "ERROR_EMAIL_ALREADY_IN_USE" -> AuthSignInFailureReason.EMAIL_ALREADY_IN_USE
        "ERROR_WEAK_PASSWORD" -> AuthSignInFailureReason.WEAK_PASSWORD
        "ERROR_USER_NOT_FOUND" -> AuthSignInFailureReason.USER_NOT_FOUND
        "ERROR_USER_DISABLED" -> AuthSignInFailureReason.USER_DISABLED
        "ERROR_TOO_MANY_REQUESTS" -> AuthSignInFailureReason.TOO_MANY_REQUESTS
        "ERROR_NETWORK_REQUEST_FAILED" -> AuthSignInFailureReason.NETWORK
        else -> AuthSignInFailureReason.UNKNOWN
    }
