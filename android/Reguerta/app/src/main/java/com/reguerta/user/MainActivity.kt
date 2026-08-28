package com.reguerta.user

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
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
import com.reguerta.user.domain.notifications.ShiftNotificationPushReference
import com.reguerta.user.presentation.root.ReguertaRoot
import com.reguerta.user.presentation.root.ReguertaRootActivityStateViewModel
import com.reguerta.user.presentation.root.SessionViewModel
import com.reguerta.user.presentation.root.SessionViewModelFactory
import com.reguerta.user.ui.theme.AppAppearance
import com.reguerta.user.ui.theme.ReguertaTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    internal val sessionViewModel: SessionViewModel by viewModels {
        SessionViewModelFactory(applicationContext)
    }
    internal val rootStateViewModel: ReguertaRootActivityStateViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        acceptShiftNotificationPush(intent)
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
                    viewModel = sessionViewModel,
                    rootStateViewModel = rootStateViewModel,
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        acceptShiftNotificationPush(intent)
    }

    private fun acceptShiftNotificationPush(intent: Intent?) {
        val sourceIntent = intent ?: return
        val reference = ShiftNotificationPushReference.validated(
            eventId = sourceIntent.getStringExtra(PUSH_EVENT_ID_KEY),
            type = sourceIntent.getStringExtra(PUSH_TYPE_KEY),
            target = sourceIntent.getStringExtra(PUSH_TARGET_KEY),
        ) ?: return
        rootStateViewModel.acceptShiftNotificationPush(reference)
        sourceIntent.removeExtra(PUSH_EVENT_ID_KEY)
        sourceIntent.removeExtra(PUSH_TYPE_KEY)
        sourceIntent.removeExtra(PUSH_TARGET_KEY)
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
        const val PUSH_EVENT_ID_KEY = "eventId"
        const val PUSH_TYPE_KEY = "type"
        const val PUSH_TARGET_KEY = "target"
    }
}
