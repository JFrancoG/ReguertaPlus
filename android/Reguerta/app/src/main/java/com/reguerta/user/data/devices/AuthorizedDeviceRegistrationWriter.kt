package com.reguerta.user.data.devices

import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.DeviceRegistrationWriteBlockedException
import com.reguerta.user.domain.devices.RegisteredDevice
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException

internal enum class AuthorizedDeviceRegistrationWriteResult {
    REGISTERED,
    DEFERRED,
    TOKEN_SUPERSEDED,
}

internal class AuthorizedDeviceRegistrationWriter(
    private val store: AuthorizedDeviceRegistrationStore,
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
        if (firstResult != AuthorizedDeviceRegistrationWriteResult.TOKEN_SUPERSEDED) {
            return firstResult
        }
        if (!isSessionCurrent()) {
            throw CancellationException("Authorized device registration session was superseded")
        }

        return register(
            memberId = memberId,
            environment = environment,
            device = refreshedDevice(store.getFirebaseInstallationId()),
            isSessionCurrent = isSessionCurrent,
        )
    }

    suspend fun register(
        memberId: String,
        environment: String,
        device: RegisteredDevice,
        isSessionCurrent: () -> Boolean,
    ): AuthorizedDeviceRegistrationWriteResult {
        val expectedRegistrationId = device.firebaseInstallationId?.trim()?.ifBlank { null }
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
                        val registrationMatches =
                            store.getFirebaseInstallationId() == expectedRegistrationId
                        if (!registrationMatches) {
                            tokenWasSuperseded.set(true)
                        }
                        registrationMatches
                    }
                },
            )
            AuthorizedDeviceRegistrationWriteResult.REGISTERED
        } catch (_: DeviceRegistrationWriteBlockedException) {
            AuthorizedDeviceRegistrationWriteResult.DEFERRED
        } catch (error: CancellationException) {
            if (tokenWasSuperseded.get() && isSessionCurrent()) {
                AuthorizedDeviceRegistrationWriteResult.TOKEN_SUPERSEDED
            } else {
                throw error
            }
        }
    }
}
