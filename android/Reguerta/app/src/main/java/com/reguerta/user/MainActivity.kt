package com.reguerta.user

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import com.reguerta.user.presentation.access.ReguertaRoot
import com.reguerta.user.ui.theme.ReguertaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestNotificationsPermissionIfNeeded()
        setContent {
            ReguertaTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    ReguertaRoot(modifier = Modifier.padding(innerPadding))
                }
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
