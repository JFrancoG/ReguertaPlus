package com.reguerta.user.data.devices

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.crypto.tink.Aead
import com.google.crypto.tink.DeterministicAead
import com.google.crypto.tink.InsecureSecretKeyAccess
import com.google.crypto.tink.KeysetHandle
import com.google.crypto.tink.RegistryConfiguration
import com.google.crypto.tink.TinkProtoKeysetFormat
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.aead.PredefinedAeadParameters
import com.google.crypto.tink.daead.DeterministicAeadConfig
import com.google.crypto.tink.daead.PredefinedDeterministicAeadParameters
import com.google.crypto.tink.integration.android.AndroidKeystore
import com.google.crypto.tink.subtle.Hex
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.util.Base64
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LegacyEncryptedDeviceRegistrationMigrationTest {
    @Test
    fun legacyAndroidxFormatMigratesWithoutDestroyingRollbackSource() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val suffix = UUID.randomUUID().toString()
        val legacyPreferencesName = "device_registration_legacy_test_$suffix"
        val securePreferencesName = "device_registration_secure_test_$suffix"
        val legacyMasterKeyAlias = "legacy_master_key_test_$suffix"
        val secureKeyAlias = "secure_device_registration_test_$suffix"
        val legacyValues = mapOf(
            "device_id" to "LEGACY-DEVICE-ID",
            "fcm_token" to "LEGACY-PUSH-CREDENTIAL",
            "member_id" to "MEMBER-1",
            "auth_uid" to "UID-1",
            "environment" to "production",
            "lease_id" to "LEASE-1",
        )
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

        try {
            val legacyFixture = createLegacyFixture(
                context = context,
                preferencesName = legacyPreferencesName,
                masterKeyAlias = legacyMasterKeyAlias,
            )
            val rawLegacyPreferences = context.getSharedPreferences(
                legacyPreferencesName,
                Context.MODE_PRIVATE,
            )
            legacyValues.forEach { (key, value) ->
                assertTrue(legacyFixture.writeString(key, value))
            }

            val preferences = DeviceRegistrationPreferences(
                encryptedStoreFactory = AndroidDeviceRegistrationEncryptedStoreFactory(
                    context = context,
                    preferencesName = securePreferencesName,
                    keyAlias = secureKeyAlias,
                ),
                rawPreferencesProvider = { rawLegacyPreferences },
                legacyValuesReader = LegacyEncryptedDeviceRegistrationValuesReader(
                    context = context,
                    preferencesName = legacyPreferencesName,
                    masterKeyAlias = legacyMasterKeyAlias,
                ),
                ioDispatcher = Dispatchers.IO,
                deviceIdProvider = { "UNEXPECTED-NEW-ID" },
            )

            assertEquals("LEGACY-DEVICE-ID", preferences.getOrCreateDeviceId())
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

            val secureRawPreferences = context.getSharedPreferences(
                securePreferencesName,
                Context.MODE_PRIVATE,
            )
            assertFalse(
                secureRawPreferences.all.values.any { value ->
                    legacyValues.values.any { plaintext ->
                        value.toString().contains(plaintext)
                    }
                },
            )
            assertTrue(
                rawLegacyPreferences.contains(
                    LegacyEncryptedDeviceRegistrationValuesReader.KEY_KEYSET_ALIAS,
                ),
            )
            assertTrue(
                rawLegacyPreferences.contains(
                    LegacyEncryptedDeviceRegistrationValuesReader.VALUE_KEYSET_ALIAS,
                ),
            )
            assertEquals(
                legacyValues,
                LegacyEncryptedDeviceRegistrationValuesReader(
                    context = context,
                    preferencesName = legacyPreferencesName,
                    masterKeyAlias = legacyMasterKeyAlias,
                ).readValues(legacyValues.keys),
            )
        } finally {
            context.deleteSharedPreferences(legacyPreferencesName)
            context.deleteSharedPreferences(securePreferencesName)
            listOf(legacyMasterKeyAlias, secureKeyAlias).forEach { alias ->
                if (keyStore.containsAlias(alias)) {
                    keyStore.deleteEntry(alias)
                }
            }
        }
    }

    @Test
    fun legacyCleartextKeysetsRemainReadableWithoutGeneratingAMasterKey() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val suffix = UUID.randomUUID().toString()
        val preferencesName = "device_registration_cleartext_test_$suffix"
        val absentMasterKeyAlias = "absent_legacy_master_key_test_$suffix"
        val legacyValues = mapOf(
            "device_id" to "LEGACY-CLEARTEXT-KEYSET-ID",
            "member_id" to "MEMBER-1",
        )
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

        try {
            val fixture = createLegacyFixtureWithCleartextKeysets(
                context = context,
                preferencesName = preferencesName,
            )
            legacyValues.forEach { (key, value) ->
                assertTrue(fixture.writeString(key, value))
            }

            assertEquals(
                legacyValues,
                LegacyEncryptedDeviceRegistrationValuesReader(
                    context = context,
                    preferencesName = preferencesName,
                    masterKeyAlias = absentMasterKeyAlias,
                ).readValues(legacyValues.keys),
            )
            assertFalse(AndroidKeystore.hasKey(absentMasterKeyAlias))
        } finally {
            context.deleteSharedPreferences(preferencesName)
            if (keyStore.containsAlias(absentMasterKeyAlias)) {
                keyStore.deleteEntry(absentMasterKeyAlias)
            }
        }
    }

    @Test
    fun missingLegacyMasterKeyFailsWithoutSilentlyRegeneratingIt() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val suffix = UUID.randomUUID().toString()
        val preferencesName = "device_registration_missing_master_test_$suffix"
        val masterKeyAlias = "missing_legacy_master_key_test_$suffix"
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

        try {
            val fixture = createLegacyFixture(
                context = context,
                preferencesName = preferencesName,
                masterKeyAlias = masterKeyAlias,
            )
            assertTrue(fixture.writeString("device_id", "LEGACY-ID"))
            keyStore.deleteEntry(masterKeyAlias)

            val result = runCatching {
                LegacyEncryptedDeviceRegistrationValuesReader(
                    context = context,
                    preferencesName = preferencesName,
                    masterKeyAlias = masterKeyAlias,
                ).readValues(setOf("device_id"))
            }

            assertTrue(result.isFailure)
            assertFalse(AndroidKeystore.hasKey(masterKeyAlias))
        } finally {
            context.deleteSharedPreferences(preferencesName)
            if (keyStore.containsAlias(masterKeyAlias)) {
                keyStore.deleteEntry(masterKeyAlias)
            }
        }
    }

    private fun createLegacyFixture(
        context: Context,
        preferencesName: String,
        masterKeyAlias: String,
    ): LegacyEncryptedSharedPreferencesFixture {
        AeadConfig.register()
        DeterministicAeadConfig.register()
        val configuration = RegistryConfiguration.get()
        AndroidKeystore.generateNewAes256GcmKey(masterKeyAlias)
        val masterAead = AndroidKeystore.getAead(masterKeyAlias)
        val keyHandle = KeysetHandle.generateNew(
            PredefinedDeterministicAeadParameters.AES256_SIV,
        )
        val valueHandle = KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM)
        val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
        assertTrue(
            preferences.edit()
                .putString(
                    LegacyEncryptedDeviceRegistrationValuesReader.KEY_KEYSET_ALIAS,
                    Hex.encode(
                        TinkProtoKeysetFormat.serializeEncryptedKeyset(
                            keyHandle,
                            masterAead,
                            ByteArray(0),
                            configuration,
                        ),
                    ),
                )
                .putString(
                    LegacyEncryptedDeviceRegistrationValuesReader.VALUE_KEYSET_ALIAS,
                    Hex.encode(
                        TinkProtoKeysetFormat.serializeEncryptedKeyset(
                            valueHandle,
                            masterAead,
                            ByteArray(0),
                            configuration,
                        ),
                    ),
                )
                .commit(),
        )
        val keyAead = keyHandle.getPrimitive(configuration, DeterministicAead::class.java)
        val valueAead = valueHandle.getPrimitive(configuration, Aead::class.java)
        return LegacyEncryptedSharedPreferencesFixture(
            preferences = preferences,
            preferencesName = preferencesName,
            keyAead = keyAead,
            valueAead = valueAead,
        )
    }

    private fun createLegacyFixtureWithCleartextKeysets(
        context: Context,
        preferencesName: String,
    ): LegacyEncryptedSharedPreferencesFixture {
        AeadConfig.register()
        DeterministicAeadConfig.register()
        val configuration = RegistryConfiguration.get()
        val keyHandle = KeysetHandle.generateNew(
            PredefinedDeterministicAeadParameters.AES256_SIV,
        )
        val valueHandle = KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM)
        val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
        assertTrue(
            preferences.edit()
                .putString(
                    LegacyEncryptedDeviceRegistrationValuesReader.KEY_KEYSET_ALIAS,
                    Hex.encode(
                        TinkProtoKeysetFormat.serializeKeyset(
                            keyHandle,
                            InsecureSecretKeyAccess.get(),
                            configuration,
                        ),
                    ),
                )
                .putString(
                    LegacyEncryptedDeviceRegistrationValuesReader.VALUE_KEYSET_ALIAS,
                    Hex.encode(
                        TinkProtoKeysetFormat.serializeKeyset(
                            valueHandle,
                            InsecureSecretKeyAccess.get(),
                            configuration,
                        ),
                    ),
                )
                .commit(),
        )
        return LegacyEncryptedSharedPreferencesFixture(
            preferences = preferences,
            preferencesName = preferencesName,
            keyAead = keyHandle.getPrimitive(configuration, DeterministicAead::class.java),
            valueAead = valueHandle.getPrimitive(configuration, Aead::class.java),
        )
    }
}

private class LegacyEncryptedSharedPreferencesFixture(
    private val preferences: android.content.SharedPreferences,
    private val preferencesName: String,
    private val keyAead: DeterministicAead,
    private val valueAead: Aead,
) {
    fun writeString(key: String, value: String): Boolean {
        val encryptedKey = Base64.getEncoder().encodeToString(
            keyAead.encryptDeterministically(
                key.toByteArray(StandardCharsets.UTF_8),
                preferencesName.toByteArray(StandardCharsets.UTF_8),
            ),
        )
        val valueBytes = value.toByteArray(StandardCharsets.UTF_8)
        val serializedValue = ByteBuffer.allocate(Int.SIZE_BYTES * 2 + valueBytes.size)
            .putInt(LegacyEncryptedDeviceRegistrationValuesReader.SERIALIZED_STRING_TYPE)
            .putInt(valueBytes.size)
            .put(valueBytes)
            .array()
        val encryptedValue = Base64.getEncoder().encodeToString(
            valueAead.encrypt(
                serializedValue,
                encryptedKey.toByteArray(StandardCharsets.UTF_8),
            ),
        )
        return preferences.edit().putString(encryptedKey, encryptedValue).commit()
    }
}
