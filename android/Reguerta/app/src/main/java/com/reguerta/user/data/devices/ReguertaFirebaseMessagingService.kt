package com.reguerta.user.data.devices

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.domain.devices.RegisteredDevice
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ReguertaFirebaseMessagingService : FirebaseMessagingService() {
    private companion object {
        const val TAG = "ReguertaPush"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FirebaseMessagingService.onNewToken received tokenPresent=${token.isNotBlank()}")
        val preferences = DeviceRegistrationPreferences(applicationContext)
        preferences.saveFcmToken(token)
        val memberId = preferences.getAuthorizedMemberId()
        if (memberId == null) {
            Log.w(TAG, "Token received but no authorized member id is cached yet")
            return
        }
        val nowMillis = System.currentTimeMillis()
        val repository = FirestoreDeviceRegistrationRepository(firestore = FirebaseFirestore.getInstance())
        CoroutineScope(Dispatchers.IO).launch {
            Log.d(TAG, "Uploading refreshed FCM token to Firestore for member=$memberId")
            repository.registerDevice(
                memberId = memberId,
                device = RegisteredDevice(
                    deviceId = preferences.getOrCreateDeviceId(),
                    platform = "android",
                    appVersion = applicationContext.packageManager
                        .getPackageInfo(applicationContext.packageName, 0)
                        .versionName ?: "0.0.0",
                    osVersion = android.os.Build.VERSION.RELEASE ?: android.os.Build.VERSION.SDK_INT.toString(),
                    apiLevel = android.os.Build.VERSION.SDK_INT,
                    manufacturer = android.os.Build.MANUFACTURER?.ifBlank { null },
                    model = android.os.Build.MODEL?.ifBlank { null },
                    fcmToken = token.trim().ifBlank { null },
                    firstSeenAtMillis = nowMillis,
                    lastSeenAtMillis = nowMillis,
                    tokenUpdatedAtMillis = nowMillis,
                ),
            )
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(
            TAG,
            "Push message received from=${message.from}, notificationTitle=${message.notification?.title}, dataKeys=${message.data.keys}"
        )
    }
}
