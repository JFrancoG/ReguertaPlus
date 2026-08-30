package com.reguerta.user.data.devices

import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.DeviceRegistrationWriteBlockedException
import com.reguerta.user.domain.devices.RegisteredDevice
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.withTimeout

internal enum class AuthorizedDeviceTokenRefreshResult {
    DEFERRED,
    STORED_ONLY,
    STALE_SESSION,
    UPLOADED,
}

internal interface AuthorizedDeviceRegistrationStore {
    suspend fun saveFirebaseInstallationId(installationId: String?)
    suspend fun getFirebaseInstallationId(): String?
    suspend fun getAuthorizedSessionContext(): AuthorizedDeviceSessionContext?
    suspend fun getOrCreateDeviceId(): String
}

internal class AuthorizedDeviceTokenRefreshCoordinator(
    private val store: AuthorizedDeviceRegistrationStore,
    private val repository: DeviceRegistrationRepository,
    private val currentAuthUidProvider: () -> String?,
    private val nowMillisProvider: () -> Long,
    private val deviceProvider:
        (installationId: String, deviceId: String, nowMillis: Long) -> RegisteredDevice,
    private val processSession: AuthorizedDeviceProcessSession =
        ReguertaAuthorizedDeviceProcessSession,
) {
    private val refreshMutex = Mutex()

    suspend fun refresh(installationId: String): AuthorizedDeviceTokenRefreshResult {
        refreshMutex.lock()
        return try {
            performRefresh(installationId)
        } finally {
            refreshMutex.unlock()
        }
    }

    private suspend fun performRefresh(
        installationId: String,
    ): AuthorizedDeviceTokenRefreshResult {
        val normalizedInstallationId = installationId.trim().ifBlank { null }
        store.saveFirebaseInstallationId(normalizedInstallationId)
        if (normalizedInstallationId == null) {
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
            normalizedInstallationId,
            store.getOrCreateDeviceId(),
            nowMillis,
        )
        try {
            repository.registerDevice(
                memberId = authorizedContext.memberId,
                environment = authorizedContext.environment,
                device = device,
                isSessionCurrent = {
                    store.getAuthorizedSessionContext() == authorizedContext &&
                        store.getFirebaseInstallationId() == normalizedInstallationId &&
                        currentAuthUidProvider() == authorizedContext.authUid &&
                        processSession.match(authorizedContext) ==
                        AuthorizedDeviceProcessSessionMatch.CURRENT
                },
            )
        } catch (_: DeviceRegistrationWriteBlockedException) {
            return AuthorizedDeviceTokenRefreshResult.DEFERRED
        }
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
