package com.reguerta.user.data.devices

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal interface DeviceRegistrationEncryptedStore {
    fun getString(key: String): String?

    fun contains(key: String): Boolean

    fun write(values: Map<String, String?>): Boolean

    fun remove(keys: Set<String>): Boolean
}

internal class SharedPreferencesDeviceRegistrationEncryptedStore(
    private val preferences: SharedPreferences,
) : DeviceRegistrationEncryptedStore {
    override fun getString(key: String): String? = preferences.getString(key, null)

    override fun contains(key: String): Boolean = preferences.contains(key)

    override fun write(values: Map<String, String?>): Boolean {
        val editor = preferences.edit()
        values.forEach { (key, value) ->
            if (value == null) editor.remove(key) else editor.putString(key, value)
        }
        return editor.commit()
    }

    override fun remove(keys: Set<String>): Boolean {
        val editor = preferences.edit()
        keys.forEach(editor::remove)
        return editor.commit()
    }
}

internal interface DeviceRegistrationValueCipher {
    fun encrypt(key: String, value: String): String

    fun decrypt(key: String, value: String): String
}

internal class AesGcmDeviceRegistrationValueCipher(
    private val secretKey: SecretKey,
) : DeviceRegistrationValueCipher {
    override fun encrypt(key: String, value: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        cipher.updateAAD(key.toByteArray(StandardCharsets.UTF_8))
        val ciphertext = cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        return listOf(
            FORMAT_VERSION,
            encoder.encodeToString(cipher.iv),
            encoder.encodeToString(ciphertext),
        ).joinToString(SEPARATOR)
    }

    override fun decrypt(key: String, value: String): String {
        val parts = value.split(SEPARATOR, limit = 3)
        require(parts.size == 3 && parts[0] == FORMAT_VERSION) {
            "Unsupported device registration ciphertext format"
        }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            secretKey,
            GCMParameterSpec(TAG_LENGTH_BITS, decoder.decode(parts[1])),
        )
        cipher.updateAAD(key.toByteArray(StandardCharsets.UTF_8))
        return String(cipher.doFinal(decoder.decode(parts[2])), StandardCharsets.UTF_8)
    }

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val FORMAT_VERSION = "v1"
        const val SEPARATOR = "."
        const val TAG_LENGTH_BITS = 128
        val encoder: Base64.Encoder = Base64.getUrlEncoder().withoutPadding()
        val decoder: Base64.Decoder = Base64.getUrlDecoder()
    }
}

internal class AndroidKeystoreDeviceRegistrationEncryptedStore(
    private val preferences: SharedPreferences,
    private val valueCipher: DeviceRegistrationValueCipher,
) : DeviceRegistrationEncryptedStore {
    override fun getString(key: String): String? = preferences.getString(key, null)?.let { value ->
        valueCipher.decrypt(key, value)
    }

    override fun contains(key: String): Boolean = preferences.contains(key)

    override fun write(values: Map<String, String?>): Boolean {
        val encryptedValues = values.mapValues { (key, value) ->
            value?.let { valueCipher.encrypt(key, it) }
        }
        val editor = preferences.edit()
        encryptedValues.forEach { (key, value) ->
            if (value == null) editor.remove(key) else editor.putString(key, value)
        }
        return editor.commit()
    }

    override fun remove(keys: Set<String>): Boolean {
        val editor = preferences.edit()
        keys.forEach(editor::remove)
        return editor.commit()
    }
}

internal class AndroidDeviceRegistrationEncryptedStoreFactory(
    private val context: Context,
    private val preferencesName: String = DeviceRegistrationPreferences.SECURE_PREFERENCES_NAME,
    private val keyAlias: String = DEFAULT_KEY_ALIAS,
) : DeviceRegistrationEncryptedStoreFactory {
    override fun create(): DeviceRegistrationEncryptedStore {
        val keyProvider = AndroidKeystoreDeviceRegistrationKeyProvider(keyAlias)
        return AndroidKeystoreDeviceRegistrationEncryptedStore(
            preferences = context.getSharedPreferences(
                preferencesName,
                Context.MODE_PRIVATE,
            ),
            valueCipher = AesGcmDeviceRegistrationValueCipher(
                secretKey = keyProvider.getOrCreate(),
            ),
        )
    }

    internal companion object {
        const val DEFAULT_KEY_ALIAS = "reguerta_device_registration_aes_v2"
    }
}

private class AndroidKeystoreDeviceRegistrationKeyProvider(
    private val alias: String,
) {
    fun getOrCreate(): SecretKey = synchronized(KEYSTORE_LOCK) {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(alias, null) as? SecretKey) ?: generateKey()
    }

    private fun generateKey(): SecretKey {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE,
        )
        keyGenerator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return keyGenerator.generateKey()
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        val KEYSTORE_LOCK = Any()
    }
}
