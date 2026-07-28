package com.reguerta.user.data.devices

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class AuthorizedDeviceSessionContext(
    val memberId: String,
    val authUid: String,
    val environment: String,
    val leaseId: String,
)

internal fun interface DeviceRegistrationEncryptedPreferencesFactory {
    fun create(): SharedPreferences
}

sealed class DeviceRegistrationPreferencesException(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause) {
    class Initialization(cause: Throwable) : DeviceRegistrationPreferencesException(
        message = "Unable to initialize encrypted device registration storage",
        cause = cause,
    )

    class Read(
        val key: String,
        cause: Throwable,
    ) : DeviceRegistrationPreferencesException(
        message = "Unable to read device registration storage key: $key",
        cause = cause,
    )

    class Corrupted(
        val keys: Set<String>,
    ) : DeviceRegistrationPreferencesException(
        message = "Authorized device registration storage is incomplete",
    )

    class Write(
        val keys: Set<String>,
        cause: Throwable? = null,
    ) : DeviceRegistrationPreferencesException(
        message = "Unable to persist device registration storage keys: ${keys.sorted().joinToString()}",
        cause = cause,
    )

    class Delete(
        val keys: Set<String>,
        cause: Throwable? = null,
    ) : DeviceRegistrationPreferencesException(
        message = "Unable to delete device registration storage keys: ${keys.sorted().joinToString()}",
        cause = cause,
    )
}

