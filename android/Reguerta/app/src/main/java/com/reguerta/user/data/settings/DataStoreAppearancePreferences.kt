package com.reguerta.user.data.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.reguerta.user.ui.theme.AppAppearance
import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

private val Context.appearanceDataStore by preferencesDataStore(
    name = "appearance_preferences",
)

class DataStoreAppearancePreferences(
    private val context: Context,
) {
    val appearance: Flow<AppAppearance> = context.appearanceDataStore.data
        .catch { error ->
            if (error is IOException) {
                emit(androidx.datastore.preferences.core.emptyPreferences())
            } else {
                throw error
            }
        }
        .map { preferences ->
            AppAppearance.fromStorageValue(preferences[AppearanceKey])
        }

    suspend fun setAppearance(appearance: AppAppearance) {
        context.appearanceDataStore.edit { preferences ->
            preferences[AppearanceKey] = appearance.storageValue
        }
    }
}

private val AppearanceKey = stringPreferencesKey("app_appearance")
