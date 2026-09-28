package com.reguerta.user

import android.os.Bundle
import android.content.Intent
import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.pm.PackageManager
import android.os.Build
import com.reguerta.user.domain.notifications.ShiftNotificationPushReference
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.reguerta.user.data.shiftcoverage.LocalCoverageRehearsalAccess
import com.reguerta.user.presentation.shiftcoverage.CoverageRehearsalViewModel
import com.reguerta.user.presentation.shiftcoverage.CoverageScreen
import com.reguerta.user.ui.theme.ReguertaTheme

/** Dedicated Debug entry point. It never constructs MainActivity's live session/dependencies. */
class CoverageRehearsalActivity : ComponentActivity() {
    private val model: CoverageRehearsalViewModel by viewModels {
        viewModelFactory {
            initializer {
                // adb reverse exposes only the fixed demo ports on a connected physical device.
                val usesUsb = intent.getBooleanExtra("coverageUsbRehearsal", false)
                CoverageRehearsalViewModel(LocalCoverageRehearsalAccess(emulatorHost = !usesUsb))
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        acceptPush(intent)
        enableEdgeToEdge()
        setContent { ReguertaTheme { CoverageScreen(model) } }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        acceptPush(intent)
    }

    private fun acceptPush(source: Intent?) {
        source ?: return
        val reference = ShiftNotificationPushReference.validated(
            source.getStringExtra("eventId"), source.getStringExtra("type"), source.getStringExtra("target"),
        ) ?: return
        val postNotification = source.getBooleanExtra("coveragePostNotification", false)
        source.removeExtra("coveragePostNotification")
        source.removeExtra("eventId")
        source.removeExtra("type")
        source.removeExtra("target")
        if (postNotification) postLocalNotification(reference) else model.acceptPush(reference)
    }

    /** Posts from the app UID so a real tray tap can exercise the isolated Debug route. */
    private fun postLocalNotification(reference: ShiftNotificationPushReference) {
        if (!reference.isCoverage) return
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val notifications = getSystemService(NotificationManager::class.java)
        if (!notifications.areNotificationsEnabled()) return
        val channelId = "coverage_rehearsal"
        notifications.createNotificationChannel(NotificationChannel(
            channelId, getString(R.string.coverage_rehearsal_notice_title), NotificationManager.IMPORTANCE_DEFAULT,
        ))
        val open = Intent(this, CoverageRehearsalActivity::class.java).apply {
            action = "coverage_rehearsal.${reference.eventId}"
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("eventId", reference.eventId)
            putExtra("type", "shift_updated")
            putExtra("target", "users")
        }
        val pending = PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        notifications.notify(reference.eventId, 84, Notification.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(getString(R.string.coverage_rehearsal_notice_title))
            .setContentText(getString(R.string.coverage_rehearsal_notice_body))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build())
    }
}
