package com.reguerta.user.presentation.root

import android.content.Context
import androidx.core.content.edit

object DevelopmentTimeMachine {
    private const val PrefsName = "reguerta_dev_time_machine"
    private const val OverrideNowMillisKey = "override_now_millis"
    private var appContext: Context? = null

    fun initialize(context: Context) {
        if (appContext == null) {
            appContext = context.applicationContext
        }
    }

    fun overrideNowMillis(): Long? {
        val context = appContext ?: return null
        val prefs = context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        return if (prefs.contains(OverrideNowMillisKey)) {
            prefs.getLong(OverrideNowMillisKey, System.currentTimeMillis())
        } else {
            null
        }
    }

    fun setOverrideNowMillis(value: Long?) {
        val context = appContext ?: return
        val prefs = context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        prefs.edit {
            if (value == null) {
                remove(OverrideNowMillisKey)
            } else {
                putLong(OverrideNowMillisKey, value)
            }
        }
    }

    fun nowMillis(): Long = overrideNowMillis() ?: System.currentTimeMillis()
}
