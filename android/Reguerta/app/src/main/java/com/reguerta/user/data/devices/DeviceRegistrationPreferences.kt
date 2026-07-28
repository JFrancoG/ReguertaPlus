package com.reguerta.user.data.devices

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.util.UUID

data class AuthorizedDeviceSessionContext(
    val memberId: String,
    val environment: String,
    val leaseId: String,
)

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

    fun saveAuthorizedSessionContext(memberId: String, environment: String) {
        preferences.edit()
            .putString(KEY_MEMBER_ID, memberId.trim().ifBlank { null })
            .putString(KEY_ENVIRONMENT, environment.trim().lowercase().ifBlank { null })
            .putString(KEY_LEASE_ID, UUID.randomUUID().toString())
            .apply()
    }

    fun clearAuthorizedSessionContext() {
        preferences.edit()
            .remove(KEY_MEMBER_ID)
            .remove(KEY_ENVIRONMENT)
            .remove(KEY_LEASE_ID)
            .apply()
    }

    fun getAuthorizedSessionContext(): AuthorizedDeviceSessionContext? {
        val memberId = preferences.getString(KEY_MEMBER_ID, null)?.trim()?.ifBlank { null }
            ?: return null
        val environment = preferences.getString(KEY_ENVIRONMENT, null)?.trim()?.ifBlank { null }
            ?: return null
        val leaseId = preferences.getString(KEY_LEASE_ID, null)?.trim()?.ifBlank { null }
            ?: return null
        return AuthorizedDeviceSessionContext(
            memberId = memberId,
            environment = environment,
            leaseId = leaseId,
        )
    }

    private companion object {
        const val PREFERENCES_NAME = "device_registration"
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_FCM_TOKEN = "fcm_token"
        const val KEY_MEMBER_ID = "member_id"
        const val KEY_ENVIRONMENT = "environment"
        const val KEY_LEASE_ID = "lease_id"
    }
}
