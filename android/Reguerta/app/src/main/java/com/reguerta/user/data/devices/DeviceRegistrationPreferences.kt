package com.reguerta.user.data.devices

import android.content.Context
import android.content.SharedPreferences
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

internal fun interface DeviceRegistrationEncryptedStoreFactory {
    fun create(): DeviceRegistrationEncryptedStore
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
    private val encryptedStoreFactory: DeviceRegistrationEncryptedStoreFactory,
    private val rawPreferencesProvider: () -> SharedPreferences,
    private val legacyValuesReader: LegacyDeviceRegistrationValuesReader =
        LegacyDeviceRegistrationValuesReader { emptyMap() },
    private val ioDispatcher: CoroutineDispatcher,
    private val deviceIdProvider: () -> String,
    private val leaseIdProvider: () -> String = { UUID.randomUUID().toString() },
) : AuthorizedDeviceRegistrationStore {
    constructor(context: Context) : this(
        encryptedStoreFactory = AndroidDeviceRegistrationEncryptedStoreFactory(
            context = context.applicationContext,
        ),
        rawPreferencesProvider = {
            context.applicationContext.getSharedPreferences(
                LEGACY_PREFERENCES_NAME,
                Context.MODE_PRIVATE,
            )
        },
        legacyValuesReader = LegacyEncryptedDeviceRegistrationValuesReader(
            context = context.applicationContext,
        ),
        ioDispatcher = Dispatchers.IO,
        deviceIdProvider = { UUID.randomUUID().toString().uppercase(Locale.ROOT) },
    )

    private val operationMutex = Mutex()
    private var initializedStore: DeviceRegistrationEncryptedStore? = null

    override suspend fun getOrCreateDeviceId(): String = withEncryptedStore { store ->
        readOptionalString(store, KEY_DEVICE_ID)?.let { return@withEncryptedStore it }

        val created = deviceIdProvider()
        writeValues(store, mapOf(KEY_DEVICE_ID to created))
        created
    }

    override suspend fun saveFirebaseInstallationId(installationId: String?) {
        withEncryptedStore { store ->
            val normalizedInstallationId = installationId.normalizedOrNull()
            if (normalizedInstallationId == null) {
                deleteKeys(store, setOf(KEY_FIREBASE_INSTALLATION_ID))
            } else {
                writeValues(
                    store,
                    mapOf(KEY_FIREBASE_INSTALLATION_ID to normalizedInstallationId),
                )
            }
        }
    }

    override suspend fun getFirebaseInstallationId(): String? = withEncryptedStore { store ->
        readOptionalString(store, KEY_FIREBASE_INSTALLATION_ID)
    }

    suspend fun saveAuthorizedSessionContext(
        memberId: String,
        authUid: String,
        environment: String,
        isSessionCurrent: () -> Boolean = { true },
    ): AuthorizedDeviceSessionContext? = withEncryptedStore { store ->
        if (!isSessionCurrent()) {
            return@withEncryptedStore null
        }
        val authorizedContext = AuthorizedDeviceSessionContext(
            memberId = requireNotNull(memberId.normalizedOrNull()) {
                "Authorized member ID must not be blank"
            },
            authUid = requireNotNull(authUid.normalizedOrNull()) {
                "Authorized Auth UID must not be blank"
            },
            environment = requireNotNull(
                environment.trim().lowercase(Locale.ROOT).ifBlank { null },
            ) {
                "Authorized environment must not be blank"
            },
            leaseId = leaseIdProvider(),
        )
        writeValues(
            store = store,
            values = mapOf(
                KEY_MEMBER_ID to authorizedContext.memberId,
                KEY_AUTH_UID to authorizedContext.authUid,
                KEY_ENVIRONMENT to authorizedContext.environment,
                KEY_LEASE_ID to authorizedContext.leaseId,
            ),
        )
        authorizedContext
    }

    suspend fun clearAuthorizedSessionContext() {
        withEncryptedStore { store ->
            deleteKeys(
                store = store,
                keys = AUTHORIZED_SESSION_KEYS,
            )
        }
    }

    override suspend fun getAuthorizedSessionContext(): AuthorizedDeviceSessionContext? =
        withEncryptedStore { store ->
            val presentKeys = AUTHORIZED_SESSION_KEYS.filterTo(mutableSetOf()) { key ->
                containsKey(store, key)
            }
            if (presentKeys.isEmpty()) {
                return@withEncryptedStore null
            }
            val values = AUTHORIZED_SESSION_KEYS.associateWith { key ->
                readOptionalString(store, key)
            }
            val missingKeys = values.filterValues { it == null }.keys
            if (
                missingKeys == setOf(KEY_AUTH_UID) &&
                presentKeys == LEGACY_AUTHORIZED_SESSION_KEYS
            ) {
                deleteKeys(store, AUTHORIZED_SESSION_KEYS)
                return@withEncryptedStore null
            }
            if (values.values.any { it == null }) {
                throw DeviceRegistrationPreferencesException.Corrupted(
                    keys = missingKeys,
                )
            }

            AuthorizedDeviceSessionContext(
                memberId = checkNotNull(values[KEY_MEMBER_ID]),
                authUid = checkNotNull(values[KEY_AUTH_UID]),
                environment = checkNotNull(values[KEY_ENVIRONMENT]),
                leaseId = checkNotNull(values[KEY_LEASE_ID]),
            )
        }

    private suspend fun <T> withEncryptedStore(
        block: (DeviceRegistrationEncryptedStore) -> T,
    ): T = withContext(ioDispatcher) {
        operationMutex.withLock {
            block(initializeStoreIfNeeded())
        }
    }

    private fun initializeStoreIfNeeded(): DeviceRegistrationEncryptedStore {
        initializedStore?.let { return it }

        val rawPreferences = try {
            rawPreferencesProvider()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Initialization(error)
        }
        val encryptedStore = try {
            encryptedStoreFactory.create()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Initialization(error)
        }
        migrateLegacyValuesIfNeeded(
            rawPreferences = rawPreferences,
            encryptedStore = encryptedStore,
        )
        return encryptedStore.also { initializedStore = it }
    }

    private fun migrateLegacyValuesIfNeeded(
        rawPreferences: SharedPreferences,
        encryptedStore: DeviceRegistrationEncryptedStore,
    ) {
        val newStoreAlreadyInitialized = CURRENT_STORAGE_KEYS.any { key ->
            containsKey(encryptedStore, key)
        }
        if (!newStoreAlreadyInitialized) {
            val plaintextValues = readLegacyPlaintextValues(rawPreferences)
            val encryptedValues = readLegacyEncryptedValues()
            val valuesToMigrate = plaintextValues + encryptedValues
            if (valuesToMigrate.isNotEmpty()) {
                writeValues(encryptedStore, valuesToMigrate)
            }
        }

        // Only plaintext fallback entries are removed. Tink keysets and encrypted entries remain
        // untouched so a controlled rollback can still read the legacy store.
        deleteKeys(
            store = SharedPreferencesDeviceRegistrationEncryptedStore(rawPreferences),
            keys = LEGACY_RAW_KEYS,
        )
    }

    private fun readLegacyPlaintextValues(
        rawPreferences: SharedPreferences,
    ): Map<String, String> = try {
        MIGRATABLE_LEGACY_KEYS.mapNotNull { key ->
            rawPreferences.getString(key, null).normalizedOrNull()?.let { key to it }
        }.toMap()
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        throw DeviceRegistrationPreferencesException.Initialization(error)
    }

    private fun readLegacyEncryptedValues(): Map<String, String> = try {
        legacyValuesReader.readValues(MIGRATABLE_LEGACY_KEYS)
            .filterKeys(MIGRATABLE_LEGACY_KEYS::contains)
            .mapNotNull { (key, value) -> value.normalizedOrNull()?.let { key to it } }
            .toMap()
    } catch (error: CancellationException) {
        throw error
    } catch (error: DeviceRegistrationPreferencesException) {
        throw error
    } catch (error: Exception) {
        throw DeviceRegistrationPreferencesException.Initialization(error)
    }

    private fun readOptionalString(store: DeviceRegistrationEncryptedStore, key: String): String? =
        try {
            store.getString(key).normalizedOrNull()
        } catch (error: CancellationException) {
            throw error
        } catch (error: DeviceRegistrationPreferencesException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Read(key = key, cause = error)
        }

    private fun containsKey(store: DeviceRegistrationEncryptedStore, key: String): Boolean =
        try {
            store.contains(key)
        } catch (error: CancellationException) {
            throw error
        } catch (error: DeviceRegistrationPreferencesException) {
            throw error
        } catch (error: Exception) {
            throw DeviceRegistrationPreferencesException.Read(key = key, cause = error)
        }

    private fun writeValues(
        store: DeviceRegistrationEncryptedStore,
        values: Map<String, String?>,
    ) {
        val keys = values.keys
        try {
            if (!store.write(values)) {
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

    private fun deleteKeys(store: DeviceRegistrationEncryptedStore, keys: Set<String>) {
        try {
            if (!store.remove(keys)) {
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
        const val SECURE_PREFERENCES_NAME = "device_registration_secure_v2"
        const val LEGACY_PREFERENCES_NAME = "device_registration"
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_FIREBASE_INSTALLATION_ID = "firebase_installation_id"
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
        val LEGACY_AUTHORIZED_SESSION_KEYS = setOf(
            KEY_MEMBER_ID,
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
        val MIGRATABLE_LEGACY_KEYS = LEGACY_RAW_KEYS - KEY_FCM_TOKEN
        val CURRENT_STORAGE_KEYS = setOf(
            KEY_DEVICE_ID,
            KEY_FIREBASE_INSTALLATION_ID,
            KEY_MEMBER_ID,
            KEY_AUTH_UID,
            KEY_ENVIRONMENT,
            KEY_LEASE_ID,
        )
    }
}
