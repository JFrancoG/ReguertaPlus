package com.reguerta.user.data.devices

import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.installations.FirebaseInstallations
import com.google.firebase.messaging.FirebaseMessaging
import com.reguerta.user.BuildConfig
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.devices.AuthorizedDeviceRegistrar
import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.RegisteredDevice
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

internal fun interface FirebaseInstallationRegistrationProvider {
    suspend fun register(): String?
}

internal class DefaultFirebaseInstallationRegistrationProvider(
    private val registerMessaging: suspend () -> Unit = {
        FirebaseMessaging.getInstance().register().await()
    },
    private val fetchInstallationId: suspend () -> String = {
        FirebaseInstallations.getInstance().id.await()
    },
) : FirebaseInstallationRegistrationProvider {
    override suspend fun register(): String? {
        registerMessaging()
        return fetchInstallationId().trim().ifBlank { null }
    }
}

class FirebaseAuthorizedDeviceRegistrar internal constructor(
    private val repository: DeviceRegistrationRepository,
    private val nowMillisProvider: () -> Long,
    private val preferences: DeviceRegistrationPreferences,
    private val registrationProvider: FirebaseInstallationRegistrationProvider,
) : AuthorizedDeviceRegistrar {
    constructor(
        context: Context,
        repository: DeviceRegistrationRepository,
        nowMillisProvider: () -> Long = { System.currentTimeMillis() },
        preferences: DeviceRegistrationPreferences = DeviceRegistrationPreferences(context),
    ) : this(
        repository = repository,
        nowMillisProvider = nowMillisProvider,
        preferences = preferences,
        registrationProvider = DefaultFirebaseInstallationRegistrationProvider(),
    )
    private companion object {
        const val TAG = "ReguertaPush"
    }

    private val registrationGeneration = AtomicLong(0L)
    private val processSession: AuthorizedDeviceProcessSession =
        ReguertaAuthorizedDeviceProcessSession
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
        val processActivationGeneration = processSession.activationGeneration()
        val registrationIsCurrent = {
            registrationGeneration.get() == generation && isSessionCurrent()
        }

        try {
            val nowMillis = nowMillisProvider()
            val registrationId = fetchFcmRegistrationIdWithRetry()
            if (!registrationIsCurrent()) return
            val deviceId = preferences.getOrCreateDeviceId()
            if (!registrationIsCurrent()) return
            val authUid = requireNotNull(member.authUid?.trim()?.ifBlank { null }) {
                "Authorized member must have an Auth UID"
            }
            val authorizedContext = preferences.saveAuthorizedSessionContext(
                memberId = member.id,
                authUid = authUid,
                environment = environment,
                isSessionCurrent = registrationIsCurrent,
            )
                ?: return
            if (!registrationIsCurrent()) return
            if (!processSession.activate(authorizedContext, processActivationGeneration)) return
            if (!registrationIsCurrent()) {
                processSession.invalidateIfOwned(authorizedContext)
                return
            }
            val authorizedRegistrationIsCurrent = {
                registrationIsCurrent() &&
                    processSession.match(authorizedContext) ==
                    AuthorizedDeviceProcessSessionMatch.CURRENT
            }
            Log.d(TAG, "Registering authorized device")

            val device = RegisteredDevice(
                deviceId = deviceId,
                platform = "android",
                appVersion = BuildConfig.VERSION_NAME,
                osVersion = Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString(),
                apiLevel = Build.VERSION.SDK_INT,
                manufacturer = Build.MANUFACTURER?.ifBlank { null },
                model = Build.MODEL?.ifBlank { null },
                firebaseInstallationId = registrationId,
                firstSeenAtMillis = nowMillis,
                lastSeenAtMillis = nowMillis,
                registrationUpdatedAtMillis = if (registrationId == null) null else nowMillis,
            )
            val writeResult = registrationWriter.registerLatest(
                memberId = member.id,
                environment = environment,
                device = device,
                isSessionCurrent = authorizedRegistrationIsCurrent,
                refreshedDevice = { latestRegistrationId ->
                    val refreshedAtMillis = nowMillisProvider()
                    device.copy(
                        firebaseInstallationId = latestRegistrationId,
                        lastSeenAtMillis = refreshedAtMillis,
                        registrationUpdatedAtMillis =
                            latestRegistrationId?.let { refreshedAtMillis },
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
        invalidateAuthorizedSession()
        try {
            preferences.clearAuthorizedSessionContext()
        } catch (error: CancellationException) {
            throw error
        } catch (error: DeviceRegistrationPreferencesException) {
            Log.e(TAG, "Unable to clear authorized device storage")
            throw error
        }
    }

    override fun invalidateAuthorizedSession() {
        registrationGeneration.incrementAndGet()
        processSession.invalidate()
    }

    private suspend fun fetchFcmRegistrationIdWithRetry(): String? {
        fetchFcmRegistrationId()?.let {
            Log.d(TAG, "Push credential fetched on first attempt")
            return it
        }
        Log.w(TAG, "Push credential unavailable on first attempt, retrying once")
        delay(1_500L)
        fetchFcmRegistrationId()?.let {
            Log.d(TAG, "Push credential fetched on second attempt")
            return it
        }
        val cached = preferences.getFirebaseInstallationId()
        if (cached != null) {
            Log.d(TAG, "Using cached push credential from encrypted storage")
        } else {
            Log.w(TAG, "Push credential unavailable after retry")
        }
        return cached
    }

    private suspend fun fetchFcmRegistrationId(): String? {
        val registrationId = withTimeoutOrNull(5_000L) {
            try {
                registrationProvider.register()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e(TAG, "Failed to fetch push credential")
                null
            }
        }?.trim()?.ifBlank { null }

        if (registrationId != null) {
            try {
                preferences.saveFirebaseInstallationId(registrationId)
            } catch (error: CancellationException) {
                throw error
            } catch (error: DeviceRegistrationPreferencesException) {
                Log.e(TAG, "Unable to cache refreshed push credential")
            }
        }
        return registrationId
    }
}
