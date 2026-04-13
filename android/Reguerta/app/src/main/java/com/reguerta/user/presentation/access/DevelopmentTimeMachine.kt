package com.reguerta.user.presentation.access

import android.content.Context

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
        prefs.edit().apply {
            if (value == null) {
                remove(OverrideNowMillisKey)
            } else {
                putLong(OverrideNowMillisKey, value)
            }
        }.apply()
    }

    fun nowMillis(): Long = overrideNowMillis() ?: System.currentTimeMillis()
}
