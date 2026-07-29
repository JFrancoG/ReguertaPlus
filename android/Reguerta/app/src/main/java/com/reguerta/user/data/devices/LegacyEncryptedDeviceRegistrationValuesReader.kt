package com.reguerta.user.data.devices

import android.content.Context
import com.google.crypto.tink.Aead
import com.google.crypto.tink.Configuration
import com.google.crypto.tink.DeterministicAead
import com.google.crypto.tink.InsecureSecretKeyAccess
import com.google.crypto.tink.KeysetHandle
import com.google.crypto.tink.RegistryConfiguration
import com.google.crypto.tink.TinkProtoKeysetFormat
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.daead.DeterministicAeadConfig
import com.google.crypto.tink.integration.android.AndroidKeystore
import com.google.crypto.tink.subtle.Hex
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.GeneralSecurityException
import java.util.Base64

internal fun interface LegacyDeviceRegistrationValuesReader {
    fun readValues(keys: Set<String>): Map<String, String>
}

/**
 * Migration-only reader for the wire format written by AndroidX
 * EncryptedSharedPreferences. It deliberately uses current Tink primitives instead of restoring
 * the deprecated AndroidX API. The legacy file is kept intact for rollback.
 */
internal class LegacyEncryptedDeviceRegistrationValuesReader(
    context: Context,
    private val preferencesName: String = DeviceRegistrationPreferences.LEGACY_PREFERENCES_NAME,
    private val masterKeyAlias: String = LEGACY_MASTER_KEY_ALIAS,
) : LegacyDeviceRegistrationValuesReader {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)

    override fun readValues(keys: Set<String>): Map<String, String> =
        synchronized(LEGACY_READER_LOCK) {
            val hasKeyKeyset = preferences.contains(KEY_KEYSET_ALIAS)
            val hasValueKeyset = preferences.contains(VALUE_KEYSET_ALIAS)
            if (!hasKeyKeyset && !hasValueKeyset) {
                return@synchronized emptyMap()
            }
            require(hasKeyKeyset && hasValueKeyset) {
                "Legacy encrypted device registration keysets are incomplete"
            }

            AeadConfig.register()
            DeterministicAeadConfig.register()
            val configuration = RegistryConfiguration.get()
            val keyAead = keysetHandle(KEY_KEYSET_ALIAS, configuration).getPrimitive(
                configuration,
                DeterministicAead::class.java,
            )
            val valueAead = keysetHandle(VALUE_KEYSET_ALIAS, configuration).getPrimitive(
                configuration,
                Aead::class.java,
            )

            keys.mapNotNull { key ->
                readString(key, keyAead, valueAead)?.let { key to it }
            }.toMap()
        }

    private fun keysetHandle(
        keysetAlias: String,
        configuration: Configuration,
    ): KeysetHandle {
        val serializedKeyset = Hex.decode(
            requireNotNull(preferences.getString(keysetAlias, null)) {
                "Legacy encrypted device registration keyset is missing"
            },
        )
        if (!AndroidKeystore.hasKey(masterKeyAlias)) {
            return parseCleartextKeyset(serializedKeyset, configuration)
        }

        return try {
            TinkProtoKeysetFormat.parseEncryptedKeyset(
                serializedKeyset,
                AndroidKeystore.getAead(masterKeyAlias),
                EMPTY_ASSOCIATED_DATA,
                configuration,
            )
        } catch (encryptedError: GeneralSecurityException) {
            try {
                parseCleartextKeyset(serializedKeyset, configuration)
            } catch (cleartextError: GeneralSecurityException) {
                encryptedError.addSuppressed(cleartextError)
                throw encryptedError
            }
        }
    }

    private fun parseCleartextKeyset(
        serializedKeyset: ByteArray,
        configuration: Configuration,
    ): KeysetHandle = TinkProtoKeysetFormat.parseKeyset(
        serializedKeyset,
        InsecureSecretKeyAccess.get(),
        configuration,
    )

    private fun readString(
        key: String,
        keyAead: DeterministicAead,
        valueAead: Aead,
    ): String? {
        val encryptedKeyBytes = keyAead.encryptDeterministically(
            key.toByteArray(StandardCharsets.UTF_8),
            preferencesName.toByteArray(StandardCharsets.UTF_8),
        )
        val encryptedKey = Base64.getEncoder().encodeToString(encryptedKeyBytes)
        val encryptedValue = preferences.getString(encryptedKey, null) ?: return null
        val serializedValue = valueAead.decrypt(
            Base64.getDecoder().decode(encryptedValue),
            encryptedKey.toByteArray(StandardCharsets.UTF_8),
        )
        val buffer = ByteBuffer.wrap(serializedValue)
        require(buffer.remaining() >= SERIALIZED_STRING_HEADER_BYTES) {
            "Legacy encrypted device registration value is truncated"
        }
        require(buffer.int == SERIALIZED_STRING_TYPE) {
            "Legacy encrypted device registration value is not a string"
        }
        val stringLength = buffer.int
        require(stringLength >= 0 && stringLength == buffer.remaining()) {
            "Legacy encrypted device registration string length is invalid"
        }
        val bytes = ByteArray(stringLength)
        buffer.get(bytes)
        return String(bytes, StandardCharsets.UTF_8).takeUnless { it == LEGACY_NULL_VALUE }
    }

    internal companion object {
        const val KEY_KEYSET_ALIAS =
            "__androidx_security_crypto_encrypted_prefs_key_keyset__"
        const val VALUE_KEYSET_ALIAS =
            "__androidx_security_crypto_encrypted_prefs_value_keyset__"
        const val LEGACY_MASTER_KEY_ALIAS = "_androidx_security_master_key_"
        const val LEGACY_NULL_VALUE = "__NULL__"
        const val SERIALIZED_STRING_TYPE = 0
        const val SERIALIZED_STRING_HEADER_BYTES = Int.SIZE_BYTES * 2
        private val EMPTY_ASSOCIATED_DATA = ByteArray(0)
        private val LEGACY_READER_LOCK = Any()
    }
}
