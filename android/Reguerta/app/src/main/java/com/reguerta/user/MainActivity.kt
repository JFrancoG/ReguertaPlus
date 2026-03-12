package com.reguerta.user

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
        setContent {
            ReguertaTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    ReguertaRoot(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}
