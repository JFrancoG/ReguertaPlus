package com.reguerta.user.data.freshness

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.reguerta.user.domain.freshness.CriticalCollection
import com.reguerta.user.domain.freshness.CriticalDataFreshnessLocalRepository
import com.reguerta.user.domain.freshness.CriticalDataFreshnessMetadata
import kotlinx.coroutines.flow.first

private val Context.criticalDataFreshnessDataStore by preferencesDataStore(
    name = "critical_data_freshness",
)

class DataStoreCriticalDataFreshnessLocalRepository(
    private val context: Context,
) : CriticalDataFreshnessLocalRepository {
    override suspend fun getMetadata(): CriticalDataFreshnessMetadata? {
        val preferences = context.criticalDataFreshnessDataStore.data.first()
        val validatedAtMillis = preferences[ValidatedAtKey] ?: return null
        val timestamps = CriticalCollection.entries.associateWith { collection ->
            preferences[timestampKey(collection)] ?: return null
        }
        return CriticalDataFreshnessMetadata(
            validatedAtMillis = validatedAtMillis,
            acknowledgedTimestampsMillis = timestamps,
        )
    }

    override suspend fun saveMetadata(metadata: CriticalDataFreshnessMetadata) {
        context.criticalDataFreshnessDataStore.edit { preferences ->
            preferences[ValidatedAtKey] = metadata.validatedAtMillis
            CriticalCollection.entries.forEach { collection ->
                preferences[timestampKey(collection)] =
                    metadata.acknowledgedTimestampsMillis.getValue(collection)
            }
        }
    }

    override suspend fun clear() {
        context.criticalDataFreshnessDataStore.edit { preferences ->
            preferences.remove(ValidatedAtKey)
            CriticalCollection.entries.forEach { collection ->
                preferences.remove(timestampKey(collection))
            }
        }
    }
}

private val ValidatedAtKey = longPreferencesKey("validated_at")

private fun timestampKey(collection: CriticalCollection): Preferences.Key<Long> =
    longPreferencesKey("timestamp_${collection.wireKey}")
