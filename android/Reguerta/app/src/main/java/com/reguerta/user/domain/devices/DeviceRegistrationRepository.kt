package com.reguerta.user.domain.devices

interface DeviceRegistrationRepository {
    suspend fun registerDevice(
        memberId: String,
        device: RegisteredDevice,
    ): RegisteredDevice
}
