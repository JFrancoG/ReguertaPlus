package com.reguerta.user.domain.devices

class DeviceRegistrationWriteBlockedException(cause: Throwable) : Exception(cause)

interface DeviceRegistrationRepository {
    suspend fun registerDevice(
        memberId: String,
        environment: String,
        device: RegisteredDevice,
        isSessionCurrent: suspend () -> Boolean = { true },
    ): RegisteredDevice
}
