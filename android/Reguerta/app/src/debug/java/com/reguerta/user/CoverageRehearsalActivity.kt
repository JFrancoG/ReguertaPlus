package com.reguerta.user

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.reguerta.user.data.shiftcoverage.LocalCoverageRehearsalAccess
import com.reguerta.user.presentation.shiftcoverage.CoverageRehearsalViewModel
import com.reguerta.user.presentation.shiftcoverage.CoverageScreen
import com.reguerta.user.ui.theme.ReguertaTheme

/** Dedicated Debug entry point. It never constructs MainActivity's live session/dependencies. */
class CoverageRehearsalActivity : ComponentActivity() {
    private val model: CoverageRehearsalViewModel by viewModels {
        viewModelFactory { initializer { CoverageRehearsalViewModel(LocalCoverageRehearsalAccess()) } }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { ReguertaTheme { CoverageScreen(model) } }
    }
}
