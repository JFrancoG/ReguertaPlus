package com.reguerta.user.data.devices

import android.content.Context
import android.util.Log
import android.os.Build
import com.google.android.gms.tasks.Tasks
import com.google.firebase.messaging.FirebaseMessaging
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.RegisteredDevice
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.withContext

class FirebaseAuthorizedDeviceRegistrar(
    private val context: Context,
    private val repository: DeviceRegistrationRepository,
    private val nowMillisProvider: () -> Long = { System.currentTimeMillis() },
) : AuthorizedDeviceRegistrar {
    private companion object {
        const val TAG = "ReguertaPush"
    }

    private val preferences = DeviceRegistrationPreferences(context)

    override suspend fun register(member: Member) {
        preferences.saveAuthorizedMemberId(member.id)
        val nowMillis = nowMillisProvider()
        val token = fetchFcmTokenWithRetry()
        Log.d(
            TAG,
            "Registering authorized device for member=${member.id}, deviceId=${preferences.getOrCreateDeviceId()}, tokenPresent=${token != null}"
        )

        repository.registerDevice(
            memberId = member.id,
            device = RegisteredDevice(
                deviceId = preferences.getOrCreateDeviceId(),
                platform = "android",
                appVersion = resolveAppVersion(),
                osVersion = Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString(),
                apiLevel = Build.VERSION.SDK_INT,
                manufacturer = Build.MANUFACTURER?.ifBlank { null },
                model = Build.MODEL?.ifBlank { null },
                fcmToken = token,
                firstSeenAtMillis = nowMillis,
                lastSeenAtMillis = nowMillis,
                tokenUpdatedAtMillis = if (token == null) null else nowMillis,
            ),
        )
    }

    private fun resolveAppVersion(): String {
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
        return packageInfo.versionName ?: "0.0.0"
    }

    private suspend fun fetchFcmTokenWithRetry(): String? {
        fetchFcmToken()?.let {
            Log.d(TAG, "FCM token fetched on first attempt")
            return it
        }
        Log.w(TAG, "FCM token unavailable on first attempt, retrying once")
        delay(1_500L)
        fetchFcmToken()?.let {
            Log.d(TAG, "FCM token fetched on second attempt")
            return it
        }
        val cached = preferences.getFcmToken()
        if (cached != null) {
            Log.d(TAG, "Using cached FCM token from encrypted storage")
        } else {
            Log.w(TAG, "FCM token still unavailable after retry and no cached token found")
        }
        return cached
    }

    private suspend fun fetchFcmToken(): String? =
        withTimeoutOrNull(5_000L) {
            runCatching {
                withContext(Dispatchers.IO) {
                    Tasks.await(FirebaseMessaging.getInstance().token)
                }
            }
                .onFailure { error ->
                    Log.e(TAG, "Failed to fetch FCM token from FirebaseMessaging", error)
                }
                .getOrNull()
                ?.trim()
                ?.ifBlank { null }
        }?.also { token ->
            Log.d(TAG, "Persisting fetched FCM token in encrypted storage")
            preferences.saveFcmToken(token)
        }
}
