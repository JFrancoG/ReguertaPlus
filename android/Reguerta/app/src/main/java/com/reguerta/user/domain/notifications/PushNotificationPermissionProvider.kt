package com.reguerta.user.domain.notifications

fun interface PushNotificationPermissionProvider {
    fun isPushNotificationPermissionActive(): Boolean
}
