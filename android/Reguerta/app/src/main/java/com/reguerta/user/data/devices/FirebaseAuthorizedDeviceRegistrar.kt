package com.reguerta.user.data.devices

import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.RegisteredDevice
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

class FirebaseAuthorizedDeviceRegistrar(
    private val context: Context,
    private val repository: DeviceRegistrationRepository,
    private val nowMillisProvider: () -> Long = { System.currentTimeMillis() },
    private val preferences: DeviceRegistrationPreferences = DeviceRegistrationPreferences(context),
) : AuthorizedDeviceRegistrar {
    private companion object {
        const val TAG = "ReguertaPush"
    }

    private val registrationGeneration = AtomicLong(0L)
    private val registrationWriter = AuthorizedDeviceRegistrationWriter(
        store = preferences,
        repository = repository,
    )

    override suspend fun register(
        member: Member,
        environment: String,
        isSessionCurrent: () -> Boolean,
    ) {
        val generation = registrationGeneration.get()
        val registrationIsCurrent = {
            registrationGeneration.get() == generation && isSessionCurrent()
        }

        try {
            val nowMillis = nowMillisProvider()
            val token = fetchFcmTokenWithRetry()
            if (!registrationIsCurrent()) return
            val deviceId = preferences.getOrCreateDeviceId()
            if (!registrationIsCurrent()) return
            val authUid = requireNotNull(member.authUid?.trim()?.ifBlank { null }) {
                "Authorized member must have an Auth UID"
            }
            val contextSaved = preferences.saveAuthorizedSessionContext(
                memberId = member.id,
                authUid = authUid,
                environment = environment,
                isSessionCurrent = registrationIsCurrent,
            )
            if (!contextSaved) return
            Log.d(TAG, "Registering authorized device")

            val device = RegisteredDevice(
                deviceId = deviceId,
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
            )
            val writeResult = registrationWriter.registerLatest(
                memberId = member.id,
                environment = environment,
                device = device,
                isSessionCurrent = registrationIsCurrent,
                refreshedDevice = { latestToken ->
                    val refreshedAtMillis = nowMillisProvider()
                    device.copy(
                        fcmToken = latestToken,
                        lastSeenAtMillis = refreshedAtMillis,
                        tokenUpdatedAtMillis = latestToken?.let { refreshedAtMillis },
                    )
                },
            )
            if (writeResult == AuthorizedDeviceRegistrationWriteResult.TOKEN_SUPERSEDED) {
                Log.d(TAG, "A newer push credential superseded the bounded registration retry")
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: DeviceRegistrationPreferencesException) {
            Log.e(TAG, "Device registration storage is unavailable")
            throw error
        }
    }

    override suspend fun clearAuthorizedSession() {
        registrationGeneration.incrementAndGet()
        try {
            preferences.clearAuthorizedSessionContext()
        } catch (error: CancellationException) {
            throw error
        } catch (error: DeviceRegistrationPreferencesException) {
            Log.e(TAG, "Unable to clear authorized device storage")
            throw error
        }
    }

    private fun resolveAppVersion(): String {
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
        return packageInfo.versionName ?: "0.0.0"
    }

    private suspend fun fetchFcmTokenWithRetry(): String? {
        fetchFcmToken()?.let {
            Log.d(TAG, "Push credential fetched on first attempt")
            return it
        }
        Log.w(TAG, "Push credential unavailable on first attempt, retrying once")
        delay(1_500L)
        fetchFcmToken()?.let {
            Log.d(TAG, "Push credential fetched on second attempt")
            return it
        }
        val cached = preferences.getFcmToken()
        if (cached != null) {
            Log.d(TAG, "Using cached push credential from encrypted storage")
        } else {
            Log.w(TAG, "Push credential unavailable after retry")
        }
        return cached
    }

    private suspend fun fetchFcmToken(): String? {
        val token = withTimeoutOrNull(5_000L) {
            try {
                FirebaseMessaging.getInstance().token.await()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e(TAG, "Failed to fetch push credential")
                null
            }
        }?.trim()?.ifBlank { null }

        if (token != null) {
            try {
                preferences.saveFcmToken(token)
            } catch (error: CancellationException) {
                throw error
            } catch (error: DeviceRegistrationPreferencesException) {
                Log.e(TAG, "Unable to cache refreshed push credential")
            }
        }
        return token
    }
}
