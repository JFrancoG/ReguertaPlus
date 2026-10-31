package com.reguerta.user

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** Selected only by the explicit transport-only Debug build; never uploads device records. */
// Lint still expects the deprecated token callback rather than the installation-ID API.
@SuppressLint("MissingFirebaseInstanceTokenRefresh")
class CoverageRemoteMessagingService : FirebaseMessagingService() {
    override fun onRegistered(installationId: String) {
        CoverageRemotePushAccess.saveRegisteredDestination(this, installationId)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (!BuildConfig.COVERAGE_REMOTE_PUSH_REHEARSAL || message.data["eventId"] != CoverageRemotePushAccess.eventId ||
            message.data["type"] != "shift_updated" || message.data["target"] != "users") return
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = "coverage_remote_rehearsal"
        manager.createNotificationChannel(NotificationChannel(channel, getString(R.string.coverage_rehearsal_notice_title), NotificationManager.IMPORTANCE_DEFAULT))
        val open = Intent(this, CoverageRehearsalActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            message.data.forEach { (key, value) -> putExtra(key, value) }
        }
        val pending = PendingIntent.getActivity(this, 84, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        manager.notify(84, Notification.Builder(this, channel).setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(getString(R.string.coverage_rehearsal_notice_title))
            .setContentText(getString(R.string.coverage_rehearsal_notice_body))
            .setContentIntent(pending).setAutoCancel(true).build())
    }
}
