package com.reguerta.user.data.devices

import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.RegisteredDevice
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.withTimeout

internal enum class AuthorizedDeviceTokenRefreshResult {
    STORED_ONLY,
    STALE_SESSION,
    UPLOADED,
}

internal interface AuthorizedDeviceTokenStore {
    suspend fun saveFcmToken(token: String?)
    suspend fun getFcmToken(): String?
    suspend fun getAuthorizedSessionContext(): AuthorizedDeviceSessionContext?
    suspend fun getOrCreateDeviceId(): String
}

internal class AuthorizedDeviceTokenRefreshCoordinator(
    private val store: AuthorizedDeviceTokenStore,
    private val repository: DeviceRegistrationRepository,
    private val currentAuthUidProvider: () -> String?,
    private val nowMillisProvider: () -> Long,
    private val deviceProvider: (token: String, deviceId: String, nowMillis: Long) -> RegisteredDevice,
    private val processSession: AuthorizedDeviceProcessSession =
        ReguertaAuthorizedDeviceProcessSession,
) {
    private val refreshMutex = Mutex()

    suspend fun refresh(token: String): AuthorizedDeviceTokenRefreshResult {
        refreshMutex.lock()
        return try {
            performRefresh(token)
        } finally {
            refreshMutex.unlock()
        }
    }

    private suspend fun performRefresh(token: String): AuthorizedDeviceTokenRefreshResult {
        val normalizedToken = token.trim().ifBlank { null }
        store.saveFcmToken(normalizedToken)
        if (normalizedToken == null) {
            return AuthorizedDeviceTokenRefreshResult.STORED_ONLY
        }

        val authorizedContext = store.getAuthorizedSessionContext()
            ?: return AuthorizedDeviceTokenRefreshResult.STORED_ONLY
        when (processSession.match(authorizedContext)) {
            AuthorizedDeviceProcessSessionMatch.NOT_ESTABLISHED ->
                return AuthorizedDeviceTokenRefreshResult.STORED_ONLY
            AuthorizedDeviceProcessSessionMatch.SUPERSEDED ->
                return AuthorizedDeviceTokenRefreshResult.STALE_SESSION
            AuthorizedDeviceProcessSessionMatch.CURRENT -> Unit
        }
        if (currentAuthUidProvider() != authorizedContext.authUid) {
            return AuthorizedDeviceTokenRefreshResult.STALE_SESSION
        }

        val nowMillis = nowMillisProvider()
        val device = deviceProvider(
            normalizedToken,
            store.getOrCreateDeviceId(),
            nowMillis,
        )
        repository.registerDevice(
            memberId = authorizedContext.memberId,
            environment = authorizedContext.environment,
            device = device,
            isSessionCurrent = {
                store.getAuthorizedSessionContext() == authorizedContext &&
                    store.getFcmToken() == normalizedToken &&
                    currentAuthUidProvider() == authorizedContext.authUid &&
                    processSession.match(authorizedContext) ==
                    AuthorizedDeviceProcessSessionMatch.CURRENT
            },
        )
        return AuthorizedDeviceTokenRefreshResult.UPLOADED
    }
}

internal class FirebaseTokenCallbackRunner(
    private val timeoutMillis: Long,
    private val refresh: suspend (String) -> AuthorizedDeviceTokenRefreshResult,
) {
    fun handle(token: String): AuthorizedDeviceTokenRefreshResult = runBlocking {
        withTimeout(timeoutMillis) {
            refresh(token)
        }
    }
}
