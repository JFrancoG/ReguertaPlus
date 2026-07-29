package com.reguerta.user.data.devices

import android.content.SharedPreferences
import javax.crypto.spec.SecretKeySpec
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DeviceRegistrationPreferencesTest {
    @Test
    fun `keystore store encrypts values and roundtrips them`() {
        val rawPreferences = FakeSharedPreferences()
        val store = AndroidKeystoreDeviceRegistrationEncryptedStore(
            preferences = rawPreferences,
            valueCipher = testValueCipher(),
        )

        assertTrue(store.write(mapOf("member_id" to "MEMBER-1")))

        val persisted = checkNotNull(rawPreferences.getString("member_id", null))
        assertFalse(persisted.contains("MEMBER-1"))
        assertTrue(persisted.startsWith("v1."))
        assertEquals("MEMBER-1", store.getString("member_id"))

        assertTrue(store.write(mapOf("member_id" to "MEMBER-1")))
        val rewritten = checkNotNull(rawPreferences.getString("member_id", null))
        assertNotEquals(persisted, rewritten)
        assertEquals("MEMBER-1", store.getString("member_id"))
    }

    @Test
    fun `keystore store binds ciphertext to its preference key`() {
        val rawPreferences = FakeSharedPreferences()
        val store = AndroidKeystoreDeviceRegistrationEncryptedStore(
            preferences = rawPreferences,
            valueCipher = testValueCipher(),
        )
        assertTrue(
            store.write(
                mapOf(
                    "member_id" to "MEMBER-1",
                    "auth_uid" to "UID-1",
                ),
            ),
        )
        val memberCiphertext = checkNotNull(rawPreferences.getString("member_id", null))
        assertTrue(rawPreferences.edit().putString("auth_uid", memberCiphertext).commit())

        val result = runCatching { store.getString("auth_uid") }

        assertTrue(result.isFailure)
    }

    @Test
    fun `absent push credential returns null`() = runTest {
        val preferences = testPreferences(
            encrypted = FakeSharedPreferences(),
            raw = FakeSharedPreferences(),
        )

        assertNull(preferences.getFirebaseInstallationId())
    }

    @Test
    fun `read failure is distinct from an absent value`() = runTest {
        val preferences = testPreferences(
            encrypted = FakeSharedPreferences(
                readFailure = IllegalStateException("read failed"),
            ),
            raw = FakeSharedPreferences(),
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Read> {
            preferences.getFirebaseInstallationId()
        }
    }

    @Test
    fun `created device id is not returned when persistence fails`() = runTest {
        val encryptedPreferences = FakeSharedPreferences(commitResult = false)
        val preferences = testPreferences(
            encrypted = encryptedPreferences,
            raw = FakeSharedPreferences(),
            deviceIdProvider = { "CREATED-ID" },
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Write> {
            preferences.getOrCreateDeviceId()
        }
        assertFalse(encryptedPreferences.contains("device_id"))
    }

    @Test
    fun `delete failure is reported instead of looking successful`() = runTest {
        val encryptedPreferences = FakeSharedPreferences(
            initialValues = mapOf(
                "member_id" to "MEMBER-1",
                "auth_uid" to "UID-1",
                "environment" to "production",
                "lease_id" to "LEASE-1",
            ),
            commitResult = false,
        )
        val preferences = testPreferences(
            encrypted = encryptedPreferences,
            raw = FakeSharedPreferences(),
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Delete> {
            preferences.clearAuthorizedSessionContext()
        }
        assertTrue(encryptedPreferences.contains("member_id"))
    }

    @Test
    fun `encrypted storage initialization failure is typed`() = runTest {
        val preferences = DeviceRegistrationPreferences(
            encryptedStoreFactory = DeviceRegistrationEncryptedStoreFactory {
                throw IllegalStateException("keystore unavailable")
            },
            rawPreferencesProvider = { FakeSharedPreferences() },
            ioDispatcher = UnconfinedTestDispatcher(testScheduler),
            deviceIdProvider = { "CREATED-ID" },
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Initialization> {
            preferences.getFirebaseInstallationId()
        }
    }

    @Test
    fun `legacy plaintext keys survive encrypted initialization failure for a safe retry`() = runTest {
        val rawPreferences = FakeSharedPreferences(
            initialValues = mapOf(
                "device_id" to "RAW-ID",
                "fcm_token" to "RAW-TOKEN",
                "member_id" to "RAW-MEMBER",
                "auth_uid" to "RAW-UID",
                "environment" to "develop",
                "lease_id" to "RAW-LEASE",
                "unrelated" to "KEEP-ME",
            ),
        )
        val preferences = DeviceRegistrationPreferences(
            encryptedStoreFactory = DeviceRegistrationEncryptedStoreFactory {
                throw IllegalStateException("keystore unavailable")
            },
            rawPreferencesProvider = { rawPreferences },
            ioDispatcher = UnconfinedTestDispatcher(testScheduler),
            deviceIdProvider = { "CREATED-ID" },
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Initialization> {
            preferences.getFirebaseInstallationId()
        }

        assertEquals("RAW-ID", rawPreferences.getString("device_id", null))
        assertEquals("RAW-TOKEN", rawPreferences.getString("fcm_token", null))
        assertEquals("RAW-MEMBER", rawPreferences.getString("member_id", null))
        assertEquals("RAW-UID", rawPreferences.getString("auth_uid", null))
        assertEquals("develop", rawPreferences.getString("environment", null))
        assertEquals("RAW-LEASE", rawPreferences.getString("lease_id", null))
        assertEquals("KEEP-ME", rawPreferences.getString("unrelated", null))
    }

    @Test
    fun `legacy encrypted values migrate atomically and leave rollback material intact`() = runTest {
        val encryptedPreferences = FakeSharedPreferences()
        val rawPreferences = FakeSharedPreferences(
            initialValues = mapOf(
                "device_id" to "PLAINTEXT-ID",
                LegacyEncryptedDeviceRegistrationValuesReader.KEY_KEYSET_ALIAS to "KEYSET",
                LegacyEncryptedDeviceRegistrationValuesReader.VALUE_KEYSET_ALIAS to "KEYSET",
                "unrelated" to "KEEP-ME",
            ),
        )
        var legacyReads = 0
        val preferences = DeviceRegistrationPreferences(
            encryptedStoreFactory = DeviceRegistrationEncryptedStoreFactory {
                SharedPreferencesDeviceRegistrationEncryptedStore(encryptedPreferences)
            },
            rawPreferencesProvider = { rawPreferences },
            legacyValuesReader = LegacyDeviceRegistrationValuesReader {
                legacyReads += 1
                mapOf(
                    "device_id" to "LEGACY-ID",
                    "fcm_token" to "LEGACY-PUSH-CREDENTIAL",
                    "member_id" to "MEMBER-1",
                    "auth_uid" to "UID-1",
                    "environment" to "production",
                    "lease_id" to "LEASE-1",
                )
            },
            ioDispatcher = UnconfinedTestDispatcher(testScheduler),
            deviceIdProvider = { "CREATED-ID" },
        )

        assertEquals("LEGACY-ID", preferences.getOrCreateDeviceId())
        assertNull(preferences.getFirebaseInstallationId())
        assertEquals(
            AuthorizedDeviceSessionContext(
                memberId = "MEMBER-1",
                authUid = "UID-1",
                environment = "production",
                leaseId = "LEASE-1",
            ),
            preferences.getAuthorizedSessionContext(),
        )
        assertEquals(1, legacyReads)
        assertEquals(1, encryptedPreferences.commitCount)
        assertFalse(rawPreferences.contains("device_id"))
        assertEquals(
            "KEYSET",
            rawPreferences.getString(
                LegacyEncryptedDeviceRegistrationValuesReader.KEY_KEYSET_ALIAS,
                null,
            ),
        )
        assertEquals(
            "KEYSET",
            rawPreferences.getString(
                LegacyEncryptedDeviceRegistrationValuesReader.VALUE_KEYSET_ALIAS,
                null,
            ),
        )
        assertEquals("KEEP-ME", rawPreferences.getString("unrelated", null))
    }

    @Test
    fun `legacy migration failure preserves source values and reports initialization`() = runTest {
        val encryptedPreferences = FakeSharedPreferences()
        val rawPreferences = FakeSharedPreferences(
            initialValues = mapOf("device_id" to "LEGACY-ID"),
        )
        val preferences = DeviceRegistrationPreferences(
            encryptedStoreFactory = DeviceRegistrationEncryptedStoreFactory {
                SharedPreferencesDeviceRegistrationEncryptedStore(encryptedPreferences)
            },
            rawPreferencesProvider = { rawPreferences },
            legacyValuesReader = LegacyDeviceRegistrationValuesReader {
                throw IllegalStateException("legacy keyset unavailable")
            },
            ioDispatcher = UnconfinedTestDispatcher(testScheduler),
            deviceIdProvider = { "CREATED-ID" },
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Initialization> {
            preferences.getOrCreateDeviceId()
        }

        assertEquals("LEGACY-ID", rawPreferences.getString("device_id", null))
        assertFalse(encryptedPreferences.contains("device_id"))
    }

    @Test
    fun `existing v2 identity is never overwritten by legacy migration`() = runTest {
        val encryptedPreferences = FakeSharedPreferences(
            initialValues = mapOf("device_id" to "V2-ID"),
        )
        val rawPreferences = FakeSharedPreferences(
            initialValues = mapOf("device_id" to "LEGACY-ID"),
        )
        var legacyReads = 0
        val preferences = DeviceRegistrationPreferences(
            encryptedStoreFactory = DeviceRegistrationEncryptedStoreFactory {
                SharedPreferencesDeviceRegistrationEncryptedStore(encryptedPreferences)
            },
            rawPreferencesProvider = { rawPreferences },
            legacyValuesReader = LegacyDeviceRegistrationValuesReader {
                legacyReads += 1
                mapOf("device_id" to "OTHER-ID")
            },
            ioDispatcher = UnconfinedTestDispatcher(testScheduler),
            deviceIdProvider = { "CREATED-ID" },
        )

        assertEquals("V2-ID", preferences.getOrCreateDeviceId())
        assertEquals(0, legacyReads)
        assertFalse(rawPreferences.contains("device_id"))
    }

    @Test
    fun `created device id is committed and reused`() = runTest {
        val encryptedPreferences = FakeSharedPreferences()
        var generatedIds = 0
        val preferences = testPreferences(
            encrypted = encryptedPreferences,
            raw = FakeSharedPreferences(),
            deviceIdProvider = {
                generatedIds += 1
                "CREATED-ID-$generatedIds"
            },
        )

        assertEquals("CREATED-ID-1", preferences.getOrCreateDeviceId())
        assertEquals("CREATED-ID-1", preferences.getOrCreateDeviceId())
        assertEquals("CREATED-ID-1", encryptedPreferences.getString("device_id", null))
        assertEquals(1, generatedIds)
        assertEquals(1, encryptedPreferences.commitCount)
        assertEquals(0, encryptedPreferences.applyCount)
    }

    @Test
    fun `authorized context roundtrips member environment and lease`() = runTest {
        val preferences = testPreferences(
            encrypted = FakeSharedPreferences(),
            raw = FakeSharedPreferences(),
            leaseIdProvider = { "LEASE-1" },
        )

        val saved = preferences.saveAuthorizedSessionContext(
            memberId = " MEMBER-1 ",
            authUid = " UID-1 ",
            environment = " ProDuction ",
        )

        assertEquals(
            AuthorizedDeviceSessionContext(
                memberId = "MEMBER-1",
                authUid = "UID-1",
                environment = "production",
                leaseId = "LEASE-1",
            ),
            saved,
        )
        assertEquals(saved, preferences.getAuthorizedSessionContext())
    }

    @Test
    fun `superseded session cannot replace the current authorized context`() = runTest {
        var leaseNumber = 0
        val preferences = testPreferences(
            encrypted = FakeSharedPreferences(),
            raw = FakeSharedPreferences(),
            leaseIdProvider = {
                leaseNumber += 1
                "LEASE-$leaseNumber"
            },
        )
        preferences.saveAuthorizedSessionContext(
            memberId = "CURRENT-MEMBER",
            authUid = "CURRENT-UID",
            environment = "production",
        )

        val saved = preferences.saveAuthorizedSessionContext(
            memberId = "STALE-MEMBER",
            authUid = "STALE-UID",
            environment = "develop",
            isSessionCurrent = { false },
        )

        assertNull(saved)
        assertEquals(
            AuthorizedDeviceSessionContext(
                memberId = "CURRENT-MEMBER",
                authUid = "CURRENT-UID",
                environment = "production",
                leaseId = "LEASE-1",
            ),
            preferences.getAuthorizedSessionContext(),
        )
    }

    @Test
    fun `legacy raw keys are removed without deleting encrypted values`() = runTest {
        val encryptedPreferences = FakeSharedPreferences(
            initialValues = mapOf("device_id" to "ENCRYPTED-ID"),
        )
        val rawPreferences = FakeSharedPreferences(
            initialValues = mapOf(
                "device_id" to "RAW-ID",
                "fcm_token" to "RAW-TOKEN",
                "member_id" to "RAW-MEMBER",
                "auth_uid" to "RAW-UID",
                "environment" to "develop",
                "lease_id" to "RAW-LEASE",
                "unrelated" to "KEEP-ME",
            ),
        )
        val preferences = testPreferences(
            encrypted = encryptedPreferences,
            raw = rawPreferences,
        )

        assertEquals("ENCRYPTED-ID", preferences.getOrCreateDeviceId())
        assertFalse(rawPreferences.contains("device_id"))
        assertFalse(rawPreferences.contains("fcm_token"))
        assertFalse(rawPreferences.contains("member_id"))
        assertFalse(rawPreferences.contains("auth_uid"))
        assertFalse(rawPreferences.contains("environment"))
        assertFalse(rawPreferences.contains("lease_id"))
        assertEquals("KEEP-ME", rawPreferences.getString("unrelated", null))
        assertEquals("ENCRYPTED-ID", encryptedPreferences.getString("device_id", null))
    }

    @Test
    fun `legacy encrypted context without auth uid is invalidated without deleting device data`() = runTest {
        val encryptedPreferences = FakeSharedPreferences(
            initialValues = mapOf(
                "device_id" to "DEVICE-1",
                "fcm_token" to "TOKEN-1",
                "member_id" to "MEMBER-1",
                "environment" to "production",
                "lease_id" to "LEASE-1",
            ),
        )
        val preferences = testPreferences(
            encrypted = encryptedPreferences,
            raw = FakeSharedPreferences(),
        )

        assertNull(preferences.getAuthorizedSessionContext())
        assertFalse(encryptedPreferences.contains("member_id"))
        assertFalse(encryptedPreferences.contains("auth_uid"))
        assertFalse(encryptedPreferences.contains("environment"))
        assertFalse(encryptedPreferences.contains("lease_id"))
        assertEquals("DEVICE-1", preferences.getOrCreateDeviceId())
        assertNull(preferences.getFirebaseInstallationId())
    }

    @Test
    fun `unknown partial authorized context is corruption rather than absence`() = runTest {
        val preferences = testPreferences(
            encrypted = FakeSharedPreferences(
                initialValues = mapOf(
                    "member_id" to "MEMBER-1",
                    "auth_uid" to "UID-1",
                    "environment" to "production",
                ),
            ),
            raw = FakeSharedPreferences(),
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Corrupted> {
            preferences.getAuthorizedSessionContext()
        }
    }

    @Test
    fun `blank stored auth uid remains corruption rather than legacy absence`() = runTest {
        val encryptedPreferences = FakeSharedPreferences(
            initialValues = mapOf(
                "member_id" to "MEMBER-1",
                "auth_uid" to "   ",
                "environment" to "production",
                "lease_id" to "LEASE-1",
            ),
        )
        val preferences = testPreferences(
            encrypted = encryptedPreferences,
            raw = FakeSharedPreferences(),
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Corrupted> {
            preferences.getAuthorizedSessionContext()
        }
        assertTrue(encryptedPreferences.contains("member_id"))
        assertTrue(encryptedPreferences.contains("auth_uid"))
        assertTrue(encryptedPreferences.contains("environment"))
        assertTrue(encryptedPreferences.contains("lease_id"))
    }

    @Test
    fun `isolated blank authorized key remains corruption rather than absence`() = runTest {
        val preferences = testPreferences(
            encrypted = FakeSharedPreferences(
                initialValues = mapOf("auth_uid" to "   "),
            ),
            raw = FakeSharedPreferences(),
        )

        assertSuspendThrows<DeviceRegistrationPreferencesException.Corrupted> {
            preferences.getAuthorizedSessionContext()
        }
    }

    private fun kotlinx.coroutines.test.TestScope.testPreferences(
        encrypted: FakeSharedPreferences,
        raw: FakeSharedPreferences,
        deviceIdProvider: () -> String = { "CREATED-ID" },
        leaseIdProvider: () -> String = { "LEASE-ID" },
    ): DeviceRegistrationPreferences = DeviceRegistrationPreferences(
        encryptedStoreFactory = DeviceRegistrationEncryptedStoreFactory {
            SharedPreferencesDeviceRegistrationEncryptedStore(encrypted)
        },
        rawPreferencesProvider = { raw },
        ioDispatcher = UnconfinedTestDispatcher(testScheduler),
        deviceIdProvider = deviceIdProvider,
        leaseIdProvider = leaseIdProvider,
    )

    private fun testValueCipher() = AesGcmDeviceRegistrationValueCipher(
        secretKey = SecretKeySpec(ByteArray(32) { index -> index.toByte() }, "AES"),
    )

    private suspend inline fun <reified T : Throwable> assertSuspendThrows(
        crossinline block: suspend () -> Unit,
    ): T {
        var caught: Throwable? = null
        try {
            block()
        } catch (error: Throwable) {
            caught = error
        }
        assertTrue(
            "Expected ${T::class.java.simpleName}, got ${caught?.javaClass?.simpleName}",
            caught is T,
        )
        return caught as T
    }
}

private class FakeSharedPreferences(
    initialValues: Map<String, String> = emptyMap(),
    private val commitResult: Boolean = true,
    private val readFailure: RuntimeException? = null,
) : SharedPreferences {
    private val values = initialValues.toMutableMap()
    var commitCount = 0
        private set
    var applyCount = 0
        private set

    override fun getAll(): Map<String, *> = values.toMap()

    override fun getString(key: String, defValue: String?): String? {
        readFailure?.let { throw it }
        return values[key] ?: defValue
    }

    override fun getStringSet(key: String, defValues: Set<String>?): Set<String>? = defValues

    override fun getInt(key: String, defValue: Int): Int = defValue

    override fun getLong(key: String, defValue: Long): Long = defValue

    override fun getFloat(key: String, defValue: Float): Float = defValue

    override fun getBoolean(key: String, defValue: Boolean): Boolean = defValue

    override fun contains(key: String): Boolean = values.containsKey(key)

    override fun edit(): SharedPreferences.Editor = Editor()

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?,
    ) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?,
    ) = Unit

    private inner class Editor : SharedPreferences.Editor {
        private val updates = mutableMapOf<String, String?>()
        private var clearRequested = false

        override fun putString(key: String, value: String?): SharedPreferences.Editor = apply {
            updates[key] = value
        }

        override fun putStringSet(key: String, values: Set<String>?): SharedPreferences.Editor = this

        override fun putInt(key: String, value: Int): SharedPreferences.Editor = this

        override fun putLong(key: String, value: Long): SharedPreferences.Editor = this

        override fun putFloat(key: String, value: Float): SharedPreferences.Editor = this

        override fun putBoolean(key: String, value: Boolean): SharedPreferences.Editor = this

        override fun remove(key: String): SharedPreferences.Editor = apply {
            updates[key] = null
        }

        override fun clear(): SharedPreferences.Editor = apply {
            clearRequested = true
        }

        override fun commit(): Boolean {
            commitCount += 1
            if (!commitResult) return false
            if (clearRequested) values.clear()
            updates.forEach { (key, value) ->
                if (value == null) values.remove(key) else values[key] = value
            }
            return true
        }

        override fun apply() {
            applyCount += 1
            commit()
        }
    }
}