class DeviceRegistrationPreferences internal constructor(
    private val encryptedPreferencesFactory: DeviceRegistrationEncryptedPreferencesFactory,
    private val rawPreferencesProvider: () -> SharedPreferences,
    private val ioDispatcher: CoroutineDispatcher,
    private val deviceIdProvider: () -> String,
    private val leaseIdProvider: () -> String = { UUID.randomUUID().toString() },
) : AuthorizedDeviceTokenStore {
    constructor(context: Context) : this(
        encryptedPreferencesFactory = AndroidDeviceRegistrationEncryptedPreferencesFactory(
            context = context.applicationContext,
        ),
        rawPreferencesProvider = {
            context.applicationContext.getSharedPreferences(
                PREFERENCES_NAME,
                Context.MODE_PRIVATE,
            )
        },
        ioDispatcher = Dispatchers.IO,
        deviceIdProvider = { UUID.randomUUID().toString().uppercase(Locale.ROOT) },
    )

    private val operationMutex = Mutex()
    private var initializedPreferences: SharedPreferences? = null

    override suspend fun getOrCreateDeviceId(): String = withEncryptedPreferences { preferences ->
        readOptionalString(preferences, KEY_DEVICE_ID)?.let { return@withEncryptedPreferences it }

        val created = deviceIdProvider()
        writeValues(preferences, mapOf(KEY_DEVICE_ID to created))
        created
    }

    override suspend fun saveFcmToken(token: String?) {
        withEncryptedPreferences { preferences ->
            val normalizedToken = token.normalizedOrNull()
            if (normalizedToken == null) {
                deleteKeys(preferences, setOf(KEY_FCM_TOKEN))
            } else {
                writeValues(preferences, mapOf(KEY_FCM_TOKEN to normalizedToken))
            }
        }
    }

    override suspend fun getFcmToken(): String? = withEncryptedPreferences { preferences ->
        readOptionalString(preferences, KEY_FCM_TOKEN)
    }

    suspend fun saveAuthorizedSessionContext(
        memberId: String,
        authUid: String,
        environment: String,
        isSessionCurrent: () -> Boolean = { true },
    ): Boolean = withEncryptedPreferences { preferences ->
        if (!isSessionCurrent()) {
            return@withEncryptedPreferences false
        }
        writeValues(
            preferences = preferences,
            values = mapOf(
                KEY_MEMBER_ID to memberId.normalizedOrNull(),
                KEY_AUTH_UID to authUid.normalizedOrNull(),
                KEY_ENVIRONMENT to environment
                    .trim()
                    .lowercase(Locale.ROOT)
                    .ifBlank { null },
                KEY_LEASE_ID to leaseIdProvider(),
            ),
        )
        true
    }

    suspend fun clearAuthorizedSessionContext() {
        withEncryptedPreferences { preferences ->
            deleteKeys(
                preferences = preferences,
                keys = AUTHORIZED_SESSION_KEYS,
            )
        }
    }

    override suspend fun getAuthorizedSessionContext(): AuthorizedDeviceSessionContext? =
        withEncryptedPreferences { preferences ->
            val values = AUTHORIZED_SESSION_KEYS.associateWith { key ->
                readOptionalString(preferences, key)
            }
            if (values.values.all { it == null }) {
                return@withEncryptedPreferences null
            }
            if (values.values.any { it == null }) {
                throw DeviceRegistrationPreferencesException.Corrupted(
                    keys = values.filterValues { it == null }.keys,
                )
            }

            AuthorizedDeviceSessionContext(
                memberId = checkNotNull(values[KEY_MEMBER_ID]),
                authUid = checkNotNull(values[KEY_AUTH_UID]),
                environment = checkNotNull(values[KEY_ENVIRONMENT]),
                leaseId = checkNotNull(values[KEY_LEASE_ID]),
            )
        }

    private suspend fun <T> withEncryptedPreferences(
        block: (SharedPreferences) -> T,
    ): T = withContext(ioDispatcher) {
        operationMutex.withLock {
            block(initializePreferencesIfNeeded())
        }
    }

    private fun initializePreferencesIfNeeded(): SharedPreferences {
        initializedPreferences?.let { return it }

        val rawPreferences = try {
            rawPreferencesProvider()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Initialization(error)
        }
        deleteKeys(rawPreferences, LEGACY_RAW_KEYS)

        val encryptedPreferences = try {
            encryptedPreferencesFactory.create()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Initialization(error)
        }
        return encryptedPreferences.also { initializedPreferences = it }
    }

    private fun readOptionalString(preferences: SharedPreferences, key: String): String? =
        try {
            preferences.getString(key, null).normalizedOrNull()
        } catch (error: CancellationException) {
            throw error
        } catch (error: DeviceRegistrationPreferencesException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Read(key = key, cause = error)
        }

    private fun writeValues(
        preferences: SharedPreferences,
        values: Map<String, String?>,
    ) {
        val keys = values.keys
        try {
            val editor = preferences.edit()
            values.forEach { (key, value) ->
                if (value == null) {
                    editor.remove(key)
                } else {
                    editor.putString(key, value)
                }
            }
            if (!editor.commit()) {
                throw DeviceRegistrationPreferencesException.Write(keys = keys)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: DeviceRegistrationPreferencesException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Write(keys = keys, cause = error)
        }
    }

    private fun deleteKeys(preferences: SharedPreferences, keys: Set<String>) {
        try {
            val editor = preferences.edit()
            keys.forEach(editor::remove)
            if (!editor.commit()) {
                throw DeviceRegistrationPreferencesException.Delete(keys = keys)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: DeviceRegistrationPreferencesException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Delete(keys = keys, cause = error)
        }
    }

    private fun String?.normalizedOrNull(): String? = this?.trim()?.ifBlank { null }

    internal companion object {
        const val PREFERENCES_NAME = "device_registration"
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_FCM_TOKEN = "fcm_token"
        const val KEY_MEMBER_ID = "member_id"
        const val KEY_AUTH_UID = "auth_uid"
        const val KEY_ENVIRONMENT = "environment"
        const val KEY_LEASE_ID = "lease_id"

        val AUTHORIZED_SESSION_KEYS = setOf(
            KEY_MEMBER_ID,
            KEY_AUTH_UID,
            KEY_ENVIRONMENT,
            KEY_LEASE_ID,
        )
        val LEGACY_RAW_KEYS = setOf(
            KEY_DEVICE_ID,
            KEY_FCM_TOKEN,
            KEY_MEMBER_ID,
            KEY_AUTH_UID,
            KEY_ENVIRONMENT,
            KEY_LEASE_ID,
        )
    }
}

private class AndroidDeviceRegistrationEncryptedPreferencesFactory(
    private val context: Context,
) : DeviceRegistrationEncryptedPreferencesFactory {
    override fun create(): SharedPreferences {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            DeviceRegistrationPreferences.PREFERENCES_NAME,
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }
}
