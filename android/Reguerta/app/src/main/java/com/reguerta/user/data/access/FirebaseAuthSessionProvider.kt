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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

class FirebaseAuthSessionProvider internal constructor(
    private val gateway: FirebaseAuthGateway,
) : AuthSessionProvider {
    constructor(auth: FirebaseAuth) : this(DefaultFirebaseAuthGateway(auth))

    override suspend fun signIn(email: String, password: String): AuthSignInResult = withContext(Dispatchers.IO) {
        val trimmedEmail = email.trim()
        var authenticationMutated = false
        return@withContext try {
            gateway.signIn(trimmedEmail, password)
            authenticationMutated = true
            currentCoroutineContext().ensureActive()
            val user = gateway.reloadCurrentUser()
            currentCoroutineContext().ensureActive()
            if (user == null) {
                if (!gateway.signOutBestEffort()) {
                    throw FirebaseAuthCleanupNotConfirmedException()
                }
                return@withContext AuthSignInResult.Failure(AuthSignInFailureReason.UNKNOWN)
            }
            if (!user.emailVerified) {
                gateway.sendCurrentUserVerificationEmail()
                currentCoroutineContext().ensureActive()
                if (!gateway.signOutBestEffort()) {
                    throw FirebaseAuthCleanupNotConfirmedException()
                }
                return@withContext AuthSignInResult.Failure(
                    AuthSignInFailureReason.EMAIL_NOT_VERIFIED,
                )
            }
            gateway.refreshCurrentUserToken(forceRefresh = true)
            currentCoroutineContext().ensureActive()

            AuthSignInResult.Success(
                principal = AuthPrincipal(
                    uid = user.uid,
                    email = (user.email ?: trimmedEmail).trim().lowercase(),
                ),
            )
        } catch (exception: CancellationException) {
            if (!gateway.signOutBestEffort()) {
                throw FirebaseAuthCleanupNotConfirmedException(exception)
            }
            throw exception
        } catch (exception: Exception) {
            if (authenticationMutated && !gateway.signOutBestEffort()) {
                throw FirebaseAuthCleanupNotConfirmedException(exception)
            }
            AuthSignInResult.Failure(exception.toFailureReason())
        }
    }

    override suspend fun signUp(email: String, password: String): AuthSignInResult = withContext(Dispatchers.IO) {
        val trimmedEmail = email.trim()
        var authenticationMutated = false
        return@withContext try {
            val user = gateway.signUp(trimmedEmail, password)
            authenticationMutated = true
            currentCoroutineContext().ensureActive()
            if (user == null) {
                if (!gateway.signOutBestEffort()) {
                    throw FirebaseAuthCleanupNotConfirmedException()
                }
                return@withContext AuthSignInResult.Failure(AuthSignInFailureReason.UNKNOWN)
            }
            gateway.sendCurrentUserVerificationEmail()
            currentCoroutineContext().ensureActive()
            if (!gateway.signOutBestEffort()) {
                throw FirebaseAuthCleanupNotConfirmedException()
            }
            AuthSignInResult.Failure(AuthSignInFailureReason.EMAIL_NOT_VERIFIED)
        } catch (exception: CancellationException) {
            if (!gateway.signOutBestEffort()) {
                throw FirebaseAuthCleanupNotConfirmedException(exception)
            }
            throw exception
        } catch (exception: Exception) {
            if (authenticationMutated && !gateway.signOutBestEffort()) {
                throw FirebaseAuthCleanupNotConfirmedException(exception)
            }
            AuthSignInResult.Failure(exception.toFailureReason())
        }
    }

    override suspend fun sendPasswordReset(email: String): AuthPasswordResetResult = withContext(Dispatchers.IO) {
        val trimmedEmail = email.trim()
        return@withContext try {
            gateway.sendPasswordReset(trimmedEmail)
            AuthPasswordResetResult.Success
        } catch (exception: Exception) {
            AuthPasswordResetResult.Failure(exception.toFailureReason())
        }
    }

    override suspend fun refreshCurrentSession(): AuthSessionRefreshResult = withContext(Dispatchers.IO) {
        val user = gateway.currentUserSnapshot() ?: return@withContext AuthSessionRefreshResult.NoSession
        val fallbackPrincipal = AuthPrincipal(
            uid = user.uid,
            email = (user.email ?: "").trim().lowercase(),
        )
        var reloadCompleted = false

        return@withContext try {
            val refreshedUser = gateway.reloadCurrentUser()
            reloadCompleted = true
            currentCoroutineContext().ensureActive()
            if (refreshedUser == null) {
                if (!gateway.signOutBestEffort()) {
                    throw FirebaseAuthCleanupNotConfirmedException()
                }
                return@withContext AuthSessionRefreshResult.Expired
            }
            gateway.refreshCurrentUserToken(forceRefresh = refreshedUser.emailVerified)
            currentCoroutineContext().ensureActive()

            AuthSessionRefreshResult.Active(
                principal = AuthPrincipal(
                    uid = refreshedUser.uid,
                    email = (refreshedUser.email ?: fallbackPrincipal.email).trim().lowercase(),
                ),
            )
        } catch (exception: CancellationException) {
            if (!gateway.signOutBestEffort()) {
                throw FirebaseAuthCleanupNotConfirmedException(exception)
            }
            throw exception
        } catch (exception: Exception) {
            if (reloadCompleted) {
                if (!gateway.signOutBestEffort()) {
                    throw FirebaseAuthCleanupNotConfirmedException(exception)
                }
                throw exception
            }
            when (exception.toFailureReason()) {
                AuthSignInFailureReason.USER_DISABLED,
                AuthSignInFailureReason.USER_NOT_FOUND,
                AuthSignInFailureReason.INVALID_CREDENTIALS,
                    -> {
                        if (!gateway.signOutBestEffort()) {
                            throw FirebaseAuthCleanupNotConfirmedException(exception)
                        }
                        AuthSessionRefreshResult.Expired
                    }

                AuthSignInFailureReason.NETWORK,
                AuthSignInFailureReason.TOO_MANY_REQUESTS,
                AuthSignInFailureReason.UNKNOWN,
                AuthSignInFailureReason.INVALID_EMAIL,
                AuthSignInFailureReason.EMAIL_ALREADY_IN_USE,
                AuthSignInFailureReason.WEAK_PASSWORD,
                AuthSignInFailureReason.EMAIL_NOT_VERIFIED,
                    -> AuthSessionRefreshResult.Active(fallbackPrincipal)
            }
        }
    }

    override fun signOut() {
        gateway.signOut()
    }
}

