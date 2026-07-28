package com.reguerta.user.domain.devices

interface DeviceRegistrationRepository {
    suspend fun registerDevice(
        memberId: String,
        environment: String,
        device: RegisteredDevice,
        isSessionCurrent: suspend () -> Boolean = { true },
    ): RegisteredDevice
}
