package com.reguerta.user.data.devices

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.util.UUID

class DeviceRegistrationPreferences(
    context: Context,
) {
    private val preferences: SharedPreferences = runCatching {
        val appContext = context.applicationContext
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)

        EncryptedSharedPreferences.create(
            PREFERENCES_NAME,
            masterKeyAlias,
            appContext,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }.getOrElse {
        context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    }

    fun getOrCreateDeviceId(): String {
        val existing = preferences.getString(KEY_DEVICE_ID, null)?.trim()?.ifBlank { null }
        if (existing != null) {
            return existing
        }
        val created = UUID.randomUUID().toString().uppercase()
        preferences.edit().putString(KEY_DEVICE_ID, created).apply()
        return created
    }

    fun saveFcmToken(token: String?) {
        preferences.edit().putString(KEY_FCM_TOKEN, token?.trim()?.ifBlank { null }).apply()
    }

    fun getFcmToken(): String? =
        preferences.getString(KEY_FCM_TOKEN, null)?.trim()?.ifBlank { null }

    fun saveAuthorizedMemberId(memberId: String?) {
        preferences.edit().putString(KEY_MEMBER_ID, memberId?.trim()?.ifBlank { null }).apply()
    }

    fun getAuthorizedMemberId(): String? =
        preferences.getString(KEY_MEMBER_ID, null)?.trim()?.ifBlank { null }

    private companion object {
        const val PREFERENCES_NAME = "device_registration"
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_FCM_TOKEN = "fcm_token"
        const val KEY_MEMBER_ID = "member_id"
    }
}
