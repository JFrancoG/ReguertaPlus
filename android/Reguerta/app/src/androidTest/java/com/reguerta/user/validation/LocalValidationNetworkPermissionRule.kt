package com.reguerta.user.validation

import android.Manifest
import android.os.Build
import androidx.test.rule.GrantPermissionRule
import com.reguerta.user.BuildConfig
import org.junit.rules.TestRule

/** Connected tests reinstall the app, so local SDK access needs a fresh LAN grant. */
internal fun localValidationNetworkPermissionRule(): TestRule =
    if (BuildConfig.LOCAL_VALIDATION && Build.VERSION.SDK_INT >= 37) {
        GrantPermissionRule.grant(Manifest.permission.ACCESS_LOCAL_NETWORK)
    } else {
        TestRule { base, _ -> base }
    }