internal class FirebaseAuthCleanupNotConfirmedException(
    cause: Throwable? = null,
) : IllegalStateException("Firebase Auth cleanup could not be confirmed", cause)

private fun FirebaseAuthGateway.signOutBestEffort(): Boolean =
    try {
        signOut()
        true
    } catch (_: Exception) {
        // Presentation remains fail-closed even if Firebase cannot confirm local sign-out.
        false
    }

internal data class FirebaseAuthUserSnapshot(
    val uid: String,
    val email: String?,
    val emailVerified: Boolean,
)

internal interface FirebaseAuthGateway {
    suspend fun signIn(email: String, password: String): FirebaseAuthUserSnapshot?
    suspend fun signUp(email: String, password: String): FirebaseAuthUserSnapshot?
    suspend fun sendCurrentUserVerificationEmail()
    suspend fun sendPasswordReset(email: String)
    fun currentUserSnapshot(): FirebaseAuthUserSnapshot?
    suspend fun reloadCurrentUser(): FirebaseAuthUserSnapshot?
    suspend fun refreshCurrentUserToken(forceRefresh: Boolean)
    fun signOut()
}

private class DefaultFirebaseAuthGateway(
    private val auth: FirebaseAuth,
) : FirebaseAuthGateway {
    override suspend fun signIn(email: String, password: String): FirebaseAuthUserSnapshot? =
        Tasks.await(auth.signInWithEmailAndPassword(email, password)).user?.toSnapshot()

    override suspend fun signUp(email: String, password: String): FirebaseAuthUserSnapshot? =
        Tasks.await(auth.createUserWithEmailAndPassword(email, password)).user?.toSnapshot()

    override suspend fun sendCurrentUserVerificationEmail() {
        val user = checkNotNull(auth.currentUser)
        Tasks.await(user.sendEmailVerification())
    }

    override suspend fun sendPasswordReset(email: String) {
        Tasks.await(auth.sendPasswordResetEmail(email))
    }

    override fun currentUserSnapshot(): FirebaseAuthUserSnapshot? = auth.currentUser?.toSnapshot()

    override suspend fun reloadCurrentUser(): FirebaseAuthUserSnapshot? {
        val user = auth.currentUser ?: return null
        Tasks.await(user.reload())
        return auth.currentUser?.toSnapshot()
    }

    override suspend fun refreshCurrentUserToken(forceRefresh: Boolean) {
        val user = checkNotNull(auth.currentUser)
        Tasks.await(user.getIdToken(forceRefresh))
    }

    override fun signOut() {
        auth.signOut()
    }
}

private fun com.google.firebase.auth.FirebaseUser.toSnapshot(): FirebaseAuthUserSnapshot =
    FirebaseAuthUserSnapshot(
        uid = uid,
        email = email,
        emailVerified = isEmailVerified,
    )

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
