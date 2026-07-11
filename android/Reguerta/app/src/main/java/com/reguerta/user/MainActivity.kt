package com.reguerta.user

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.reguerta.user.data.settings.DataStoreAppearancePreferences
import com.reguerta.user.presentation.root.ReguertaRoot
import com.reguerta.user.ui.theme.AppAppearance
import com.reguerta.user.ui.theme.ReguertaTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestNotificationsPermissionIfNeeded()
        setContent {
            val appearancePreferences = remember {
                DataStoreAppearancePreferences(applicationContext)
            }
            val appearance by appearancePreferences.appearance.collectAsStateWithLifecycle(
                initialValue = AppAppearance.SYSTEM,
            )
            val scope = rememberCoroutineScope()
            ReguertaTheme(
                darkTheme = appearance.resolvesToDark(isSystemInDarkTheme()),
            ) {
                ReguertaRoot(
                    modifier = Modifier.fillMaxSize(),
                    appAppearance = appearance,
                    onAppAppearanceChanged = { updatedAppearance ->
                        scope.launch {
                            appearancePreferences.setAppearance(updatedAppearance)
                        }
                    },
                )
            }
        }
    }

    private fun requestNotificationsPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }
        if (
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        ActivityCompat.requestPermissions(
            this as Activity,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            NOTIFICATIONS_PERMISSION_REQUEST_CODE,
        )
    }

    private companion object {
        const val NOTIFICATIONS_PERMISSION_REQUEST_CODE = 1001
    }
}
