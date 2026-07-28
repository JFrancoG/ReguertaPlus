package com.reguerta.user.data.freshness

import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.reguerta.user.domain.freshness.CriticalCollection
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.CriticalDataFreshnessMetadata
import com.reguerta.user.domain.freshness.CriticalDataFreshnessMetadataWrite
import kotlinx.coroutines.flow.first

private val Context.criticalDataFreshnessDataStore by preferencesDataStore(
    name = "critical_data_freshness",
)

class DataStoreCriticalDataFreshnessLocalRepository(
    private val context: Context,
) : CriticalDataFreshnessLocalRepository {
    override suspend fun getMetadata(): CriticalDataFreshnessMetadata? {
        val preferences = context.criticalDataFreshnessDataStore.data.first()
        val environment = preferences[EnvironmentKey] ?: return null
        val validatedAtMillis = preferences[ValidatedAtKey] ?: return null
        val timestamps = CriticalCollection.entries.associateWith { collection ->
            preferences[timestampKey(collection)] ?: return null
        }
        return CriticalDataFreshnessMetadata(
            environment = environment,
            validatedAtMillis = validatedAtMillis,
            acknowledgedTimestampsMillis = timestamps,
        )
    }

    override suspend fun saveMetadataIfCurrent(
        write: CriticalDataFreshnessMetadataWrite,
        isCurrent: () -> Boolean,
    ): Boolean {
        var didSave = false
        context.criticalDataFreshnessDataStore.edit { preferences ->
            if (!isCurrent()) return@edit
            preferences[WriteIdKey] = write.id
            preferences[EnvironmentKey] = write.metadata.environment
            preferences[ValidatedAtKey] = write.metadata.validatedAtMillis
            CriticalCollection.entries.forEach { collection ->
                preferences[timestampKey(collection)] =
                    write.metadata.acknowledgedTimestampsMillis.getValue(collection)
            }
            didSave = true
        }
        return didSave
    }

    override suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite) {
        context.criticalDataFreshnessDataStore.edit { preferences ->
            if (preferences[WriteIdKey] != write.id) return@edit
            preferences.clearFreshnessMetadata()
        }
    }

    override suspend fun clear() {
        context.criticalDataFreshnessDataStore.edit { preferences ->
            preferences.clearFreshnessMetadata()
        }
    }
}

private val WriteIdKey = stringPreferencesKey("write_id")
private val EnvironmentKey = stringPreferencesKey("environment")
private val ValidatedAtKey = longPreferencesKey("validated_at")

private fun timestampKey(collection: CriticalCollection): Preferences.Key<Long> =
    longPreferencesKey("timestamp_${collection.wireKey}")

private fun MutablePreferences.clearFreshnessMetadata() {
    remove(WriteIdKey)
    remove(EnvironmentKey)
    remove(ValidatedAtKey)
    CriticalCollection.entries.forEach { collection ->
        remove(timestampKey(collection))
    }
}
