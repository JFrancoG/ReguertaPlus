package com.reguerta.user.domain.devices

data class RegisteredDevice(
    val deviceId: String,
    val platform: String,
    val appVersion: String,
    val osVersion: String,
    val apiLevel: Int?,
    val manufacturer: String?,
    val model: String?,
    val fcmToken: String?,
    val firstSeenAtMillis: Long,
    val lastSeenAtMillis: Long,
    val tokenUpdatedAtMillis: Long?,
)
