package com.reguerta.user.data.notifications

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.reguerta.user.domain.notifications.PushNotificationPermissionProvider

class AndroidPushNotificationPermissionProvider(
    private val context: Context,
) : PushNotificationPermissionProvider {
    override fun isPushNotificationPermissionActive(): Boolean {
        val appNotificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        val runtimePermissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED

        return appNotificationsEnabled && runtimePermissionGranted
    }
}
