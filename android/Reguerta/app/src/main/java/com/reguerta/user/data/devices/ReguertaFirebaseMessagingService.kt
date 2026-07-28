package com.reguerta.user.data.devices

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.reguerta.user.domain.devices.RegisteredDevice
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException

class ReguertaFirebaseMessagingService : FirebaseMessagingService() {
    private companion object {
        const val TAG = "ReguertaPush"
        const val TOKEN_CALLBACK_TIMEOUT_MILLIS = 15_000L
    }

    private val preferences: DeviceRegistrationPreferences by lazy {
        DeviceRegistrationPreferences(applicationContext)
    }
    private val tokenRefreshCoordinator: AuthorizedDeviceTokenRefreshCoordinator by lazy {
        AuthorizedDeviceTokenRefreshCoordinator(
            store = preferences,
            repository = FirestoreDeviceRegistrationRepository(
                firestore = FirebaseFirestore.getInstance(),
            ),
            currentAuthUidProvider = { FirebaseAuth.getInstance().currentUser?.uid },
            nowMillisProvider = { System.currentTimeMillis() },
            deviceProvider = { token, deviceId, nowMillis ->
                RegisteredDevice(
                    deviceId = deviceId,
                    platform = "android",
                    appVersion = applicationContext.packageManager
                        .getPackageInfo(applicationContext.packageName, 0)
                        .versionName ?: "0.0.0",
                    osVersion = android.os.Build.VERSION.RELEASE
                        ?: android.os.Build.VERSION.SDK_INT.toString(),
                    apiLevel = android.os.Build.VERSION.SDK_INT,
                    manufacturer = android.os.Build.MANUFACTURER?.ifBlank { null },
                    model = android.os.Build.MODEL?.ifBlank { null },
                    fcmToken = token,
                    firstSeenAtMillis = nowMillis,
                    lastSeenAtMillis = nowMillis,
                    tokenUpdatedAtMillis = nowMillis,
                )
            },
        )
    }
    private val tokenCallbackRunner: FirebaseTokenCallbackRunner by lazy {
        FirebaseTokenCallbackRunner(
            timeoutMillis = TOKEN_CALLBACK_TIMEOUT_MILLIS,
            refresh = tokenRefreshCoordinator::refresh,
        )
    }

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FirebaseMessagingService received a refreshed push credential")
        try {
            when (tokenCallbackRunner.handle(token)) {
                AuthorizedDeviceTokenRefreshResult.STORED_ONLY ->
                    Log.d(TAG, "Push credential stored without an authorized upload")
                AuthorizedDeviceTokenRefreshResult.STALE_SESSION ->
                    Log.w(TAG, "Push credential received for a superseded authorized session")
                AuthorizedDeviceTokenRefreshResult.UPLOADED ->
                    Log.d(TAG, "Refreshed push credential uploaded")
            }
        } catch (_: TimeoutCancellationException) {
            Log.w(TAG, "Push credential refresh exceeded the callback window")
        } catch (_: CancellationException) {
            Log.d(TAG, "Skipping push credential upload for a superseded session")
        } catch (_: DeviceRegistrationPreferencesException) {
            Log.e(TAG, "Push credential storage is unavailable")
        } catch (_: Exception) {
            Log.e(TAG, "Failed to upload refreshed push credential")
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "Push message received")
    }
}
