package com.reguerta.user.data.devices

import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.RegisteredDevice
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException

internal enum class AuthorizedDeviceRegistrationWriteResult {
    REGISTERED,
    TOKEN_SUPERSEDED,
}

internal class AuthorizedDeviceRegistrationWriter(
    private val store: AuthorizedDeviceTokenStore,
    private val repository: DeviceRegistrationRepository,
) {
    suspend fun registerLatest(
        memberId: String,
        environment: String,
        device: RegisteredDevice,
        isSessionCurrent: () -> Boolean,
        refreshedDevice: (String?) -> RegisteredDevice,
    ): AuthorizedDeviceRegistrationWriteResult {
        val firstResult = register(
            memberId = memberId,
            environment = environment,
            device = device,
            isSessionCurrent = isSessionCurrent,
        )
        if (firstResult == AuthorizedDeviceRegistrationWriteResult.REGISTERED) {
            return firstResult
        }
        if (!isSessionCurrent()) {
            throw CancellationException("Authorized device registration session was superseded")
        }

        return register(
            memberId = memberId,
            environment = environment,
            device = refreshedDevice(store.getFcmToken()),
            isSessionCurrent = isSessionCurrent,
        )
    }

    suspend fun register(
        memberId: String,
        environment: String,
        device: RegisteredDevice,
        isSessionCurrent: () -> Boolean,
    ): AuthorizedDeviceRegistrationWriteResult {
        val expectedToken = device.fcmToken?.trim()?.ifBlank { null }
        val tokenWasSuperseded = AtomicBoolean(false)
        return try {
            repository.registerDevice(
                memberId = memberId,
                environment = environment,
                device = device,
                isSessionCurrent = {
                    if (!isSessionCurrent()) {
                        false
                    } else {
                        val tokenMatches = store.getFcmToken() == expectedToken
                        if (!tokenMatches) {
                            tokenWasSuperseded.set(true)
                        }
                        tokenMatches
                    }
                },
            )
            AuthorizedDeviceRegistrationWriteResult.REGISTERED
        } catch (error: CancellationException) {
            if (tokenWasSuperseded.get() && isSessionCurrent()) {
                AuthorizedDeviceRegistrationWriteResult.TOKEN_SUPERSEDED
            } else {
                throw error
            }
        }
    }
}
