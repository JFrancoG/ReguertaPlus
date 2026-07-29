package com.reguerta.user.data.devices

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.security.KeyStore
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidKeystoreDeviceRegistrationStoreTest {
    @Test
    fun valuesRemainEncryptedAndReadableAfterStoreReconstruction() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val suffix = UUID.randomUUID().toString()
        val preferencesName = "device_registration_test_$suffix"
        val keyAlias = "reguerta_device_registration_test_$suffix"
        val rawPreferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

        try {
            val firstStore = AndroidDeviceRegistrationEncryptedStoreFactory(
                context = context,
                preferencesName = preferencesName,
                keyAlias = keyAlias,
            ).create()
            assertTrue(firstStore.write(mapOf("member_id" to "MEMBER-1")))

            val persisted = checkNotNull(rawPreferences.getString("member_id", null))
            assertFalse(persisted.contains("MEMBER-1"))

            val reconstructedStore = AndroidDeviceRegistrationEncryptedStoreFactory(
                context = context,
                preferencesName = preferencesName,
                keyAlias = keyAlias,
            ).create()
            assertEquals("MEMBER-1", reconstructedStore.getString("member_id"))
        } finally {
            context.deleteSharedPreferences(preferencesName)
            if (keyStore.containsAlias(keyAlias)) {
                keyStore.deleteEntry(keyAlias)
            }
        }
    }
}
