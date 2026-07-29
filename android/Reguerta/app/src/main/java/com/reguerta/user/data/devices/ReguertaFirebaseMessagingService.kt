package com.reguerta.user.data.devices

import android.annotation.SuppressLint
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.reguerta.user.BuildConfig
import com.reguerta.user.domain.devices.RegisteredDevice
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException

// AGP 9.3 lint still requires the deprecated onNewToken callback instead of onRegistered.
@SuppressLint("MissingFirebaseInstanceTokenRefresh")
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
            deviceProvider = { installationId, deviceId, nowMillis ->
                RegisteredDevice(
                    deviceId = deviceId,
                    platform = "android",
                    appVersion = BuildConfig.VERSION_NAME,
                    osVersion = android.os.Build.VERSION.RELEASE
                        ?: android.os.Build.VERSION.SDK_INT.toString(),
                    apiLevel = android.os.Build.VERSION.SDK_INT,
                    manufacturer = android.os.Build.MANUFACTURER?.ifBlank { null },
                    model = android.os.Build.MODEL?.ifBlank { null },
                    firebaseInstallationId = installationId,
                    firstSeenAtMillis = nowMillis,
                    lastSeenAtMillis = nowMillis,
                    registrationUpdatedAtMillis = nowMillis,
                )
            },
        )
    }
    private val registrationCallbackRunner: FirebaseTokenCallbackRunner by lazy {
        FirebaseTokenCallbackRunner(
            timeoutMillis = TOKEN_CALLBACK_TIMEOUT_MILLIS,
            refresh = tokenRefreshCoordinator::refresh,
        )
    }

    override fun onRegistered(installationId: String) {
        super.onRegistered(installationId)
        Log.d(TAG, "FirebaseMessagingService received a refreshed installation registration")
        try {
            when (registrationCallbackRunner.handle(installationId)) {
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
